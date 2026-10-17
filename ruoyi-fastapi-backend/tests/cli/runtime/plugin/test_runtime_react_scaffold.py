import json
import shutil
import subprocess
from pathlib import Path

import pytest

from cli.runtime.plugin.service import CliPluginRuntimeService
from plugins.core.environment import PluginRuntimeEnvironmentService

BACKEND_ROOT = Path(__file__).resolve().parents[4]
REACT_ROOT = BACKEND_ROOT.parent / 'ruoyi-fastapi-frontend' / 'react' / 'web'


@pytest.mark.parametrize('template', ['full-stack', 'crud-page'])
@pytest.mark.parametrize('selection', ['explicit', 'package', 'environment'])
def test_react_scaffold_generates_checkable_files_and_route_test(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, template: str, selection: str
) -> None:
    """生成实际插件并通过后端检查，Node 执行生成的路由测试。"""
    backend = tmp_path / 'backend'
    container = tmp_path / 'ruoyi-fastapi-frontend'
    frontend = tmp_path / 'host' if selection == 'package' else container / 'react' / 'web'
    frontend.mkdir(parents=True)
    (frontend / 'package.json').write_text(
        json.dumps({'type': 'module', 'dependencies': {'react': '19.2.0', 'antd': '6.6.5'}}), encoding='utf-8'
    )
    resolver = frontend / 'src' / 'utils' / 'pluginViewResolver.js'
    resolver.parent.mkdir(parents=True)
    resolver.write_bytes((REACT_ROOT / 'src' / 'utils' / 'pluginViewResolver.js').read_bytes())
    for name in ('RUOYI_PLUGIN_FRONTEND_FRAMEWORK', 'RUOYI_FRONTEND_FRAMEWORK'):
        monkeypatch.delenv(name, raising=False)
    if selection == 'environment':
        monkeypatch.setenv('RUOYI_PLUGIN_FRONTEND_FRAMEWORK', 'react')
    environment = PluginRuntimeEnvironmentService(
        backend_root=backend, frontend_root=frontend if selection == 'package' else container
    )
    runtime = CliPluginRuntimeService(runtime_environment=environment)
    kwargs = {'frontend_framework': 'react'} if selection == 'explicit' else {}
    preview = runtime.create_plugin('react_demo', template=template, dry_run=True, **kwargs)
    assert preview['ok'] is True
    assert preview['frontendFramework'] == 'react'
    assert not (backend / 'plugins' / 'react_demo').exists()
    assert not (frontend / 'plugins' / 'react_demo').exists()

    created = runtime.create_plugin('react_demo', template=template, **kwargs)
    assert created['ok'] is True
    view = frontend / 'plugins' / 'react_demo' / 'views' / 'index.jsx'
    api = frontend / 'plugins' / 'react_demo' / 'api' / 'react_demo.js'
    assert view.is_file() and api.is_file()
    assert not view.with_suffix('.vue').exists()
    assert not (container / 'vue3' / 'web' / 'plugins' / 'react_demo').exists()
    assert 'index.jsx' in (backend / 'plugins' / 'react_demo' / 'README.md').read_text(encoding='utf-8')
    assert 'React' in (frontend / 'plugins' / 'react_demo' / 'README.md').read_text(encoding='utf-8')

    # 检查命令使用选中的实际 React 工程。
    react_runtime = CliPluginRuntimeService(
        runtime_environment=PluginRuntimeEnvironmentService(backend_root=backend, frontend_root=frontend)
    )
    checked = react_runtime.core_runtime.check_plugin('react_demo')
    assert checked['ok'] is True, checked
    assert checked['checks'][0]['structureErrors'] == []
    before = {path: path.read_bytes() for path in frontend.rglob('*') if path.is_file()}
    conflict = runtime.create_plugin('react_demo', template=template, **kwargs)
    assert conflict['ok'] is False
    assert before == {path: path.read_bytes() for path in frontend.rglob('*') if path.is_file()}

    node = shutil.which('node')
    if node:
        result = subprocess.run(
            [node, '--test', str(frontend / 'tests/plugins/react_demo/pluginView.test.js')],
            cwd=frontend,
            capture_output=True,
            text=True,
            encoding='utf-8',
            check=False,
            timeout=30,
        )
        assert result.returncode == 0, result.stdout + result.stderr


def test_react_frontend_only_respects_no_test_option(tmp_path: Path) -> None:
    """只生成前端时不创建后端插件，关闭测试开关不留下测试目录。"""
    backend = tmp_path / 'backend'
    frontend = tmp_path / 'ruoyi-fastapi-frontend' / 'react' / 'web'
    runtime = CliPluginRuntimeService(
        runtime_environment=PluginRuntimeEnvironmentService(backend_root=backend, frontend_root=frontend)
    )
    result = runtime.create_plugin('frontend_demo', template='crud-page', backend=False, test=False)
    assert result['ok'] is True
    assert (frontend / 'plugins/frontend_demo/views/index.jsx').is_file()
    assert not (backend / 'plugins').exists()
    assert not (frontend / 'tests').exists()
