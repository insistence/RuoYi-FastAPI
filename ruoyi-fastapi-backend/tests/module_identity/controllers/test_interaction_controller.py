import json
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from common.aspect.db_session import get_db_session_provider
from common.constant import OidcAuditEvent
from common.enums import RedisInitKeyConfig
from config.env import OidcConfig
from exceptions.exception import OAuthProtocolException, OidcInteractionException
from exceptions.handle import handle_exception
from module_admin.entity.do.user_do import SysUser
from module_admin.service.user_service import UserService
from module_identity.controller.interaction_controller import (
    _failure_response,
    _safe_json_body,
    cancel,
    captcha,
    get_interaction,
    interaction_controller,
)
from module_identity.dao.oauth_client_dao import OAuthClientDao
from module_identity.dao.oauth_grant_dao import OAuthGrantDao, OAuthGrantSnapshot
from module_identity.dependencies import require_oidc_protocol_ready
from module_identity.entity.do.oauth_grant_do import SysOAuthGrant
from module_identity.entity.vo.interaction_vo import (
    CaptchaResponseModel,
    ChangePasswordModel,
    InteractionConsentModel,
    InteractionLoginModel,
    InteractionResultModel,
    InteractionViewModel,
)
from module_identity.redis_keys import OidcRedisKey
from module_identity.service.audit_service import AuditService
from module_identity.service.authorization_service import (
    AuthorizationCodeService,
    AuthorizationContext,
    ClientSnapshot,
    InteractionCompletionService,
    ScopeSnapshot,
)
from module_identity.service.consent_service import ConsentResult, ConsentService, InteractionConsentService
from module_identity.service.identity_service import (
    CredentialAuthenticationResult,
    CredentialAuthenticationService,
    IdentitySecurityEventService,
    IdentitySubjectService,
)
from module_identity.service.infrastructure_service import AfterCommitCoordinator, OidcRateLimiter, RateLimitUnavailable
from module_identity.service.interaction_service import (
    InteractionFlowService,
    InteractionLoginOutcome,
    InteractionLoginService,
    InteractionService,
)
from module_identity.service.session_service import SsoSessionDao, SsoSessionService
from tests.module_identity.support.http import make_request
from tests.module_identity.support.redis_fakes import FakeRedis
from utils.oidc_util import OidcUtil
from utils.pwd_util import PwdUtil

_PEPPER = 'interaction-controller-pepper-' + 'x' * 32
_CHALLENGE = 'A' * 43
_HTTP_OK = 200
_HTTP_NOT_FOUND = 404
_HTTP_SEE_OTHER = 303
_HTTP_BAD_REQUEST = 400
_HTTP_TOO_MANY_REQUESTS = 429
_HTTP_SERVICE_UNAVAILABLE = 503
_MIN_EXPECTED_COMMITS = 2


def _payload(status: str = 'awaiting_login', **overrides: object) -> dict[str, object]:
    """
    构造 Interaction 内部白名单载荷。

    :param status: 操作或记录所处的状态
    :param overrides: 调用方按名称传入的附加选项
    :return: Interaction 内部白名单载荷
    """
    payload: dict[str, object] = {
        'interactionId': 'interaction-controller-id',
        'clientPk': 1001,
        'clientId': 'portal-client',
        'redirectUri': 'https://portal.example/callback',
        'responseType': 'code',
        'scopes': ['openid', 'profile'],
        'resources': [],
        'state': 'opaque-state',
        'nonce': 'opaque-nonce',
        'codeChallenge': _CHALLENGE,
        'codeChallengeMethod': 'S256',
        'prompt': [],
        'maxAge': None,
        'consentRequired': status == 'awaiting_consent',
        'authenticatedSid': 'sid-1' if status in {'awaiting_consent', 'completed'} else None,
        'userId': 2 if status in {'awaiting_consent', 'completed'} else None,
        'subjectId': '11111111-1111-4111-8111-111111111111' if status in {'awaiting_consent', 'completed'} else None,
        'authVersion': 1 if status in {'awaiting_consent', 'completed'} else None,
    }
    payload.update(overrides)
    return payload


def _request(redis: FakeRedis, csrf: str | None = None) -> Request:
    """
    构造交互页面请求替身。

    :param redis: 测试用 Redis
    :param csrf: 请求中的 CSRF 校验值
    :return: 交互页面请求替身
    """
    return make_request(redis.client, headers={'x-csrf-token': csrf} if csrf else {})


def _context() -> AuthorizationContext:
    """
    构造同意校验使用的不可变上下文。

    :return: 同意校验使用的不可变上下文
    """
    return AuthorizationContext(
        client=ClientSnapshot(1001, 'portal-client', 1, ('authorization_code',), ('code',), True, True, False),
        redirect_uri='https://portal.example/callback',
        scopes=('openid', 'profile'),
        scope_models=(
            ScopeSnapshot(1, 'openid', 'identity', None, True),
            ScopeSnapshot(2, 'profile', 'identity', None, True),
        ),
        pre_authorized_scopes=frozenset({'openid'}),
        resource=None,
        state='opaque-state',
        nonce='opaque-nonce',
        code_challenge=_CHALLENGE,
        code_challenge_method='S256',
        prompt=None,
        max_age=None,
    )


