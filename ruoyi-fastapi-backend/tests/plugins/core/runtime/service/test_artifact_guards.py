import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from plugins.core.validation.dependency_policy import DependencyInstallPolicyConfig
from tests.plugins.core.runtime.fakes import (
    FakePluginRuntimeGateway,
    FakePluginService,
    build_runtime_with_gateway,
    write_manifest,
)

EXPECTED_DATABASE_OPERATIONS = 2


@pytest.mark.asyncio
@pytest.mark.parametrize('operation', ['install', 'upgrade', 'enable', 'disable', 'uninstall', 'purge'])
@pytest.mark.parametrize('dry_run', [False, True])
async def test_database_artifact_source_blocks_legacy_lifecycle_without_source_directory(
    tmp_path: Path, operation: str, dry_run: bool
) -> None:
    """数据库中的产物来源即使没有源码目录也阻止旧生命周期操作。"""
    gateway = FakePluginRuntimeGateway()
    FakePluginService.detail_plugin = SimpleNamespace(plugin_id='demo', source='artifact')
    runtime = build_runtime_with_gateway(tmp_path / 'backend', gateway)
    if operation in {'enable', 'disable'}:
        payload = await runtime.set_plugin_enabled('demo', enabled=operation == 'enable', dry_run=dry_run)
    else:
        payload = await getattr(runtime, f'{operation}_plugin')('demo', dry_run=dry_run)
    assert payload['ok'] is False
    assert payload['status'] == 'blocked'
    assert payload['operation'] == operation
    assert payload['capability']['runtimeManageable'] is False
    assert gateway.lifecycle_uows == []
    assert gateway.session_local.sessions == []
    assert FakePluginService.marked_errors == []
    assert FakePluginService.operation_logs == []
    assert FakePluginService.purge_by_id_called_with is None


@pytest.mark.asyncio
async def test_state_query_failure_cannot_authorize_orphan_purge(tmp_path: Path) -> None:
    """状态查询失败时拒绝清理孤立产物。"""

    class FailingGateway(FakePluginRuntimeGateway):
        """在插件状态查询时模拟失败。"""

        async def get_plugin_state(self, plugin_id: str) -> None:
            """
            模拟此操作抛出 RuntimeError 的情形。

            :param plugin_id: 插件清单中的唯一标识
            :raises RuntimeError: 模拟插件状态数据库不可用
            """
            raise RuntimeError('state database unavailable')

    gateway = FailingGateway()
    payload = await build_runtime_with_gateway(tmp_path / 'backend', gateway).purge_plugin('demo')
    assert payload['status'] == 'blocked'
    assert '无法确认插件来源' in payload['message']
    assert gateway.session_local.sessions == []


@pytest.mark.asyncio
async def test_config_read_resolves_selected_artifact_without_source_directory(tmp_path: Path) -> None:
    """无源码目录时仍可按配置读取选中产物。"""
    selected = object()

    class ArtifactGateway(FakePluginRuntimeGateway):
        """提供测试所选制品对应的插件记录。"""

        async def get_selected_artifact_plugin(self, plugin_id: str, backend_root: Path) -> object:
            """
            校验插件来源并返回所选交付物。

            :param plugin_id: 插件清单中的唯一标识
            :param backend_root: 后端项目的根目录
            :return: 所选交付物
            """
            assert plugin_id == 'demo'
            assert backend_root == tmp_path / 'backend'
            return selected

        async def get_plugin_config(self, discovered_plugin: object, *, reveal_secret: bool = False) -> list:
            """
            检查插件选择和配置读取参数。

            :param discovered_plugin: 扫描插件目录后得到的插件描述
            :param reveal_secret: 是否在返回结果中显示敏感值
            :return: 模拟的插件配置条目列表
            """
            assert discovered_plugin is selected
            assert reveal_secret is False
            return []

        async def set_plugin_config(self, discovered_plugin: object, values: dict, **kwargs: object) -> list:
            """
            校验写入配置的目标插件及字段值。

            :param discovered_plugin: 扫描插件目录后得到的插件描述
            :param values: 当前处理的值集合
            :param kwargs: 传给被调用对象的关键字参数
            :return: 模拟写入后的配置条目列表
            """
            assert discovered_plugin is selected
            assert values == {'provider': 'local'}
            return []

    FakePluginService.detail_plugin = SimpleNamespace(plugin_id='demo', source='artifact')
    runtime = build_runtime_with_gateway(tmp_path / 'backend', ArtifactGateway())
    result = await runtime.get_plugin_config('demo')
    assert result['ok'] is True
    assert result['configs'] == []
    result = await runtime.set_plugin_config('demo', {'provider': 'local'})
    assert result['ok'] is True


@pytest.mark.parametrize('method', ['install_plugin_dependencies', 'install_plugin_dependencies_from_cli'])
def test_artifact_source_blocks_dependency_install_even_when_same_id_source_exists(tmp_path: Path, method: str) -> None:
    """同标识源码存在时产物来源仍阻止安装依赖。"""
    backend = tmp_path / 'backend'
    write_manifest(
        backend / 'plugins' / 'demo',
        'id: demo\nname: Demo\nversion: 1.0.0\nbackend:\n  module: plugins.demo\n',
    )
    gateway = FakePluginRuntimeGateway()
    FakePluginService.detail_plugin = SimpleNamespace(plugin_id='demo', source='artifact')
    payload = getattr(build_runtime_with_gateway(backend, gateway), method)('demo', confirmed=True)
    assert payload['status'] == 'blocked'
    assert '签名制品' in payload['message']
    assert gateway.commands == []
    assert gateway.session_local.sessions == []


