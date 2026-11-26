import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI, Request
from starlette import status
from starlette.types import Message, Receive, Scope, Send

from plugins.core.runtime.asgi import PluginGatewayASGI, PluginLifespanManager
from plugins.core.sdk import PluginHostContext, PluginRequestContext


@pytest.mark.asyncio
async def test_mounted_app_lifespan_state_root_path_and_shutdown(tmp_path: Path) -> None:
    """挂载应用保留生命周期状态、根路径和关闭处理。"""
    events = []

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[dict[str, str], None]:
        """
        记录下游应用的启动和关闭过程。

        :param app: 正在配置或处理请求的 ASGI 应用
        :yield: 包含 ``resource`` 的数据
        """
        events.append('start')
        yield {'resource': 'ready'}
        events.append('stop')

    child = FastAPI(lifespan=lifespan)

    @child.get('/api/state', summary='查询插件应用状态', description='返回插件应用的资源状态、标识及挂载信息。')
    async def state(request: Request) -> dict[str, str]:
        return {
            'resource': request.state.resource,
            'plugin': request.state.plugin_context.host.plugin_id,
            'root_path': request.scope['root_path'],
        }

    async def authorize(scope: Scope) -> PluginRequestContext:
        """
        创建测试使用的 ``PluginRequestContext`` 实例。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :return: 测试使用的 ``PluginRequestContext`` 实例
        """
        return PluginRequestContext(PluginHostContext('demo', tmp_path), user=None)

    manager = PluginLifespanManager(child)
    parent = FastAPI()
    parent.mount('/apps/demo', PluginGatewayASGI(child, manager, authorize))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=parent), base_url='http://test') as client:
        assert (await client.get('/apps/demo/api/state')).status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        await manager.startup()
        await manager.startup()
        response = await client.get('/apps/demo/api/state')
        assert response.json() == {'resource': 'ready', 'plugin': 'demo', 'root_path': '/apps/demo'}
        await manager.shutdown()
        await manager.shutdown()
        assert (await client.get('/apps/demo/api/state')).status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert events == ['start', 'stop']


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', [PermissionError, LookupError])
async def test_gateway_rejects_http_and_websocket_without_invoking_plugin(failure: type[Exception]) -> None:
    """网关拒绝 HTTP 或 WebSocket 后不调用插件。"""
    reached = []

    async def child(scope: Scope, receive: Receive, send: Send) -> None:
        """
        模拟接收宿主消息的下游 ASGI 应用。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        reached.append(scope)

    async def authorize(scope: Scope) -> PluginRequestContext:
        """
        模拟此操作抛出 failure 的情形。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :raises Exception: 底层操作失败时向调用方传播异常
        """
        raise failure()

    manager = PluginLifespanManager(child, managed=False)
    await manager.startup()
    gateway = PluginGatewayASGI(child, manager, authorize)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=gateway), base_url='http://test') as client:
        response = await client.get('/ui/index.html')
        assert response.status_code == (403 if failure is PermissionError else 401)
    messages = []

    async def send(message: Message) -> None:
        """
        收集应用发送的 ASGI 消息。

        :param message: 与当前结果一起返回的说明
        """
        messages.append(message)

    await gateway({'type': 'websocket', 'path': '/ws'}, AsyncMock(), send)
    assert messages[0]['type'] == 'websocket.close'
    assert not reached


@pytest.mark.asyncio
async def test_failed_or_unsupported_lifespan_cleans_up() -> None:
    """生命周期失败或不受支持时清理资源。"""
    stopped = asyncio.Event()

    async def failed(scope: Scope, receive: Receive, send: Send) -> None:
        """
        模拟子应用未完成其生命周期操作。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        try:
            await receive()
            await send({'type': 'lifespan.startup.failed', 'message': 'broken resource'})
            await asyncio.Event().wait()
        finally:
            stopped.set()

    manager = PluginLifespanManager(failed)
    with pytest.raises(RuntimeError, match='broken resource'):
        await manager.startup()
    assert stopped.is_set()
    assert not manager.started

    async def unsupported(scope: Scope, receive: Receive, send: Send) -> None:
        """
        模拟直接结束的下游 ASGI 应用。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        return

    with pytest.raises(RuntimeError, match='确认前退出'):
        await PluginLifespanManager(unsupported).startup()


@pytest.mark.asyncio
async def test_lifespan_timeout_cancels_task() -> None:
    """生命周期超时后取消任务。"""
    stopped = asyncio.Event()

    async def hangs(scope: Scope, receive: Receive, send: Send) -> None:
        """
        保持异步任务等待以触发超时处理。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    manager = PluginLifespanManager(hangs, timeout=0.02)
    with pytest.raises(TimeoutError):
        await manager.startup()
    assert stopped.is_set()


