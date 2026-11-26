import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from types import ModuleType

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path) -> ModuleType:
    """
    按路径加载 CI 与 E2E 入口，以验证跨工程的版本契约。

    :param name: 要读取的本地模块的完整名称
    :param path: 要读取或处理的路径
    :return: 提供被测功能的模块
    """
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None, path
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ci = load_module('ci_plan_matrix', ROOT / '.github/scripts/ci_plan.py')
compose = load_module('prepare_e2e_compose_matrix', ROOT / 'ruoyi-fastapi-test/prepare_e2e_compose.py')


@pytest.mark.parametrize('workflow,job', [('ci-backend.yml', 'unit-contract'), ('ci-native.yml', 'runtime')])
def test_backend_and_native_cover_full_e2e_python_versions(workflow: str, job: str) -> None:
    """后端和原生运行时不能遗漏完整 E2E 矩阵中的 Python 版本。"""
    config = yaml.safe_load((ROOT / '.github/workflows' / workflow).read_text(encoding='utf-8'))
    assert config['jobs'][job]['strategy']['matrix']['python'] == list(ci.PYTHON_VERSIONS)


@pytest.mark.parametrize('workflow,job', [('ci-backend.yml', 'unit-contract'), ('ci-quality.yml', 'type-check')])
def test_type_checks_run_on_every_supported_python(workflow: str, job: str) -> None:
    """后端、浏览器测试和 CI 脚本的类型检查应在每个受支持版本运行。"""
    config = yaml.safe_load((ROOT / '.github/workflows' / workflow).read_text(encoding='utf-8'))
    matrix_job = config['jobs'][job]
    assert matrix_job['strategy']['matrix']['python'] == list(ci.PYTHON_VERSIONS)
    (setup,) = (step for step in matrix_job['steps'] if step.get('uses', '').startswith('actions/setup-python@'))
    assert setup['with']['python-version'] == '${{ matrix.python }}'
    (check,) = (step for step in matrix_job['steps'] if 'scripts/check_types.py' in step.get('run', ''))
    assert 'if' not in check
    assert '--python-version ${{ matrix.python }}' in check['run']


def test_release_covers_full_matrix_and_preserves_pr_baseline() -> None:
    """插件发布的完整矩阵跟随 E2E，PR 仍使用单版本基线。"""
    config = yaml.safe_load((ROOT / '.github/workflows/ci-integration.yml').read_text(encoding='utf-8'))
    expression = config['jobs']['release']['strategy']['matrix']['python']
    versions = [json.loads(value) for value in re.findall(r"'(\[[^']+\])'", expression)]
    assert versions == [list(ci.PYTHON_VERSIONS), ['3.12']]


@pytest.mark.parametrize('python_version', ci.PYTHON_VERSIONS)
@pytest.mark.parametrize('database,suffix', [('mysql', 'my'), ('postgresql', 'pg')])
def test_e2e_cli_accepts_matrix_and_passes_version_to_docker(
    python_version: str, database: str, suffix: str, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """实际 CLI 解析每个矩阵版本，并将其传入两种数据库的 Docker 构建参数。"""
    service = f'ruoyi-backend-{suffix}'
    configuration = {'services': {service: {'build': {'context': 'backend'}}}}
    result = subprocess.CompletedProcess(args=[], returncode=0, stdout=json.dumps(configuration))
    monkeypatch.setattr(compose.subprocess, 'run', lambda *args, **kwargs: result)
    output = tmp_path / 'compose.json'
    monkeypatch.setattr(
        sys,
        'argv',
        [
            'prepare_e2e_compose.py',
            '--database',
            database,
            '--framework',
            'vue3',
            '--python-version',
            python_version,
            '--project',
            'ruoyi-ci-python-matrix',
            '--output',
            str(output),
        ],
    )
    compose.main()
    generated = json.loads(output.read_text(encoding='utf-8'))
    assert generated['services'][service]['build']['args']['PYTHON_VERSION'] == python_version
