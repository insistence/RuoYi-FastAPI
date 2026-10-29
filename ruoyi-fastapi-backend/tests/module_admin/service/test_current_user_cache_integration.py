import asyncio
from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Annotated, Any
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import Depends, Request
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from common.aspect.db_session import DBSessionDependency, get_db_session_provider
from common.aspect.interface_auth import UserInterfaceAuthDependency
from common.aspect.pre_auth import CurrentUserDependency, PreAuthDependency
from common.constant import HttpStatusConstant
from common.context import RequestContext
from config.database import CurrentUserCacheSession, create_async_session_factory
from config.env import AppConfig
from config.get_redis import RedisUtil
from module_admin.entity.do.dept_do import SysDept
from module_admin.entity.do.menu_do import SysMenu
from module_admin.entity.do.post_do import SysPost
from module_admin.entity.do.role_do import SysRole, SysRoleMenu
from module_admin.entity.do.user_do import SysUser, SysUserPost, SysUserRole
from module_admin.entity.vo.user_vo import CurrentUserModel
from module_admin.service.login_service import _SESSION_RENEW_SCRIPT, LoginService
from tests.module_admin.service.test_current_user_resolution import (
    ADMIN_ID,
    ADMIN_QUERY_COUNT,
    REGULAR_QUERY_COUNT,
    TWO_AUTHENTICATIONS,
    USER_ID,
    resolution_env,  # noqa: F401
)
from tests.utils.test_current_user_cache_util import cache_redis, redis_socket  # noqa: F401
from utils.cache_util import CurrentUserCacheUtil

THREE_AUTHENTICATIONS = 3
FOUR_AUTHENTICATIONS = 4


