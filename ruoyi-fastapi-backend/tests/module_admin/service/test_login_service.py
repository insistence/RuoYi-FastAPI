from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi import Request
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from common.enums import PasswordCharacterType
from config.env import JwtConfig
from exceptions.exception import AuthException, ServiceException
from module_admin.dao.user_dao import UserDao
from module_admin.entity.vo.login_vo import UserRegister
from module_admin.entity.vo.user_vo import CurrentUserModel, ResetUserModel, UserInfoModel
from module_admin.service.login_service import LoginService
from module_admin.service.user_service import UserService
from tests.module_admin.service.helpers import make_current_user, make_query_db, make_redis_request
from utils.pwd_util import PwdUtil


@pytest.mark.asyncio
@pytest.mark.parametrize(('config_value', 'expected'), [(None, '0'), ('4', '4')])
async def test_get_sys_account_chrtype_uses_config_and_default(config_value: str | None, expected: str) -> None:
    """密码字符类型取自配置并支持默认值。"""
    redis = SimpleNamespace(get=AsyncMock(return_value=config_value))
    request = make_redis_request(redis)

    result = await LoginService.get_sys_account_chrtype(request)

    assert result == expected
    redis.get.assert_awaited_once_with('sys_config:sys.account.chrtype')


def test_current_user_model_exposes_password_character_type_alias() -> None:
    """当前用户模型公开密码字符类型的别名。"""
    current_user = CurrentUserModel(
        permissions=[], roles=[], user=UserInfoModel(user_id=1, user_name='admin'), pwd_chrtype='3'
    )

    assert current_user.model_dump(by_alias=True)['pwdChrtype'] == '3'


@pytest.mark.asyncio
async def test_get_current_user_rejects_malformed_user_id_claim() -> None:
    """当前用户认证拒绝格式错误的用户标识声明。"""
    token = jwt.encode(
        {'user_id': 'invalid', 'session_id': 'session-id'},
        JwtConfig.jwt_secret_key,
        algorithm=JwtConfig.jwt_algorithm,
    )

    with (
        patch.object(UserDao, 'get_user_by_id', new_callable=AsyncMock) as get_user,
        pytest.raises(AuthException) as exc_info,
    ):
        await LoginService.get_current_user(Request({'type': 'http'}), token, make_query_db())

    assert exc_info.value.message == '用户token已失效，请重新登录'
    get_user.assert_not_awaited()


@pytest.mark.asyncio
async def test_unlock_screen_rejects_empty_password() -> None:
    """解锁屏幕拒绝空密码。"""
    with (
        patch.object(UserDao, 'get_user_by_name', new_callable=AsyncMock) as get_user,
        pytest.raises(ServiceException) as exc_info,
    ):
        await LoginService.unlock_screen_services(make_query_db(), make_current_user(1, user_name='admin'), '')

    assert exc_info.value.message == '密码不能为空'
    get_user.assert_not_awaited()


@pytest.mark.asyncio
async def test_unlock_screen_rejects_missing_current_user() -> None:
    """解锁屏幕时必须有当前用户。"""
    with (
        patch.object(UserDao, 'get_user_by_name', new=AsyncMock(return_value=None)) as get_user,
        pytest.raises(ServiceException) as exc_info,
    ):
        await LoginService.unlock_screen_services(make_query_db(), make_current_user(1, user_name='admin'), 'password')

    assert exc_info.value.message == '服务器超时，请重新登录'
    get_user.assert_awaited_once()


@pytest.mark.asyncio
async def test_unlock_screen_rejects_wrong_password() -> None:
    """解锁屏幕拒绝错误密码。"""
    user = SimpleNamespace(password='hashed-password')
    with (
        patch.object(UserDao, 'get_user_by_name', new=AsyncMock(return_value=user)),
        patch.object(PwdUtil, 'verify_password', return_value=False) as verify_password,
        pytest.raises(ServiceException) as exc_info,
    ):
        await LoginService.unlock_screen_services(
            make_query_db(), make_current_user(1, user_name='admin'), 'wrong-password'
        )

    assert exc_info.value.message == '密码错误，请重新输入'
    verify_password.assert_called_once_with('wrong-password', 'hashed-password')


