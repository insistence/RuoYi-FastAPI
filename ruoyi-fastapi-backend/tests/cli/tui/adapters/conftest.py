import asyncio
import importlib
import sys
from collections.abc import Callable, Iterator
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[4]

sys.path.insert(0, str(BACKEND_DIR))


class RuntimeQueryStub:
    """
    把现有负载工厂映射为新的异步进程内查询接口。

    :ivar runner: 执行命令或后台任务的对象
    """

    def __init__(self, runner: Callable[..., SimpleNamespace]) -> None:
        """
        初始化测试夹具的 ``runner``。

        :param runner: 执行命令或后台任务的对象
        """
        self.runner = runner

    def _payload(self, *arguments: str) -> object:
        """
        执行测试命令并提取其 JSON 结果。

        :param arguments: 调用方传入的其余位置参数
        :return: 随调用传入或返回的结构化数据
        """
        return self.runner(*arguments, parse_json=True).payload

    async def get_app_env(self, env: str) -> object:
        """
        提供用于界面测试的当前应用环境。

        :param env: 当前运行环境
        :return: 用于界面测试的当前应用环境
        """
        return self._payload('app', 'env', f'--env={env}', '--output=json')

    async def get_app_config(self, env: str) -> object:
        """
        提供用于界面测试的当前应用配置。

        :param env: 当前运行环境
        :return: 用于界面测试的当前应用配置
        """
        return self._payload('app', 'config', f'--env={env}', '--output=json')

    async def get_app_routes(self, env: str) -> object:
        """
        提供用于界面测试的已注册的应用路由。

        :param env: 当前运行环境
        :return: 用于界面测试的已注册的应用路由
        """
        return self._payload('app', 'routes', f'--env={env}', '--output=json')

    async def get_doctor(self, env: str) -> object:
        """
        提供用于界面测试的应用诊断结果。

        :param env: 当前运行环境
        :return: 用于界面测试的应用诊断结果
        """
        return self._payload('app', 'doctor', f'--env={env}', '--output=json')

    async def get_completion_doctor(self) -> object:
        """
        提供用于界面测试的命令补全环境的诊断结果。

        :return: 用于界面测试的命令补全环境的诊断结果
        """
        return self._payload('completion', 'doctor', '--output=json')

    async def get_completion_preview(self, shell: str) -> object:
        """
        提供用于界面测试的指定 Shell 的补全脚本预览。

        :param shell: 生成补全命令的目标 shell
        :return: 用于界面测试的指定 Shell 的补全脚本预览
        """
        return self.runner('completion', 'show', f'--shell={shell}', parse_json=False)

    async def get_database_ping(self) -> object:
        """
        提供用于界面测试的数据库连接探测结果。

        :return: 用于界面测试的数据库连接探测结果
        """
        return self._payload('ops', 'ping-db', '--output=json')

    async def get_database_current(self) -> object:
        """
        提供用于界面测试的数据库当前迁移版本。

        :return: 用于界面测试的数据库当前迁移版本
        """
        return self._payload('db', 'current', '--output=json')

    async def get_database_heads(self) -> object:
        """
        提供用于界面测试的迁移脚本的最新版本。

        :return: 用于界面测试的迁移脚本的最新版本
        """
        return self._payload('db', 'heads', '--output=json')

    async def get_database_history(self, *, limit: int = 8) -> object:
        """
        提供用于界面测试的数据库迁移历史。

        :param limit: 允许读取或返回的最大条目数
        :return: 用于界面测试的数据库迁移历史
        """
        return self._payload('db', 'history', f'--limit={limit}', '--output=json')

    async def get_redis_ping(self) -> object:
        """
        提供用于界面测试的Redis 连接探测结果。

        :return: 用于界面测试的Redis 连接探测结果
        """
        return self._payload('ops', 'ping-redis', '--output=json')

    async def get_dependencies(self) -> object:
        """
        提供用于界面测试的服务依赖的可用性。

        :return: 用于界面测试的服务依赖的可用性
        """
        return self._payload('ops', 'deps', '--output=json')

    async def get_server_info(self) -> object:
        """
        提供用于界面测试的服务器运行信息。

        :return: 用于界面测试的服务器运行信息
        """
        return self._payload('ops', 'server-info', '--output=json')

    async def get_crypto_validation(self) -> object:
        """
        提供用于界面测试的传输加密配置的校验结果。

        :return: 用于界面测试的传输加密配置的校验结果
        """
        return self._payload('crypto', 'validate', '--output=json')

    async def get_crypto_public_key(self) -> object:
        """
        提供用于界面测试的当前传输加密公钥。

        :return: 用于界面测试的当前传输加密公钥
        """
        return self._payload('crypto', 'export-public', '--output=json')

    async def get_cache_stats(self) -> object:
        """
        提供用于界面测试的缓存命名空间统计。

        :return: 用于界面测试的缓存命名空间统计
        """
        return self._payload('cache', 'stats', '--output=json')

    async def get_cache_keys(self, cache_name: str) -> object:
        """
        提供用于界面测试的指定命名空间中的缓存键。

        :param cache_name: 缓存名称
        :return: 用于界面测试的指定命名空间中的缓存键
        """
        return self._payload('cache', 'keys', cache_name, '--output=json')

    async def get_cache_value(self, cache_name: str, cache_key: str) -> object:
        """
        提供用于界面测试的指定缓存键的值。

        :param cache_name: 缓存名称
        :param cache_key: 缓存键名
        :return: 用于界面测试的指定缓存键的值
        """
        return self._payload('cache', 'get', cache_name, cache_key, '--output=json')

    async def get_cache_ttl(self, cache_name: str, cache_key: str) -> object:
        """
        提供用于界面测试的指定缓存键的剩余有效期。

        :param cache_name: 缓存名称
        :param cache_key: 缓存键名
        :return: 用于界面测试的指定缓存键的剩余有效期
        """
        return self._payload('cache', 'ttl', cache_name, cache_key, '--output=json')

    async def get_jobs(self) -> object:
        """
        提供用于界面测试的调度任务列表。

        :return: 用于界面测试的调度任务列表
        """
        return self._payload('job', 'list', '--paged', '--page-size=8', '--output=json')

    async def get_job_logs(self, *, job_name: str = '', status: str | None = None, page_size: int = 20) -> object:
        """
        提供用于界面测试的任务执行日志。

        :param job_name: 任务名称过滤条件
        :param status: 操作或记录所处的状态
        :param page_size: 每页数量
        :return: 用于界面测试的任务执行日志
        """
        arguments = ['job', 'logs', '--paged', f'--page-size={page_size}', '--output=json']
        if job_name:
            arguments.append(f'--job-name={job_name}')
        if status is not None:
            arguments.append(f'--status={status}')
        return self._payload(*arguments)

    async def get_job_detail(self, job_id: int) -> object:
        """
        提供用于界面测试的指定调度任务的详情。

        :param job_id: 任务ID
        :return: 用于界面测试的指定调度任务的详情
        """
        return self._payload('job', 'detail', str(job_id), '--output=json')

    async def get_gen_tables(self) -> object:
        """
        提供用于界面测试的已导入代码生成器的表。

        :return: 用于界面测试的已导入代码生成器的表
        """
        return self._payload('gen', 'list', '--paged', '--page-size=8', '--output=json')

    async def get_gen_db_tables(self, *, table_name: str = '', page_size: int = 8) -> object:
        """
        提供用于界面测试的可供导入的数据库表。

        :param table_name: 表名称
        :param page_size: 每页数量
        :return: 用于界面测试的可供导入的数据库表
        """
        arguments = ['gen', 'db-list', '--paged', f'--page-size={page_size}', '--output=json']
        if table_name:
            arguments.append(f'--table-name={table_name}')
        return self._payload(*arguments)

    async def get_gen_detail(self, table_id: int) -> object:
        """
        提供用于界面测试的生成表的详细配置。

        :param table_id: 代码生成表的记录标识
        :return: 用于界面测试的生成表的详细配置
        """
        return self._payload('gen', 'detail', str(table_id), '--output=json')

    async def get_gen_preview(self, table_id: int) -> object:
        """
        提供用于界面测试的所选表的代码预览。

        :param table_id: 代码生成表的记录标识
        :return: 用于界面测试的所选表的代码预览
        """
        return self._payload('gen', 'preview', str(table_id), '--output=json')

    async def get_gen_export_dry_run(self, table_name: str) -> object:
        """
        提供用于界面测试的生成代码导出的预演结果。

        :param table_name: 表名称
        :return: 用于界面测试的生成代码导出的预演结果
        """
        return self._payload('gen', 'export', table_name, '--dry-run', '--output=json')

    async def get_configs(self) -> object:
        """
        提供用于界面测试的系统参数列表。

        :return: 用于界面测试的系统参数列表
        """
        return self._payload('config', 'list', '--paged', '--page-size=8', '--output=json')

    async def get_config_diagnostics(self) -> object:
        """
        提供用于界面测试的系统配置的诊断结果。

        :return: 用于界面测试的系统配置的诊断结果
        """
        return self._payload('config', 'doctor', '--sample-limit=5', '--output=json')

    async def get_config_detail(self, config_key: str) -> object:
        """
        提供用于界面测试的指定系统参数的详情。

        :param config_key: 用于查找配置项的键
        :return: 用于界面测试的指定系统参数的详情
        """
        return self._payload('config', 'get', config_key, '--source=both', '--output=json')


