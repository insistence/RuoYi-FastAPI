from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from config.env import AppConfig, OidcConfig
from middlewares.handle import handle_middleware
from middlewares.oidc_cors_middleware import OidcCorsMiddleware


@pytest.fixture(autouse=True)
def _mock_snapshot_refresh(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    用可控的异步调用替换跨域策略快照刷新。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    """
    monkeypatch.setattr('middlewares.oidc_cors_middleware.OidcRuntimeService.ensure_cors_snapshot', AsyncMock())


def _client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """
    创建启用了测试配置的请求客户端。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    :return: 启用了测试配置的请求客户端
    """
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    monkeypatch.setattr(OidcConfig, 'oidc_cors_allowed_origins', 'https://allowed.example')
    app = FastAPI()

    @app.get(
        '/.well-known/openid-configuration',
        summary='获取 OIDC 发现信息',
        description='返回测试认证中心的签发者地址，用于验证发现端点的跨域策略。',
    )
    async def discovery() -> dict[str, str]:
        return {'issuer': 'https://auth.example.com'}

    @app.get('/oauth2/authorize', summary='访问授权端点', description='返回授权端点的测试响应，用于验证跨域请求处理。')
    async def authorize() -> dict[str, bool]:
        return {'ok': True}

    @app.post(
        '/oauth2/token',
        summary='获取测试访问令牌',
        description='返回带有访问令牌的响应，用于检查令牌端点的跨域响应头。',
    )
    async def token() -> Response:
        return Response(
            content='{"access_token":"token"}',
            media_type='application/json',
            headers={'Vary': 'Accept-Encoding, Origin'},
        )

    @app.get(
        '/business', summary='访问普通业务端点', description='返回业务成功状态，用于比较协议路径和业务路径的跨域处理。'
    )
    async def business() -> dict[str, bool]:
        return {'ok': True}

    app.add_middleware(
        CORSMiddleware,
        allow_origins=['*'],
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )
    app.add_middleware(OidcCorsMiddleware)
    return TestClient(app)


def test_authorize_disallows_cors_but_discovery_remains_public(monkeypatch: pytest.MonkeyPatch) -> None:
    """授权端点禁止跨域访问而发现端点保持公开。"""
    client = _client(monkeypatch)
    origin = {'Origin': 'https://external.example'}

    discovery = client.get('/.well-known/openid-configuration', headers=origin)
    authorize = client.get('/oauth2/authorize', headers=origin)

    assert discovery.status_code == status.HTTP_200_OK
    assert discovery.headers['access-control-allow-origin'] == origin['Origin']
    assert authorize.status_code == status.HTTP_403_FORBIDDEN
    assert 'access-control-allow-origin' not in authorize.headers


def test_token_preflight_requires_explicit_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    """令牌预检必须显式指定来源。"""
    client = _client(monkeypatch)
    allowed = client.options(
        '/oauth2/token',
        headers={
            'Origin': 'https://allowed.example',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
    )
    denied = client.options(
        '/oauth2/token',
        headers={
            'Origin': 'https://denied.example',
            'Access-Control-Request-Method': 'POST',
        },
    )

    assert allowed.status_code == status.HTTP_200_OK
    assert allowed.headers['access-control-allow-origin'] == 'https://allowed.example'
    assert denied.status_code == status.HTTP_403_FORBIDDEN
    assert 'access-control-allow-origin' not in denied.headers


def test_token_form_post_from_disallowed_origin_is_rejected_before_downstream(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """令牌表单请求在进入下游前拒绝未许可来源。"""
    response = _client(monkeypatch).post(
        '/oauth2/token',
        data={'grant_type': 'authorization_code', 'code': 'opaque-code'},
        headers={'Origin': 'https://denied.example', 'Content-Type': 'application/x-www-form-urlencoded'},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert 'access-control-allow-origin' not in response.headers


def test_allowed_response_preserves_non_origin_vary_tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    """允许跨域的响应保留 Vary 中其他字段。"""
    client = _client(monkeypatch)

    response = client.post('/oauth2/token', headers={'Origin': 'https://allowed.example'})

    assert response.status_code == status.HTTP_200_OK
    assert response.headers['access-control-allow-origin'] == 'https://allowed.example'
    assert 'accept-encoding' in response.headers.get('vary', '').lower()
    assert 'origin' in response.headers.get('vary', '').lower()


def test_existing_business_cors_remains_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    """保留原有业务跨域规则。"""
    response = _client(monkeypatch).get('/business', headers={'Origin': 'https://current-web.example'})

    assert response.status_code == status.HTTP_200_OK
    baseline_client = _client(monkeypatch)
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', False)
    baseline = baseline_client.get('/business', headers={'Origin': 'https://current-web.example'})
    assert response.headers['access-control-allow-origin'] == baseline.headers['access-control-allow-origin']
    assert response.headers['access-control-allow-credentials'] == baseline.headers['access-control-allow-credentials']


def test_runtime_registered_origin_is_exact_and_does_not_allow_similar_hosts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """协议层注册缓存可扩展白名单，但相近 Host、路径和尾点仍拒绝。"""
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    monkeypatch.setattr(OidcConfig, 'oidc_cors_allowed_origins', '')
    app = FastAPI()
    app.state.oidc_registered_cors_origins = frozenset({'https://registered.example'})

    @app.post(
        '/oauth2/token',
        summary='验证令牌端点来源',
        description='返回令牌端点的测试响应，用于核对动态注册来源的匹配边界。',
    )
    async def token() -> Response:
        return Response('{}', media_type='application/json')

    app.add_middleware(OidcCorsMiddleware)
    client = TestClient(app)
    allowed = client.post('/oauth2/token', headers={'Origin': 'https://registered.example'})
    similar = client.post('/oauth2/token', headers={'Origin': 'https://registered.example.evil'})
    trailing = client.post('/oauth2/token', headers={'Origin': 'https://registered.example.'})
    path = client.post('/oauth2/token', headers={'Origin': 'https://registered.example/path'})
    assert allowed.status_code == status.HTTP_200_OK
    assert similar.status_code == status.HTTP_403_FORBIDDEN
    assert trailing.status_code == status.HTTP_403_FORBIDDEN
    assert path.status_code == status.HTTP_403_FORBIDDEN


def test_interaction_api_requires_exact_issuer_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    """交互登录、改密和完成接口不继承全局宽松 CORS。"""
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    monkeypatch.setattr(OidcConfig, 'oidc_issuer', 'https://auth.example.com/oidc')
    app = FastAPI()

    @app.post(
        '/auth/interaction/i-1/login', summary='提交交互登录', description='模拟登录提交，用于检查交互端点的跨域限制。'
    )
    async def login() -> Response:
        return Response('{}', media_type='application/json')

    @app.get(
        '/auth/interaction/i-1/complete',
        summary='完成认证交互',
        description='模拟认证交互结束，用于检查完成端点的跨域限制。',
    )
    async def complete() -> Response:
        return Response('{}', media_type='application/json')

    app.add_middleware(
        CORSMiddleware,
        allow_origins=['*'],
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )
    app.add_middleware(OidcCorsMiddleware)
    client = TestClient(app)

    allowed = client.post('/auth/interaction/i-1/login', headers={'Origin': 'https://auth.example.com'})
    denied = client.post('/auth/interaction/i-1/login', headers={'Origin': 'https://evil.example'})
    port_spoof = client.post('/auth/interaction/i-1/login', headers={'Origin': 'https://auth.example.com:443'})
    scheme_spoof = client.get('/auth/interaction/i-1/complete', headers={'Origin': 'http://auth.example.com'})

    assert allowed.status_code == status.HTTP_200_OK
    assert allowed.headers['access-control-allow-origin'] == 'https://auth.example.com'
    assert denied.status_code == status.HTTP_403_FORBIDDEN
    assert port_spoof.status_code == status.HTTP_403_FORBIDDEN
    assert scheme_spoof.status_code == status.HTTP_403_FORBIDDEN
    assert '*' not in allowed.headers.get('access-control-allow-origin', '')


def test_interaction_preflight_rejects_cross_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    """交互接口的预检不能被内层宽松 CORS 伪造成功。"""
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    monkeypatch.setattr(OidcConfig, 'oidc_issuer', 'https://auth.example.com')
    app = FastAPI()

    @app.post(
        '/auth/interaction/i-1/change-password',
        summary='提交交互密码变更',
        description='模拟交互改密，用于检查预检请求的处理。',
    )
    async def change_password() -> Response:
        return Response('{}')

    app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'])
    app.add_middleware(OidcCorsMiddleware)
    response = TestClient(app).options(
        '/auth/interaction/i-1/change-password',
        headers={'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'POST'},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert 'access-control-allow-origin' not in response.headers


def test_oidc_cors_is_bypassed_when_provider_is_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """关闭认证中心时 OIDC 路径不得被专用 CORS 中间件拦截。"""
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', False)
    app = FastAPI()

    @app.post(
        '/oauth2/token',
        summary='访问已关闭认证中心的令牌路径',
        description='返回测试响应，用于验证关闭认证中心后的中间件行为。',
    )
    async def token() -> Response:
        return Response('{}', media_type='application/json')

    app.add_middleware(OidcCorsMiddleware)
    response = TestClient(app).post('/oauth2/token', headers={'Origin': 'https://denied.example'})

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.parametrize('enabled', [False, True])
def test_global_registration_follows_oidc_switch(monkeypatch: pytest.MonkeyPatch, enabled: bool) -> None:
    """全局中间件注册应与 OIDC_ENABLED 开关保持一致。"""
    monkeypatch.setattr(AppConfig, 'app_demo_mode', False)
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', enabled)

    app = FastAPI()
    handle_middleware(app)

    registered = any(item.cls is OidcCorsMiddleware for item in app.user_middleware)
    assert registered is enabled
