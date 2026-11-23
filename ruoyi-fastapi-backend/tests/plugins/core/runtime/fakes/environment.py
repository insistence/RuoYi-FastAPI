import sys
from pathlib import Path

from plugins.core.environment import PluginRuntimeEnvironmentService
from plugins.core.frontend import PluginFrontendFrameworkResolver


class FakeRuntimeEnvironment:
    """
    测试用运行时环境服务。

    :ivar backend_dir: 后端项目目录
    :ivar frontend_dir: 前端项目目录
    :ivar frontend_mode: 当前使用的前端集成模式
    :ivar backend_runtime_mode: 后端运行模式
    """

    def __init__(self, backend_dir: Path, frontend_dir: Path | None = None) -> None:
        """
        初始化测试用运行时环境服务。

        :param backend_dir: 后端项目目录
        :param frontend_dir: 前端项目目录
        """
        self.backend_dir = backend_dir
        self.frontend_dir = frontend_dir or Path(
            PluginRuntimeEnvironmentService(backend_root=backend_dir).get_frontend_dir()
        )
        self.frontend_mode = 'dev'
        self.backend_runtime_mode = 'dev'

    def get_backend_dir(self) -> str:
        """
        获取后端项目根目录。

        :return: 后端项目根目录
        """
        return str(self.backend_dir)

    def get_backend_plugins_dir(self) -> str:
        """
        获取后端插件根目录。

        :return: 后端插件根目录
        """
        return str(self.backend_dir / 'plugins')

    def get_frontend_dir(self) -> str:
        """
        获取前端项目根目录。

        :return: 前端项目根目录
        """
        return str(self.frontend_dir)

    def get_frontend_framework(self, frontend_root: Path | str | None = None) -> str:
        """
        获取测试用前端工程的框架标识。

        :param frontend_root: 前端项目的根目录
        :return: 测试用前端工程的框架标识
        """
        root = Path(frontend_root) if frontend_root is not None else self.frontend_dir
        return PluginFrontendFrameworkResolver.resolve(root)

    def get_frontend_plugins_dir(self) -> str:
        """
        获取前端插件根目录。

        :return: 前端插件根目录
        """
        return str(self.frontend_dir / 'plugins')

    @staticmethod
    def get_python_executable() -> str:
        """
        获取测试用 Python 解释器。

        :return: 测试用 Python 解释器
        """
        return sys.executable

    def get_frontend_mode(self) -> str:
        """
        获取测试用前端模式。

        :return: 测试用前端模式
        """
        return self.frontend_mode

    def get_backend_runtime_mode(self) -> str:
        """
        获取测试用后端运行模式。

        :return: 测试用后端运行模式
        """
        return self.backend_runtime_mode