@pytest.mark.asyncio
@pytest.mark.parametrize('phase', ['startup', 'shutdown'])
async def test_lifespan_timeout_is_bounded_and_retry_uses_fresh_protocol_state(phase: str) -> None:
    """拒绝残留任务重启，退出后重试不读取旧任务的迟到消息和状态。"""
    release = asyncio.Event()
    attempts = []

    async def child(scope: Scope, receive: Receive, send: Send) -> None:
        """
        模拟接收宿主消息的下游 ASGI 应用。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        attempts.append(scope['state'])
        await receive()
        if len(attempts) > 1:
            scope['state']['attempt'] = len(attempts)
            await send({'type': 'lifespan.startup.complete'})
            await receive()
            await send({'type': 'lifespan.shutdown.complete'})
            return
        if phase == 'shutdown':
            await send({'type': 'lifespan.startup.complete'})
            await receive()
        while not release.is_set():
            with suppress(asyncio.CancelledError):
                await release.wait()
        scope['state']['stale'] = True
        await send({'type': 'lifespan.startup.failed', 'message': 'late response'})

    manager = PluginLifespanManager(child, timeout=0.01, cancel_timeout=0.01)
    if phase == 'shutdown':
        await manager.startup()
    operation = asyncio.create_task(getattr(manager, phase)())
    try:
        await asyncio.wait({operation}, timeout=1)
        assert operation.done(), '生命周期取消等待必须有界'
        with pytest.raises(TimeoutError):
            await operation
        assert not manager.ready and manager.has_pending_task
        with pytest.raises(RuntimeError, match='尚未退出'):
            await manager.startup()
        release.set()
        assert manager._task is not None
        await asyncio.wait({manager._task}, timeout=1)
        await manager.startup()
        assert manager.ready and manager.state == {'attempt': 2}
        assert attempts[0] is not attempts[1]
        await manager.shutdown()
        await manager.shutdown()
    finally:
        release.set()
        await asyncio.gather(operation, return_exceptions=True)
        await manager.shutdown()


@pytest.mark.asyncio
@pytest.mark.parametrize('phase', ['startup', 'shutdown'])
async def test_lifespan_self_cancellation_is_protocol_error(phase: str) -> None:
    """生命周期主动取消被识别为协议错误。"""

    async def child(scope: Scope, receive: Receive, send: Send) -> None:
        """
        模拟接收宿主消息的下游 ASGI 应用。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        :raises asyncio.CancelledError: 异步操作被取消时
        """
        await receive()
        if phase == 'shutdown':
            await send({'type': 'lifespan.startup.complete'})
            await receive()
            await send({'type': 'lifespan.shutdown.complete'})
        raise asyncio.CancelledError

    manager = PluginLifespanManager(child)
    if phase == 'shutdown':
        await manager.startup()
    with pytest.raises(RuntimeError, match='自行取消'):
        await getattr(manager, phase)()
    assert not manager.ready and not manager.has_pending_task


@pytest.mark.asyncio
async def test_lifespan_accepts_callable_returning_future() -> None:
    """生命周期接受返回 Future 的可调用对象。"""

    async def child(scope: Scope, receive: Receive, send: Send) -> None:
        """
        模拟接收宿主消息的下游 ASGI 应用。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        await receive()
        await send({'type': 'lifespan.startup.complete'})
        await receive()
        await send({'type': 'lifespan.shutdown.complete'})

    def app(scope: Scope, receive: Receive, send: Send) -> asyncio.Future[None]:
        """
        将测试请求交给下游 ASGI 应用。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        :return: 运行下游 ASGI 应用的异步任务
        """
        return asyncio.create_task(child(scope, receive, send))

    manager = PluginLifespanManager(app)
    await manager.startup()
    assert manager.ready
    await manager.shutdown()
    assert not manager.has_pending_task


@pytest.mark.asyncio
async def test_host_cancellation_propagates_and_releases_lifespan_task() -> None:
    """宿主取消时传播取消信号并释放生命周期任务。"""
    opened, stopped = asyncio.Event(), asyncio.Event()

    async def child(scope: Scope, receive: Receive, send: Send) -> None:
        """
        模拟接收宿主消息的下游 ASGI 应用。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        opened.set()
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    manager = PluginLifespanManager(child)
    task = asyncio.create_task(manager.startup())
    await opened.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert stopped.is_set() and not manager.has_pending_task


@pytest.mark.parametrize('timeout', [0, -1, float('inf'), float('nan')])
def test_lifespan_rejects_invalid_time_limits(timeout: float) -> None:
    """生命周期拒绝无效的时间限制。"""
    with pytest.raises(ValueError, match='大于零'):
        PluginLifespanManager(AsyncMock(), timeout=timeout)
    with pytest.raises(ValueError, match='大于零'):
        PluginLifespanManager(AsyncMock(), cancel_timeout=timeout)


@pytest.mark.asyncio
async def test_concurrent_shutdown_waits_for_startup_and_sends_one_shutdown() -> None:
    """并发关闭等待启动完成并只发送一次关闭事件。"""
    opened, release = asyncio.Event(), asyncio.Event()
    messages = []

    async def child(scope: Scope, receive: Receive, send: Send) -> None:
        """
        模拟接收宿主消息的下游 ASGI 应用。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        messages.append((await receive())['type'])
        opened.set()
        await release.wait()
        await send({'type': 'lifespan.startup.complete'})
        messages.append((await receive())['type'])
        await send({'type': 'lifespan.shutdown.complete'})

    manager = PluginLifespanManager(child, timeout=1)
    starting = asyncio.create_task(manager.startup())
    await opened.wait()
    stopping = [asyncio.create_task(manager.shutdown()) for _ in range(2)]
    try:
        await asyncio.sleep(0)
        assert not manager.ready
        release.set()
        await asyncio.wait_for(asyncio.gather(starting, *stopping), timeout=1)
        assert messages == ['lifespan.startup', 'lifespan.shutdown']
        assert not manager.ready and not manager.has_pending_task
    finally:
        release.set()
        await asyncio.gather(starting, *stopping, return_exceptions=True)
        await manager.shutdown()
