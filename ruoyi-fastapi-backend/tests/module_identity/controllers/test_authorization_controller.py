import asyncio
import time
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import select

from common.constant import OidcAuditEvent
from config.env import OidcConfig
from exceptions.exception import OAuthProtocolException
from module_identity.controller import authorization_controller as controller
from module_identity.controller.authorization_controller import authorize
from module_identity.entity.do.oauth_audit_do import SysOAuthAuditLog
from module_identity.redis_keys import OidcRedisKey
from module_identity.service import infrastructure_service
from module_identity.service.audit_service import AuditService
from module_identity.service.authorization_service import AuthorizationService
from module_identity.service.interaction_service import InteractionService
from tests.module_identity.services.test_authorization_service import _seed_authorization_data
from tests.module_identity.support.redis_fakes import FakeRedis

_REDIRECT_URI = 'https://portal.example/callback?tenant=one'
_CHALLENGE = 'A' * 43
_HTTP_OK = 200
_HTTP_NOT_FOUND = 404
_HTTP_SEE_OTHER = 303
_HTTP_TOO_MANY_REQUESTS = 429


class _QueryParams:
    """
    提供 Starlette QueryParams 所需的多值读取接口。

    :ivar values: 当前处理的值集合
    """

    def __init__(self, values: list[tuple[str, str]]) -> None:
        """
        初始化测试夹具的 ``values``。

        :param values: 当前处理的值集合
        """
        self.values = values

    def multi_items(self) -> list[tuple[str, str]]:
        """
        向调用方返回 ``self.values``。

        :return: 测试缓存当前保存的值
        """
        return self.values


class _Request:
    """
    构造不携带 Legacy 会话的认证请求。

    :ivar method: 当前请求的 HTTP 方法
    :ivar query_params: 模拟 HTTP 请求中的查询参数
    :ivar cookies: 模拟请求或响应携带的 Cookie
    :ivar headers: 响应或请求携带的 HTTP 头
    :ivar client: 发起当前调用的客户端
    :ivar app: 正在配置或处理请求的 ASGI 应用
    """

    def __init__(self, values: list[tuple[str, str]], redis: FakeRedis | None = None) -> None:
        """
        初始化测试夹具的 ``method``, ``query_params``, ``cookies``, ``headers``。

        :param values: 当前处理的值集合
        :param redis: 用于缓存或发布消息的 Redis 客户端
        """
        self.method = 'GET'
        self.query_params = _QueryParams(values)
        self.cookies: dict[str, str] = {}
        self.headers: dict[str, str] = {}
        self.client = SimpleNamespace(host='198.51.100.10')
        self.app = SimpleNamespace(state=SimpleNamespace(redis=redis or FakeRedis()))


class _RateRedis(FakeRedis):
    """仅实现授权端点固定窗口 Lua 等效语义的 FakeRedis。"""

    async def eval(self, script: str, numkeys: int, *args: Any) -> Any:
        """
        按测试约定模拟 Redis 脚本的执行。

        :param script: 需要运行的脚本
        :param numkeys: 传给 Redis 脚本的键数量
        :param args: 传给被调用对象的位置参数
        :return: 测试脚本按当前状态返回的结果
        """
        if script != infrastructure_service.OidcRateLimiter._SCRIPT:
            return await super().eval(script, numkeys, *args)
        async with self.lock:
            key = str(args[0])
            current = int(self.values.get(key, ('0', None))[0]) + 1
            ttl = int(args[1])
            self.values[key] = (str(current), time.monotonic() + ttl)
            return [current, ttl]


def _values(**overrides: str) -> list[tuple[str, str]]:
    """
    构造有效授权 Query 参数。

    :param overrides: 调用方按名称传入的附加选项
    :return: 有效授权 Query 参数
    """
    values = {
        'response_type': 'code',
        'client_id': 'authorization-client',
        'redirect_uri': _REDIRECT_URI,
        'scope': 'openid profile',
        'nonce': 'nonce-value',
        'state': 'opaque-state',
        'code_challenge': _CHALLENGE,
        'code_challenge_method': 'S256',
    }
    values.update(overrides)
    return list(values.items())