@pytest_asyncio.fixture
async def cache_env(
    resolution_env: SimpleNamespace,  # noqa: F811
    cache_redis: Redis,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[SimpleNamespace]:
    """复用真实鉴权路由和数据库，缓存及会话命令均由隔离Redis执行。"""
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', True)
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_ttl_seconds', 5)
    for key, value in resolution_env.redis.values.items():
        await cache_redis.set(key, value, ex=3600)
    resolution_env.app.state.redis = cache_redis
    engine = resolution_env.sessions.kw['bind']
    sessions = create_async_session_factory(engine)
    sessions.configure(info={CurrentUserCacheSession._REDIS_KEY: cache_redis})
    namespace = CurrentUserCacheUtil.namespace_for_bind(engine)
    assert namespace is not None
    calls = []
    original_eval = cache_redis.eval

    async def record_eval(script: str, *args: Any) -> Any:
        calls.append(script)
        return await original_eval(script, *args)

    async def session_dependency() -> AsyncIterator[AsyncSession]:
        async with sessions() as db:
            yield db

    monkeypatch.setattr(cache_redis, 'eval', record_eval)
    monkeypatch.setattr(
        RedisUtil, 'create_redis_pool', AsyncMock(side_effect=AssertionError('应用会话应复用已有Redis客户端'))
    )
    resolution_env.app.dependency_overrides[get_db_session_provider(None)] = session_dependency
    yield SimpleNamespace(
        **{
            **vars(resolution_env),
            'redis': cache_redis,
            'sessions': sessions,
            'namespace': namespace,
            'calls': calls,
            'renew_count': lambda: calls.count(_SESSION_RENEW_SCRIPT),
        }
    )


@pytest.mark.asyncio
async def test_cache_hit_avoids_sql_and_still_renews_the_session(cache_env: SimpleNamespace) -> None:
    first = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert first.status_code == HttpStatusConstant.SUCCESS
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    snapshot_key = CurrentUserCacheUtil._keys(cache_env.namespace, USER_ID)[2]
    deadline = await cache_env.redis.hget(snapshot_key, 'deadline')

    second = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert second.json() == first.json()
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == TWO_AUTHENTICATIONS
    assert await cache_env.redis.hget(snapshot_key, 'deadline') == deadline
    assert 'private-password-hash' not in await cache_env.redis.hget(snapshot_key, 'payload')


@pytest.mark.asyncio
async def test_cache_hit_recomputes_password_policy(
    cache_env: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert not first.json()['isPasswordExpired']
    await cache_env.redis.mset(
        {
            'sys_config:sys.account.chrtype': '4',
            'sys_config:sys.account.initPasswordModify': '1',
            'sys_config:sys.account.passwordValidateDays': '1',
        }
    )
    monkeypatch.setattr(AppConfig, 'app_timezone', 'UTC')

    second = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert second.json()['pwdChrtype'] == '4'
    assert second.json()['isDefaultModifyPwd']
    assert second.json()['isPasswordExpired']
    assert second.json()['appTimezone'] == 'UTC'
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT


@pytest.mark.asyncio
async def test_concurrent_cache_hits_keep_users_and_context_separate(cache_env: SimpleNamespace) -> None:
    for user_id in (ADMIN_ID, USER_ID):
        await cache_env.client.get('/profile', headers=cache_env.headers[user_id])
    initial_queries = len(cache_env.statements)
    admin, user = await asyncio.gather(
        cache_env.client.get('/profile', headers=cache_env.headers[ADMIN_ID]),
        cache_env.client.get('/profile', headers=cache_env.headers[USER_ID]),
    )

    assert admin.json()['user']['userId'] == ADMIN_ID
    assert admin.json()['permissions'] == ['*:*:*']
    assert user.json()['user']['userId'] == USER_ID
    assert user.json()['permissions'] == ['demo:read']
    assert initial_queries == ADMIN_QUERY_COUNT + REGULAR_QUERY_COUNT
    assert len(cache_env.statements) == initial_queries
    assert cache_env.renew_count() == FOUR_AUTHENTICATIONS


@pytest.mark.asyncio
@pytest.mark.parametrize('replacement', [None, 'new-login-token'])
async def test_cache_hit_never_accepts_revoked_or_replaced_token(
    cache_env: SimpleNamespace, replacement: str | None
) -> None:
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    token_key = f'access_token:session-{USER_ID}'
    if replacement is None:
        await cache_env.redis.delete(token_key)
    else:
        await cache_env.redis.set(token_key, replacement, ex=60)

    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert response.json()['code'] == HttpStatusConstant.UNAUTHORIZED
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == 1
    assert await cache_env.redis.get(token_key) == replacement


@pytest.mark.asyncio
async def test_use_cache_false_reauthenticates_even_when_both_calls_hit_cache(cache_env: SimpleNamespace) -> None:
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    @cache_env.app.get('/revalidate-cached', dependencies=[PreAuthDependency()])
    async def revalidate(
        first: Annotated[CurrentUserModel, CurrentUserDependency()],
        second: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
    ) -> dict:
        return {'sameUser': first is second, 'contextIsFresh': RequestContext.get_current_user() is second}

    response = await cache_env.client.get('/revalidate-cached', headers=cache_env.headers[USER_ID])

    assert response.json() == {'sameUser': False, 'contextIsFresh': True}
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == THREE_AUTHENTICATIONS


@pytest.mark.asyncio
async def test_cached_use_cache_false_rejects_session_revoked_between_dependencies(cache_env: SimpleNamespace) -> None:
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    async def revoke(current_user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> None:
        await cache_env.redis.delete(f'access_token:session-{current_user.user.user_id}')

    @cache_env.app.get('/revoke-cached', dependencies=[PreAuthDependency(), Depends(revoke)])
    async def revalidate(
        current_user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
    ) -> None:
        pytest.fail('已撤销会话不应进入接口')

    response = await cache_env.client.get('/revoke-cached', headers=cache_env.headers[USER_ID])

    assert response.json()['code'] == HttpStatusConstant.UNAUTHORIZED
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == TWO_AUTHENTICATIONS


@pytest.mark.asyncio
async def test_cached_use_cache_false_applies_permission_change_between_dependencies(
    cache_env: SimpleNamespace,
) -> None:
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    async def revoke(
        current_user: Annotated[CurrentUserModel, CurrentUserDependency()],
        query_db: Annotated[AsyncSession, DBSessionDependency()],
    ) -> None:
        await query_db.execute(delete(SysRoleMenu).where(SysRoleMenu.role_id == USER_ID))
        await query_db.commit()

    @cache_env.app.get('/revoke-cached-permission', dependencies=[PreAuthDependency(), Depends(revoke)])
    async def revalidate(
        current_user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
        permitted: Annotated[bool, UserInterfaceAuthDependency('demo:read')],
    ) -> None:
        pytest.fail('权限撤销后不应进入接口')

    response = await cache_env.client.get('/revoke-cached-permission', headers=cache_env.headers[USER_ID])

    assert response.json()['code'] == HttpStatusConstant.FORBIDDEN
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT * 2
    assert cache_env.renew_count() == THREE_AUTHENTICATIONS


@pytest.mark.asyncio
async def test_plugin_cache_hit_does_not_renew_host_session(cache_env: SimpleNamespace) -> None:
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    token_key = f'access_token:session-{USER_ID}'
    await cache_env.redis.pexpire(token_key, 2000)
    ttl = await cache_env.redis.pttl(token_key)
    token = cache_env.headers[USER_ID]['Authorization'].removeprefix('Bearer ')
    request = Request({'type': 'http', 'app': cache_env.app})

    async with cache_env.sessions() as db:
        current_user = await LoginService.get_current_user_for_plugin_session(request, token, db)

    assert current_user.permissions == ['demo:read']
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == 1
    assert 0 < await cache_env.redis.pttl(token_key) <= ttl


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['disable_user', 'delete_user', 'remove_role', 'disable_role', 'remove_menu'])
async def test_committed_permission_changes_invalidate_cached_authentication(
    cache_env: SimpleNamespace, change: str
) -> None:
    await cache_env.client.get('/permitted', headers=cache_env.headers[USER_ID])
    async with cache_env.sessions.begin() as db:
        if change in ('disable_user', 'delete_user'):
            values = {'status': '1'} if change == 'disable_user' else {'del_flag': '2'}
            await db.execute(update(SysUser).where(SysUser.user_id == USER_ID).values(**values))
        elif change == 'remove_role':
            await db.execute(delete(SysUserRole).where(SysUserRole.user_id == USER_ID))
        elif change == 'disable_role':
            await db.execute(update(SysRole).where(SysRole.role_id == USER_ID).values(status='1'))
        else:
            await db.execute(delete(SysRoleMenu).where(SysRoleMenu.role_id == USER_ID))

    response = await cache_env.client.get('/permitted', headers=cache_env.headers[USER_ID])

    expected = (
        HttpStatusConstant.UNAUTHORIZED if change in ('disable_user', 'delete_user') else HttpStatusConstant.FORBIDDEN
    )
    assert response.json()['code'] == expected
    assert len(cache_env.statements) > REGULAR_QUERY_COUNT


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['department', 'data_scope', 'post', 'menu'])
async def test_shared_changes_refresh_all_authorization_fields(cache_env: SimpleNamespace, change: str) -> None:
    await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    async with cache_env.sessions.begin() as db:
        if change == 'department':
            await db.execute(update(SysDept).where(SysDept.dept_id == USER_ID).values(ancestors='0,99'))
        elif change == 'data_scope':
            await db.execute(update(SysRole).where(SysRole.role_id == USER_ID).values(data_scope='5'))
        elif change == 'post':
            await db.execute(update(SysPost).where(SysPost.post_id == USER_ID).values(status='1'))
        else:
            await db.execute(update(SysMenu).where(SysMenu.menu_id == USER_ID).values(perms='demo:new'))

    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    payload = response.json()

    if change == 'department':
        assert payload['user']['dept']['ancestors'] == '0,99'
    elif change == 'data_scope':
        assert payload['user']['role'][0]['dataScope'] == '5'
    elif change == 'post':
        assert payload['user']['postIds'] == ''
    else:
        assert payload['permissions'] == ['demo:new']
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT * 2


@pytest.mark.asyncio
async def test_existing_transaction_bypasses_cache_without_publishing_uncommitted_permissions(
    cache_env: SimpleNamespace,
) -> None:
    first = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    async with cache_env.sessions() as db:
        await db.execute(update(SysRole).where(SysRole.role_id == USER_ID).values(status='1'))
        current_user = await LoginService._get_current_user_snapshot(cache_env.redis, db, USER_ID)
        assert current_user.permissions == []
        assert db.in_transaction()
        await db.rollback()
    queries = len(cache_env.statements)

    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert response.json() == first.json()
    assert len(cache_env.statements) == queries


@pytest.mark.asyncio
async def test_external_connection_transaction_cannot_publish_uncommitted_user(cache_env: SimpleNamespace) -> None:
    first = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    engine = cache_env.sessions.kw['bind']
    async with engine.connect() as connection:
        transaction = await connection.begin()
        try:
            await connection.execute(update(SysUser).where(SysUser.user_id == USER_ID).values(nick_name='Uncommitted'))
            async with AsyncSession(bind=connection) as db:
                assert not db.in_transaction()
                user = await LoginService._get_current_user_snapshot(cache_env.redis, db, USER_ID)
                assert user.user.nick_name == 'Uncommitted'
        finally:
            await transaction.rollback()
    queries = len(cache_env.statements)

    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert response.json() == first.json()
    assert len(cache_env.statements) == queries


@pytest.mark.asyncio
@pytest.mark.parametrize('default_bind', [False, True])
async def test_multi_bind_sessions_keep_original_database_resolution(
    cache_env: SimpleNamespace, default_bind: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = cache_env.sessions.kw['bind']
    secondary = create_async_engine(engine.url)
    bindings = dict.fromkeys(
        (SysUser, SysDept, SysRole, SysPost, SysMenu, SysUserRole, SysUserPost, SysRoleMenu), engine
    )
    if default_bind:
        bindings[SysRole] = secondary
    read = AsyncMock(side_effect=AssertionError('多绑定会话不应访问用户快照缓存'))
    monkeypatch.setattr(CurrentUserCacheUtil, 'read', read)
    try:
        async with AsyncSession(bind=engine if default_bind else None, binds=bindings) as db:
            user = await LoginService._get_current_user_snapshot(cache_env.redis, db, USER_ID)
        assert user.user.user_id == USER_ID
        assert user.permissions == ['demo:read']
        assert user.roles == ['reader']
        read.assert_not_awaited()
    finally:
        await secondary.dispose()


@pytest.mark.asyncio
async def test_concurrent_permission_commit_prevents_old_query_refilling_cache(
    cache_env: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    loaded = asyncio.Event()
    release = asyncio.Event()
    original = LoginService._get_current_user_from_db

    async def delayed(query_db: AsyncSession, user_id: int) -> CurrentUserModel:
        user = await original(query_db, user_id)
        loaded.set()
        await release.wait()
        return user

    monkeypatch.setattr(LoginService, '_get_current_user_from_db', delayed)
    pending = asyncio.create_task(cache_env.client.get('/profile', headers=cache_env.headers[USER_ID]))
    try:
        await asyncio.wait_for(loaded.wait(), timeout=2)
        async with cache_env.sessions.begin() as db:
            await db.execute(delete(SysRoleMenu).where(SysRoleMenu.role_id == USER_ID))
        release.set()
        first = await pending
        assert first.json()['permissions'] == ['demo:read']
    finally:
        release.set()
        if not pending.done():
            pending.cancel()
            await asyncio.gather(pending, return_exceptions=True)
    monkeypatch.setattr(LoginService, '_get_current_user_from_db', original)

    response = await cache_env.client.get('/permitted', headers=cache_env.headers[USER_ID])

    assert response.json()['code'] == HttpStatusConstant.FORBIDDEN
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT * 2


@pytest.mark.asyncio
async def test_direct_orm_user_change_invalidates_only_affected_user(cache_env: SimpleNamespace) -> None:
    for user_id in (ADMIN_ID, USER_ID):
        await cache_env.client.get('/profile', headers=cache_env.headers[user_id])
    async with cache_env.sessions.begin() as db:
        user = await db.get(SysUser, USER_ID)
        user.nick_name = 'Changed reader'
    cache_env.statements.clear()

    admin = await cache_env.client.get('/profile', headers=cache_env.headers[ADMIN_ID])
    assert admin.json()['user']['nickName'] == 'Admin'
    assert cache_env.statements == []
    user = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert user.json()['user']['nickName'] == 'Changed reader'
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT


@pytest.mark.asyncio
async def test_corrupt_cached_payload_falls_back_to_database(cache_env: SimpleNamespace) -> None:
    first = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    key = CurrentUserCacheUtil._keys(cache_env.namespace, USER_ID)[2]
    await cache_env.redis.hset(key, 'payload', '{invalid-json')

    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert response.json() == first.json()
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT * 2
    assert cache_env.renew_count() == TWO_AUTHENTICATIONS


@pytest.mark.asyncio
async def test_cache_failure_can_fall_back_without_bypassing_session_check(
    cache_env: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = cache_env.redis.eval

    async def cache_failure(script: str, *args: Any) -> Any:
        if script != _SESSION_RENEW_SCRIPT:
            raise RedisConnectionError('snapshot cache unavailable')
        return await original(script, *args)

    monkeypatch.setattr(cache_env.redis, 'eval', cache_failure)
    response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
    assert response.json()['user']['userId'] == USER_ID
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == 1

    monkeypatch.setattr(cache_env.redis, 'get', AsyncMock(side_effect=RedisConnectionError('session unavailable')))
    async with AsyncClient(
        transport=ASGITransport(app=cache_env.app, raise_app_exceptions=False), base_url='http://test'
    ) as client:
        failed = await client.get('/profile', headers=cache_env.headers[USER_ID])
    assert failed.json()['code'] == HttpStatusConstant.ERROR
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('stage', ['read', 'write'])
async def test_cache_cancellation_propagates_without_renewal_or_context(
    cache_env: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, stage: str
) -> None:
    original = cache_env.redis.eval
    cancel_script = CurrentUserCacheUtil._READ_SCRIPT if stage == 'read' else CurrentUserCacheUtil._WRITE_SCRIPT

    async def cancel(script: str, *args: Any) -> Any:
        if script == cancel_script:
            raise asyncio.CancelledError
        return await original(script, *args)

    monkeypatch.setattr(cache_env.redis, 'eval', cancel)
    with pytest.raises(asyncio.CancelledError):
        await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])

    assert cache_env.renew_count() == 0
    expected_queries = 0 if stage == 'read' else REGULAR_QUERY_COUNT
    assert len(cache_env.statements) == expected_queries
    assert await cache_env.redis.get(f'access_token:session-{USER_ID}') is not None


@pytest.mark.asyncio
async def test_cache_disabled_keeps_database_authentication(
    cache_env: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', False)
    for _ in range(2):
        response = await cache_env.client.get('/profile', headers=cache_env.headers[USER_ID])
        assert response.json()['permissions'] == ['demo:read']

    assert len(cache_env.statements) == REGULAR_QUERY_COUNT * 2
    assert cache_env.renew_count() == TWO_AUTHENTICATIONS
    assert all(script == _SESSION_RENEW_SCRIPT for script in cache_env.calls)
