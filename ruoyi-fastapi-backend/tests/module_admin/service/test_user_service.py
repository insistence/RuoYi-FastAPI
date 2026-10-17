from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from common.enums import PasswordCharacterType
from exceptions.exception import ServiceException
from module_admin.dao.user_dao import UserDao
from module_admin.entity.vo.user_vo import EditUserModel
from module_admin.service.user_service import UserService


@pytest.mark.asyncio
@pytest.mark.parametrize('readonly_fields', [{}, {'role': [{'roleId': 2}]}], ids=['react-form', 'vue-form'])
async def test_edit_user_accepts_form_without_readonly_roles(
    monkeypatch: pytest.MonkeyPatch, readonly_fields: dict
) -> None:
    """编辑表单可以省略只读角色详情，用户字段与角色/岗位关联仍全部保存。"""
    user = EditUserModel(userId=2, userName='tester', sex='1', roleIds=[2], postIds=[1], **readonly_fields)
    database = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
    monkeypatch.setattr(UserService, 'user_detail_services', AsyncMock(return_value=SimpleNamespace(data=user)))
    monkeypatch.setattr(UserService, 'check_user_name_unique_services', AsyncMock(return_value=True))
    security_event = AsyncMock()
    monkeypatch.setattr(UserService, '_handle_edit_identity_security_event', security_event)
    operations = {}
    for name in (
        'edit_user_dao',
        'delete_user_role_dao',
        'delete_user_post_dao',
        'add_user_role_dao',
        'add_user_post_dao',
    ):
        operations[name] = AsyncMock()
        monkeypatch.setattr(UserDao, name, operations[name])

    result = await UserService.edit_user_services(database, user)

    assert result.is_success is True
    operations['edit_user_dao'].assert_awaited_once_with(database, {'user_id': 2, 'user_name': 'tester', 'sex': '1'})
    for operation in operations.values():
        operation.assert_awaited_once()
    assert operations['add_user_role_dao'].await_args.args[1].role_id == user.role_ids[0]
    assert operations['add_user_post_dao'].await_args.args[1].post_id == user.post_ids[0]
    security_event.assert_awaited_once_with(database, user, user)
    database.commit.assert_awaited_once()
    database.rollback.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('pwd_chrtype', 'password'),
    [
        ('0', 'Abc123!'),
        ('1', '123456'),
        ('2', 'Abcdef'),
        ('3', 'Abc123'),
        ('4', 'Abc123!'),
    ],
)
async def test_validate_password_accepts_each_character_type(pwd_chrtype: str, password: str) -> None:
    redis = SimpleNamespace(get=AsyncMock(return_value=pwd_chrtype))

    await UserService.validate_password_services(redis, password)

    redis.get.assert_awaited_once_with('sys_config:sys.account.chrtype')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('pwd_chrtype', 'password', 'message'),
    [
        ('0', 'Abc<123', '密码不能包含非法字符：< > " \' \\ |'),
        ('1', '12345a', '密码只能为数字（0-9）'),
        ('2', 'Abc123', '密码只能为英文字母（a-z、A-Z）'),
        ('3', 'Abcdef', '密码必须同时包含字母和数字'),
        ('4', 'Abc123', '密码必须同时包含字母、数字和特殊字符（~!@#$%^&*()-=_+）'),
    ],
)
async def test_validate_password_rejects_invalid_character_type(pwd_chrtype: str, password: str, message: str) -> None:
    redis = SimpleNamespace(get=AsyncMock(return_value=pwd_chrtype))

    with pytest.raises(ServiceException) as exc_info:
        await UserService.validate_password_services(redis, password)

    assert exc_info.value.message == message


@pytest.mark.asyncio
@pytest.mark.parametrize('password', ['12345', '123456789012345678901'])
async def test_validate_password_rejects_invalid_length(password: str) -> None:
    redis = SimpleNamespace(get=AsyncMock(return_value='0'))

    with pytest.raises(ServiceException) as exc_info:
        await UserService.validate_password_services(redis, password)

    assert exc_info.value.message == '密码长度必须介于 6 和 20 之间'


@pytest.mark.asyncio
async def test_validate_password_uses_fixed_rule_without_reading_config() -> None:
    redis = SimpleNamespace(get=AsyncMock(return_value='4'))

    await UserService.validate_password_services(redis, 'abcdef', PasswordCharacterType.DEFAULT)

    redis.get.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('config_value', [None, '', 'invalid'])
async def test_validate_password_falls_back_to_default_rule(config_value: str | None) -> None:
    redis = SimpleNamespace(get=AsyncMock(return_value=config_value))

    await UserService.validate_password_services(redis, 'abcdef')
