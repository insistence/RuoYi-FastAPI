import runpy
import subprocess
from pathlib import Path
from unittest.mock import Mock

import pytest
from pytest import MonkeyPatch

from cli import bootstrap
from cli.bootstrap import AppBootstrapService
from cli.runtime.base import RuntimeEnvironmentService

APP_ENTRY = Path(__file__).resolve().parents[3] / 'app.py'
CHILD_EXIT_CODE = 7
INTERRUPT_EXIT_CODE = 130


class FakeRuntimeEnvironment(RuntimeEnvironmentService):
    """提供启动测试使用的后端路径和解释器。"""

    @staticmethod
    def get_backend_dir() -> str:
        """
        返回测试环境使用的后端根目录。

        :return: 测试环境使用的后端根目录
        """
        return 'C:\\project\\ruoyi-fastapi-backend'

    @staticmethod
    def get_python_executable() -> str:
        """
        返回测试使用的 Python 解释器路径。

        :return: 测试使用的 Python 解释器路径
        """
        return 'C:\\Python\\python.exe'


@pytest.mark.parametrize('module_name,expected', [('__main__', 'server:create_app'), ('app', 'create_app')])
def test_app_entry_compiles_catalogs_before_startup(module_name: str, expected: str, monkeypatch: MonkeyPatch) -> None:
    """应用启动前编译翻译目录。"""
    calls = []
    monkeypatch.setattr(
        'scripts.compile_i18n.compile_catalogs', lambda *, isolate_plugin_errors: calls.append(isolate_plugin_errors)
    )
    monkeypatch.setattr('uvicorn.run', lambda **options: calls.append(options['app']))
    monkeypatch.setattr('server.create_app', lambda: calls.append('create_app'))

    runpy.run_path(str(APP_ENTRY), run_name=module_name)

    assert calls == [True, expected]


@pytest.mark.parametrize('module_name', ['__main__', 'app'])
def test_app_entry_stops_on_catalog_error(module_name: str, monkeypatch: MonkeyPatch) -> None:
    """翻译目录编译失败时中止启动。"""
    monkeypatch.setattr('scripts.compile_i18n.compile_catalogs', Mock(side_effect=ValueError('invalid catalog')))
    start = Mock()
    monkeypatch.setattr('uvicorn.run', start)
    monkeypatch.setattr('server.create_app', start)

    with pytest.raises(ValueError, match='invalid catalog'):
        runpy.run_path(str(APP_ENTRY), run_name=module_name)

    start.assert_not_called()


def test_exec_app_run_command_waits_for_child_process_on_windows(monkeypatch: MonkeyPatch) -> None:
    """Windows 启动器等待子进程结束。"""
    service = AppBootstrapService(runtime_environment=FakeRuntimeEnvironment())
    expected_command = [
        'C:\\Python\\python.exe',
        'C:\\project\\ruoyi-fastapi-backend\\app.py',
        '--env',
        'dev',
    ]
    captured: dict[str, object] = {}

    def fake_run(command: list[str], *, check: bool) -> subprocess.CompletedProcess[str]:
        """
        模拟子进程运行并记录命令参数。

        :param command: 执行的命令及其参数
        :param check: 对源码运行文档检查并返回行号和诊断的测试夹具
        :return: ``subprocess.CompletedProcess`` 实例
        """
        captured['command'] = command
        captured['check'] = check
        return subprocess.CompletedProcess(command, CHILD_EXIT_CODE)

    monkeypatch.setattr(bootstrap, '_IS_WINDOWS', True)
    monkeypatch.setattr(bootstrap.subprocess, 'run', fake_run)

    with pytest.raises(SystemExit) as exit_info:
        service.exec_app_run_command('dev')

    assert exit_info.value.code == CHILD_EXIT_CODE
    assert captured == {'command': expected_command, 'check': False}


def test_exec_app_run_command_returns_interrupt_exit_code_on_windows(monkeypatch: MonkeyPatch) -> None:
    """Windows 启动器在中断时返回相应退出码。"""
    service = AppBootstrapService(runtime_environment=FakeRuntimeEnvironment())

    def fake_run(command: list[str], *, check: bool) -> subprocess.CompletedProcess[str]:
        """
        模拟此操作抛出 KeyboardInterrupt 的情形。

        :param command: 执行的命令及其参数
        :param check: 对源码运行文档检查并返回行号和诊断的测试夹具
        :raises KeyboardInterrupt: 执行期间收到中断信号时
        """
        raise KeyboardInterrupt

    monkeypatch.setattr(bootstrap, '_IS_WINDOWS', True)
    monkeypatch.setattr(bootstrap.subprocess, 'run', fake_run)

    with pytest.raises(SystemExit) as exit_info:
        service.exec_app_run_command('dev')

    assert exit_info.value.code == INTERRUPT_EXIT_CODE


def test_exec_app_run_command_uses_exec_on_posix(monkeypatch: MonkeyPatch) -> None:
    """POSIX 启动器通过 exec 替换当前进程。"""
    service = AppBootstrapService(runtime_environment=FakeRuntimeEnvironment())
    captured: dict[str, object] = {}

    def fake_execvp(executable: str, command: list[str]) -> None:
        """
        捕获将要替换进程的可执行文件和参数。

        :param executable: 需要启动的可执行文件
        :param command: 执行的命令及其参数
        """
        captured['executable'] = executable
        captured['command'] = command

    monkeypatch.setattr(bootstrap, '_IS_WINDOWS', False)
    monkeypatch.setattr(bootstrap.os, 'execvp', fake_execvp)

    service.exec_app_run_command('prod')

    assert captured == {
        'executable': 'C:\\Python\\python.exe',
        'command': [
            'C:\\Python\\python.exe',
            'C:\\project\\ruoyi-fastapi-backend\\app.py',
            '--env',
            'prod',
        ],
    }