@pytest.fixture
def oidc_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    配置安全 OIDC 参数。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    """
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    monkeypatch.setattr(OidcConfig, 'oidc_token_hash_pepper', _PEPPER)
    monkeypatch.setattr(OidcConfig, 'oidc_authorization_code_ttl_seconds', 90)


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_login_and_complete_real_interaction_lifecycle(monkeypatch: pytest.MonkeyPatch) -> None:
    """真实 Interaction Redis 状态机贯通 CSRF、登录、完成和授权码一次消费标记。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    result = CredentialAuthenticationResult(
        user=SysUser(user_id=2),
        dept=None,
        acr='urn:ruoyi:acr:pwd',
        amr=('pwd',),
        remember_me=False,
        password_change_required=False,
        password_change_reason=None,
    )
    subject = SimpleNamespace(subject_id='11111111-1111-4111-8111-111111111111', auth_version=1)
    session = SimpleNamespace(
        sid='sid-1',
        user_id=2,
        subject_id=subject.subject_id,
        auth_version=1,
        auth_time=None,
        remember_me=False,
    )
    monkeypatch.setattr(
        'module_identity.service.authorization_service.AuthorizationService._completion_grant',
        AsyncMock(return_value=SimpleNamespace(grant_id='grant-1')),
    )

    async def authenticate(*args: object, **kwargs: object) -> CredentialAuthenticationResult:
        """
        向调用方返回 ``result``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 为当前测试预设的操作结果
        """
        return result

    async def require_subject(*args: object, **kwargs: object) -> Any:
        """
        向调用方返回 ``subject``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 令牌中标识用户的主体
        """
        return subject

    async def create_sso(*args: object, **kwargs: object) -> tuple[str, Any]:
        """
        提供登录流程使用的测试会话。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 登录流程使用的测试会话
        """
        return 'ss1.sid-1.' + 'A' * 43, session

    monkeypatch.setattr(CredentialAuthenticationService, 'authenticate_oidc', authenticate)
    monkeypatch.setattr(IdentitySubjectService, 'require_by_user_id', require_subject)
    monkeypatch.setattr(SsoSessionService, 'create', create_sso)
    db = AsyncMock(spec=AsyncSession)
    outcome = await InteractionLoginService.login(
        redis.client,
        created.interaction_id,
        InteractionLoginModel(user_name='alice', password='password'),
        db,
        created.csrf_token,
        '127.0.0.1',
        None,
    )
    assert outcome.result is not None
    assert outcome.cookie is not None
    assert (await InteractionService.get_record(redis.client, created.interaction_id))['status'] == 'completed'
    assert 'ss1.sid-1.' in outcome.cookie

    monkeypatch.setattr(
        OAuthClientDao,
        'find_exact_uri',
        lambda *args, **kwargs: _async(SimpleNamespace(uri='https://portal.example/callback')),
    )
    monkeypatch.setattr(SsoSessionDao, 'get_active', lambda *args, **kwargs: _async(session))
    audit_events: list[str] = []

    async def record_audit(*args: object, **kwargs: object) -> None:
        """
        记录本次提交的审计事件。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        """
        audit_events.append(str(args[1]))

    monkeypatch.setattr(AuditService, 'record', record_audit)
    completed = await InteractionCompletionService.complete(redis.client, created.interaction_id, db)
    assert 'code=ac1.' in completed.location
    assert audit_events == [OidcAuditEvent.AUTHORIZE_SUCCEEDED]
    with pytest.raises(OidcInteractionException):
        await InteractionCompletionService.complete(redis.client, created.interaction_id, db)
    assert await redis.ttl(OidcRedisKey.interaction(f'{created.interaction_id}-completion')) > 0


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_forced_password_login_creates_no_sso_cookie_or_active_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """强制改密登录只推进短时证明状态，不提前创建 SSO。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    result = CredentialAuthenticationResult(
        user=SysUser(user_id=2),
        dept=None,
        acr='urn:ruoyi:acr:pwd',
        amr=('pwd',),
        remember_me=False,
        password_change_required=True,
        password_change_reason='initial_password',
    )
    subject = SimpleNamespace(subject_id='11111111-1111-4111-8111-111111111111', auth_version=1)

    async def authenticate(*args: object, **kwargs: object) -> CredentialAuthenticationResult:
        """
        向调用方返回 ``result``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 为当前测试预设的操作结果
        """
        return result

    async def require_subject(*args: object, **kwargs: object) -> Any:
        """
        向调用方返回 ``subject``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 令牌中标识用户的主体
        """
        return subject

    async def forbidden_sso(*args: object, **kwargs: object) -> Any:
        """
        模拟此操作抛出 AssertionError 的情形。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises AssertionError: 强制密码登录错误地尝试创建单点登录会话
        """
        raise AssertionError('forced password login must not create SSO')

    monkeypatch.setattr(CredentialAuthenticationService, 'authenticate_oidc', authenticate)
    monkeypatch.setattr(IdentitySubjectService, 'require_by_user_id', require_subject)
    monkeypatch.setattr(SsoSessionService, 'create', forbidden_sso)
    outcome = await InteractionLoginService.login(
        redis.client,
        created.interaction_id,
        InteractionLoginModel(user_name='alice', password='password'),
        AsyncMock(spec=AsyncSession),
        created.csrf_token,
    )
    assert outcome.result is not None
    assert outcome.cookie is None
    record = await InteractionService.get_record(redis.client, created.interaction_id)
    assert record['status'] == 'password_change_required'
    assert record['authenticatedSid'] is None
    assert isinstance(record['credentialProofHash'], str)


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
@pytest.mark.usefixtures('interaction_page_metadata')
async def test_get_interaction_requires_csrf_header() -> None:
    """Interaction 页面读取也必须使用原始 CSRF Header。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    with pytest.raises(OidcInteractionException):
        await get_interaction(_request(redis), created.interaction_id, AsyncMock(spec=AsyncSession))
    response = await get_interaction(
        _request(redis, created.csrf_token), created.interaction_id, AsyncMock(spec=AsyncSession), created.csrf_token
    )
    assert response.status_code == _HTTP_OK


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
@pytest.mark.parametrize(('stored_value', 'expected'), [('true', True), ('false', False)])
@pytest.mark.usefixtures('interaction_page_metadata')
async def test_get_interaction_captcha_enabled_reflects_system_config(stored_value: str, expected: bool) -> None:
    """Interaction 页面验证码开关必须来自系统配置，而不是固定默认值。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    config_key = f'{RedisInitKeyConfig.SYS_CONFIG.key}:sys.account.captchaEnabled'
    await redis.set(config_key, stored_value)

    response = await get_interaction(
        _request(redis, created.csrf_token), created.interaction_id, AsyncMock(spec=AsyncSession), created.csrf_token
    )

    assert response.status_code == _HTTP_OK
    assert json.loads(bytes(response.body))['data']['captchaEnabled'] is expected


def test_interaction_error_responses_use_the_unified_response_util_envelope() -> None:
    """交互 HTTP 错误保留统一 code/msg/success/time 业务 envelope。"""
    response = _failure_response('invalid interaction', _HTTP_BAD_REQUEST)
    payload = json.loads(bytes(response.body))

    assert response.status_code == _HTTP_BAD_REQUEST
    assert payload['code'] is not None
    assert payload['msg'] == 'invalid interaction'
    assert payload['success'] is False
    assert 'time' in payload


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_captcha_endpoint_has_independent_oidc_limit_and_fail_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """验证码端点使用 Interaction/IP 摘要限流，Redis 故障不放行。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    monkeypatch.setattr(InteractionFlowService, 'captcha_enabled', lambda *_args: _async(False))
    request = _request(redis)
    for _ in range(5):
        assert (await captcha(request, created.interaction_id)).status_code == _HTTP_OK
    limited = await captcha(request, created.interaction_id)
    assert limited.status_code == _HTTP_TOO_MANY_REQUESTS
    assert all('interaction-controller-id' not in key for key in redis.values)
    monkeypatch.setattr(
        OidcRateLimiter,
        'enforce',
        lambda *_args, **_kwargs: _raise_async(RateLimitUnavailable('down')),
    )
    unavailable = await captcha(request, created.interaction_id)
    assert unavailable.status_code == _HTTP_SERVICE_UNAVAILABLE