@pytest.fixture
def install_query_service(
    monkeypatch: pytest.MonkeyPatch,
) -> Callable[[ModuleType, Callable[..., SimpleNamespace]], RuntimeQueryStub]:
    """
    向适配器及其采集/分区协作对象注入异步查询桩。

    :param monkeypatch: 测试结束后恢复原查询服务的夹具
    :return: 供调用方使用的 ``install``
    """

    def install(module: ModuleType, runner: Callable[..., SimpleNamespace]) -> RuntimeQueryStub:
        """
        安装测试使用的运行时查询适配器。

        :param module: 提供被测功能的模块
        :param runner: 执行命令或后台任务的对象
        :return: 供调用方使用的 ``query_service``
        """
        query_service = RuntimeQueryStub(runner)
        visited: set[int] = set()

        def inject(target: object) -> None:
            """
            将查询替身注入待测试的组件。

            :param target: 本次操作的目标
            """
            if id(target) in visited:
                return
            visited.add(id(target))
            if hasattr(target, 'query_service'):
                monkeypatch.setattr(target, 'query_service', query_service)
            for attribute_name in ('snapshot_collector', 'section_builder'):
                child = getattr(target, attribute_name, None)
                if child is not None:
                    inject(child)

        for attribute_name in dir(module):
            if attribute_name.endswith(('_ADAPTER', '_COLLECTOR')):
                inject(getattr(module, attribute_name))
        return query_service

    return install


