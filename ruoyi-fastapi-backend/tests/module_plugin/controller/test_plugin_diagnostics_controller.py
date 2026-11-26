import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, Request
from sqlalchemy.ext.asyncio import AsyncSession

from common.context import LocaleContext, RequestContext
from i18n.message import I18nMessage
from module_plugin.controller.plugin_controller import diagnose_system_plugin


@pytest.mark.asyncio
async def test_diagnose_api_attaches_runtime_without_changing_static_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    """诊断接口追加运行信息并保留静态检查状态。"""
    app = FastAPI()
    reporter = object()
    app.state.plugin_diagnostics_reporter = reporter
    app.state.redis = object()
    app.state.plugin_application_runtime = SimpleNamespace(ready_key='isolated:ready')
    operation = SimpleNamespace(
        diagnose_plugin_with_audit_services=AsyncMock(
            return_value={
                'ok': True,
                'pluginId': 'demo',
                'message': I18nMessage('插件诊断包生成完成', msg_key='plugin.runtime.diagnostics.completed'),
                'info': {},
                'check': {},
                'config': {},
                'menuPlan': {},
                'audit': {'available': True},
            }
        )
    )
    read = AsyncMock(return_value={'state': 'unavailable', 'observedTotals': None})
    monkeypatch.setattr('module_plugin.controller.plugin_controller.get_plugin_operation_service', lambda: operation)
    monkeypatch.setattr('plugins.core.runtime.diagnostics_query.read_plugin_runtime_diagnostics', read)
    token = RequestContext.set_current_locale(LocaleContext('en-US'))
    try:
        response = await diagnose_system_plugin(Request({'type': 'http', 'app': app}), AsyncSession(), 'demo')
    finally:
        RequestContext.reset_current_locale(token)
    result = json.loads(bytes(response.body))
    assert result['msgKey'] == 'plugin.runtime.diagnostics.completed'
    payload = result['data']
    assert result['msg'] == payload['message'] == 'Plugin diagnostic bundle generated'
    assert payload['ok'] is True
    assert payload['runtime'] == {'state': 'unavailable', 'observedTotals': None}
    read.assert_awaited_once_with('demo', reporter=reporter, redis=app.state.redis, ready_key='isolated:ready')


@pytest.mark.asyncio
@pytest.mark.parametrize('complete', [True, False])
async def test_failed_check_remains_visible_but_generation_failure_keeps_error_envelope(
    monkeypatch: pytest.MonkeyPatch, complete: bool
) -> None:
    """保留失败检查且生成失败时使用标准错误响应。"""
    payload = {'ok': False, 'message': '插件诊断包生成完成，发现问题', 'info': {'pluginId': 'demo'}}
    if complete:
        payload.update(check={'ok': False}, config={}, menuPlan={}, audit={})
    operation = SimpleNamespace(diagnose_plugin_with_audit_services=AsyncMock(return_value=payload))
    monkeypatch.setattr('module_plugin.controller.plugin_controller.get_plugin_operation_service', lambda: operation)
    monkeypatch.setattr(
        'plugins.core.runtime.diagnostics_query.read_plugin_runtime_diagnostics',
        AsyncMock(return_value={'state': 'observed'}),
    )
    response = await diagnose_system_plugin(Request({'type': 'http', 'app': FastAPI()}), AsyncSession(), 'demo')
    result = json.loads(bytes(response.body))
    assert result['code'] == (200 if complete else 601)
    assert result['data']['ok'] is False
    assert result['data']['runtime'] == {'state': 'observed'}