async def _raise_async(error: Exception) -> Any:
    """
    在测试中构造异步异常结果。

    :param error: 发生错误时返回的错误信息
    :raises Exception: 底层操作失败时向调用方传播异常
    """
    raise error


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_mutations_require_csrf_and_consent_cannot_expand_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    """登录/同意变更必须有 CSRF，提交 Scope 不能超出原请求。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload('awaiting_consent'), pepper=_PEPPER)
    db = AsyncMock(spec=AsyncSession)
    with pytest.raises(OidcInteractionException):
        await InteractionConsentService.consent(
            redis.client,
            created.interaction_id,
            InteractionConsentModel(approved=True, scopes=['openid', 'profile']),
            db,
            None,
        )
    monkeypatch.setattr(
        InteractionConsentService,
        'context_from_record',
        lambda *args, **kwargs: _async(_context()),
    )
    monkeypatch.setattr(AuditService, 'record_independent', lambda *args, **kwargs: _async(None))
    with pytest.raises(OAuthProtocolException) as expanded:
        await InteractionConsentService.consent(
            redis.client,
            created.interaction_id,
            InteractionConsentModel(approved=True, scopes=['openid', 'profile', 'admin']),
            db,
            created.csrf_token,
        )
    assert expanded.value.error == 'invalid_scope'
    assert (await InteractionService.get_record(redis.client, created.interaction_id))['status'] == 'awaiting_consent'


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_cancel_is_csrf_protected_and_legacy_cookie_is_ignored() -> None:
    """取消操作使用 CAS，且交互控制器不读取 Legacy access_token Cookie。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    request = make_request(
        redis.client, headers={'x-csrf-token': created.csrf_token, 'cookie': 'access_token=legacy-token'}
    )
    response = await cancel(request, created.interaction_id, AsyncMock(spec=AsyncSession), created.csrf_token)
    assert response.status_code == _HTTP_OK
    assert (await InteractionService.get_record(redis.client, created.interaction_id))['status'] == 'denied'


