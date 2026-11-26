import asyncio
import inspect
import pickle
import sys
from collections.abc import AsyncGenerator, Iterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
import yaml
from apscheduler.util import obj_to_ref, ref_to_obj
from fastapi import FastAPI

from config.scheduler.job_adapter import JobAdapter
from plugins.core.discovery.registry import RegisteredPlugin
from plugins.core.discovery.scanner import PluginScanner
from plugins.core.lifecycle.jobs import PluginJobModelBuilder
from plugins.core.manifest.schema import PluginManifestFactory
from plugins.core.runtime.entrypoint import PluginEntrypointLoader
from plugins.core.runtime.explicit import ExplicitPluginRuntime, LoadedExplicitPlugin
from plugins.core.runtime.job_dispatcher import (
    DISPATCH_TARGET,
    PluginJobBinding,
    bind_plugin_jobs,
    dispatch_plugin_job,
    unbind_plugin_jobs,
)
from plugins.core.runtime.route_guard import PluginRouteStateGateway
from plugins.core.sdk import PluginHostContext, PluginTaskContext
from plugins.core.validation.structure import PluginStructureChecker


@pytest.fixture
def setup_plugin(tmp_path: Path) -> Iterator[SimpleNamespace]:
    """
    在临时目录中创建可调度的测试插件。

    :param tmp_path: pytest 为当前用例创建的临时目录
    :yield: ``SimpleNamespace`` 实例
    """
    directory = tmp_path / 'plugins' / 'dispatch_test'
    directory.mkdir(parents=True)
    data = {
        'manifestVersion': 2,
        'id': 'dispatch_test',
        'name': 'Dispatch test',
        'version': '1.0.0',
        'backend': {
            'module': 'plugins.dispatch_test',
            'entrypoint': 'plugins.dispatch_test:create_plugin',
            'jobs': [
                {
                    'id': 'tick',
                    'callable': 'plugins.dispatch_test.tick',
                    'cronExpression': '0 */5 * * * ?',
                    'enabled': False,
                    'jobStore': 'redis',
                    'args': ['argument'],
                    'kwargs': {'value': 'keyword'},
                }
            ],
        },
    }
    (directory / 'plugin.yaml').write_text(yaml.safe_dump(data), encoding='utf-8')
    (directory / '__init__.py').write_text(
        'from plugins.core.sdk import PluginDefinition\n'
        'def create_plugin(host):\n    return PluginDefinition()\n'
        'def tick(context, *args, **kwargs):\n'
        '    return context.host.service("test.task")(context, *args, **kwargs)\n',
        encoding='utf-8',
    )
    plugin = PluginScanner(directory.parent).load_manifest(directory / 'plugin.yaml')
    service = AsyncMock(return_value='done')
    sessions = []

    @asynccontextmanager
    async def session() -> AsyncGenerator[object, None]:
        """
        为当前测试操作提供数据库会话。

        :yield: 数据库会话
        """
        sessions.append('open')
        try:
            yield object()
        finally:
            sessions.append('close')

    host = PluginHostContext('dispatch_test', directory, services={'test.task': service}, session_factory=session)
    gateway = Mock(spec_set=PluginRouteStateGateway, is_plugin_enabled=AsyncMock(return_value=True))
    runtime = ExplicitPluginRuntime(gateway)
    runtime.metrics.register('dispatch_test', plugin.manifest.version, None, None)
    definition = PluginEntrypointLoader(plugin).load(host)
    runtime.loaded['dispatch_test'] = LoadedExplicitPlugin(
        RegisteredPlugin(plugin, None, True, 'installed'), host, definition
    )
    yield SimpleNamespace(
        plugin=plugin, runtime=runtime, service=service, gateway=gateway, sessions=sessions, data=data
    )
    sys.modules.pop('plugins.dispatch_test', None)
    package = sys.modules.get('plugins')
    if package is not None and hasattr(package, 'dispatch_test'):
        delattr(package, 'dispatch_test')


