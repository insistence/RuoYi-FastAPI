from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from exceptions.exception import OAuthProtocolException, OidcInteractionException
from exceptions.handle import handle_exception
from module_identity.security.backchannel_transport import PermanentBackchannelError
from module_identity.service.token_protocol_service import RevocationError


@pytest.mark.parametrize(
    ('error', 'description', 'message'),
    [
        ('invalid_client', 'Client authentication failed', '客户端认证失败'),
        ('invalid_scope', 'Requested scope is not authorized', '请求的权限范围尚未获准'),
        ('server_error', 'Token endpoint is unavailable', '令牌服务暂不可用'),
    ],
)
def test_protocol_exception_has_chinese_diagnostics_and_compatible_wire_description(
    error: str, description: str, message: str
) -> None:
    """协议异常提供中文诊断并保留兼容的协议描述。"""
    exception = OAuthProtocolException(error, description)

    assert str(exception) == exception.message == message
    assert exception.as_dict() == {'error': error, 'error_description': description}


def test_code_only_exception_keeps_optional_protocol_description_absent() -> None:
    """只有错误码的异常省略可选的协议描述。"""
    exception = OAuthProtocolException('invalid_scope')

    assert str(exception) == '请求的权限范围无效'
    assert exception.as_dict() == {'error': 'invalid_scope'}


def test_chinese_interaction_message_keeps_redirect_protocol_ascii_and_state_unchanged() -> None:
    """中文交互消息保留跳转参数的 ASCII 编码和原始状态。"""
    app = FastAPI()
    handle_exception(app)
    interaction = OidcInteractionException(
        'interaction-id',
        '权限范围策略已变更，请重新授权',
        error='invalid_scope',
        redirect_uri='https://client.example/callback?tenant=one',
        state='opaque-state',
        redirect_uri_verified=True,
    )

    @app.get(
        '/authorize', summary='模拟需要交互的授权', description='返回认证交互的协议错误，用于验证跳转参数与状态编码。'
    )
    async def authorize() -> None:
        raise interaction.as_protocol_exception()

    with TestClient(app) as client:
        response = client.get('/authorize', follow_redirects=False)

    assert response.status_code == status.HTTP_303_SEE_OTHER
    assert str(interaction) == '权限范围策略已变更，请重新授权'
    location = response.headers['location']
    assert location.isascii()
    assert parse_qs(urlsplit(location).query) == {
        'tenant': ['one'],
        'error': ['invalid_scope'],
        'error_description': ['Scope policy has changed'],
        'state': ['opaque-state'],
    }
    assert response.headers['cache-control'] == 'no-store'


@pytest.mark.parametrize('description', ['内部诊断：private-marker', 'dependency\nprivate-marker'])
def test_unknown_diagnostic_is_not_exposed_as_protocol_description(description: str) -> None:
    """未知诊断信息不会作为协议描述公开。"""
    app = FastAPI()
    handle_exception(app)

    @app.get('/token', summary='模拟令牌服务错误', description='触发服务端协议错误，用于验证对外返回的诊断信息。')
    async def token() -> None:
        raise OAuthProtocolException('server_error', description, status_code=503)

    with TestClient(app) as client:
        response = client.get('/token')

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json() == {'error': 'server_error', 'error_description': 'Authorization service is unavailable'}
    assert 'private-marker' not in response.text
    assert response.headers['cache-control'] == 'no-store'


def test_revocation_exception_localizes_diagnostics_without_changing_protocol_fields() -> None:
    """撤销异常本地化诊断并保留协议字段。"""
    exception = RevocationError('invalid_client', 'Client authentication failed')

    assert str(exception) == exception.message == '客户端认证失败'
    assert exception.error == 'invalid_client'
    assert exception.description == 'Client authentication failed'


def test_backchannel_exception_keeps_audit_code_independent_from_chinese_diagnostics() -> None:
    """后通道异常的审计码独立于中文诊断。"""
    exception = PermanentBackchannelError('invalid retry payload', '后端退出通知重试载荷无效')

    assert str(exception) == exception.message == '后端退出通知重试载荷无效'
    assert exception.failure_code == 'invalid retry payload'
