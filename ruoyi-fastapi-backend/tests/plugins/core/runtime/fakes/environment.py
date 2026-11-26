import sys
from pathlib import Path

from plugins.core.environment import PluginRuntimeEnvironmentService


class FakeRuntimeEnvironment(PluginRuntimeEnvironmentService):
    """
    测试用运行时环境服务。

    :ivar frontend_root: 测试指定的前端工程目录
    :ivar frontend_mode: 当前使用的前端集成模式
    :ivar backend_runtime_mode: 后端运行模式
    """

    def __init__(self, backend_dir: Path, frontend_dir: Path | None = None) -> None:
        """
        初始化测试用运行时环境服务。

        :param backend_dir: 后端项目目录
        :param frontend_dir: 前端项目目录
        """
        super().__init__(backend_root=backend_dir, frontend_root=frontend_dir, python_executable=sys.executable)
        if frontend_dir is not None:
            self.frontend_root = frontend_dir
        self.frontend_mode = 'dev'
        self.backend_runtime_mode = 'dev'