@pytest.mark.asyncio
async def test_persistent_reference_restores_and_dispatches_on_host_loop(setup_plugin: SimpleNamespace) -> None:
    """持久化引用恢复后在宿主事件循环中分发。"""
    state = setup_plugin
    manifest = state.plugin.manifest
    job = PluginJobModelBuilder.build(manifest.id, manifest.backend.jobs[0], manifest=manifest)
    assert job.invoke_target == DISPATCH_TARGET
    assert job.status == '1'  # 清单默认停用；管理流程可单独启用，分发器不把此默认值当永久禁令。
    options = JobAdapter.prepare(job)
    reference, args, kwargs = pickle.loads(
        pickle.dumps((obj_to_ref(options['func']), options['args'], options['kwargs']))
    )
    callback = ref_to_obj(reference)
    assert inspect.iscoroutinefunction(callback)
    assert args == ['dispatch_test', 'tick', '1.0.0']
    assert kwargs == {}
    await state.runtime.activate('dispatch_test', FastAPI())
    try:
        assert await callback(*args, **kwargs) == 'done'
        context = state.service.await_args.args[0]
        assert isinstance(context, PluginTaskContext)
        assert context.request_id
        assert not hasattr(context, 'user')
        assert state.service.await_args.args[1:] == ('argument',)
        assert state.service.await_args.kwargs == {'value': 'keyword'}
        assert state.sessions == ['open', 'close']
        metric = next(item for item in state.runtime.metrics.snapshot().series if item.operation == 'job:tick')
        assert (metric.started, metric.active, metric.succeeded) == (1, 0, 1)
    finally:
        await state.runtime.shutdown()


@pytest.mark.asyncio
async def test_gates_reject_before_call_and_shutdown_unbinds(setup_plugin: SimpleNamespace) -> None:
    """调用前检查访问条件并在关闭时解除绑定。"""
    state = setup_plugin
    with pytest.raises(RuntimeError, match='未就绪'):
        await dispatch_plugin_job('dispatch_test', 'tick', '1.0.0')
    await state.runtime.activate('dispatch_test', FastAPI())
    try:
        with pytest.raises(RuntimeError, match='版本不匹配'):
            await dispatch_plugin_job('dispatch_test', 'tick', '0.9.0')
        with pytest.raises(LookupError, match='未声明'):
            await dispatch_plugin_job('dispatch_test', 'other', '1.0.0')
        state.gateway.is_plugin_enabled.return_value = False
        with pytest.raises(PermissionError, match='未启用'):
            await dispatch_plugin_job('dispatch_test', 'tick', '1.0.0')
        state.service.assert_not_called()
        assert state.sessions == ['open', 'close']
        metric = next(item for item in state.runtime.metrics.snapshot().series if item.operation == 'job:tick')
        assert (metric.started, metric.active, metric.rejected) == (1, 0, 1)
    finally:
        await state.runtime.shutdown()
    with pytest.raises(RuntimeError, match='未就绪'):
        await dispatch_plugin_job('dispatch_test', 'tick', '1.0.0')


@pytest.mark.asyncio
@pytest.mark.parametrize('during_gate', [False, True])
async def test_shutdown_cancels_running_task_before_child_resources_close(
    setup_plugin: SimpleNamespace, during_gate: bool
) -> None:
    """关闭子应用资源前先取消运行中的任务。"""
    state = setup_plugin
    started, closed = asyncio.Event(), asyncio.Event()

    async def block(*args: object, **kwargs: object) -> None:
        """
        通知调用方任务已开始并等待测试释放。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        """
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            closed.set()

    if during_gate:
        state.gateway.is_plugin_enabled.side_effect = block
    else:
        state.service.side_effect = block
    await state.runtime.activate('dispatch_test', FastAPI())
    loaded = state.runtime.loaded['dispatch_test']

    async def stop_child() -> None:
        """确认资源释放后停止子任务。"""
        assert closed.is_set()
        assert state.sessions == ['open', 'close']

    loaded.lifespan = SimpleNamespace(ready=True, shutdown=stop_child)
    task = asyncio.create_task(dispatch_plugin_job('dispatch_test', 'tick', '1.0.0'))
    try:
        await asyncio.wait_for(started.wait(), 5)
    finally:
        await state.runtime.shutdown()
    with pytest.raises(asyncio.CancelledError):
        await task
    metric = next(item for item in state.runtime.metrics.snapshot().series if item.operation == 'job:tick')
    assert (metric.active, metric.cancelled) == (0, 1)