@pytest.mark.asyncio
async def test_interaction_disabled_is_local_404(monkeypatch: pytest.MonkeyPatch) -> None:
    """OIDC 关闭时交互页面和写入口均返回本地 404。"""
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', False)
    response = await get_interaction(_request(FakeRedis()), 'interaction-id', AsyncMock(spec=AsyncSession))
    assert response.status_code == _HTTP_NOT_FOUND
    assert response.headers['cache-control'] == 'no-store'


def test_consent_scope_dto_rejects_duplicate_and_oversized_values() -> None:
    """同意 DTO 在进入 Controller 前拒绝重复或超长 Scope。"""
    with pytest.raises(ValueError):
        InteractionConsentModel(approved=True, scopes=['openid', 'openid'])
    with pytest.raises(ValueError):
        InteractionConsentModel(approved=True, scopes=['x' * 101])


@pytest.mark.asyncio
async def test_body_parser_rejects_duplicate_unknown_and_oversized_json_without_echoing_password() -> None:
    """JSON 解析错误统一脱敏，且受 16KiB 总体大小限制。"""
    cases = [
        ('duplicate', b'{"userName":"alice","password":"super-secret","password":"again"}'),
        ('unknown', json.dumps({'userName': 'alice', 'password': 'super-secret', 'unknown': True}).encode()),
        ('oversized', b'{' + b'"password":"' + b'x' * (16 * 1024) + b'"}'),
    ]
    for reason, value in cases:
        midpoint = len(value) // 2
        receive = AsyncMock(
            side_effect=[
                {'type': 'http.request', 'body': value[:midpoint], 'more_body': True},
                {'type': 'http.request', 'body': value[midpoint:], 'more_body': False},
            ]
        )
        request = Request({'type': 'http', 'headers': [(b'content-type', b'application/json')]}, receive)
        with pytest.raises(OidcInteractionException) as raised:
            await _safe_json_body(request, InteractionLoginModel)
        assert raised.value.error == 'invalid_request', reason
        assert 'super-secret' not in str(raised.value)


@pytest.mark.usefixtures('oidc_enabled')
def test_interaction_routes_stream_and_normalize_malformed_json_without_password_echo() -> None:
    """真实 ASGI 路由以流式上限读取请求，异常响应不回显凭据。"""
    app = FastAPI()
    handle_exception(app)
    app.include_router(interaction_controller)

    async def db_override() -> Any:
        """
        为请求提供替代数据库会话。

        :yield: 本次请求使用的模拟数据库会话
        """
        yield AsyncMock(spec=AsyncSession)

    app.dependency_overrides[get_db_session_provider(None)] = db_override
    app.dependency_overrides[require_oidc_protocol_ready] = lambda: None
    client = TestClient(app)
    cases = [
        ('application/json', b'{"userName":"alice","password":"secret","password":"again"}'),
        ('application/json', json.dumps({'userName': 'alice', 'password': 'secret', 'unknown': True}).encode()),
        ('application/json', b'{"userName":"alice","password":"' + b'x' * (16 * 1024) + b'"}'),
        ('text/plain', b'{"userName":"alice","password":"secret"}'),
    ]
    for content_type, body in cases:
        response = client.post(
            '/auth/interaction/interaction-id/login',
            content=body,
            headers={'content-type': content_type},
        )
        assert response.status_code == _HTTP_BAD_REQUEST
        assert 'secret' not in response.text
        assert 'again' not in response.text
        assert response.headers['cache-control'] == 'no-store'
        assert response.headers['pragma'] == 'no-cache'


