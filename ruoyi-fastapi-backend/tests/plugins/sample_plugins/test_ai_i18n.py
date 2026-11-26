import json
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock, Mock

import pytest
import yaml
from agno.agent import Agent
from sqlalchemy.ext.asyncio import AsyncSession

from cli.runtime.plugin.support import PluginDependencyLockfileTemplateBuilder
from common.context import LocaleContext, RequestContext
from plugins.ai.dao.ai_model_dao import AiModelDao
from plugins.ai.entity.vo.ai_chat_vo import AiChatRequestModel
from plugins.ai.service.ai_chat_service import AiChatService
from plugins.core.discovery.scanner import PluginScanner
from plugins.core.validation.manifest import PluginManifestChecker


def test_ai_menu_translations_and_frontend_lock_metadata() -> None:
    """验证 AI 插件清单的菜单译名及三个前端的依赖锁元数据。"""
    backend = Path(__file__).resolve().parents[3]
    manifest = PluginScanner(backend / 'plugins').load_manifest(backend / 'plugins/ai/plugin.yaml').manifest
    assert any(menu.name_i18n for menu in manifest.frontend.menus)
    frontend = backend.parent / 'ruoyi-fastapi-frontend'
    target = PluginManifestChecker(backend_root=backend, frontend_root=frontend / 'vue3/web').check(manifest)
    assert not target.error_issues
    for framework in ('vue2', 'vue3', 'react'):
        lock = PluginDependencyLockfileTemplateBuilder.build(
            manifest, frontend_framework=framework, frontend_root=frontend / framework / 'web'
        )
        metadata = yaml.safe_load(lock.to_yaml())
        assert (metadata['plugin'], metadata['version'], metadata['frontendFramework']) == (
            'ai',
            manifest.version,
            framework,
        )


@pytest.mark.asyncio
@pytest.mark.usefixtures('ai_catalog')
async def test_stream_error_uses_captured_locale_after_request_context_changes() -> None:
    """验证请求语言改变后，流式错误仍使用创建时的快照。"""

    async def broken_stream(*args: object, **kwargs: object) -> AsyncIterator[object]:
        """
        模拟读取模型响应流期间发生错误。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises RuntimeError: 模型提供方内部错误
        :yield: 上下文就绪后将控制权交给调用方
        """
        raise RuntimeError('模型提供方内部错误')
        yield

    stream = AiChatService._stream_agent(
        agent=Mock(spec=Agent, arun=broken_stream),
        chat_req=AiChatRequestModel(model_id=1, message='请保留这段用户输入'),
        run_kwargs={},
        is_reasoning=False,
        session_id='session',
        locale_context=LocaleContext('en-US'),
    )
    assert json.loads(await anext(stream))['type'] == 'meta'
    token = RequestContext.set_current_locale(LocaleContext('zh-CN'))
    try:
        error = json.loads(await anext(stream))
        assert error == {
            'type': 'error',
            'error': 'Unable to generate a response. Please try again later.',
            'msgKey': 'ai.stream.failed',
            'msgDomain': 'plugin.ai',
            'msgParams': {},
        }
    finally:
        RequestContext.reset_current_locale(token)
        await stream.aclose()


@pytest.mark.asyncio
@pytest.mark.usefixtures('ai_catalog')
async def test_stream_setup_failure_is_a_localized_event(monkeypatch: pytest.MonkeyPatch) -> None:
    """验证流初始化失败时返回本地化错误事件。"""
    monkeypatch.setattr(AiModelDao, 'get_ai_model_detail_by_id', AsyncMock(return_value=None))
    stream = AiChatService.chat_services(
        AsyncSession(), AiChatRequestModel(model_id=1, message='Hello'), 1, locale_context=LocaleContext('en-US')
    )
    events = [json.loads(frame) async for frame in stream]
    assert events == [
        {
            'error': 'Model not found',
            'type': 'error',
            'msgKey': 'ai.model.notFound',
            'msgParams': {},
            'msgDomain': 'plugin.ai',
        }
    ]