@pytest.mark.asyncio
async def test_job_timeout_and_host_exception_propagate(setup_plugin: SimpleNamespace) -> None:
    """传播任务超时及宿主异常。"""
    state = setup_plugin
    state.plugin.manifest.backend.jobs[0].timeout_seconds = 0.01
    closed = asyncio.Event()

    async def wait(*args: object, **kwargs: object) -> None:
        """
        等待测试控制的任务状态变更。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        """
        try:
            await asyncio.Event().wait()
        finally:
            closed.set()

    await state.runtime.activate('dispatch_test', FastAPI())
    try:
        state.service.side_effect = wait
        with pytest.raises(TimeoutError):
            await dispatch_plugin_job('dispatch_test', 'tick', '1.0.0')
        assert closed.is_set()
        state.service.side_effect = ValueError('business-error')
        with pytest.raises(ValueError, match='business-error'):
            await dispatch_plugin_job('dispatch_test', 'tick', '1.0.0')
        metric = next(item for item in state.runtime.metrics.snapshot().series if item.operation == 'job:tick')
        assert (metric.started, metric.active, metric.failed, metric.timed_out) == (2, 0, 2, 1)
        assert metric.last_error_type == 'ValueError'
    finally:
        await state.runtime.shutdown()


@pytest.mark.asyncio
async def test_failed_activation_releases_binding_for_retry(setup_plugin: SimpleNamespace) -> None:
    """激活失败后释放绑定以供重试。"""
    runtime = setup_plugin.runtime
    with (
        patch.object(runtime, '_check_health', new=AsyncMock(side_effect=ValueError('unhealthy'))),
        pytest.raises(ValueError, match='unhealthy'),
    ):
        await runtime.activate('dispatch_test', FastAPI())
    with pytest.raises(RuntimeError, match='未就绪'):
        await dispatch_plugin_job('dispatch_test', 'tick', '1.0.0')
    await runtime.activate('dispatch_test', FastAPI())
    await runtime.shutdown()


def test_job_preflight_does_not_import_and_rejects_invalid_settings(setup_plugin: SimpleNamespace) -> None:
    """任务预检无需导入模块即可拒绝无效设置。"""
    state = setup_plugin
    with patch('importlib.import_module', side_effect=AssertionError('预检不能导入插件')):
        checked = PluginStructureChecker(state.plugin.backend_path.parents[1]).check(
            state.plugin, include_frontend=False
        )
    assert checked.ok, checked.failed_items
    for update in ({'executor': 'processpool'}, {'timeoutSeconds': 0}, {'callable': 'os.system'}):
        data = {
            **state.data,
            'backend': {**state.data['backend'], 'jobs': [{**state.data['backend']['jobs'][0], **update}]},
        }
        with pytest.raises(ValueError):
            PluginManifestFactory.create(data)


