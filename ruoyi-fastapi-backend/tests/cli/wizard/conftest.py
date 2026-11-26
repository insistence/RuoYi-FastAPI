import importlib
import sys
from collections.abc import Callable
from pathlib import Path
from types import ModuleType

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[3]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _load_module(module_name: str) -> ModuleType:
    """
    清除已有导入并重新加载指定模块。

    :param module_name: 生成模块名
    :return: 重新导入的模块对象
    """
    sys.modules.pop(module_name, None)
    sys.modules.pop('cli', None)
    return importlib.import_module(module_name)


@pytest.fixture
def backend_dir() -> Path:
    """
    向调用方返回 ``BACKEND_DIR``。

    :return: 测试使用的后端工程根目录
    """
    return BACKEND_DIR


@pytest.fixture
def load_module() -> Callable[[str], ModuleType]:
    """
    向调用方返回 ``_load_module``。

    :return: 按名称重新加载模块的函数
    """
    return _load_module


@pytest.fixture
def cli_main(load_module: Callable[[str], ModuleType]) -> ModuleType:
    """
    为测试加载 ``cli.main`` 模块。

    :param load_module: 按名称加载测试模块的回调
    :return: CLI 主入口模块
    """
    return load_module('cli.main')


@pytest.fixture
def app_run_flow(load_module: Callable[[str], ModuleType]) -> ModuleType:
    """
    为测试加载 ``cli.wizard.flows.app_run`` 模块。

    :param load_module: 按名称加载测试模块的回调
    :return: 启动应用向导模块
    """
    return load_module('cli.wizard.flows.app_run')


@pytest.fixture
def cache_clear_flow(load_module: Callable[[str], ModuleType]) -> ModuleType:
    """
    为测试加载 ``cli.wizard.flows.cache_clear`` 模块。

    :param load_module: 按名称加载测试模块的回调
    :return: 清理缓存向导模块
    """
    return load_module('cli.wizard.flows.cache_clear')


@pytest.fixture
def db_upgrade_flow(load_module: Callable[[str], ModuleType]) -> ModuleType:
    """
    为测试加载 ``cli.wizard.flows.db_upgrade`` 模块。

    :param load_module: 按名称加载测试模块的回调
    :return: 数据库升级向导模块
    """
    return load_module('cli.wizard.flows.db_upgrade')


@pytest.fixture
def gen_export_flow(load_module: Callable[[str], ModuleType]) -> ModuleType:
    """
    为测试加载 ``cli.wizard.flows.gen_export`` 模块。

    :param load_module: 按名称加载测试模块的回调
    :return: 导出代码向导模块
    """
    return load_module('cli.wizard.flows.gen_export')


@pytest.fixture
def gen_import_flow(load_module: Callable[[str], ModuleType]) -> ModuleType:
    """
    为测试加载 ``cli.wizard.flows.gen_import`` 模块。

    :param load_module: 按名称加载测试模块的回调
    :return: 导入数据表向导模块
    """
    return load_module('cli.wizard.flows.gen_import')


@pytest.fixture
def prod_check_flow(load_module: Callable[[str], ModuleType]) -> ModuleType:
    """
    为测试加载 ``cli.wizard.flows.prod_check`` 模块。

    :param load_module: 按名称加载测试模块的回调
    :return: 生产检查向导模块
    """
    return load_module('cli.wizard.flows.prod_check')


@pytest.fixture
def exit_codes(load_module: Callable[[str], ModuleType]) -> ModuleType:
    """
    为测试加载 ``cli.exit_codes`` 模块。

    :param load_module: 按名称加载测试模块的回调
    :return: 退出码定义模块
    """
    return load_module('cli.exit_codes')
