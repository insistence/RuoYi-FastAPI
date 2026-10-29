import asyncio
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock

import pytest
from fastapi import Request
from redis.exceptions import TimeoutError as RedisTimeoutError

from common.context import RequestContext
from config.env import AppConfig
from exceptions.exception import AuthException
from module_admin.entity.vo.user_vo import CurrentUserModel
from module_admin.service.login_service import _SESSION_RENEW_SCRIPT, LoginService
from plugins.core.runtime.browser_session import (
    COOKIE_NAME_PREFIX,
    authenticate_browser_session,
    issue_browser_session,
)
from tests.module_admin.service.test_current_user_cache_integration import cache_env  # noqa: F401
from tests.module_admin.service.test_current_user_resolution import (
    REGULAR_QUERY_COUNT,
    USER_ID,
    resolution_env,  # noqa: F401
)
from tests.utils.test_current_user_cache_util import cache_redis, redis_socket  # noqa: F401
from utils.cache_util import CurrentUserCacheUtil

_FINAL_PLUGIN_READ = 2


async def _prepare_cached_session(
    env: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> tuple[Request, str, str]:
    """使用真实鉴权预热快照，并设置当前登录模式对应的会话键。"""
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    token = env.headers[USER_ID]['Authorization'].removeprefix('Bearer ')
    token_id = f'session-{USER_ID}' if same_time_login else str(USER_ID)
    token_key = f'access_token:{token_id}'
    await env.redis.set(token_key, token, ex=60)
    response = await env.client.get('/profile', headers=env.headers[USER_ID])
    assert response.json()['permissions'] == ['demo:read']
    assert len(env.statements) == REGULAR_QUERY_COUNT
    request = Request(
        {
            'type': 'http',
            'app': env.app,
            'method': 'GET',
            'scheme': 'http',
            'path': '/apps/cache_test/api/info',
            'headers': [(b'host', b'test')],
        }
    )
    return request, token, token_key


async def _resolve_cached_session(
    env: SimpleNamespace, request: Request, token: str, for_plugin: bool
) -> CurrentUserModel:
    """通过新数据库会话进入真实缓存命中及最终会话校验路径。"""
    resolve = LoginService.get_current_user_for_plugin_session if for_plugin else LoginService.get_current_user
    async with env.sessions() as db:
        return await resolve(request, token, db)


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
@pytest.mark.parametrize('for_plugin', [True, False])
@pytest.mark.parametrize('change', ['logout', 'new_login', 'expired'])
async def test_cached_request_rejects_session_changed_after_snapshot_read(
    cache_env: SimpleNamespace,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
    same_time_login: bool,
    for_plugin: bool,
    change: str,
) -> None:
    request, token, token_key = await _prepare_cached_session(cache_env, monkeypatch, same_time_login)
    loaded, resume = asyncio.Event(), asyncio.Event()
    original_eval = cache_env.redis.eval

    async def pause_snapshot(script: str, *args: Any) -> Any:
        result = await original_eval(script, *args)
        if script == CurrentUserCacheUtil._READ_SCRIPT:
            assert result[4]
            loaded.set()
            await resume.wait()
        return result

    monkeypatch.setattr(cache_env.redis, 'eval', pause_snapshot)
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)
    pending = asyncio.create_task(_resolve_cached_session(cache_env, request, token, for_plugin))
    replacement_deadline = None
    try:
        await asyncio.wait_for(loaded.wait(), timeout=2)
        if change == 'logout':
            await LoginService.logout_services(request, token_key.removeprefix('access_token:'), token)
        elif change == 'new_login':
            await cache_env.redis.set(token_key, 'new-login-token', ex=60)
            replacement_deadline = await cache_env.redis.pexpiretime(token_key)
        else:
            await cache_env.redis.pexpireat(token_key, 1)
        resume.set()
        with pytest.raises(AuthException):
            await pending
    finally:
        resume.set()
        if not pending.done():
            pending.cancel()
            await asyncio.gather(pending, return_exceptions=True)

    set_user.assert_not_called()
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == (1 if for_plugin else 2)
    if change == 'new_login':
        assert await cache_env.redis.get(token_key) == 'new-login-token'
        assert await cache_env.redis.pexpiretime(token_key) == replacement_deadline
    else:
        assert await cache_env.redis.get(token_key) is None


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
@pytest.mark.parametrize('for_plugin', [True, False])
@pytest.mark.parametrize('failure', ['timeout', 'cancel'])
async def test_cached_final_session_check_failure_never_sets_authenticated_context(  # noqa: PLR0915
    cache_env: SimpleNamespace,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
    same_time_login: bool,
    for_plugin: bool,
    failure: str,
) -> None:
    request, token, token_key = await _prepare_cached_session(cache_env, monkeypatch, same_time_login)
    await cache_env.redis.pexpire(token_key, 1000)
    previous_deadline = await cache_env.redis.pexpiretime(token_key)
    checked, resume = asyncio.Event(), asyncio.Event()
    original_eval, original_get = cache_env.redis.eval, cache_env.redis.get
    session_reads = 0

    async def fail_after_check() -> None:
        checked.set()
        if failure == 'timeout':
            raise RedisTimeoutError('session response unavailable')
        await resume.wait()

    async def eval_then_fail(script: str, *args: Any) -> Any:
        result = await original_eval(script, *args)
        if script == CurrentUserCacheUtil._READ_SCRIPT:
            assert result[4]
        if script == _SESSION_RENEW_SCRIPT:
            assert result == 1
            await fail_after_check()
        return result

    async def get_then_fail(key: str) -> Any:
        nonlocal session_reads
        result = await original_get(key)
        if for_plugin and key == token_key:
            session_reads += 1
            if session_reads == _FINAL_PLUGIN_READ:
                assert result == token
                await fail_after_check()
        return result

    monkeypatch.setattr(cache_env.redis, 'eval', eval_then_fail)
    monkeypatch.setattr(cache_env.redis, 'get', get_then_fail)
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)
    pending = asyncio.create_task(_resolve_cached_session(cache_env, request, token, for_plugin))
    try:
        await asyncio.wait_for(checked.wait(), timeout=2)
        if failure == 'cancel':
            pending.cancel()
        with pytest.raises(asyncio.CancelledError if failure == 'cancel' else RedisTimeoutError):
            await pending
    finally:
        resume.set()
        if not pending.done():
            pending.cancel()
            await asyncio.gather(pending, return_exceptions=True)

    set_user.assert_not_called()
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert await original_get(token_key) == token
    deadline = await cache_env.redis.pexpiretime(token_key)
    if for_plugin:
        assert cache_env.renew_count() == 1
        assert deadline == previous_deadline
    else:
        # Redis已经完成续期但未收到成功响应时，当前请求仍不能通过鉴权。
        assert cache_env.renew_count() == _FINAL_PLUGIN_READ
        assert deadline > previous_deadline


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_browser_cookie_uses_cached_permissions_without_renewal_and_rejects_logout(
    cache_env: SimpleNamespace,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
    same_time_login: bool,
) -> None:
    request, token, token_key = await _prepare_cached_session(cache_env, monkeypatch, same_time_login)
    cookie, _, _ = await issue_browser_session(
        request, plugin_id='cache_test', version='1.0.0', main_token=token, user_id=USER_ID
    )
    request = Request(
        {
            **request.scope,
            'headers': [*request.scope['headers'], (b'cookie', f'{COOKIE_NAME_PREFIX}cache_test={cookie}'.encode())],
        }
    )
    deadline = await cache_env.redis.pexpiretime(token_key)
    async with cache_env.sessions() as db:
        user = await authenticate_browser_session(request, plugin_id='cache_test', version='1.0.0', query_db=db)
    assert user.permissions == ['demo:read']
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == 1
    assert await cache_env.redis.pexpiretime(token_key) == deadline

    await LoginService.logout_services(request, token_key.removeprefix('access_token:'), token)
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)
    async with cache_env.sessions() as db:
        with pytest.raises(LookupError, match='主登录会话已失效'):
            await authenticate_browser_session(request, plugin_id='cache_test', version='1.0.0', query_db=db)
    set_user.assert_not_called()
    assert len(cache_env.statements) == REGULAR_QUERY_COUNT
    assert cache_env.renew_count() == 1
    assert await cache_env.redis.get(token_key) is None
