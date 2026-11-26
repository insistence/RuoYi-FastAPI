import re
from collections.abc import AsyncIterator, Iterator
from time import monotonic
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from common.aspect.db_session import get_db_session_provider
from config.env import OidcConfig
from middlewares.oidc_cors_middleware import OidcCorsMiddleware
from module_identity.controller.authorization_controller import authorization_controller
from module_identity.dao.oauth_client_dao import OAuthClientDao
from module_identity.dependencies import require_oidc_protocol_ready
from module_identity.service.infrastructure_service import OidcRateLimiter
from module_identity.service.logout_confirmation_service import LogoutConfirmationService
from module_identity.service.session_service import LogoutResult, LogoutService


class ConfirmationRedis:
    """
    模拟带过期时间的注销确认记录。

    :ivar values: 当前处理的值集合
    """

    def __init__(self) -> None:
        """初始化测试夹具的 ``values``。"""
        self.values: dict[str, tuple[str, float]] = {}

    async def set(self, key: str, value: str, *, ex: int, nx: bool = False) -> bool:
        """
        写入测试缓存键并设置过期时间。

        :param key: 查找数据时使用的键
        :param value: 待处理的输入值
        :param ex: 捕获到的异常实例
        :param nx: 是否只在键尚不存在时写入
        :return: 是否写入测试缓存键并设置过期时间
        """
        if nx and key in self.values:
            return False
        self.values[key] = (value, monotonic() + ex)
        return True

    async def eval(self, _script: str, _count: int, key: str) -> str | None:
        """
        按测试约定模拟 Redis 脚本的执行。

        :param _script: 测试替身接收的 Redis 脚本
        :param _count: 调用方传入的计数
        :param key: 查找数据时使用的键
        :return: 模拟脚本读取或更新后的值
        """
        value, expires = self.values.pop(key, (None, 0))
        return value if expires > monotonic() else None


def _confirmation_token(html: str) -> str:
    """
    提取确认表单中的一次性令牌。

    :param html: 注销确认页面
    :return: 表单提交所需的令牌
    """
    match = re.search(r'name="confirmation" value="(?P<token>[^"]+)"', html)
    assert match is not None
    token = match.group('token')
    assert isinstance(token, str)
    return token


@pytest.fixture
def logout_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, AsyncMock]]:
    """
    创建启用认证中心的注销测试客户端。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    :yield: 依次为 ``client``、``execute`` 的元组
    """
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    monkeypatch.setattr(OidcConfig, 'oidc_issuer', 'https://auth.example')
    monkeypatch.setattr(OidcConfig, 'oidc_token_hash_pepper', 'logout-confirmation-test-' + 'x' * 32)
    monkeypatch.setattr(OidcRateLimiter, 'enforce', AsyncMock())
    monkeypatch.setattr(LogoutConfirmationService, 'form_redirect_origin', AsyncMock(return_value='https://rp.example'))
    app = FastAPI()
    app.add_middleware(OidcCorsMiddleware)
    app.state.redis = ConfirmationRedis()
    app.include_router(authorization_controller)
    db = AsyncMock(spec=AsyncSession)

    async def get_db() -> AsyncIterator[AsyncMock]:
        """
        为请求提供数据库会话。

        :yield: 当前操作使用的数据库会话
        """
        yield db

    app.dependency_overrides[get_db_session_provider(None)] = get_db
    app.dependency_overrides[require_oidc_protocol_ready] = lambda: None
    execute = AsyncMock(return_value=LogoutResult('https://rp.example/done', 'state-1', True))
    monkeypatch.setattr(LogoutService, 'execute_logout', execute)
    with TestClient(app, base_url='https://auth.example', follow_redirects=False) as client:
        yield client, execute


@pytest.mark.parametrize('method', ['GET', 'POST'])
def test_standard_logout_requires_confirmation_then_redirects(
    logout_client: tuple[TestClient, AsyncMock], method: str
) -> None:
    """标准注销先确认再重定向。"""
    client, execute = logout_client
    parameters = {
        'id_token_hint': 'private-hint',
        'post_logout_redirect_uri': 'https://rp.example/done',
        'state': 'state-1',
    }
    response = (
        client.get('/oauth2/logout', params=parameters)
        if method == 'GET'
        else client.post('/oauth2/logout', data=parameters)
    )
    assert response.status_code == status.HTTP_200_OK
    assert '确认退出' in response.text
    assert 'private-hint' not in response.text
    assert "frame-ancestors 'none'" in response.headers['content-security-policy']
    assert "form-action 'self' https://rp.example;" in response.headers['content-security-policy']
    execute.assert_not_awaited()
    token = _confirmation_token(response.text)
    response = client.post(
        '/oauth2/logout/confirm',
        data={'confirmation': token, 'decision': 'confirm'},
        headers={'Origin': 'https://auth.example'},
    )
    assert response.status_code == status.HTTP_303_SEE_OTHER
    assert response.headers['location'] == 'https://rp.example/done?state=state-1'
    assert execute.await_args_list[-1].kwargs['confirmed'] is True
    assert execute.await_args_list[-1].kwargs['id_token_hint'] == 'private-hint'
    execute.reset_mock()
    replay = client.post(
        '/oauth2/logout/confirm',
        data={'confirmation': token, 'decision': 'confirm'},
        headers={'Origin': 'https://auth.example'},
    )
    assert replay.status_code == status.HTTP_400_BAD_REQUEST
    execute.assert_not_awaited()


