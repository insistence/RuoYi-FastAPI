from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

from common.annotation.log_annotation import Log
from common.constant import HttpStatusConstant
from common.context import RequestContext
from common.enums import BusinessType
from exceptions.exception import (
    AuthException,
    FileRangeNotSatisfiableException,
    LoginException,
    OAuthProtocolException,
    OidcInteractionException,
    PermissionException,
    ServiceException,
)
from exceptions.handle import handle_exception
from module_admin.service.log_service import LogQueueService
from utils.dependency_util import DependencyUtil


@pytest.fixture
def log_context(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    monkeypatch.setattr(DependencyUtil, 'check_exclude_routes', lambda *args, **kwargs: None)
    monkeypatch.setattr(Log, '_get_oper_location', AsyncMock(return_value='测试'))
    monkeypatch.setattr(
        RequestContext,
        'get_current_user',
        lambda: SimpleNamespace(
            user=SimpleNamespace(user_name='tester', dept=None),
        ),
    )
    monkeypatch.setattr(LogQueueService, 'enqueue_operation_log', AsyncMock())
    diagnostic_logger = MagicMock()
    monkeypatch.setattr('utils.exception_util.logger', diagnostic_logger)
    return diagnostic_logger


@pytest.mark.parametrize('decorated', [False, True])
def test_unexpected_error_is_safe_and_correlates_with_server_log(log_context: MagicMock, decorated: bool) -> None:
    app = FastAPI()
    handle_exception(app)
    error = RuntimeError('SELECT secret FROM users; password=private-marker /srv/private/config')

    async def endpoint(request: Request) -> None:
        raise error

    app.get('/failure')(Log(title='测试', business_type=BusinessType.OTHER)(endpoint) if decorated else endpoint)
    response = TestClient(app, raise_server_exceptions=False).get('/failure')
    payload = response.json()
    assert payload['code'] == HttpStatusConstant.ERROR
    assert payload['msg'] == '服务暂时不可用，请稍后重试'
    assert 'private-marker' not in response.text
    assert 'SELECT' not in response.text
    assert '/srv/private' not in response.text
    error_id = payload['data']['errorId']
    assert response.headers['X-Error-Id'] == error_id
    log_context.bind.assert_called_once_with(error_id=error_id)
    log_context.bind.return_value.opt.assert_called_once_with(exception=error)


@pytest.mark.parametrize(
    'exception_kind', ['auth', 'permission', 'http', 'oauth', 'redirect', 'oidc', 'login', 'service', 'range']
)
@pytest.mark.parametrize('audit_fails', [False, True])
def test_logged_known_errors_preserve_global_response(
    log_context: MagicMock, monkeypatch: pytest.MonkeyPatch, exception_kind: str, audit_fails: bool
) -> None:
    exceptions = {
        'auth': AuthException(message='令牌失效'),
        'permission': PermissionException(message='无权限'),
        'http': HTTPException(401, '凭证无效', headers={'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store'}),
        'oauth': OAuthProtocolException('invalid_client'),
        'redirect': OAuthProtocolException(
            'access_denied', redirect_uri='https://client.example/callback', redirect_uri_verified=True, state='opaque'
        ),
        'oidc': OidcInteractionException(interaction_id='expired'),
        'login': LoginException(message='登录失败'),
        'service': ServiceException(message='操作失败'),
        'range': FileRangeNotSatisfiableException(20),
    }
    app = FastAPI()
    handle_exception(app)

    async def endpoint(request: Request) -> None:
        raise exceptions[exception_kind]

    app.get('/plain')(endpoint)
    app.get('/logged')(Log(title='测试', business_type=BusinessType.OTHER)(endpoint))
    if audit_fails:
        monkeypatch.setattr(
            LogQueueService, 'enqueue_operation_log', AsyncMock(side_effect=RuntimeError('queue unavailable'))
        )
    client = TestClient(app, raise_server_exceptions=False)
    plain = client.get('/plain', follow_redirects=False)
    logged = client.get('/logged', follow_redirects=False)
    assert logged.status_code == plain.status_code
    for name in ['location', 'www-authenticate', 'cache-control', 'pragma', 'content-range']:
        assert logged.headers.get(name) == plain.headers.get(name)
    if plain.content:
        expected, actual = plain.json(), logged.json()
        expected.pop('time', None)
        actual.pop('time', None)
        assert actual == expected
    else:
        assert not logged.content
    LogQueueService.enqueue_operation_log.assert_awaited_once()
