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


@pytest.mark.parametrize('locale', ['zh-CN', 'en-US'])
def test_plugin_payload_preserves_semantics_until_response_rendering(locale: str) -> None:
    """验证插件操作消息在响应阶段按当前语言翻译。"""
    message = I18nMessage('插件安装完成', msg_key='plugin.runtime.install.completed')
    payload = PluginRuntimeInvalidOperationPayload(ok=False, operation='install', plugin_id='demo', message=message)
    data = payload.to_payload()
    assert data['message'] is message
    assert PluginOperationResult.from_payload(data).message is message
    token = RequestContext.set_current_locale(LocaleContext(locale))
    try:
        response = json.loads(bytes(_plugin_operation_response(data, '操作完成').body))
        expected = 'Plugin installation completed' if locale == 'en-US' else '插件安装完成'
        assert response['msg'] == response['data']['message'] == expected
        assert response['msgKey'] == 'plugin.runtime.install.completed'
        assert data['message'] == '插件安装完成'
    finally:
        RequestContext.reset_current_locale(token)


def test_batch_feedback_preserves_message_metadata_and_user_data() -> None:
    """验证批量操作保留消息标识，用户提供的名称保持原样。"""
    message = I18nMessage('插件安装完成', msg_key='plugin.runtime.install.completed')
    report = PluginBatchReportBuilder.build_item_report('install', 'demo', {'ok': True, 'message': message}, 10)
    assert report.message is message
    token = RequestContext.set_current_locale(LocaleContext('en-US'))
    try:
        response = json.loads(bytes(ResponseUtil.success(data={'report': report, 'customName': '用户插件'}).body))
        assert response['data']['report']['message'] == 'Plugin installation completed'
        assert response['data']['customName'] == '用户插件'
    finally:
        RequestContext.reset_current_locale(token)


def test_nested_status_message_uses_response_locale_snapshot() -> None:
    """验证嵌套状态消息按外层响应的语言快照翻译。"""
    message = I18nMessage(
        '插件 migration 已人工标记为成功',
        msg_key='plugin.runtime.migration.marked',
        msg_params={'label': I18nMessage('成功', msg_key='plugin.runtime.migration.successStatus')},
    )
    fields = I18nUtil.message_fields(message, context=LocaleContext('en-US'))
    assert fields['msg'] == 'Plugin migration manually marked as successful'
    assert fields['msgParams'] == {'label': 'successful'}
    chinese = I18nUtil.message_fields(message, context=LocaleContext('zh-CN'))
    assert chinese['msg'] == '插件 migration 已人工标记为成功'
    assert chinese['msgParams'] == {'label': '成功'}
