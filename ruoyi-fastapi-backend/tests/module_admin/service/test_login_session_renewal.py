import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from redis.exceptions import TimeoutError as RedisTimeoutError

from common.context import RequestContext
from config.env import AppConfig, JwtConfig
from exceptions.exception import AuthException
from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel
from module_admin.service.login_service import _SESSION_LOGOUT_SCRIPT, _SESSION_RENEW_SCRIPT, LoginService
from utils.jwt_util import JwtUtil
from utils.time_util import TimezoneUtil

_SESSION_TTL = 10
_REPLACEMENT_TTL = 30
_PLUGIN_SESSION_READS = 2


class SessionRedis:
    """使用可控时间模拟登录会话和原子续期、退出命令。"""

    def __init__(self) -> None:
        self.now = 0
        self.values: dict[str, str] = {}
        self.deadlines: dict[str, int] = {}
        self.renew_calls: list[tuple[str, str, int]] = []
        self.logout_calls: list[tuple[str, str]] = []

    def _read(self, key: str) -> str | None:
        if self.deadlines.get(key, float('inf')) <= self.now:
            self.values.pop(key, None)
        return self.values.get(key)

    async def get(self, key: str) -> str | None:
        return self._read(key)

    async def set(self, key: str, value: str, *, ex: int) -> None:
        self.values[key] = value
        self.deadlines[key] = self.now + ex

    async def delete(self, key: str) -> None:
        self.values.pop(key, None)
        self.deadlines.pop(key, None)

    async def eval(self, script: str, count: int, key: str, token: str, seconds: int | None = None) -> int:
        assert count == 1
        if script == _SESSION_LOGOUT_SCRIPT:
            assert seconds is None
            self.logout_calls.append((key, token))
            if self._read(key) != token:
                return 0
            self.values.pop(key)
            self.deadlines.pop(key, None)
            return 1
        assert script == _SESSION_RENEW_SCRIPT
        assert seconds is not None
        self.renew_calls.append((key, token, seconds))
        if self._read(key) != token:
            return 0
        self.deadlines[key] = self.now + seconds
        return 1


