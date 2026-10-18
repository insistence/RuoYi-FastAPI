from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import TYPE_CHECKING

import pytest
from playwright.async_api import Error

from system.test_plugin_management import assert_unchanged

if TYPE_CHECKING:
    from playwright.async_api import Browser, Playwright

pytestmark = pytest.mark.harness


@pytest.mark.parametrize('scenario', ['reset_once', 'reset_always', 'http_error', 'business_error', 'changed'])
async def test_plugin_read_recovers_only_one_connection_reset(
    e2e_browser: tuple[Playwright, Browser], scenario: str
) -> None:
    """用真实 TCP 断连验证只读核验的有限重试，HTTP 和业务失败仍须暴露。"""
    before = {'installedVersion': '1.0.0', 'enabled': True, 'status': 'installed'}
    requests = []

    async def respond(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            request = await reader.readuntil(b'\r\n\r\n')
            requests.append(request.split(b'\r\n')[0])
            if scenario == 'reset_always' or (scenario == 'reset_once' and len(requests) == 1):
                return
            data = {**before, 'status': 'changed'} if scenario == 'changed' else before
            body = json.dumps({'code': 500 if scenario == 'business_error' else 200, 'data': data}).encode()
            status = '500 Internal Server Error' if scenario == 'http_error' else '200 OK'
            writer.write(
                f'HTTP/1.1 {status}\r\nContent-Type: application/json\r\n'
                f'Content-Length: {len(body)}\r\nConnection: close\r\n\r\n'.encode()
                + body
            )
            await writer.drain()
        finally:
            writer.close()
            await writer.wait_closed()

    async with await asyncio.start_server(respond, '127.0.0.1', 0) as server:
        port = server.sockets[0].getsockname()[1]
        api = await e2e_browser[0].request.new_context(base_url=f'http://127.0.0.1:{port}')
        try:
            view = SimpleNamespace(api=api)
            if scenario == 'reset_once':
                await assert_unchanged(view, before)
            else:
                with pytest.raises(Error if scenario == 'reset_always' else AssertionError):
                    await assert_unchanged(view, before)
        finally:
            await api.dispose()
    assert len(requests) == (2 if scenario.startswith('reset_') else 1)
    assert all(request == b'GET /system/plugin/ai HTTP/1.1' for request in requests)