@pytest.mark.asyncio
async def test_db_commit_then_redis_cas_failure_runs_compensation(monkeypatch: pytest.MonkeyPatch) -> None:
    """DB 已提交但 Redis CAS 失败时必须执行补偿且保留可重试状态。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    compensated = False

    async def failed_transition(*args: object, **kwargs: object) -> object:
        """
        模拟此操作抛出 OidcInteractionException 的情形。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises OidcInteractionException: 模拟交互状态的比较交换失败
        """
        raise OidcInteractionException(created.interaction_id, 'CAS failed', error='server_error', status_code=503)

    async def compensate() -> None:
        """记录失败处理是否触发补偿。"""
        nonlocal compensated
        compensated = True

    monkeypatch.setattr(InteractionService, 'transition', failed_transition)
    with pytest.raises(OidcInteractionException):
        await InteractionFlowService.commit_transition(
            AsyncMock(spec=AsyncSession),
            AfterCommitCoordinator(),
            redis.client,
            created.interaction_id,
            'completed',
            compensate=compensate,
        )
    assert compensated is True
    assert (await InteractionService.get_record(redis.client, created.interaction_id))['status'] == 'awaiting_login'


@pytest.mark.asyncio
async def test_consent_commit_then_redis_cas_failure_compensates_persisted_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """同意 Grant 已提交但 Interaction CAS 失败时必须持久化撤销补偿。"""
    redis = FakeRedis()
    created = await InteractionService.create(
        redis.client,
        _payload('awaiting_consent', userId=2, subjectId='subject-2', authVersion=1),
        pepper=_PEPPER,
    )
    grant = SysOAuthGrant(grant_id='grant-after-commit', user_id=2, subject_id='subject-2')
    persisted = OAuthGrantSnapshot(
        grant_id=grant.grant_id,
        user_id=grant.user_id,
        subject_id=grant.subject_id,
        client_pk=1,
        granted_scopes=('openid', 'profile'),
        granted_resources=(),
        client_policy_version=1,
        status='active',
        consented_at=datetime.now(UTC),
        expires_at=None,
        revoked_at=None,
        revoke_reason=None,
        last_used_at=None,
    )
    result = ConsentResult(
        approved=True,
        scopes=('openid', 'profile'),
        grant=grant,
        persisted_grant=persisted,
    )
    db = AsyncMock(spec=AsyncSession)
    compensated = False

    async def revoke(*_args: object, **_kwargs: object) -> bool:
        """
        在此测试分支返回 True。

        :param _args: 调用方传入的其余位置参数
        :param _kwargs: 调用方按名称传入的附加选项
        :return: 此分支的固定值 ``True``
        """
        return True

    monkeypatch.setattr(OAuthGrantDao, 'revoke_snapshot', revoke)

    async def compensate() -> None:
        """记录失败处理是否触发补偿。"""
        nonlocal compensated
        compensated = True
        await ConsentService.compensate_persisted_grant(db, result)

    async def cas_failure(*_args: object, **_kwargs: object) -> None:
        """
        模拟此操作抛出 OidcInteractionException 的情形。

        :param _args: 调用方传入的其余位置参数
        :param _kwargs: 调用方按名称传入的附加选项
        :raises OidcInteractionException: 模拟交互状态的比较交换失败
        """
        raise OidcInteractionException(created.interaction_id, 'CAS failed', error='server_error', status_code=503)

    monkeypatch.setattr(InteractionService, 'transition', cas_failure)
    with pytest.raises(OidcInteractionException):
        await InteractionFlowService.commit_transition(
            db,
            AfterCommitCoordinator(),
            redis.client,
            created.interaction_id,
            'completed',
            compensate=compensate,
        )

    assert compensated is True
    assert db.commit.await_count >= _MIN_EXPECTED_COMMITS


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_password_change_cas_failure_runs_full_security_saga(monkeypatch: pytest.MonkeyPatch) -> None:
    """改密已提交后 CAS 失败会删除 Interaction、撤销新 Session 并独立记高危审计。"""
    subject_id = '11111111-1111-4111-8111-111111111111'
    payload = _payload(
        'password_change_required',
        userId=2,
        subjectId=subject_id,
        authVersion=1,
        credentialProofHash=OidcUtil.credential_proof(
            'interaction-controller-id', 2, subject_id, 1, pepper=OidcConfig.oidc_token_hash_pepper
        ),
    )
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, payload, pepper=_PEPPER)
    stored = await InteractionService.get_record(redis.client, created.interaction_id)
    stored['status'] = 'password_change_required'
    stored['credentialProofHash'] = OidcUtil.credential_proof(
        created.interaction_id, 2, subject_id, 1, pepper=OidcConfig.oidc_token_hash_pepper
    )
    await redis.set(
        OidcRedisKey.interaction(created.interaction_id),
        json.dumps(stored, separators=(',', ':')),
        ex=60,
    )
    user = SimpleNamespace(
        user_id=2,
        password=PwdUtil.get_password_hash('old-password'),
        status='0',
        del_flag='0',
        pwd_update_date=None,
    )
    subject = SimpleNamespace(subject_id=subject_id, auth_version=2)
    session = SimpleNamespace(sid='new-session', user_id=2, subject_id=subject_id, auth_version=2)
    db = _scalar_session(user)
    revoked: list[str] = []
    audit_events: list[str] = []

    monkeypatch.setattr(UserService, 'validate_password_services', lambda *_args, **_kwargs: _async(None))
    monkeypatch.setattr(IdentitySubjectService, 'require_by_user_id', lambda *_args, **_kwargs: _async(subject))
    monkeypatch.setattr(IdentitySecurityEventService, 'handle_user_event', lambda *_args, **_kwargs: _async(None))
    monkeypatch.setattr(
        SsoSessionService,
        'revoke_user',
        lambda *_args, **_kwargs: _async(None),
    )
    monkeypatch.setattr(
        SsoSessionService,
        'create',
        lambda *_args, **_kwargs: _async(('ss1.new-session.' + 'A' * 43, session)),
    )

    async def revoke(*_args: object, **_kwargs: object) -> None:
        """
        在请求处理中撤销测试凭据。

        :param _args: 调用方传入的其余位置参数
        :param _kwargs: 调用方按名称传入的附加选项
        """
        revoked.append(session.sid)

    async def record_independent(*args: object, **_kwargs: object) -> None:
        """
        记录独立事务写入的审计事件。

        :param args: 传给被调用对象的位置参数
        :param _kwargs: 调用方按名称传入的附加选项
        """
        audit_events.append(str(args[1]))

    monkeypatch.setattr(SsoSessionService, 'revoke', revoke)
    monkeypatch.setattr(AuditService, 'record_independent', record_independent)

    async def cas_fail(*args: object, **kwargs: object) -> None:
        """
        模拟此操作抛出 OidcInteractionException 的情形。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises OidcInteractionException: 模拟交互状态的比较交换失败
        """
        raise OidcInteractionException(created.interaction_id, 'CAS failed', error='server_error', status_code=503)

    monkeypatch.setattr(InteractionService, 'transition', cas_fail)
    with pytest.raises(OidcInteractionException) as raised:
        await InteractionLoginService.change_password(
            redis.client,
            created.interaction_id,
            ChangePasswordModel(
                old_password='old-password', new_password='new-password-A1!', confirm_password='new-password-A1!'
            ),
            db,
            created.csrf_token,
        )
    assert raised.value.error == 'server_error'
    assert await redis.get(OidcRedisKey.interaction(created.interaction_id)) is None
    assert revoked == [session.sid]
    assert audit_events == [OidcAuditEvent.LOGIN_FAILED]
    assert db.commit.await_count >= _MIN_EXPECTED_COMMITS


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_password_change_saga_continues_when_interaction_delete_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """补偿删除 Interaction 失败时仍继续撤销 Session 和独立审计。"""
    subject_id = '11111111-1111-4111-8111-111111111111'
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    stored = await InteractionService.get_record(redis.client, created.interaction_id)
    stored.update(
        {
            'status': 'password_change_required',
            'userId': 2,
            'subjectId': subject_id,
            'authVersion': 1,
            'credentialProofHash': OidcUtil.credential_proof(
                created.interaction_id, 2, subject_id, 1, pepper=OidcConfig.oidc_token_hash_pepper
            ),
        }
    )
    await redis.set(OidcRedisKey.interaction(created.interaction_id), json.dumps(stored), ex=60)
    user = SimpleNamespace(
        user_id=2,
        password=PwdUtil.get_password_hash('old-password'),
        status='0',
        del_flag='0',
        pwd_update_date=None,
    )
    session = SimpleNamespace(sid='new-session', user_id=2, subject_id=subject_id, auth_version=2)
    db = _scalar_session(user)
    revoked: list[str] = []
    audits: list[str] = []

    async def delete_failure(*_args: object, **_kwargs: object) -> int:
        """
        模拟此操作抛出 RuntimeError 的情形。

        :param _args: 调用方传入的其余位置参数
        :param _kwargs: 调用方按名称传入的附加选项
        :raises RuntimeError: 模拟删除 Redis 记录失败
        """
        raise RuntimeError('redis unavailable')

    monkeypatch.setattr(redis, 'delete', delete_failure)
    monkeypatch.setattr(UserService, 'validate_password_services', lambda *_args, **_kwargs: _async(None))
    monkeypatch.setattr(
        IdentitySubjectService,
        'require_by_user_id',
        lambda *_args, **_kwargs: _async(SimpleNamespace(subject_id=subject_id, auth_version=2)),
    )
    monkeypatch.setattr(IdentitySecurityEventService, 'handle_user_event', lambda *_args, **_kwargs: _async(None))
    monkeypatch.setattr(SsoSessionService, 'revoke_user', lambda *_args, **_kwargs: _async(None))
    monkeypatch.setattr(SsoSessionService, 'create', lambda *_args, **_kwargs: _async(('cookie', session)))
    monkeypatch.setattr(SsoSessionService, 'revoke', lambda *_args, **_kwargs: _append_async(revoked, session.sid))
    monkeypatch.setattr(AuditService, 'record_independent', lambda *args, **kwargs: _append_async(audits, str(args[1])))

    async def cas_fail(*_args: object, **_kwargs: object) -> None:
        """
        模拟此操作抛出 OidcInteractionException 的情形。

        :param _args: 调用方传入的其余位置参数
        :param _kwargs: 调用方按名称传入的附加选项
        :raises OidcInteractionException: 模拟交互状态的比较交换失败
        """
        raise OidcInteractionException(created.interaction_id, 'CAS failed', error='server_error', status_code=503)

    monkeypatch.setattr(InteractionService, 'transition', cas_fail)
    with pytest.raises(OidcInteractionException):
        await InteractionLoginService.change_password(
            redis.client,
            created.interaction_id,
            ChangePasswordModel(
                old_password='old-password', new_password='new-password-A1!', confirm_password='new-password-A1!'
            ),
            db,
            created.csrf_token,
        )
    assert revoked == [session.sid]
    assert audits == [OidcAuditEvent.LOGIN_FAILED]


def _scalar_session(value: object) -> AsyncMock:
    """
    构造直接标量查询和结果集查询都返回指定对象的会话。

    :param value: 应返回的记录
    :return: 可检查事务调用的数据库会话替身
    """
    session = AsyncMock(spec=AsyncSession)
    session.scalar.return_value = value
    result = Mock()
    result.scalars.return_value.first.return_value = value
    session.execute.return_value = result
    return session


@pytest.mark.asyncio
async def test_cache_callback_failure_does_not_compensate_committed_session() -> None:
    """提交后缓存回调失败与状态 CAS 失败分离，不撤销已落库 Session。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    compensated = False

    async def cache_failure() -> None:
        """
        模拟此操作抛出 RuntimeError 的情形。

        :raises RuntimeError: 模拟缓存服务不可用
        """
        raise RuntimeError('cache unavailable')

    async def compensate() -> None:
        """记录失败处理是否触发补偿。"""
        nonlocal compensated
        compensated = True

    coordinator = AfterCommitCoordinator()
    await coordinator.register(cache_failure)
    with pytest.raises(OidcInteractionException):
        await InteractionFlowService.commit_transition(
            AsyncMock(spec=AsyncSession),
            coordinator,
            redis.client,
            created.interaction_id,
            'completed',
            compensate=compensate,
        )
    assert compensated is False
    assert (await InteractionService.get_record(redis.client, created.interaction_id))['status'] == 'completed'


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_code_audit_failure_invalidates_code_and_marker(monkeypatch: pytest.MonkeyPatch) -> None:
    """审计或提交失败时授权码与 completion marker 均不可继续使用。"""
    store = FakeRedis()
    redis = Mock(spec=Redis, wraps=store)
    created = await InteractionService.create(redis, _payload('completed'), pepper=_PEPPER)
    marker = OidcRedisKey.interaction(f'{created.interaction_id}-completion')
    await redis.set(marker, 'reserved', ex=60)
    session = SimpleNamespace(
        sid='sid-1',
        user_id=2,
        subject_id='11111111-1111-4111-8111-111111111111',
        auth_version=1,
        auth_time=None,
    )
    monkeypatch.setattr(
        InteractionCompletionService,
        'active_session',
        lambda *_args, **_kwargs: _async(session),
    )
    monkeypatch.setattr(
        'module_identity.service.authorization_service.AuthorizationService._completion_grant',
        AsyncMock(return_value=SimpleNamespace(grant_id='grant-1')),
    )

    async def audit_failure(*_args: object, **_kwargs: object) -> None:
        """
        模拟此操作抛出 RuntimeError 的情形。

        :param _args: 调用方传入的其余位置参数
        :param _kwargs: 调用方按名称传入的附加选项
        :raises RuntimeError: 模拟审计服务不可用
        """
        raise RuntimeError('audit unavailable')

    monkeypatch.setattr(AuditService, 'record', audit_failure)
    record = await InteractionService.get_record(redis, created.interaction_id)
    with pytest.raises(OAuthProtocolException) as raised:
        await InteractionCompletionService._issue_code(
            AsyncMock(spec=AsyncSession), redis, record, 'https://portal.example/callback', marker
        )
    assert raised.value.error == 'server_error'
    assert await redis.get(marker) is None
    assert not any(key.startswith('oidc:authorization_code:') for key in store.values)


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
async def test_code_invalidate_failure_still_cleans_marker_and_rolls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    """授权码失效补偿自身失败时仍继续清理 marker、回滚且只返回脱敏错误。"""
    redis = Mock(spec=Redis, wraps=FakeRedis())
    created = await InteractionService.create(redis, _payload('completed'), pepper=_PEPPER)
    marker = OidcRedisKey.interaction(f'{created.interaction_id}-completion')
    await redis.set(marker, 'reserved', ex=60)
    session = SimpleNamespace(
        sid='sid-1',
        user_id=2,
        subject_id='11111111-1111-4111-8111-111111111111',
        auth_version=1,
        auth_time=None,
    )
    monkeypatch.setattr(
        InteractionCompletionService,
        'active_session',
        lambda *_args, **_kwargs: _async(session),
    )
    monkeypatch.setattr(AuditService, 'record', lambda *_args, **_kwargs: _raise_async(RuntimeError('audit')))
    invalidate = AsyncMock(side_effect=RuntimeError('redis invalidate failed'))
    monkeypatch.setattr(AuthorizationCodeService, 'invalidate', invalidate)
    monkeypatch.setattr(
        'module_identity.service.authorization_service.AuthorizationService._completion_grant',
        AsyncMock(return_value=SimpleNamespace(grant_id='grant-1')),
    )
    db = AsyncMock(spec=AsyncSession)
    record = await InteractionService.get_record(redis, created.interaction_id)
    with pytest.raises(OAuthProtocolException) as raised:
        await InteractionCompletionService._issue_code(db, redis, record, 'https://portal.example/callback', marker)
    assert raised.value.error == 'server_error'
    assert await redis.get(marker) is None
    invalidate.assert_awaited_once()
    db.rollback.assert_awaited_once()