@pytest.fixture
def session_case(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    redis = SessionRedis()
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(redis=redis)))
    token = JwtUtil.encode(
        {'user_id': '7', 'session_id': 'session-a', 'exp': int(TimezoneUtil.utc_now().timestamp()) + 3600}
    )
    user = CurrentUserModel(
        permissions=['demo:read'], roles=['reader'], user=UserInfoModel(userId=7, userName='tester')
    )
    get_user = AsyncMock(return_value=user)
    monkeypatch.setattr(LoginService, '_get_current_user_from_db', get_user)
    RequestContext.clear_all()
    return SimpleNamespace(redis=redis, request=request, token=token, user=user, get_user=get_user)


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_valid_session_renews_only_its_expiration(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    key = 'access_token:session-a' if same_time_login else 'access_token:7'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    session_case.redis.now = 5

    result = await LoginService.get_current_user(session_case.request, f'Bearer {session_case.token}', object())

    assert result is session_case.user
    assert await session_case.redis.get(key) == session_case.token
    assert session_case.redis.deadlines[key] == session_case.redis.now + JwtConfig.jwt_redis_expire_minutes * 60
    assert session_case.redis.renew_calls == [(key, session_case.token, JwtConfig.jwt_redis_expire_minutes * 60)]
    assert RequestContext.get_current_user() is result
    RequestContext.clear_all()


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
@pytest.mark.parametrize('change', ['logout', 'new_login', 'expired'])
@pytest.mark.parametrize('for_plugin', [True, False])
async def test_concurrent_session_change_cannot_be_overwritten_or_restored(
    session_case: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    same_time_login: bool,
    change: str,
    for_plugin: bool,
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    key = 'access_token:session-a' if same_time_login else 'access_token:7'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    loaded, resume = asyncio.Event(), asyncio.Event()

    async def load_user(*args: object) -> CurrentUserModel:
        loaded.set()
        await resume.wait()
        return session_case.user

    monkeypatch.setattr(LoginService, '_get_current_user_from_db', load_user)
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)
    resolve_user = LoginService.get_current_user_for_plugin_session if for_plugin else LoginService.get_current_user
    pending = asyncio.create_task(resolve_user(session_case.request, session_case.token, object()))
    await loaded.wait()
    if change == 'logout':
        token_id = 'session-a' if same_time_login else '7'
        await LoginService.logout_services(session_case.request, token_id, session_case.token)
    elif change == 'new_login':
        await session_case.redis.set(key, 'new-login-token', ex=_REPLACEMENT_TTL)
    else:
        session_case.redis.now = _SESSION_TTL + 1
    resume.set()

    with pytest.raises(AuthException) as exc_info:
        await pending
    assert exc_info.value.message == '用户token已失效，请重新登录'
    set_user.assert_not_called()
    if for_plugin:
        assert session_case.redis.renew_calls == []

    if change == 'new_login':
        assert await session_case.redis.get(key) == 'new-login-token'
        assert session_case.redis.deadlines[key] == _REPLACEMENT_TTL
    else:
        assert await session_case.redis.get(key) is None


@pytest.mark.asyncio
async def test_expired_session_does_not_load_user_or_renew(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', True)
    key = 'access_token:session-a'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    session_case.redis.now = _SESSION_TTL + 1

    with pytest.raises(AuthException) as exc_info:
        await LoginService.get_current_user(session_case.request, session_case.token, object())
    assert exc_info.value.message == '用户token已失效，请重新登录'

    session_case.get_user.assert_not_awaited()
    assert session_case.redis.renew_calls == []


@pytest.mark.asyncio
async def test_renewal_failure_does_not_authenticate_request(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', True)
    key = 'access_token:session-a'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    monkeypatch.setattr(session_case.redis, 'eval', AsyncMock(side_effect=RedisTimeoutError('redis timeout')))
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)

    with pytest.raises(RedisTimeoutError):
        await LoginService.get_current_user(session_case.request, session_case.token, object())

    set_user.assert_not_called()
    assert session_case.redis.deadlines[key] == _SESSION_TTL


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_committed_renewal_timeout_does_not_authenticate_request(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    key = 'access_token:session-a' if same_time_login else 'access_token:7'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    session_case.redis.now = 5
    original_eval = session_case.redis.eval

    async def renew_then_timeout(script: str, count: int, cache_key: str, token: str, seconds: int) -> int:
        await original_eval(script, count, cache_key, token, seconds)
        raise RedisTimeoutError('redis response timeout')

    monkeypatch.setattr(session_case.redis, 'eval', renew_then_timeout)
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)

    with pytest.raises(RedisTimeoutError):
        await LoginService.get_current_user(session_case.request, session_case.token, object())

    set_user.assert_not_called()
    assert session_case.redis.renew_calls == [(key, session_case.token, JwtConfig.jwt_redis_expire_minutes * 60)]
    assert session_case.redis.deadlines[key] == session_case.redis.now + JwtConfig.jwt_redis_expire_minutes * 60
    assert await session_case.redis.get(key) == session_case.token


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_cancelled_committed_renewal_does_not_authenticate_request(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    key = 'access_token:session-a' if same_time_login else 'access_token:7'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    session_case.redis.now = 5
    original_eval = session_case.redis.eval
    renewed, resume = asyncio.Event(), asyncio.Event()

    async def renew_then_wait(script: str, count: int, cache_key: str, token: str, seconds: int) -> int:
        result = await original_eval(script, count, cache_key, token, seconds)
        renewed.set()
        await resume.wait()
        return result

    monkeypatch.setattr(session_case.redis, 'eval', renew_then_wait)
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)
    pending = asyncio.create_task(LoginService.get_current_user(session_case.request, session_case.token, object()))
    await renewed.wait()
    pending.cancel()
    with pytest.raises(asyncio.CancelledError):
        await pending

    set_user.assert_not_called()
    assert session_case.redis.renew_calls == [(key, session_case.token, JwtConfig.jwt_redis_expire_minutes * 60)]
    assert session_case.redis.deadlines[key] == session_case.redis.now + JwtConfig.jwt_redis_expire_minutes * 60
    assert await session_case.redis.get(key) == session_case.token


@pytest.mark.asyncio
async def test_concurrent_requests_can_renew_the_same_session(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', True)
    key = 'access_token:session-a'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    requests = 5

    results = await asyncio.gather(
        *(LoginService.get_current_user(session_case.request, session_case.token, object()) for _ in range(requests))
    )

    assert len(results) == requests
    assert len(session_case.redis.renew_calls) == requests
    assert await session_case.redis.get(key) == session_case.token


@pytest.mark.asyncio
async def test_cancelled_request_does_not_renew_session(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', True)
    key = 'access_token:session-a'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    loaded, resume = asyncio.Event(), asyncio.Event()

    async def load_user(*args: object) -> CurrentUserModel:
        loaded.set()
        await resume.wait()
        return session_case.user

    monkeypatch.setattr(LoginService, '_get_current_user_from_db', load_user)
    pending = asyncio.create_task(LoginService.get_current_user(session_case.request, session_case.token, object()))
    await loaded.wait()
    pending.cancel()
    with pytest.raises(asyncio.CancelledError):
        await pending

    assert session_case.redis.renew_calls == []
    assert session_case.redis.deadlines[key] == _SESSION_TTL
    assert await session_case.redis.get(key) == session_case.token


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_plugin_validation_never_renews_main_session(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    key = 'access_token:session-a' if same_time_login else 'access_token:7'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)

    result = await LoginService.get_current_user_for_plugin_session(session_case.request, session_case.token, object())

    assert result is session_case.user
    assert session_case.redis.renew_calls == []
    assert session_case.redis.deadlines[key] == _SESSION_TTL
    RequestContext.clear_all()


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_plugin_final_session_check_failure_does_not_authenticate(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    key = 'access_token:session-a' if same_time_login else 'access_token:7'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    original_get = session_case.redis.get
    session_reads = 0

    async def read_session(cache_key: str) -> str | None:
        nonlocal session_reads
        if cache_key == key:
            session_reads += 1
            if session_reads == _PLUGIN_SESSION_READS:
                raise RedisTimeoutError('redis timeout')
        return await original_get(cache_key)

    monkeypatch.setattr(session_case.redis, 'get', read_session)
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)

    with pytest.raises(RedisTimeoutError):
        await LoginService.get_current_user_for_plugin_session(session_case.request, session_case.token, object())

    assert session_reads == _PLUGIN_SESSION_READS
    session_case.get_user.assert_awaited_once()
    set_user.assert_not_called()
    assert session_case.redis.renew_calls == []
    assert session_case.redis.deadlines[key] == _SESSION_TTL
    assert await original_get(key) == session_case.token


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_cancelled_plugin_final_session_check_does_not_authenticate(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    key = 'access_token:session-a' if same_time_login else 'access_token:7'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    original_get = session_case.redis.get
    checking, resume = asyncio.Event(), asyncio.Event()
    session_reads = 0

    async def read_session(cache_key: str) -> str | None:
        nonlocal session_reads
        if cache_key == key:
            session_reads += 1
            if session_reads == _PLUGIN_SESSION_READS:
                checking.set()
                await resume.wait()
        return await original_get(cache_key)

    monkeypatch.setattr(session_case.redis, 'get', read_session)
    set_user = Mock()
    monkeypatch.setattr(RequestContext, 'set_current_user', set_user)
    pending = asyncio.create_task(
        LoginService.get_current_user_for_plugin_session(session_case.request, session_case.token, object())
    )
    await checking.wait()
    pending.cancel()
    with pytest.raises(asyncio.CancelledError):
        await pending

    assert session_reads == _PLUGIN_SESSION_READS
    session_case.get_user.assert_awaited_once()
    set_user.assert_not_called()
    assert session_case.redis.renew_calls == []
    assert session_case.redis.deadlines[key] == _SESSION_TTL
    assert await original_get(key) == session_case.token


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_logout_is_idempotent_and_only_removes_its_session(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    token_id = 'session-a' if same_time_login else '7'
    key = f'access_token:{token_id}'
    other_key = 'access_token:session-b' if same_time_login else 'access_token:8'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    await session_case.redis.set(other_key, 'other-token', ex=_REPLACEMENT_TTL)
    delete = AsyncMock(side_effect=AssertionError('退出不能无条件删除会话'))
    monkeypatch.setattr(session_case.redis, 'delete', delete)
    requests = 3

    results = await asyncio.gather(
        *(LoginService.logout_services(session_case.request, token_id, session_case.token) for _ in range(requests))
    )

    assert results == [True] * requests
    assert await session_case.redis.get(key) is None
    assert key not in session_case.redis.deadlines
    assert await session_case.redis.get(other_key) == 'other-token'
    assert session_case.redis.deadlines[other_key] == _REPLACEMENT_TTL
    assert session_case.redis.logout_calls == [(key, session_case.token)] * requests
    assert session_case.redis.renew_calls == []
    session_case.get_user.assert_not_awaited()
    delete.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
@pytest.mark.parametrize('state', ['missing', 'expired', 'replaced'])
async def test_logout_of_stale_token_keeps_current_session(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool, state: str
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    token_id = 'session-a' if same_time_login else '7'
    key = f'access_token:{token_id}'
    if state == 'expired':
        await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
        session_case.redis.now = _SESSION_TTL + 1
    elif state == 'replaced':
        await session_case.redis.set(key, 'new-login-token', ex=_REPLACEMENT_TTL)

    assert await LoginService.logout_services(session_case.request, token_id, session_case.token) is True

    if state == 'replaced':
        assert await session_case.redis.get(key) == 'new-login-token'
        assert session_case.redis.deadlines[key] == _REPLACEMENT_TTL
    else:
        assert await session_case.redis.get(key) is None
    assert session_case.redis.renew_calls == []
    session_case.get_user.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
@pytest.mark.parametrize('login_before_logout', [True, False])
async def test_concurrent_new_login_survives_old_token_logout(
    session_case: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    same_time_login: bool,
    login_before_logout: bool,
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    token_id = 'session-a' if same_time_login else '7'
    key = f'access_token:{token_id}'
    new_key = 'access_token:session-b' if same_time_login else key
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    original_eval = session_case.redis.eval
    entered, resume = asyncio.Event(), asyncio.Event()

    async def delayed_logout(script: str, count: int, cache_key: str, token: str) -> int:
        result = None if login_before_logout else await original_eval(script, count, cache_key, token)
        entered.set()
        await resume.wait()
        return await original_eval(script, count, cache_key, token) if login_before_logout else result

    monkeypatch.setattr(session_case.redis, 'eval', delayed_logout)
    pending = asyncio.create_task(LoginService.logout_services(session_case.request, token_id, session_case.token))
    await entered.wait()
    await session_case.redis.set(new_key, 'new-login-token', ex=_REPLACEMENT_TTL)
    resume.set()

    assert await pending is True
    monkeypatch.setattr(session_case.redis, 'eval', original_eval)
    assert await LoginService.logout_services(session_case.request, token_id, session_case.token) is True
    assert await session_case.redis.get(new_key) == 'new-login-token'
    assert session_case.redis.deadlines[new_key] == _REPLACEMENT_TTL
    if same_time_login:
        assert await session_case.redis.get(key) is None
    assert session_case.redis.renew_calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
async def test_logout_after_committed_renewal_does_not_restore_session(
    session_case: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    token_id = 'session-a' if same_time_login else '7'
    key = f'access_token:{token_id}'
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    original_eval = session_case.redis.eval
    renewed, resume = asyncio.Event(), asyncio.Event()

    async def delayed_renewal(script: str, count: int, cache_key: str, token: str, seconds: int | None = None) -> int:
        result = await original_eval(script, count, cache_key, token, seconds)
        if script == _SESSION_RENEW_SCRIPT:
            renewed.set()
            await resume.wait()
        return result

    monkeypatch.setattr(session_case.redis, 'eval', delayed_renewal)
    pending = asyncio.create_task(LoginService.get_current_user(session_case.request, session_case.token, object()))
    await renewed.wait()
    assert await LoginService.logout_services(session_case.request, token_id, session_case.token) is True
    resume.set()

    # 续期已先完成的请求可以结束，但不能恢复随后退出的会话。
    assert await pending is session_case.user
    assert await session_case.redis.get(key) is None
    assert key not in session_case.redis.deadlines
    with pytest.raises(AuthException):
        await LoginService.get_current_user(session_case.request, session_case.token, object())
    assert len(session_case.redis.renew_calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [True, False])
@pytest.mark.parametrize('committed', [True, False])
@pytest.mark.parametrize('failure', ['timeout', 'cancelled'])
async def test_failed_logout_and_retry_cannot_delete_new_login(
    session_case: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    same_time_login: bool,
    committed: bool,
    failure: str,
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    token_id = 'session-a' if same_time_login else '7'
    key = f'access_token:{token_id}'
    new_key = 'access_token:session-b' if same_time_login else key
    await session_case.redis.set(key, session_case.token, ex=_SESSION_TTL)
    original_eval = session_case.redis.eval
    entered, resume = asyncio.Event(), asyncio.Event()

    async def failed_logout(script: str, count: int, cache_key: str, token: str) -> int:
        if committed:
            await original_eval(script, count, cache_key, token)
        entered.set()
        await resume.wait()
        raise RedisTimeoutError('redis response timeout')

    monkeypatch.setattr(session_case.redis, 'eval', failed_logout)
    delete = AsyncMock(side_effect=AssertionError('退出失败不能降级为无条件删除'))
    monkeypatch.setattr(session_case.redis, 'delete', delete)
    pending = asyncio.create_task(LoginService.logout_services(session_case.request, token_id, session_case.token))
    await entered.wait()
    assert await session_case.redis.get(key) == (None if committed else session_case.token)
    await session_case.redis.set(new_key, 'new-login-token', ex=_REPLACEMENT_TTL)
    if failure == 'cancelled':
        pending.cancel()
    else:
        resume.set()
    expected_exception = asyncio.CancelledError if failure == 'cancelled' else RedisTimeoutError
    with pytest.raises(expected_exception):
        await pending

    # 响应异常不能撤销已执行的删除；旧令牌重试也不能删除后续新登录。
    monkeypatch.setattr(session_case.redis, 'eval', original_eval)
    assert await LoginService.logout_services(session_case.request, token_id, session_case.token) is True
    assert await session_case.redis.get(new_key) == 'new-login-token'
    assert session_case.redis.deadlines[new_key] == _REPLACEMENT_TTL
    assert session_case.redis.renew_calls == []
    session_case.get_user.assert_not_awaited()
    delete.assert_not_awaited()
