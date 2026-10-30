import json
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from common.context import LocaleContext, RequestContext
from plugins.ai.dao.ai_model_dao import AiModelDao
from plugins.ai.entity.vo.ai_chat_vo import AiChatRequestModel
from plugins.ai.service.ai_chat_service import AiChatService


@pytest.mark.asyncio
async def test_stream_error_uses_captured_locale_after_request_context_changes() -> None:
    async def broken_stream(*args: object, **kwargs: object) -> AsyncIterator[object]:
        raise RuntimeError('模型提供方内部错误')
        yield

    stream = AiChatService._stream_agent(
        agent=SimpleNamespace(arun=broken_stream),
        chat_req=AiChatRequestModel(modelId=1, message='请保留这段用户输入'),
        run_kwargs={},
        is_reasoning=False,
        session_id='session',
        locale_context=LocaleContext('en-US', 'v1'),
    )
    assert json.loads(await anext(stream))['type'] == 'meta'
    token = RequestContext.set_current_locale(LocaleContext('zh-CN', 'v1'))
    try:
        error = json.loads(await anext(stream))
        assert error == {
            'type': 'error',
            'error': 'Unable to generate a response. Please try again later.',
            'msgKey': 'ai.stream.failed',
            'msgParams': {},
        }
    finally:
        RequestContext.reset_current_locale(token)
        await stream.aclose()


@pytest.mark.asyncio
async def test_stream_setup_failure_is_a_localized_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(AiModelDao, 'get_ai_model_detail_by_id', AsyncMock(return_value=None))
    stream = AiChatService.chat_services(
        object(), AiChatRequestModel(modelId=1, message='Hello'), 1, locale_context=LocaleContext('en-US', 'v1')
    )
    events = [json.loads(frame) async for frame in stream]
    assert events == [{'error': 'Model not found', 'type': 'error', 'msgKey': 'ai.model.notFound', 'msgParams': {}}]