def _async(value: object) -> Any:
    """
    构造异步测试结果。

    :param value: 待处理的输入值
    :return: 异步测试结果
    """

    async def result() -> object:
        """
        向调用方返回 ``value``。

        :return: 为此调用预设的值
        """
        return value

    return result()


def _append_async(values: list[Any], value: Any) -> Any:
    """
    构造追加测试值的异步结果。

    :param values: 当前处理的值集合
    :param value: 待处理的输入值
    :return: 追加测试值的异步结果
    """

    async def result() -> None:
        """记录调用方收到的异步结果。"""
        values.append(value)

    return result()


@pytest.mark.asyncio
@pytest.mark.usefixtures('oidc_enabled')
@pytest.mark.parametrize('endpoint', ['', 'captcha', 'login', 'change-password', 'consent', 'cancel', 'complete'])
@pytest.mark.usefixtures('interaction_page_metadata')
async def test_interaction_http_response_matches_frontend_data_contract(
    monkeypatch: pytest.MonkeyPatch, endpoint: str
) -> None:
    """真实 HTTP 响应按 OpenAPI 和页面约定将交互字段放在 data 下。"""
    redis = FakeRedis()
    created = await InteractionService.create(redis.client, _payload(), pepper=_PEPPER)
    result = InteractionResultModel(
        next_action='redirect', interaction_id=created.interaction_id, redirect_url='/auth/interaction/complete'
    )
    outcome = InteractionLoginOutcome(result=result)
    monkeypatch.setattr(InteractionLoginService, 'login', AsyncMock(return_value=outcome))
    monkeypatch.setattr(InteractionLoginService, 'change_password', AsyncMock(return_value=outcome))
    monkeypatch.setattr(InteractionConsentService, 'consent', AsyncMock(return_value=result))
    monkeypatch.setattr(InteractionConsentService, 'cancel', AsyncMock(return_value=result))
    monkeypatch.setattr(
        InteractionCompletionService, 'complete', AsyncMock(return_value=SimpleNamespace(location=result.redirect_url))
    )
    await redis.set(f'{RedisInitKeyConfig.SYS_CONFIG.key}:sys.account.captchaEnabled', 'false')
    app = FastAPI()
    app.state.redis = redis
    app.include_router(interaction_controller)

    async def db_override() -> Any:
        """
        为请求提供替代数据库会话。

        :yield: 本次请求使用的模拟数据库会话
        """
        yield AsyncMock(spec=AsyncSession)

    app.dependency_overrides[get_db_session_provider(None)] = db_override
    app.dependency_overrides[require_oidc_protocol_ready] = lambda: None
    bodies = {
        'login': {'userName': 'alice', 'password': 'test-password'},
        'change-password': {'oldPassword': 'old', 'newPassword': 'new', 'confirmPassword': 'new'},
        'consent': {'approved': True, 'scopes': ['openid']},
    }
    path = '/auth/interaction/' + created.interaction_id + ('/' + endpoint if endpoint else '')
    with TestClient(app) as client:
        response = client.request(
            'GET' if endpoint in {'', 'captcha'} else 'POST',
            path,
            headers={'X-CSRF-Token': created.csrf_token},
            json=bodies.get(endpoint),
        )
    assert response.status_code == _HTTP_OK
    payload = response.json()
    model = (
        InteractionViewModel
        if not endpoint
        else CaptchaResponseModel
        if endpoint == 'captcha'
        else InteractionResultModel
    )
    model.model_validate(payload['data'])
    assert payload['code'] == _HTTP_OK and payload['success']
    assert 'nextAction' not in payload and 'captchaEnabled' not in payload
    assert response.headers['cache-control'] == 'no-store'