@pytest.mark.asyncio
async def test_unlock_screen_accepts_correct_password() -> None:
    """正确密码可以解锁屏幕。"""
    user = SimpleNamespace(password='hashed-password')
    with (
        patch.object(UserDao, 'get_user_by_name', new=AsyncMock(return_value=user)) as get_user,
        patch.object(PwdUtil, 'verify_password', return_value=True) as verify_password,
    ):
        result = await LoginService.unlock_screen_services(
            make_query_db(), make_current_user(1, user_name='ry'), 'correct-password'
        )

    assert result is True
    get_user.assert_awaited_once()
    assert get_user.await_args_list[-1].args[1] == 'ry'
    verify_password.assert_called_once_with('correct-password', 'hashed-password')


@pytest.mark.asyncio
async def test_register_uses_front_end_default_password_rule() -> None:
    """注册使用前端默认的密码规则。"""
    redis = SimpleNamespace(get=AsyncMock(side_effect=['true', 'false']))
    request = make_redis_request(redis)
    user_register = UserRegister(
        username='test_user',
        password='abcdef',
        confirm_password='abcdef',
    )
    expected = object()

    with (
        patch.object(UserService, 'validate_password_services', new_callable=AsyncMock) as validate_password,
        patch.object(UserService, 'add_user_services', new=AsyncMock(return_value=expected)),
        patch.object(PwdUtil, 'get_password_hash', return_value='hashed-password'),
    ):
        result = await LoginService.register_user_services(request, make_query_db(), user_register)

    assert result is expected
    validate_password.assert_awaited_once_with(redis, 'abcdef', PasswordCharacterType.DEFAULT)


@pytest.mark.parametrize('profile', [None, {}, {'userId': 1}, {'userName': 'reader'}])
def test_current_user_requires_identity(profile: dict | None) -> None:
    """受保护操作应拒绝缺少用户资料的快照。"""
    with pytest.raises(ValidationError):
        CurrentUserModel.model_validate({'permissions': [], 'roles': [], 'user': profile})


@pytest.mark.asyncio
async def test_password_recovery_passes_validated_password_to_reset_service() -> None:
    """校验短信验证码后将原始密码交给负责哈希和保存的服务。"""
    request = MagicMock(spec=Request)
    request.app.state.redis.get = AsyncMock(return_value='123456')
    user_id = 3
    reset = ResetUserModel.model_validate(
        {'userName': 'reader', 'password': 'new-password', 'smsCode': '123456', 'sessionId': 'session'}
    )
    async with AsyncSession() as db:
        with (
            patch.object(UserDao, 'get_user_by_name', new=AsyncMock(return_value=SimpleNamespace(user_id=user_id))),
            patch.object(UserService, 'validate_password_services', new_callable=AsyncMock),
            patch.object(UserService, 'reset_user_services', new_callable=AsyncMock) as save,
        ):
            result = await LoginService.forget_user_services(request, db, reset)
            save.assert_awaited_once_with(db, reset)
    assert result is save.return_value
    assert reset.password == 'new-password'
    assert reset.user_id == user_id


@pytest.mark.asyncio
async def test_password_recovery_requires_an_existing_code() -> None:
    """缓存和请求均缺少验证码时按过期处理。"""
    request = MagicMock(spec=Request)
    request.app.state.redis.get = AsyncMock(return_value=None)
    async with AsyncSession() as db:
        with patch.object(UserService, 'reset_user_services', new_callable=AsyncMock) as save:
            result = await LoginService.forget_user_services(request, db, ResetUserModel())
    assert not result.is_success
    save.assert_not_awaited()
