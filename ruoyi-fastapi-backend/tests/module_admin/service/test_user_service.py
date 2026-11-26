from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from redis.asyncio import Redis
from sqlalchemy import true
from sqlalchemy.ext.asyncio import AsyncSession

from common.enums import PasswordCharacterType
from common.vo import PageModel
from exceptions.exception import ServiceException
from module_admin.dao.user_dao import UserDao
from module_admin.entity.vo.user_vo import EditUserModel, UserInfoModel, UserRolePageQueryModel
from module_admin.service.post_service import PostService
from module_admin.service.role_service import RoleService
from module_admin.service.user_service import UserService
from tests.module_admin.service.helpers import make_query_db


@pytest.mark.asyncio
@pytest.mark.parametrize('readonly_fields', [{}, {'role': [{'roleId': 2}]}], ids=['react-form', 'vue-form'])
async def test_edit_user_accepts_form_without_readonly_roles(
    monkeypatch: pytest.MonkeyPatch, readonly_fields: dict[str, object]
) -> None:
    """编辑表单可以省略只读角色详情，用户字段与角色/岗位关联仍全部保存。"""
    user = EditUserModel.model_validate(
        {'user_id': 2, 'user_name': 'tester', 'sex': '1', 'role_ids': [2], 'post_ids': [1], **readonly_fields}
    )
    database = make_query_db()
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
    assert user.role_ids
    assert operations['add_user_role_dao'].await_args_list[-1].args[1].role_id == user.role_ids[0]
    assert user.post_ids
    assert operations['add_user_post_dao'].await_args_list[-1].args[1].post_id == user.post_ids[0]
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
    """密码校验接受各类允许的字符。"""
    redis = MagicMock(spec_set=Redis)
    redis.get = AsyncMock(return_value=pwd_chrtype)

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
    """密码校验拒绝不允许的字符类型。"""
    redis = MagicMock(spec_set=Redis)
    redis.get = AsyncMock(return_value=pwd_chrtype)

    with pytest.raises(ServiceException) as exc_info:
        await UserService.validate_password_services(redis, password)

    assert exc_info.value.message == message


@pytest.mark.asyncio
@pytest.mark.parametrize('password', ['12345', '123456789012345678901'])
async def test_validate_password_rejects_invalid_length(password: str) -> None:
    """密码校验拒绝无效长度。"""
    redis = MagicMock(spec_set=Redis)
    redis.get = AsyncMock(return_value='0')

    with pytest.raises(ServiceException) as exc_info:
        await UserService.validate_password_services(redis, password)

    assert exc_info.value.message == '密码长度必须介于 6 和 20 之间'


@pytest.mark.asyncio
async def test_validate_password_uses_fixed_rule_without_reading_config() -> None:
    """指定固定密码规则时无需读取配置。"""
    redis = MagicMock(spec_set=Redis)
    redis.get = AsyncMock(return_value='4')

    await UserService.validate_password_services(redis, 'abcdef', PasswordCharacterType.DEFAULT)

    redis.get.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('config_value', [None, '', 'invalid'])
async def test_validate_password_falls_back_to_default_rule(config_value: str | None) -> None:
    """密码校验支持回退到默认规则。"""
    redis = MagicMock(spec_set=Redis)
    redis.get = AsyncMock(return_value=config_value)

    await UserService.validate_password_services(redis, 'abcdef')


@pytest.mark.asyncio
@pytest.mark.parametrize('allocated', [True, False])
async def test_role_user_lists_support_paged_and_unpaged_queries(
    monkeypatch: pytest.MonkeyPatch, allocated: bool
) -> None:
    """验证已分配和未分配用户列表均保留分页信息，并支持默认的不分页查询。"""
    rows = [{'userId': 3, 'userName': 'reader'}]
    page = PageModel(rows=rows, page_num=2, page_size=1, total=3, has_next=True)
    fetch = AsyncMock(side_effect=[rows, page])
    if allocated:
        monkeypatch.setattr(UserDao, 'get_user_role_allocated_list_by_role_id', fetch)
        list_users = RoleService.get_role_user_allocated_list_services
    else:
        monkeypatch.setattr(UserDao, 'get_user_role_unallocated_list_by_role_id', fetch)
        list_users = RoleService.get_role_user_unallocated_list_services
    query = UserRolePageQueryModel.model_validate({'roleId': 2})
    async with AsyncSession() as db:
        users = await list_users(db, query, true())
        paged_users = await list_users(db, query, true(), is_page=True)
    assert users == [UserInfoModel(user_id=3, user_name='reader')]
    assert paged_users.rows == users
    assert (paged_users.page_num, paged_users.page_size, paged_users.total, paged_users.has_next) == (2, 1, 3, True)
    assert [call.args[-1] for call in fetch.await_args_list] == [False, True]


@pytest.mark.asyncio
async def test_missing_user_has_no_profile_or_role_details(monkeypatch: pytest.MonkeyPatch) -> None:
    """用户不存在时，详情、个人资料和角色选择接口均返回空的用户资料。"""
    missing = {
        'user_basic_info': None,
        'user_dept_info': None,
        'user_post_info': [],
        'user_role_info': [],
        'user_menu_info': [],
    }
    monkeypatch.setattr(UserDao, 'get_user_detail_by_id', AsyncMock(return_value=missing))
    monkeypatch.setattr(PostService, 'get_post_list_services', AsyncMock(return_value=[]))
    monkeypatch.setattr(RoleService, 'get_role_select_option_services', AsyncMock(return_value=[]))
    async with AsyncSession() as db:
        detail = await UserService.user_detail_services(db, 2)
        profile = await UserService.user_profile_services(db, 2)
        roles = await UserService.get_user_role_allocated_list_services(db, UserRolePageQueryModel(user_id=2))
    assert detail.data is None
    assert profile.data is None
    assert roles.user is None
