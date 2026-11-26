import sys
from pathlib import Path
from subprocess import CompletedProcess

from cli.runtime.plugin.service import CliPluginRuntimeService
from plugins.core.environment import PluginRuntimeEnvironmentService
from plugins.core.management.service.gateway import PluginManagementRuntimeGateway
from plugins.core.runtime.service.gateway import PluginCommandOutputCallback
from plugins.core.validation.dependencies import (
    NpmDependencyInspector,
    PluginDependencyChecker,
    PythonDependencyInspector,
)

EXPECTED_FRONTEND_BUILD_TIMEOUT = 300


class FakeRuntimeEnvironment(PluginRuntimeEnvironmentService):
    """
    使用测试目录和当前 Python 解释器的开发环境。

    :ivar frontend_mode: 测试固定使用的前端开发模式
    :ivar backend_runtime_mode: 测试固定使用的后端开发模式
    """

    def __init__(self, backend_dir: Path, frontend_dir: Path | None = None) -> None:
        """
        设置测试用插件目录和解释器。

        :param backend_dir: 后端根目录
        :param frontend_dir: 前端根目录
        """
        super().__init__(backend_root=backend_dir, frontend_root=frontend_dir, python_executable=sys.executable)
        self.frontend_mode = 'dev'
        self.backend_runtime_mode = 'dev'


class FakePluginRuntimeGateway(PluginManagementRuntimeGateway):
    """
    测试用插件 CLI 运行时适配器。

    :ivar completed_process: 用于模拟子进程执行结果的对象
    :ivar commands: 测试替身收到的命令
    """

    def __init__(self) -> None:
        """初始化测试用插件 CLI 运行时适配器。"""
        self.completed_process = CompletedProcess(args=[], returncode=0, stdout='1 passed\n', stderr='')
        self.commands: list[tuple[list[str], str, int | None]] = []

    def run_command(
        self,
        command: list[str],
        workdir: str,
        *,
        timeout: int | None = None,
        output_callback: PluginCommandOutputCallback | None = None,
    ) -> CompletedProcess[str]:
        """
        记录测试用系统命令。

        :param command: 执行的命令及其参数
        :param workdir: 命令执行时使用的工作目录
        :param output_callback: 接收命令输出的回调
        :param timeout: 等待操作完成的超时限制
        :return: 供调用方使用的 ``self.completed_process``
        """
        self.commands.append((command, workdir, timeout))
        return self.completed_process


def build_runtime(backend_root: Path, frontend_root: Path | None = None) -> CliPluginRuntimeService:
    """
    构建测试用插件 CLI 运行时服务。

    :param backend_root: 后端项目的根目录
    :param frontend_root: 前端项目的根目录
    :return: 测试用插件 CLI 运行时服务
    """
    return CliPluginRuntimeService(
        runtime_environment=FakeRuntimeEnvironment(backend_root, frontend_root),
        dependency_checker=PluginDependencyChecker(
            python_inspector=PythonDependencyInspector(installed_packages={'openai': '2.17.0'}),
            npm_inspector=NpmDependencyInspector(installed_packages={'vue': '3.5.26'}),
        ),
    )


def build_runtime_with_gateway(
    backend_root: Path,
    gateway: FakePluginRuntimeGateway,
    frontend_root: Path | None = None,
) -> CliPluginRuntimeService:
    """
    构建带测试运行时适配器的插件 CLI 运行时服务。

    :param backend_root: 后端项目的根目录
    :param gateway: 测试用插件运行时适配器
    :param frontend_root: 前端项目的根目录
    :return: 带测试运行时适配器的插件 CLI 运行时服务
    """
    return CliPluginRuntimeService(
        runtime_environment=FakeRuntimeEnvironment(backend_root, frontend_root),
        dependency_checker=PluginDependencyChecker(
            python_inspector=PythonDependencyInspector(installed_packages={'openai': '2.17.0'}),
            npm_inspector=NpmDependencyInspector(installed_packages={'vue': '3.5.26'}),
        ),
        management_gateway=gateway,
        model_gateway=gateway,
        command_gateway=gateway,
    )
