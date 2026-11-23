from copy import deepcopy
from pathlib import Path

import pytest
import yaml

from plugins.core.capability import PluginRuntimeCapabilityResolver
from plugins.core.discovery.scanner import DiscoveredPlugin, PluginScanner
from plugins.core.manifest.schema import PluginManifest, PluginManifestFactory
from plugins.core.manifest.v2 import PluginManifestV2
from plugins.core.validation.manifest import PluginManifestChecker
from plugins.core.validation.structure import PluginStructureChecker


def manifest_data(*, native: bool = False, asgi: bool = False, bundle: bool = False) -> dict:
    """
    按后端类型准备插件清单字段。

    :param native: 是否使用原生插件
    :param asgi: 测试使用的 ASGI 应用
    :param bundle: 打包后的前端资源
    :return: 随调用传入或返回的结构化数据
    """
    module = 'ruoyi_plugin_demo' if native else 'plugins.demo'
    backend = {'module': module, 'entrypoint': f'{module}.entry:create_plugin'}
    if native:
        backend.update(runtime='native', native={'distribution': 'ruoyi-plugin-demo'})
    if asgi:
        backend['integration'] = 'asgi'
    payload = {'manifestVersion': 2, 'id': 'demo', 'name': 'Demo', 'version': '1.0.0', 'backend': backend}
    if bundle:
        payload['frontend'] = {
            'delivery': {'type': 'bundle'},
            'bundle': {},
            'menus': [{'name': 'Demo', 'path': 'demo', 'component': 'PluginFrame'}],
        }
    return payload


@pytest.mark.parametrize('native', [False, True])
@pytest.mark.parametrize('asgi', [False, True])
def test_runtime_and_integration_are_independent(native: bool, asgi: bool) -> None:
    """运行时配置与集成模式相互独立。"""
    manifest = PluginManifestFactory.create(manifest_data(native=native, asgi=asgi))
    assert isinstance(manifest, PluginManifestV2)
    assert manifest.runtime_kind == ('native' if native else 'python')
    assert manifest.integration_kind == ('asgi' if asgi else 'router')
    assert manifest.backend.routers.auto_scan is False
    if asgi:
        assert manifest.backend.asgi.mount_path == '/apps/demo'


def test_v1_keeps_defaults_and_rejects_v2_fields() -> None:
    """第一版配置保留默认值并拒绝第二版字段。"""
    data = {'id': 'demo', 'name': 'Demo', 'version': '1', 'backend': {'module': 'plugins.demo'}}
    manifest = PluginManifestFactory.create(data)
    assert type(manifest) is PluginManifest
    assert manifest.backend.routers.auto_scan
    assert not manifest.uses_entrypoint
    data['backend']['runtime'] = 'python'
    with pytest.raises(ValueError, match='Extra inputs'):
        PluginManifestFactory.create(data)


@pytest.mark.parametrize(
    ('field', 'value'),
    [
        ('entrypoint', 'os:system'),
        ('module', 'module_admin'),
        ('routers', {'autoScan': True}),
        ('native', {'distribution': 'demo'}),
        ('hooks', {'onStartup': 'os:system'}),
        ('asgi', {'mountPath': '/system'}),
    ],
)
def test_rejects_unsafe_or_conflicting_backend(field: str, value: object) -> None:
    """拒绝不安全或冲突的后端配置。"""
    payload = manifest_data(asgi=True)
    payload['backend'][field] = value
    with pytest.raises(ValueError):
        PluginManifestFactory.create(payload)


def test_asgi_cannot_start_resources_twice() -> None:
    """ASGI 不能重复启动资源。"""
    payload = manifest_data(asgi=True)
    payload['backend']['hooks'] = {'onStartup': 'plugins.demo.entry:startup'}
    with pytest.raises(ValueError, match='lifespan'):
        PluginManifestFactory.create(payload)


@pytest.mark.parametrize('path', ['../dist', '/dist', 'C:/dist', 'web\\dist', 'web/../dist', 'web/./dist'])
def test_bundle_rejects_nonportable_or_escaping_paths(path: str) -> None:
    """资源包拒绝不可移植或越界的路径。"""
    payload = manifest_data(asgi=True, bundle=True)
    payload['frontend']['bundle']['directory'] = path
    with pytest.raises(ValueError, match='安全相对路径'):
        PluginManifestFactory.create(payload)


def test_bundle_does_not_request_host_build_or_npm() -> None:
    """资源包无需宿主构建或调用 npm。"""
    payload = manifest_data(asgi=True, bundle=True)
    manifest = PluginManifestFactory.create(payload)
    assert manifest.frontend.delivery.type == 'bundle'
    assert not manifest.frontend.delivery.build_required
    plugin = DiscoveredPlugin(manifest, Path('plugins/demo'), Path('plugins/demo/plugin.yaml'))
    capability = PluginRuntimeCapabilityResolver(frontend_mode='built', backend_runtime_mode='service').resolve(plugin)
    assert not capability.frontend_build_required
    assert capability.frontend_runtime_manageable  # bundle 无需重建宿主前端。
    assert not capability.backend_runtime_manageable  # 保持生产变更门禁。
    invalid = deepcopy(payload)
    invalid['dependencies'] = {'frontend': {'vue3': {'npm': ['vue>=3.0.0']}}}
    with pytest.raises(ValueError, match='独立管理'):
        PluginManifestFactory.create(invalid)


def test_host_api_compatibility_is_enforced() -> None:
    """执行宿主 API 的兼容性检查。"""
    payload = manifest_data()
    payload['compatibility'] = {'hostApiVersion': '>=2.0.0'}
    result = PluginManifestChecker().check(PluginManifestFactory.create(payload))
    assert not result.ok
    assert any(item.path == 'compatibility.hostApiVersion' for item in result.error_issues)


def test_discovery_and_structure_do_not_execute_entrypoint(tmp_path: Path) -> None:
    """发现和结构校验均不执行插件入口。"""
    root = tmp_path / 'plugins' / 'demo'
    root.mkdir(parents=True)
    (root / 'plugin.yaml').write_text(yaml.safe_dump(manifest_data()), encoding='utf-8')
    (root / '__init__.py').write_text('raise RuntimeError("must not import")', encoding='utf-8')
    (root / 'entry.py').write_text('raise RuntimeError("must not import")', encoding='utf-8')
    plugin = PluginScanner(root.parent).discover()[0]
    result = PluginStructureChecker(tmp_path).check(plugin)
    assert result.ok
    assert any(item.kind == 'entrypoint' for item in result.items)


def test_bundle_resources_are_checked_in_production(tmp_path: Path) -> None:
    """生产环境检查资源包中的资源。"""
    root = tmp_path / 'plugins' / 'demo'
    root.mkdir(parents=True)
    (root / 'plugin.yaml').write_text(yaml.safe_dump(manifest_data(asgi=True, bundle=True)), encoding='utf-8')
    (root / '__init__.py').touch()
    (root / 'entry.py').touch()
    plugin = PluginScanner(root.parent).discover()[0]
    result = PluginStructureChecker(tmp_path).check(plugin, include_frontend=False)
    assert not result.ok
    assert any(item.kind == 'frontend_bundle' and not item.ok for item in result.items)