def test_cancel_keeps_sso_cookie_and_never_calls_revocation(logout_client: tuple[TestClient, AsyncMock]) -> None:
    """取消注销时保留单点登录 Cookie 且不撤销会话。"""
    client, execute = logout_client
    client.cookies.set(OidcConfig.oidc_sso_cookie_name, 'current-sso', domain='auth.example', path='/')
    page = client.get('/oauth2/logout')
    token = _confirmation_token(page.text)
    response = client.post(
        '/oauth2/logout/confirm',
        data={'confirmation': token, 'decision': 'cancel'},
        headers={'Origin': 'https://auth.example'},
    )
    assert response.status_code == status.HTTP_200_OK
    assert '已取消退出' in response.text
    assert OidcConfig.oidc_sso_cookie_name + '=' not in response.headers.get('set-cookie', '')
    execute.assert_not_awaited()


@pytest.mark.parametrize('attack', ['origin', 'cookie', 'expired'])
def test_confirmation_rejects_wrong_origin_browser_or_expiry(
    logout_client: tuple[TestClient, AsyncMock], attack: str
) -> None:
    """注销确认时拒绝来源、浏览器或有效期不符的请求。"""
    client, execute = logout_client
    page = client.get('/oauth2/logout')
    token = _confirmation_token(page.text)
    origin = 'https://evil.example' if attack == 'origin' else 'https://auth.example'
    if attack == 'cookie':
        client.cookies.clear()
    if attack == 'expired':
        assert isinstance(client.app, FastAPI)
        redis = client.app.state.redis
        redis.values = {key: (value, 0) for key, (value, _expires) in redis.values.items()}
    response = client.post(
        '/oauth2/logout/confirm', data={'confirmation': token, 'decision': 'confirm'}, headers={'Origin': origin}
    )
    assert response.status_code in {400, 403}
    execute.assert_not_awaited()


def test_cross_site_post_may_omit_lax_sso_cookie_until_confirmation(
    logout_client: tuple[TestClient, AsyncMock],
) -> None:
    """跨站POST不携带Lax Cookie，同源确认请求可携带会话Cookie。"""
    client, execute = logout_client
    page = client.post('/oauth2/logout', data={'state': 'cross-site'})
    assert page.headers['referrer-policy'] == 'strict-origin'
    token = _confirmation_token(page.text)
    client.cookies.set(OidcConfig.oidc_sso_cookie_name, 'current-sso', domain='auth.example', path='/')
    response = client.post(
        '/oauth2/logout/confirm',
        data={'confirmation': token, 'decision': 'confirm'},
        headers={'Origin': 'https://auth.example'},
    )
    assert response.status_code == status.HTTP_303_SEE_OTHER
    assert execute.await_args_list[-1].kwargs['cookie'] == 'current-sso'


def test_changing_an_initially_bound_sso_cookie_rejects_confirmation(
    logout_client: tuple[TestClient, AsyncMock],
) -> None:
    """最初绑定的单点登录 Cookie 变化后拒绝确认。"""
    client, execute = logout_client
    client.cookies.set(OidcConfig.oidc_sso_cookie_name, 'first-sso', domain='auth.example', path='/')
    page = client.get('/oauth2/logout')
    token = _confirmation_token(page.text)
    client.cookies.set(OidcConfig.oidc_sso_cookie_name, 'second-sso', domain='auth.example', path='/')
    response = client.post(
        '/oauth2/logout/confirm',
        data={'confirmation': token, 'decision': 'confirm'},
        headers={'Origin': 'https://auth.example'},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    execute.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('registered', [True, False])
async def test_confirmation_csp_allows_only_verified_registered_redirect(
    monkeypatch: pytest.MonkeyPatch, registered: bool
) -> None:
    """确认页的 CSP 仅允许已验证的注册重定向地址。"""
    monkeypatch.setattr(
        LogoutService, '_validate_id_token_hint', AsyncMock(return_value=({}, SimpleNamespace(client_pk=1)))
    )
    monkeypatch.setattr(
        OAuthClientDao,
        'find_exact_uri',
        AsyncMock(return_value=SimpleNamespace(status='0') if registered else None),
    )
    origin = await LogoutConfirmationService.form_redirect_origin(
        AsyncSession(), {'id_token_hint': 'valid-hint', 'post_logout_redirect_uri': 'https://rp.example:9443/done'}
    )
    assert origin == ('https://rp.example:9443' if registered else None)
    monkeypatch.setattr(LogoutService, '_validate_id_token_hint', AsyncMock(side_effect=ValueError('invalid hint')))
    assert (
        await LogoutConfirmationService.form_redirect_origin(
            AsyncSession(), {'id_token_hint': 'invalid-hint', 'post_logout_redirect_uri': 'https://rp.example/done'}
        )
        is None
    )