@pytest.fixture
def oidc_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    配置控制器测试使用的安全 OIDC 参数。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    """
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    monkeypatch.setattr(OidcConfig, 'oidc_issuer', 'https://auth.example.com')
    monkeypatch.setattr(OidcConfig, 'oidc_pkce_methods', 'S256')
    monkeypatch.setattr(OidcConfig, 'oidc_token_hash_pepper', 'authorization-controller-pepper-' + 'x' * 32)
    monkeypatch.setattr(OidcConfig, 'oidc_interaction_login_url', 'https://auth.example.com/auth-center/login')
    monkeypatch.setattr(OidcConfig, 'oidc_interaction_consent_url', 'https://auth.example.com/auth-center/consent')


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_authorize_creates_real_interaction_with_fragment_csrf(data_session: Any) -> None:
    """有效请求真实执行校验和 Interaction 创建，CSRF 只进入 Fragment。"""
    await _seed_authorization_data(data_session)
    response = await authorize(_Request(_values()), data_session)
    assert response.status_code == _HTTP_SEE_OTHER
    location = response.headers['location']
    assert 'interaction=' in location
    assert '#csrf=' in location
    assert 'csrf=' not in location.split('?', 1)[1].split('#', 1)[0]
    assert response.headers['cache-control'] == 'no-store'


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_authorize_invalid_redirect_is_local_and_plain_pkce_is_redirectable(data_session: Any) -> None:
    """未注册 Redirect 不得跳转；精确注册后 plain PKCE 才允许协议错误回跳。"""
    await _seed_authorization_data(data_session)
    with pytest.raises(OAuthProtocolException) as local:
        await authorize(_Request(_values(redirect_uri='https://evil.example/callback')), data_session)
    assert local.value.can_redirect is False

    with pytest.raises(OAuthProtocolException) as redirectable:
        await authorize(_Request(_values(code_challenge_method='plain')), data_session)
    assert redirectable.value.error == 'invalid_request'
    assert redirectable.value.can_redirect is True
    with pytest.raises(OAuthProtocolException) as unsupported:
        await authorize(_Request(_values(response_type='token')), data_session)
    assert unsupported.value.error == 'unsupported_response_type'
    assert unsupported.value.can_redirect is True


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_authorize_max_age_discards_stale_sso(monkeypatch: pytest.MonkeyPatch, data_session: Any) -> None:
    """超过 max_age 的有效 SSO 只能重新进入登录交互。"""
    await _seed_authorization_data(data_session)
    stale = SimpleNamespace(
        sid='sid-stale',
        user_id=2,
        subject_id='11111111-1111-4111-8111-111111111111',
        auth_version=1,
        auth_time=datetime.now(UTC) - timedelta(seconds=30),
    )

    async def load_stale(*args: object, **kwargs: object) -> Any:
        """
        向调用方返回 ``stale``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 已经过期的快照
        """
        return stale

    monkeypatch.setattr(AuthorizationService, '_load_sso_session', load_stale)
    response = await authorize(_Request(_values(max_age='1')), data_session)
    assert response.status_code == _HTTP_SEE_OTHER
    assert '/auth-center/login' in response.headers['location']


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_authorize_ip_limit_is_atomic_and_hashes_ip(monkeypatch: pytest.MonkeyPatch) -> None:
    """授权固定窗口并发计数只使用 HMAC-IP Redis Key。"""
    redis = _RateRedis()
    request = _Request(_values(), redis)
    request.client = SimpleNamespace(host='198.51.100.10')
    await asyncio.gather(*(controller._enforce_authorization_rate_limit(request, redis) for _ in range(30)))
    with pytest.raises(OAuthProtocolException) as limited:
        await controller._enforce_authorization_rate_limit(request, redis)
    assert limited.value.status_code == _HTTP_TOO_MANY_REQUESTS
    assert limited.value.redirect_uri is None
    assert all('198.51.100.10' not in key for key in redis.values)
    assert any(key.startswith('oidc:rate_limit:authorize:ip:') for key in redis.values)


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_authorize_audit_events_are_structured_and_secret_free(data_session: Any) -> None:
    """授权成功事件落库且不携带协议秘密。"""
    await _seed_authorization_data(data_session)
    await authorize(_Request(_values()), data_session)
    rows = (
        (
            await data_session.execute(
                select(SysOAuthAuditLog).where(SysOAuthAuditLog.client_id == 'authorization-client')
            )
        )
        .scalars()
        .all()
    )
    event_types = {row.event_type for row in rows}
    assert OidcAuditEvent.AUTHORIZE_REQUESTED in event_types
    assert OidcAuditEvent.AUTHORIZE_SUCCEEDED not in event_types
    for row in rows:
        assert 'nonce-value' not in str(row.detail)
        assert _CHALLENGE not in str(row.detail)
        assert 'opaque-state' not in str(row.detail)


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_authorize_prompt_none_without_sso_returns_login_required_without_interaction(data_session: Any) -> None:
    """prompt=none 没有新 SSO 时直接返回 login_required，不创建页面状态。"""
    await _seed_authorization_data(data_session)
    redis = FakeRedis()
    with pytest.raises(OAuthProtocolException) as raised:
        await authorize(_Request(_values(prompt='none'), redis), data_session)
    assert raised.value.error == 'login_required'
    assert raised.value.can_redirect is True
    assert not any(key.startswith('oidc:interaction:') for key in redis.values)


@pytest.mark.asyncio
async def test_authorize_disabled_is_local_404(data_session: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    """OIDC 关闭时授权入口返回本地 404。"""
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', False)
    response = await authorize(_Request(_values()), data_session)
    assert response.status_code == _HTTP_NOT_FOUND
    assert response.headers['cache-control'] == 'no-store'


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_complete_code_audit_failure_cleans_code_and_marker(monkeypatch: pytest.MonkeyPatch) -> None:
    """Authorization 完成阶段审计失败时授权码与 marker 均被补偿。"""
    redis = FakeRedis()
    interaction_id = 'authorization-completion-id'
    marker = OidcRedisKey.interaction(f'{interaction_id}-completion')
    await redis.set(OidcRedisKey.interaction(interaction_id), 'present', ex=60)
    record = {
        'interactionId': interaction_id,
        'status': 'completed',
        'clientPk': 1,
        'clientId': 'authorization-client',
        'redirectUri': _REDIRECT_URI,
        'scopes': ['openid'],
        'resources': [],
        'state': 'state-value',
        'nonce': 'nonce-value',
        'codeChallenge': _CHALLENGE,
        'codeChallengeMethod': 'S256',
        'authenticatedSid': 'sid-1',
        'grantId': None,
    }
    session = SimpleNamespace(
        sid='sid-1',
        user_id=2,
        subject_id='11111111-1111-4111-8111-111111111111',
        auth_version=1,
        auth_time=None,
    )
    monkeypatch.setattr(InteractionService, 'get_record', lambda *_args, **_kwargs: _async(record))
    monkeypatch.setattr(
        AuthorizationService,
        'verified_redirect_for_client',
        lambda *_args, **_kwargs: _async(_REDIRECT_URI),
    )
    monkeypatch.setattr(AuthorizationService, 'active_session', lambda *_args, **_kwargs: _async(session))
    monkeypatch.setattr(AuditService, 'record', lambda *_args, **_kwargs: _raise_async(RuntimeError('audit')))
    with pytest.raises(OAuthProtocolException) as raised:
        await AuthorizationService._complete_authorization(_Db(), redis, interaction_id)
    assert raised.value.error == 'server_error'
    assert await redis.get(marker) is None
    assert not any(key.startswith('oidc:authorization_code:') for key in redis.values)


class _Db:
    """
    记录授权完成测试的事务动作。

    :ivar commits: 测试中记录的提交次数
    :ivar rollbacks: 测试中记录的回滚次数
    """

    def __init__(self) -> None:
        """初始化测试夹具的 ``commits``, ``rollbacks``。"""
        self.commits = 0
        self.rollbacks = 0

    async def commit(self) -> None:
        """累加 ``commits`` 供后续断言检查。"""
        self.commits += 1

    async def rollback(self) -> None:
        """累加 ``rollbacks`` 供后续断言检查。"""
        self.rollbacks += 1


async def _async(value: object) -> Any:
    """
    构造异步测试结果。

    :param value: 待处理的输入值
    :return: 待处理的输入值
    """
    return value


async def _raise_async(error: Exception) -> Any:
    """
    构造异步异常结果。

    :param error: 发生错误时返回的错误信息
    :raises Exception: 底层操作失败时向调用方传播异常
    """
    raise error