def _load_adapter_module(module_name: str) -> ModuleType:
    """
    重新导入测试需要的 TUI 适配器。

    :param module_name: 生成模块名
    :return: 重新加载的终端界面适配器模块
    """
    sys.modules.pop(module_name, None)
    sys.modules.pop('cli', None)
    return importlib.import_module(module_name)


@pytest.fixture
def app_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.app`` 模块。

    :return: 应用页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.app')


@pytest.fixture
def cache_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.cache`` 模块。

    :return: 缓存页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.cache')


@pytest.fixture
def crypto_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.crypto`` 模块。

    :return: 加密页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.crypto')


@pytest.fixture
def database_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.database`` 模块。

    :return: 数据库页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.database')


@pytest.fixture
def jobs_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.jobs`` 模块。

    :return: 任务页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.jobs')


@pytest.fixture
def gen_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.gen`` 模块。

    :return: 生成器页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.gen')


@pytest.fixture
def configs_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.configs`` 模块。

    :return: 配置页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.configs')


@pytest.fixture
def ops_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.ops`` 模块。

    :return: 运维页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.ops')


@pytest.fixture
def health_adapter() -> ModuleType:
    """
    为测试加载 ``cli.tui.adapters.health`` 模块。

    :return: 健康检查页面的适配器模块
    """
    return _load_adapter_module('cli.tui.adapters.health')


@pytest.fixture
def load_adapter_module() -> Callable[[str], ModuleType]:
    """
    向调用方返回 ``_load_adapter_module``。

    :return: 加载终端界面适配器的函数
    """
    return _load_adapter_module


@pytest.fixture(autouse=True)
def dispose_async_db_engine_after_test() -> Iterator[None]:
    """
    在每个 TUI adapter 测试结束后尝试释放全局异步数据库连接池。

    这些适配器测试会按需导入运行时模块；若其中某些路径触发真实数据库访问，
    注册表中的引擎可能在测试进程结束前仍持有连接，从而在 GC 阶段产生
    SQLAlchemy 未归还连接告警。这里统一在测试后主动释放注册表资源，将清理职责
    收口到测试夹具而非业务代码。

    :yield: 上下文就绪后将控制权交给调用方
    """
    yield
    database_module = sys.modules.get('config.database')
    if database_module is not None:
        asyncio.run(database_module.DataSourceRegistry.dispose_all())
