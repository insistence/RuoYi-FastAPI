from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import delete, update
from sqlalchemy.orm import aliased

from common.constant import HttpStatusConstant
from module_admin.dao.user_dao import UserDao
from module_admin.entity.do.menu_do import SysMenu
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.user_vo import UserPostModel, UserRoleModel
from module_admin.service.user_service import UserService
from plugins.core.management.dao.dao import PluginDao
from tests.module_admin.service.test_current_user_cache_integration import (
    cache_env,  # noqa: F401
    cache_redis,  # noqa: F401
    redis_socket,  # noqa: F401
    resolution_env,  # noqa: F401
)
from tests.module_admin.service.test_current_user_resolution import ADMIN_ID, REGULAR_QUERY_COUNT, USER_ID
from utils.cache_util import CurrentUserCacheUtil
from utils.time_util import TimezoneUtil


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'changes, expected',
    [
        (
            {'nick_name': 'Updated reader', 'email': 'reader@example.com', 'phonenumber': '13800000000', 'sex': '1'},
            {'nickName': 'Updated reader', 'email': 'reader@example.com', 'phonenumber': '13800000000', 'sex': '1'},
        ),
        ({'avatar': '/profile/avatar/reader.png'}, {'avatar': '/profile/avatar/reader.png'}),
        ({'dept_id': None}, {'deptId': None, 'dept': None}),
        ({'login_ip': '127.0.0.2'}, {'loginIp': '127.0.0.2'}),
    ],
)
async def test_user_dao_updates_refresh_profile_without_invalidating_other_users(
    cache_env: SimpleNamespace,  # noqa: F811
    changes: dict[str, Any],
    expected: dict[str, Any],
) -> None:
    for user_id in (ADMIN_ID, USER_ID):
        await cache_env.client.get('/profile', headers=cache_env.headers[user_id])
    async with cache_env.sessions.begin() as db:
        await UserDao.edit_user_dao(db, {'user_id': USER_ID, **changes})
    cache_env.statements.clear()

    admin = await cache_env.client.get('/profile', headers=cache_env.headers[ADMIN_ID])
    assert admin.json()['user']['nickName'] == 'Admin'
    assert cache_env.statements == []
    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    for name, value in expected.items():
        assert response.json()['user'][name] == value
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT


@pytest.mark.asyncio
async def test_timezone_service_commit_refreshes_cached_preference(cache_env: SimpleNamespace) -> None:  # noqa: F811
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    async with cache_env.sessions() as db:
        result = await UserService.update_user_timezone_services(db, USER_ID, 'reader', 'Europe/London')
    assert result.is_success

    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert response.json()['user']['timeZone'] == 'Europe/London'
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT * 2


@pytest.mark.asyncio
@pytest.mark.parametrize('mutation', ['bulk', 'orm'])
async def test_password_changes_refresh_policy_without_caching_hash(
    cache_env: SimpleNamespace,  # noqa: F811
    mutation: str,
) -> None:
    await cache_env.redis.set('sys_config:sys.account.initPasswordModify', '1')
    first = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert first.json()['isDefaultModifyPwd']
    changed_at = TimezoneUtil.utc_now()
    async with cache_env.sessions.begin() as db:
        if mutation == 'bulk':
            await UserDao.edit_user_dao(
                db, {'user_id': USER_ID, 'password': 'changed-password-hash', 'pwd_update_date': changed_at}
            )
        else:
            # 认证中心改密使用ORM对象赋值，提交时同样需要失效用户快照。
            user = await db.get(SysUser, USER_ID)
            user.password = 'changed-password-hash'
            user.pwd_update_date = changed_at
    cache_env.statements.clear()

    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert not response.json()['isDefaultModifyPwd']
    assert response.json()['user']['pwdUpdateDate'] is not None
    assert response.json()['user']['password'] is None
    key = CurrentUserCacheUtil._keys(cache_env.namespace, USER_ID)[2]
    assert 'changed-password-hash' not in await cache_env.redis.hget(key, 'payload')
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT


@pytest.mark.asyncio
async def test_user_role_assignment_and_revocation_refresh_admin_permission(
    cache_env: SimpleNamespace,  # noqa: F811
) -> None:
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assignment = UserRoleModel(userId=USER_ID, roleId=ADMIN_ID)
    async with cache_env.sessions.begin() as db:
        await UserDao.add_user_role_dao(db, assignment)

    elevated = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert elevated.json()['permissions'] == ['*:*:*']
    assert set(elevated.json()['roles']) == {'admin', 'reader'}

    async with cache_env.sessions.begin() as db:
        await UserDao.delete_user_role_by_user_and_role_dao(db, assignment)
    revoked = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert revoked.json()['permissions'] == ['demo:read']
    assert revoked.json()['roles'] == ['reader']


