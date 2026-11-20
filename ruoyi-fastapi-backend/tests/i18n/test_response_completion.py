import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import status

from common.context import LocaleContext, RequestContext
from config.env import OidcConfig
from module_identity.controller.interaction_controller import _invalid_body, _not_found, captcha
from module_identity.service.interaction_service import InteractionFlowService
from plugins.core.manifest.schema import PluginManifest
from plugins.core.runtime.support.batch_report import PluginBatchReportBuilder
from plugins.core.runtime.support.payload.validation import PluginValidationPayloadMixin
from plugins.core.validation.manifest import PluginManifestChecker
from scripts.compile_i18n import compile_catalogs
from utils.response_util import ResponseUtil


@pytest.fixture(autouse=True, scope='module')
def catalogs() -> None:
    """编译认证和插件响应测试使用的中英文词库。"""
    compile_catalogs()


@pytest.mark.parametrize('locale', ['zh-CN', 'en-US'])
def test_authentication_error_helpers_keep_status_and_translate(locale: str) -> None:
    """验证认证交互错误保持原 HTTP 状态，消息按请求语言翻译。"""
    token = RequestContext.set_current_locale(LocaleContext(locale))
    try:
        invalid, disabled = _invalid_body(), _not_found()
    finally:
        RequestContext.reset_current_locale(token)
    assert invalid.status_code == status.HTTP_400_BAD_REQUEST
    assert disabled.status_code == status.HTTP_404_NOT_FOUND
    assert invalid.headers['cache-control'] == 'no-store'
    assert json.loads(invalid.body)['msg'] == (
        'Invalid authentication interaction request' if locale == 'en-US' else '认证交互请求无效'
    )
    assert json.loads(disabled.body)['msg'] == (
        'The authentication service is not enabled' if locale == 'en-US' else '认证服务未启用'
    )


@pytest.mark.asyncio
@pytest.mark.parametrize('limited', [False, True])
async def test_captcha_failure_keeps_http_contract_and_localizes(
    monkeypatch: pytest.MonkeyPatch, limited: bool
) -> None:
    """验证验证码限流和服务不可用响应的状态、响应头及译文。"""
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    monkeypatch.setattr(
        InteractionFlowService,
        'captcha',
        AsyncMock(return_value=SimpleNamespace(rate_limited=limited, unavailable=not limited, retry_after=17)),
    )
    request = SimpleNamespace(
        app=SimpleNamespace(state=SimpleNamespace(redis=object())),
        client=SimpleNamespace(host='127.0.0.1'),
        headers={},
    )
    token = RequestContext.set_current_locale(LocaleContext('en-US'))
    try:
        response = await captcha(request, 'interaction')
    finally:
        RequestContext.reset_current_locale(token)
    if limited:
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert response.headers['retry-after'] == '17'
        assert json.loads(response.body)['msg'] == 'Too many requests. Please try again later'
    else:
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert json.loads(response.body)['msg'] == 'The authentication service is temporarily unavailable'


@pytest.mark.parametrize('locale', ['zh-CN', 'en-US'])
def test_plugin_precheck_suggestion_survives_payload_and_response(locale: str) -> None:
    """验证预检查及批量操作建议在插件响应中使用当前语言。"""
    manifest = PluginManifest.model_validate(
        {
            'id': 'demo',
            'name': 'Demo',
            'version': '1.0.0',
            'backend': {'module': 'plugins.demo'},
            'config': {'items': [{'key': 'api_key', 'type': 'password', 'default': 'test', 'secret': True}]},
        }
    )
    issue = PluginManifestChecker()._check_secret_config_defaults(manifest)[0]
    payload = PluginValidationPayloadMixin.build_validation_issue(issue)
    token = RequestContext.set_current_locale(LocaleContext(locale))
    try:
        response = json.loads(ResponseUtil.success(data=payload).body)
        batch = PluginBatchReportBuilder.build_item_report(
            'install', 'demo', {'ok': False, 'structureErrors': ['invalid']}, 1
        )
        batch_response = json.loads(ResponseUtil.success(data=batch).body)
    finally:
        RequestContext.reset_current_locale(token)
    assert response['data']['suggestion'] == (
        'Remove the default value and enter it in the plugin settings after installation'
        if locale == 'en-US'
        else '建议删除默认值，改为安装后在插件配置中录入'
    )
    assert batch_response['data']['suggestion'] == (
        'Run ruoyi plugin check demo to fix plugin directory issues'
        if locale == 'en-US'
        else '先执行 ruoyi plugin check demo 修复插件目录结构问题'
    )
