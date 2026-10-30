import json

import pytest

from common.context import LocaleContext, RequestContext
from i18n.message import I18nMessage
from i18n.translator import I18nUtil
from module_plugin.controller.plugin_controller import _plugin_operation_response
from plugins.core.runtime.result import PluginOperationResult
from plugins.core.runtime.support.batch_report import PluginBatchReportBuilder
from plugins.core.runtime.support.payload.runtime import PluginRuntimeInvalidOperationPayload
from utils.response_util import ResponseUtil


@pytest.mark.parametrize('version', ['legacy', 'v1'])
def test_plugin_payload_preserves_semantics_until_response_rendering(version: str) -> None:
    message = I18nMessage('插件安装完成', msg_key='plugin.runtime.install.completed')
    payload = PluginRuntimeInvalidOperationPayload(ok=False, operation='install', pluginId='demo', message=message)
    data = payload.to_payload()
    assert data['message'] is message
    assert PluginOperationResult.from_payload(data).message is message
    token = RequestContext.set_current_locale(LocaleContext(locale='en-US', version=version))
    try:
        response = json.loads(_plugin_operation_response(data, '操作完成').body)
        expected = 'Plugin installation completed' if version == 'v1' else '插件安装完成'
        assert response['msg'] == response['data']['message'] == expected
        assert response.get('msgKey') == ('plugin.runtime.install.completed' if version == 'v1' else None)
        assert data['message'] == '插件安装完成'
    finally:
        RequestContext.reset_current_locale(token)


def test_batch_feedback_preserves_message_metadata_and_user_data() -> None:
    message = I18nMessage('插件安装完成', msg_key='plugin.runtime.install.completed')
    report = PluginBatchReportBuilder.build_item_report('install', 'demo', {'ok': True, 'message': message}, 10)
    assert report.message is message
    token = RequestContext.set_current_locale(LocaleContext(locale='en-US', version='v1'))
    try:
        response = json.loads(ResponseUtil.success(data={'report': report, 'customName': '用户插件'}).body)
        assert response['data']['report']['message'] == 'Plugin installation completed'
        assert response['data']['customName'] == '用户插件'
    finally:
        RequestContext.reset_current_locale(token)


def test_nested_status_message_uses_response_locale_snapshot() -> None:
    message = I18nMessage(
        '插件 migration 已人工标记为成功',
        msg_key='plugin.runtime.migration.marked',
        msg_params={'label': I18nMessage('成功', msg_key='plugin.runtime.migration.successStatus')},
    )
    fields = I18nUtil.message_fields(message, context=LocaleContext(locale='en-US', version='v1'))
    assert fields['msg'] == 'Plugin migration manually marked as successful'
    assert fields['msgParams'] == {'label': 'successful'}
    assert I18nUtil.message_fields(message, context=LocaleContext()) == {'msg': '插件 migration 已人工标记为成功'}
