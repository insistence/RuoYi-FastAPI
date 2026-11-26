from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from exceptions.exception import OAuthProtocolException, OidcInteractionException
from exceptions.handle import handle_exception


def _client() -> TestClient:
    """
    创建启用了测试配置的请求客户端。

    :return: 启用了测试配置的请求客户端
    """
    app = FastAPI()
    handle_exception(app)

    @app.get(
        '/invalid-client', summary='模拟客户端认证失败', description='返回 OAuth 客户端认证失败的错误和认证响应头。'
    )
    async def invalid_client() -> None:
        raise OAuthProtocolException(
            'invalid_client',
            'Client authentication failed',
            status.HTTP_401_UNAUTHORIZED,
            headers={'Cache-Control': 'public, max-age=3600', 'Pragma': 'cache'},
        )

    @app.get('/authorize-error', summary='模拟授权被拒绝', description='向客户端回调地址返回授权错误并保留状态参数。')
    async def authorize_error() -> None:
        raise OAuthProtocolException(
            'access_denied',
            redirect_uri=(
                'https://client.example/callback?tenant=one&tenant=two&error=old&error_description=old'
                '&error_uri=https%3A%2F%2Fevil.example&code=old&state=old&iss=https%3A%2F%2Fevil.example'
            ),
            state='opaque-state',
            redirect_uri_verified=True,
            issuer='https://auth.example.com',
        )

    @app.get(
        '/invalid-redirect',
        summary='验证无效回调地址',
        description='对含片段的回调地址触发授权错误，检查错误响应的去向。',
    )
    async def invalid_redirect() -> None:
        raise OAuthProtocolException(
            'access_denied',
            redirect_uri='https://client.example/callback#fragment',
            redirect_uri_verified=True,
        )

    @app.get('/interaction', summary='模拟认证交互过期', description='触发交互过期错误，用于核对协议错误响应。')
    async def interaction() -> None:
        raise OidcInteractionException('interaction-1', 'Interaction expired')

    return TestClient(app)


def test_invalid_client_uses_standard_oauth_json() -> None:
    """无效客户端按标准 OAuth JSON 返回。"""
    response = _client().get('/invalid-client')

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()['error'] == 'invalid_client'
    assert response.headers['cache-control'] == 'no-store'
    assert response.headers['pragma'] == 'no-cache'
    assert response.headers['www-authenticate'] == 'Basic realm="oauth2/token"'
    assert 'success' not in response.json()


def test_verified_redirect_replaces_protocol_parameters_and_preserves_application_query() -> None:
    """已验证的重定向替换协议参数并保留业务查询。"""
    response = _client().get('/authorize-error', follow_redirects=False)

    assert response.status_code == status.HTTP_303_SEE_OTHER
    assert response.headers['location'] == (
        'https://client.example/callback?tenant=one&tenant=two&error=access_denied&state=opaque-state'
        '&iss=https%3A%2F%2Fauth.example.com'
    )
    assert response.headers['cache-control'] == 'no-store'
    assert response.headers['pragma'] == 'no-cache'


def test_invalid_validated_redirect_fails_closed_locally() -> None:
    """已验证的重定向失效时在本地拒绝请求。"""
    response = _client().get('/invalid-redirect', follow_redirects=False)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'location' not in response.headers
    assert response.json()['error'] == 'server_error'


def test_interaction_exception_keeps_business_response_boundary() -> None:
    """交互异常使用业务响应约定。"""
    response = _client().get('/interaction')

    assert response.status_code == status.HTTP_200_OK
    assert response.json()['code'] is not None
    assert response.json()['data'] == 'interaction-1'
    assert 'error' not in response.json()
    assert response.headers['cache-control'] == 'no-store'
    assert response.headers['pragma'] == 'no-cache'