@pytest.mark.asyncio
@pytest.mark.parametrize('during_gate', [False, True])
async def test_unbind_is_bounded_and_blocks_new_binding_until_old_jobs_exit(
    setup_plugin: SimpleNamespace, during_gate: bool
) -> None:
    """残留任务保持在途，不允许复用绑定；延迟结束最终记录取消且不启动迟到回调。"""
    state = setup_plugin
    opened, release = asyncio.Event(), asyncio.Event()

    async def resistant(*args: object, **kwargs: object) -> bool:
        """
        模拟延迟响应取消信号的任务。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 此分支的固定值 ``True``
        """
        opened.set()
        while not release.is_set():
            with suppress(asyncio.CancelledError):
                await release.wait()
        return True

    (state.gateway.is_plugin_enabled if during_gate else state.service).side_effect = resistant
    await state.runtime.activate('dispatch_test', FastAPI())
    binding = state.runtime.loaded['dispatch_test'].jobs
    task = asyncio.create_task(dispatch_plugin_job('dispatch_test', 'tick', '1.0.0'))
    await opened.wait()
    stopping = asyncio.create_task(unbind_plugin_jobs(binding, grace_seconds=0.01))
    try:
        await asyncio.wait({stopping}, timeout=1)
        assert stopping.done() and not task.done()
        await stopping
        with pytest.raises(RuntimeError, match='未就绪'):
            await dispatch_plugin_job('dispatch_test', 'tick', '1.0.0')
        with pytest.raises(RuntimeError, match='旧任务尚未退出'):
            bind_plugin_jobs(state.plugin, binding.host, state.gateway, lambda: True)
        sample = next(item for item in state.runtime.metrics.snapshot().series if item.operation == 'job:tick')
        assert (sample.active, sample.succeeded, sample.cancelled) == (1, 0, 0)
        release.set()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, timeout=1)
        if during_gate:
            state.service.assert_not_called()
        assert state.sessions == ['open', 'close']
        sample = next(item for item in state.runtime.metrics.snapshot().series if item.operation == 'job:tick')
        assert (sample.active, sample.succeeded, sample.cancelled) == (0, 0, 1)
        replacement = bind_plugin_jobs(state.plugin, binding.host, state.gateway, lambda: True)
        await unbind_plugin_jobs(replacement, grace_seconds=0.01)
    finally:
        release.set()
        await asyncio.gather(stopping, task, return_exceptions=True)
        await state.runtime.shutdown()


@pytest.mark.asyncio
async def test_shutdown_keeps_pending_job_diagnostics_until_callback_exits(
    setup_plugin: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    """运行时关闭后仍保留取消超时任务的插件归属，迟到退出后计数归零。"""
    state = setup_plugin
    opened, release = asyncio.Event(), asyncio.Event()

    async def resistant(*args: object, **kwargs: object) -> bool:
        """
        模拟延迟响应取消信号的任务。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 此分支的固定值 ``True``
        """
        opened.set()
        while not release.is_set():
            with suppress(asyncio.CancelledError):
                await release.wait()
        return True

    async def bounded_unbind(binding: PluginJobBinding) -> None:
        """
        以较短的宽限期解除插件任务绑定。

        :param binding: 关联资源和运行时的绑定信息
        """
        await unbind_plugin_jobs(binding, grace_seconds=0.01)

    state.service.side_effect = resistant
    monkeypatch.setattr('plugins.core.runtime.explicit.unbind_plugin_jobs', bounded_unbind)
    await state.runtime.activate('dispatch_test', FastAPI())
    binding = state.runtime.loaded['dispatch_test'].jobs
    task = asyncio.create_task(dispatch_plugin_job('dispatch_test', 'tick', '1.0.0'))
    await opened.wait()
    try:
        running = state.runtime.diagnostic_snapshot().plugins[0]
        assert running.active_jobs == 1 and running.pending_job_tasks == 0
        await state.runtime.shutdown()
        pending = state.runtime.diagnostic_snapshot()
        assert state.runtime.loaded['dispatch_test'].jobs is binding
        assert not pending.plugins[0].ready
        assert pending.plugins[0].closing
        assert pending.plugins[0].active_jobs == 1
        assert pending.plugins[0].pending_job_tasks == 1
        assert pending.worker_pending_cleanup_tasks == 1
        release.set()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, timeout=1)
        finished = state.runtime.diagnostic_snapshot()
        assert finished.plugins[0].active_jobs == 0
        assert finished.plugins[0].pending_job_tasks == 0
        assert finished.worker_pending_cleanup_tasks == 0
    finally:
        release.set()
        await asyncio.gather(task, return_exceptions=True)
        await state.runtime.shutdown()