@pytest.mark.asyncio
async def test_user_post_removal_and_assignment_refresh_cached_post_ids(cache_env: SimpleNamespace) -> None:  # noqa: F811
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assignment = UserPostModel(userId=USER_ID, postId=USER_ID)
    async with cache_env.sessions.begin() as db:
        await UserDao.delete_user_post_dao(db, assignment)

    removed = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert removed.json()['user']['postIds'] == ''

    async with cache_env.sessions.begin() as db:
        await UserDao.add_user_post_dao(db, assignment)
    added = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert added.json()['user']['postIds'] == str(USER_ID)


@pytest.mark.asyncio
@pytest.mark.parametrize('mutation', ['edit', 'disable', 'uninstall'])
async def test_plugin_menu_mutations_revoke_cached_permission(
    cache_env: SimpleNamespace,  # noqa: F811
    mutation: str,
) -> None:
    await cache_env.client.get('/permitted', headers=cache_env.headers[USER_ID])
    async with cache_env.sessions.begin() as db:
        if mutation == 'edit':
            await PluginDao.update_sys_menu(db, {'menu_id': USER_ID, 'perms': 'demo:new'})
        elif mutation == 'disable':
            await PluginDao.update_sys_menu_status_by_ids(db, [USER_ID], '1')
        else:
            await PluginDao.delete_sys_menus_by_ids(db, [USER_ID])

    response = await cache_env.client.get('/permitted', headers=cache_env.headers[USER_ID])

    assert response.json()['code'] == HttpStatusConstant.FORBIDDEN
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT * 2


@pytest.mark.asyncio
@pytest.mark.parametrize('alias_type', ['orm', 'core'])
@pytest.mark.parametrize('target_name', ['user', 'menu'])
@pytest.mark.parametrize('mutation', ['update', 'delete'])
async def test_aliased_mutations_refresh_cached_user_and_permissions(
    cache_env: SimpleNamespace,  # noqa: F811
    alias_type: str,
    target_name: str,
    mutation: str,
) -> None:
    first = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert first.json()['permissions'] == ['demo:read']
    model = SysUser if target_name == 'user' else SysMenu
    target = aliased(model, name='cache_target') if alias_type == 'orm' else model.__table__.alias('cache_target')
    columns = target if alias_type == 'orm' else target.c
    target_id = columns.user_id if target_name == 'user' else columns.menu_id
    if mutation == 'update':
        values = {'nick_name': 'Alias updated reader'} if target_name == 'user' else {'perms': 'demo:updated'}
        statement = update(target).where(target_id == USER_ID).values(**values)
    else:
        statement = delete(target).where(target_id == USER_ID)
    async with cache_env.sessions.begin() as db:
        await db.execute(statement.execution_options(synchronize_session=False))
    cache_env.statements.clear()

    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    if target_name == 'user':
        if mutation == 'update':
            assert response.json()['user']['nickName'] == 'Alias updated reader'
        else:
            assert response.json()['code'] == HttpStatusConstant.UNAUTHORIZED
    else:
        assert response.json()['permissions'] == (['demo:updated'] if mutation == 'update' else [])
        denied = await cache_env.client.get('/permitted', headers=cache_env.headers[USER_ID])
        assert denied.json()['code'] == HttpStatusConstant.FORBIDDEN
    assert cache_env.statements


@pytest.mark.asyncio
@pytest.mark.filterwarnings('ignore:UPDATE statement has a cartesian product:sqlalchemy.exc.SAWarning')
async def test_alias_update_with_original_table_condition_refreshes_all_affected_users(
    cache_env: SimpleNamespace,  # noqa: F811
) -> None:
    for user_id in (ADMIN_ID, USER_ID):
        response = await cache_env.client.get('/profile', headers=cache_env.headers[user_id])
        assert response.json()['user']['userId'] == user_id
    target = SysUser.__table__.alias('cache_target')
    async with cache_env.sessions.begin() as db:
        # 条件引用原表，匹配管理员时会更新别名目标中的全部用户。
        await db.execute(
            update(target).where(SysUser.user_id == ADMIN_ID).values(nick_name='All alias targets updated')
        )
    cache_env.statements.clear()

    for user_id in (ADMIN_ID, USER_ID):
        response = await cache_env.client.get('/profile', headers=cache_env.headers[user_id])
        assert response.json()['user']['nickName'] == 'All alias targets updated'
    assert cache_env.statements
