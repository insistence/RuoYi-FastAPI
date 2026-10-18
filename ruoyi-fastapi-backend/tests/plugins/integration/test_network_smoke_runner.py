import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI

from tests.plugins.integration import test_network_smoke as smoke


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['startup', 'browser', 'shutdown'])
async def test_network_cleanup_preserves_original_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, failure: str
) -> None:
    """清理总会执行，但退出码不能覆盖启动错误或浏览器断言。"""
    server = SimpleNamespace(started=False, should_exit=False)
    stopping = asyncio.Event()

    async def serve(**kwargs: object) -> None:
        server.started = True
        await stopping.wait()

    server.serve = serve
    monkeypatch.setattr(smoke.uvicorn, 'Server', lambda config: server)

    async def start_frontend(*args: object, **kwargs: object) -> SimpleNamespace:
        if failure == 'startup':
            kwargs['stdout'].write("Cannot find module 'memory-fs'\n")
        else:
            (tmp_path / 'frontend-ready.json').write_text('{"port": 12345}', encoding='utf-8')
        return SimpleNamespace(returncode=1)

    monkeypatch.setattr(smoke.asyncio, 'create_subprocess_exec', start_frontend)
    fixture = SimpleNamespace(app=FastAPI(), runtime=SimpleNamespace(shutdown=AsyncMock(side_effect=stopping.set)))
    message = {
        'startup': "前端代理启动失败.*Cannot find module 'memory-fs'",
        'browser': 'browser-check-failed',
        'shutdown': '前端代理未正常退出',
    }[failure]
    with pytest.raises(AssertionError, match=f'(?s){message}'):
        async with smoke.network_servers(fixture, tmp_path, tmp_path):
            if failure == 'browser':
                raise AssertionError('browser-check-failed')
    fixture.runtime.shutdown.assert_awaited_once()
    assert server.should_exit
