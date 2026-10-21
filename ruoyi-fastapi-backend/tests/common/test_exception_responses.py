from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from common.annotation.log_annotation import Log
from common.constant import HttpStatusConstant
from common.context import RequestContext
from common.enums import BusinessType
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