def test_dependency_install_fails_closed_when_source_query_fails(tmp_path: Path) -> None:
    """依赖来源查询失败时拒绝安装。"""

    class FailingGateway(FakePluginRuntimeGateway):
        """在插件状态查询时模拟失败。"""

        async def get_plugin_state(self, plugin_id: str) -> None:
            """
            模拟此操作抛出 RuntimeError 的情形。

            :param plugin_id: 插件清单中的唯一标识
            :raises RuntimeError: 模拟插件状态数据库不可用
            """
            raise RuntimeError('database unavailable')

    gateway = FailingGateway()
    payload = build_runtime_with_gateway(tmp_path, gateway).install_plugin_dependencies_from_cli('demo', confirmed=True)
    assert payload['status'] == 'blocked'
    assert gateway.commands == []


@pytest.mark.asyncio
async def test_sync_dependency_install_never_runs_nested_event_loop(tmp_path: Path) -> None:
    """同步依赖安装不会嵌套启动事件循环。"""

    class UnexpectedQueryGateway(FakePluginRuntimeGateway):
        """在不应查询插件状态时触发测试失败。"""

        async def get_plugin_state(self, plugin_id: str) -> None:
            """
            若执行到此操作则立即使测试失败。

            :param plugin_id: 插件清单中的唯一标识
            """
            pytest.fail('synchronous wrapper must not query within the running loop')

    gateway = UnexpectedQueryGateway()
    payload = build_runtime_with_gateway(tmp_path, gateway).install_plugin_dependencies_from_cli('demo', confirmed=True)
    assert payload['status'] == 'blocked'
    assert '事件循环' in payload['message']
    assert gateway.commands == []


@pytest.mark.asyncio
async def test_configuration_never_falls_back_to_conflicting_source(tmp_path: Path) -> None:
    """配置读取不会回退到冲突的源码。"""
    backend = tmp_path / 'backend'
    write_manifest(
        backend / 'plugins' / 'demo',
        'id: demo\nname: Demo\nversion: 1.0.0\nbackend:\n  module: plugins.demo\n',
    )

    class ConflictingGateway(FakePluginRuntimeGateway):
        """模拟插件制品选择冲突。"""

        async def get_selected_artifact_plugin(self, plugin_id: str, backend_root: Path) -> None:
            """
            在调用时报告预期的测试失败：制品与源码目录冲突。

            :param plugin_id: 插件清单中的唯一标识
            :param backend_root: 后端项目的根目录
            :raises ValueError: 制品与源码目录冲突
            """
            raise ValueError('制品与源码目录冲突')

    FakePluginService.detail_plugin = SimpleNamespace(plugin_id='demo', source='artifact')
    gateway = ConflictingGateway()
    runtime = build_runtime_with_gateway(backend, gateway)
    for payload in (await runtime.get_plugin_config('demo'), await runtime.set_plugin_config('demo', {'key': 'value'})):
        assert payload['ok'] is False
        assert '冲突' in str(payload)
    assert gateway.session_local.sessions == []


@pytest.mark.parametrize('method', ['install_plugin_dependencies', 'install_plugin_dependencies_from_cli'])
def test_dependency_source_check_and_audit_share_one_event_loop(tmp_path: Path, method: str) -> None:
    """依赖来源校验和审计共用事件循环。"""
    backend = tmp_path / 'backend'
    write_manifest(
        backend / 'plugins' / 'demo',
        'id: demo\nname: Demo\nversion: 1.0.0\nbackend:\n  module: plugins.demo\n'
        'dependencies:\n  python:\n    - missing-python\n',
    )
    loops: list[asyncio.AbstractEventLoop] = []

    class LoopAffineGateway(FakePluginRuntimeGateway):
        """检查插件操作是否使用同一个事件循环。"""

        async def get_plugin_state(self, plugin_id: str) -> None:
            """
            提供插件状态查询的观测点。

            :param plugin_id: 插件清单中的唯一标识
            """
            loops.append(asyncio.get_running_loop())

        async def add_plugin_operation_log(self, payload: dict, *, dry_run: bool, continue_on_error: bool) -> None:
            """
            记录插件日志调用及其事件循环。

            :param payload: 随调用传入或返回的结构化数据
            :param dry_run: 是否只预览操作结果
            :param continue_on_error: 单项操作失败后是否继续执行
            :raises RuntimeError: 检测到跨事件循环复用异步数据库连接池
            """
            current_loop = asyncio.get_running_loop()
            if loops[0] is not current_loop:
                raise RuntimeError('shared async database pool was reused from a different event loop')
            loops.append(current_loop)
            await super().add_plugin_operation_log(payload, dry_run=dry_run, continue_on_error=continue_on_error)

    gateway = LoopAffineGateway()
    payload = getattr(build_runtime_with_gateway(backend, gateway), method)(
        'demo', policy_config=DependencyInstallPolicyConfig(mode='explicit', env='dev'), confirmed=True
    )
    assert payload['ok'] is True
    assert len(gateway.commands) == 1
    assert len(loops) == EXPECTED_DATABASE_OPERATIONS
    assert loops[0] is loops[1]
    assert loops[0].is_closed()
    assert len(FakePluginService.operation_logs) == 1
