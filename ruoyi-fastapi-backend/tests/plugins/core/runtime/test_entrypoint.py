import base64
import hashlib
import sys
from collections.abc import Generator
from importlib.machinery import EXTENSION_SUFFIXES
from pathlib import Path

import pytest
from packaging.tags import sys_tags

from plugins.core.discovery.scanner import DiscoveredPlugin
from plugins.core.manifest.schema import PluginManifestFactory
from plugins.core.runtime.entrypoint import PluginEntrypointLoader
from plugins.core.sdk import PluginHostContext, await_plugin_callback


@pytest.fixture(autouse=True)
def isolate_modules() -> Generator[None, None, None]:
    """
    测试模块使用独立 ID，避免影响现有插件测试。

    :yield: 上下文就绪后将控制权交给调用方
    """
    yield
    for name in list(sys.modules):
        if name == 'plugins.entry_test' or name.startswith('plugins.entry_test.'):
            sys.modules.pop(name, None)
    if hasattr(sys.modules.get('plugins'), 'entry_test'):
        delattr(sys.modules['plugins'], 'entry_test')


def make_plugin(tmp_path: Path, source: str, *, native: bool = False) -> DiscoveredPlugin:
    """
    组装测试所需的插件描述。

    :param tmp_path: pytest 为当前用例创建的临时目录
    :param source: 写入测试插件入口模块的 Python 源码
    :param native: 是否使用原生插件
    :return: 测试所需的插件描述
    """
    root = tmp_path / 'plugins' / 'entry_test'
    root.mkdir(parents=True, exist_ok=True)
    module = 'ruoyi_plugin_entry_test' if native else 'plugins.entry_test'
    backend = {'module': module, 'entrypoint': f'{module}.entry:create_plugin'}
    if native:
        backend.update(runtime='native', native={'distribution': 'ruoyi-plugin-entry-test'})
    manifest = PluginManifestFactory.create(
        {'manifestVersion': 2, 'id': 'entry_test', 'name': 'Test', 'version': '1.0.0', 'backend': backend}
    )
    (root / '__init__.py').touch()
    (root / 'entry.py').write_text(source, encoding='utf-8')
    return DiscoveredPlugin(manifest, root, root / 'plugin.yaml')


def test_python_factory_can_call_host_service(tmp_path: Path) -> None:
    """Python 工厂可调用宿主服务。"""
    calls = []
    plugin = make_plugin(
        tmp_path,
        'from plugins.core.sdk import PluginDefinition\n'
        'def create_plugin(host):\n'
        '    host.service("record")("called")\n'
        '    return PluginDefinition()\n',
    )
    host = PluginHostContext(plugin.manifest.id, plugin.backend_path, services={'record': calls.append})
    definition = PluginEntrypointLoader(plugin).load(host)
    assert definition.api_version == 1
    assert calls == ['called']


def test_loader_rejects_other_version_in_module_cache(tmp_path: Path) -> None:
    """加载器拒绝模块缓存中的其他版本。"""
    source = 'from plugins.core.sdk import PluginDefinition\ndef create_plugin(host): return PluginDefinition()\n'
    first = make_plugin(tmp_path / 'first', source)
    second = make_plugin(tmp_path / 'second', source)
    PluginEntrypointLoader(first).load(PluginHostContext(first.manifest.id, first.backend_path))
    with pytest.raises(ImportError, match='必须重启'):
        PluginEntrypointLoader(second).load(PluginHostContext(second.manifest.id, second.backend_path))


def test_failed_import_removes_new_modules(tmp_path: Path) -> None:
    """导入失败时清理新增模块。"""
    plugin = make_plugin(tmp_path, 'raise RuntimeError("broken import")\n')
    with pytest.raises(RuntimeError, match='broken import'):
        PluginEntrypointLoader(plugin).load(PluginHostContext(plugin.manifest.id, plugin.backend_path))
    assert 'plugins.entry_test.entry' not in sys.modules
    assert 'plugins.entry_test' not in sys.modules


@pytest.mark.parametrize(
    'source',
    [
        'def create_plugin(host): return object()\n',
        'async def create_plugin(host): return None\n',
        'from plugins.core.sdk import PluginDefinition\ndef create_plugin(host): return PluginDefinition(api_version=2)\n',
    ],
)
def test_factory_protocol_is_checked(tmp_path: Path, source: str) -> None:
    """校验插件工厂协议。"""
    plugin = make_plugin(tmp_path, source)
    with pytest.raises((ValueError, TypeError)):
        PluginEntrypointLoader(plugin).load(PluginHostContext(plugin.manifest.id, plugin.backend_path))


def test_native_precheck_validates_tags_record_and_hash_without_importing(tmp_path: Path) -> None:
    """原生预检在不导入模块时校验标签、记录和哈希。"""
    plugin = make_plugin(tmp_path, '', native=True)
    native_root = plugin.backend_path / 'native'
    package = native_root / 'ruoyi_plugin_entry_test'
    package.mkdir(parents=True)
    (package / '__init__.py').write_text('raise RuntimeError("do not import")', encoding='utf-8')
    library = package / f'entry{EXTENSION_SUFFIXES[0]}'
    library.write_bytes(b'fixture-not-an-executable')
    metadata = native_root / 'ruoyi_plugin_entry_test-1.0.0.dist-info'
    metadata.mkdir()
    (metadata / 'METADATA').write_text('Name: ruoyi-plugin-entry-test\nVersion: 1.0.0\n', encoding='utf-8')
    (metadata / 'WHEEL').write_text(f'Wheel-Version: 1.0\nTag: {next(sys_tags())}\n', encoding='utf-8')
    digest = base64.urlsafe_b64encode(hashlib.sha256(library.read_bytes()).digest()).rstrip(b'=').decode()
    relative = library.relative_to(native_root).as_posix()
    (metadata / 'RECORD').write_text(f'{relative},sha256={digest},{library.stat().st_size}\n', encoding='utf-8')
    loader = PluginEntrypointLoader(plugin)
    assert loader.check_entrypoint().path == library.resolve()
    assert 'ruoyi_plugin_entry_test' not in sys.modules
    library.write_bytes(b'tampered')
    with pytest.raises(ValueError, match='SHA256'):
        loader.check_entrypoint()
    (metadata / 'WHEEL').write_text('Tag: cp20-cp20-unknown_platform\n', encoding='utf-8')
    with pytest.raises(ValueError, match='ABI'):
        loader.check_entrypoint()


@pytest.mark.asyncio
async def test_native_style_callable_returns_awaitable() -> None:
    """原生可调用对象可返回可等待的结果。"""

    async def calculate(value: int) -> int:
        """
        返回输入值加一的回调结果。

        :param value: 待处理的输入值
        :return: 输入值加一的回调结果
        """
        return value + 1

    class NativeStyleCallback:
        """用同步调用入口模拟原生插件回调。"""

        def __call__(self, value: int) -> object:
            """
            执行测试替身的回调。

            :param value: 待处理的输入值
            :return: 传入数值经回调计算后的结果
            """
            return calculate(value)

    result = await await_plugin_callback(NativeStyleCallback(), 4)
    assert result == 4 + 1
    with pytest.raises(TypeError, match='awaitable'):
        await await_plugin_callback(lambda: 4)


def test_context_rejects_resource_escape_and_unknown_service(tmp_path: Path) -> None:
    """上下文拒绝资源越界及未知服务。"""
    host = PluginHostContext('entry_test', tmp_path)
    with pytest.raises(ValueError, match='根目录'):
        host.resource('../outside')
    with pytest.raises(LookupError, match='未提供'):
        host.service('os.system')
