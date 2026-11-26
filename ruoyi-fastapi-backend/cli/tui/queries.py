import asyncio
from collections.abc import Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from threading import BoundedSemaphore
from typing import Any, TypeVar

from cli.completion.doctor import COMPLETION_DOCTOR, CompletionDoctorService
from cli.completion.installers import COMPLETION_INSTALLER, CompletionInstallerService
from cli.core.app_builder import CliApplicationBuilder
from cli.exit_codes import DEPENDENCY_ERROR, RUNTIME_ERROR
from cli.main import CLI_APPLICATION_BUILDER
from cli.runtime.app import APP_RUNTIME, AppRuntimeService
from cli.runtime.cache import CACHE_RUNTIME, CacheRuntimeService
from cli.runtime.config import CONFIG_RUNTIME, ConfigRuntimeService
from cli.runtime.crypto import CRYPTO_RUNTIME, CryptoRuntimeService
from cli.runtime.db import DATABASE_RUNTIME, DatabaseRuntimeService
from cli.runtime.gen import GEN_RUNTIME, GenRuntimeService
from cli.runtime.job import JOB_RUNTIME, JobRuntimeService
from cli.runtime.ops import OPERATIONS_RUNTIME, OperationsRuntimeService

TUI_REMOTE_QUERY_TIMEOUT_SECONDS = 3.0
TUI_LOCAL_QUERY_TIMEOUT_SECONDS = 2.0
TUI_PAGE_TIMEOUT_SECONDS = 5.0

_ResultT = TypeVar('_ResultT')


@dataclass(frozen=True)
class TuiGeneratedOutput:
    """
    进程内生成文本结果。

    :ivar stdout: 生成的标准文本
    :ivar stderr: 生成失败信息
    :ivar returncode: 生成结果码
    """

    stdout: str
    stderr: str = ''
    returncode: int = 0


@dataclass(frozen=True)
class TuiQueryExecutor:
    """
    TUI 查询执行器。

    该对象统一施加页面查询超时，并将短时间本地同步检查移出 Textual
    事件循环。网络查询必须通过 ``run_async`` 执行。

    :ivar remote_timeout_seconds: 远程查询的超时时间（秒）
    :ivar local_timeout_seconds: 本地查询的超时时间（秒）
    :ivar local_executor: 执行本地查询的执行器
    :ivar local_slots: 限制并发本地查询数量的槽位
    """

    remote_timeout_seconds: float = TUI_REMOTE_QUERY_TIMEOUT_SECONDS
    local_timeout_seconds: float = TUI_LOCAL_QUERY_TIMEOUT_SECONDS
    local_executor: ThreadPoolExecutor = field(
        default_factory=lambda: ThreadPoolExecutor(max_workers=2, thread_name_prefix='ruoyi-tui-query'),
        compare=False,
        repr=False,
    )
    local_slots: BoundedSemaphore = field(
        default_factory=lambda: BoundedSemaphore(2),
        compare=False,
        repr=False,
    )

    async def run_async(
        self,
        operation: Callable[[], Awaitable[_ResultT]],
        *,
        label: str,
    ) -> _ResultT | dict[str, Any]:
        """
        执行带超时的异步查询。

        :param operation: 异步查询工厂
        :param label: 查询名称
        :return: 查询结果或超时负载
        :raises asyncio.CancelledError: 异步操作被取消时
        """
        try:
            return await asyncio.wait_for(operation(), timeout=self.remote_timeout_seconds)
        except TimeoutError:
            return self.build_timeout_payload(label)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            return self.build_failure_payload(label, exc)

    async def run_local(
        self,
        operation: Callable[[], _ResultT],
        *,
        label: str,
    ) -> _ResultT | dict[str, Any]:
        """
        执行带超时的短时间本地同步查询。

        :param operation: 同步查询函数
        :param label: 查询名称
        :return: 查询结果或失败负载
        :raises Exception: 底层操作失败时向调用方传播异常
        :raises asyncio.CancelledError: 异步操作被取消时
        """
        loop = asyncio.get_running_loop()
        deadline = loop.time() + self.local_timeout_seconds
        while not self.local_slots.acquire(blocking=False):
            remaining = deadline - loop.time()
            if remaining <= 0:
                return self.build_timeout_payload(label)
            await asyncio.sleep(min(0.01, remaining))
        try:
            future = loop.run_in_executor(self.local_executor, operation)
        except Exception:
            self.local_slots.release()
            raise
        future.add_done_callback(lambda completed: self.local_slots.release())
        try:
            remaining = max(deadline - loop.time(), 0)
            return await asyncio.wait_for(
                asyncio.shield(future),
                timeout=remaining,
            )
        except TimeoutError:
            return self.build_timeout_payload(label)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            return self.build_failure_payload(label, exc)

    @staticmethod
    def build_timeout_payload(label: str) -> dict[str, Any]:
        """
        构建超时结果。

        :param label: 查询名称
        :return: 标准失败负载
        """
        return {
            'ok': False,
            'message': f'{label}超时',
            'error': f'查询未在规定时间内完成：{label}',
            'timeout': True,
            'exit_code': RUNTIME_ERROR,
        }

    @staticmethod
    def build_failure_payload(label: str, exc: Exception) -> dict[str, Any]:
        """
        构建异常结果。

        :param label: 查询名称
        :param exc: 查询异常
        :return: 标准失败负载
        """
        return {
            'ok': False,
            'message': f'{label}失败',
            'error': str(exc) or exc.__class__.__name__,
            'exit_code': RUNTIME_ERROR,
        }


@dataclass
class TuiRuntimeQueryService:
    """
    TUI 进程内查询服务。

    所有 TUI 页面通过该服务直接调用 runtime，不再启动嵌套 CLI 进程。

    :ivar app_runtime: 应用运行时服务
    :ivar database_runtime: 数据库运行时服务
    :ivar operations_runtime: 运维运行时服务
    :ivar cache_runtime: 缓存运行时服务
    :ivar job_runtime: 定时任务运行时服务
    :ivar gen_runtime: 代码生成运行时服务
    :ivar config_runtime: 参数配置运行时服务
    :ivar crypto_runtime: 传输加密运行时服务
    :ivar completion_doctor: completion 诊断服务
    :ivar completion_installer: completion 安装与脚本生成服务
    :ivar application_builder: 根应用构建器
    :ivar executor: TUI 查询执行器
    """

    app_runtime: AppRuntimeService = field(default_factory=lambda: APP_RUNTIME)
    database_runtime: DatabaseRuntimeService = field(default_factory=lambda: DATABASE_RUNTIME)
    operations_runtime: OperationsRuntimeService = field(default_factory=lambda: OPERATIONS_RUNTIME)
    cache_runtime: CacheRuntimeService = field(default_factory=lambda: CACHE_RUNTIME)
    job_runtime: JobRuntimeService = field(default_factory=lambda: JOB_RUNTIME)
    gen_runtime: GenRuntimeService = field(default_factory=lambda: GEN_RUNTIME)
    config_runtime: ConfigRuntimeService = field(default_factory=lambda: CONFIG_RUNTIME)
    crypto_runtime: CryptoRuntimeService = field(default_factory=lambda: CRYPTO_RUNTIME)
    completion_doctor: CompletionDoctorService = field(default_factory=lambda: COMPLETION_DOCTOR)
    completion_installer: CompletionInstallerService = field(default_factory=lambda: COMPLETION_INSTALLER)
    application_builder: CliApplicationBuilder = field(default_factory=lambda: CLI_APPLICATION_BUILDER)
    executor: TuiQueryExecutor = field(default_factory=TuiQueryExecutor)

    async def get_app_env(self, env: str) -> dict[str, Any]:
        """
        为终端界面查询当前应用环境。

        :param env: 当前运行环境
        :return: 当前应用环境
        """
        result = await self.executor.run_local(
            self.app_runtime.get_app_env_snapshot,
            label='读取应用环境',
        )
        if isinstance(result, dict) and result.get('ok') is False:
            return result
        if not isinstance(result, dict):
            return self.executor.build_failure_payload(
                '读取应用环境',
                TypeError('应用环境结果格式无效'),
            )
        return {'ok': True, 'env': env, 'runtime': result}

    async def get_app_config(self, env: str) -> dict[str, Any]:
        """
        为终端界面查询当前应用配置。

        :param env: 当前运行环境
        :return: 当前应用配置
        """
        result = await self.executor.run_local(
            self.app_runtime.get_app_config_snapshot,
            label='读取应用配置',
        )
        if isinstance(result, dict) and result.get('ok') is False:
            return result
        return {'ok': True, 'env': env, 'config': result}

    async def get_app_routes(self, env: str) -> dict[str, Any]:
        """
        为终端界面查询已注册的应用路由。

        :param env: 当前运行环境
        :return: 已注册的应用路由
        """
        result = await self.executor.run_local(
            lambda: self.app_runtime.get_app_routes_snapshot(env, group_by='tag'),
            label='读取应用路由',
        )
        return (
            result
            if isinstance(result, dict)
            else self.executor.build_failure_payload(
                '读取应用路由',
                TypeError('应用路由结果格式无效'),
            )
        )

    async def get_doctor(self, env: str) -> dict[str, Any]:
        """
        为终端界面查询应用诊断结果。

        :param env: 当前运行环境
        :return: 随调用传入或返回的结构化数据
        """
        database, redis, crypto = await asyncio.gather(
            self.get_database_ping(),
            self.get_redis_ping(),
            self.get_crypto_validation(),
        )
        payload = {
            'env': env,
            'database': database,
            'redis': redis,
            'crypto': crypto,
        }
        payload['ok'] = all(isinstance(item, dict) and item.get('ok', False) for item in (database, redis, crypto))
        if not payload['ok']:
            payload['exit_code'] = DEPENDENCY_ERROR
        return payload

    async def get_completion_doctor(self) -> dict[str, Any]:
        """
        为终端界面查询命令补全环境的诊断结果。

        :return: 命令补全环境的诊断结果
        """
        result = await self.executor.run_local(
            self.completion_doctor.build_completion_doctor_payload,
            label='读取补全诊断',
        )
        return (
            result
            if isinstance(result, dict)
            else self.executor.build_failure_payload(
                '读取补全诊断',
                TypeError('补全诊断结果格式无效'),
            )
        )

    async def get_completion_preview(self, shell: str) -> TuiGeneratedOutput:
        """
        为终端界面查询指定 Shell 的补全脚本预览。

        :param shell: 生成补全命令的目标 shell
        :return: 指定 Shell 的补全脚本预览
        """

        def _render() -> str:
            """
            捕获补全脚本的文本输出供 TUI 预览。

            :return: 补全脚本或诊断命令的输出文本
            """
            return self.completion_installer.render_completion_script(
                self.application_builder.build(),
                shell,
            )

        result = await self.executor.run_local(_render, label='生成补全脚本')
        if isinstance(result, dict) and not result.get('ok', False):
            return TuiGeneratedOutput(
                stdout='',
                stderr=str(result.get('message') or result.get('error') or '生成补全脚本失败'),
                returncode=1,
            )
        return TuiGeneratedOutput(stdout=str(result))

    async def get_database_ping(self) -> dict[str, Any]:
        """
        为终端界面查询数据库连接探测结果。

        :return: 数据库连接探测结果
        """
        result = await self.executor.run_async(
            self.database_runtime.ping_database,
            label='数据库探活',
        )
        return result if isinstance(result, dict) else {}

    async def get_database_current(self) -> dict[str, Any]:
        """
        为终端界面查询数据库当前迁移版本。

        :return: 数据库当前迁移版本
        """
        result = await self.executor.run_async(
            self.database_runtime.get_current_revision_async,
            label='读取数据库版本',
        )
        return result if isinstance(result, dict) else {}

    async def get_database_heads(self) -> dict[str, Any]:
        """
        为终端界面查询迁移脚本的最新版本。

        :return: 迁移脚本的最新版本
        """
        result = await self.executor.run_local(
            self.database_runtime.get_alembic_heads,
            label='读取 Alembic heads',
        )
        return result if isinstance(result, dict) else {}

    async def get_database_history(self, *, limit: int = 8) -> dict[str, Any]:
        """
        为终端界面查询数据库迁移历史。

        :param limit: 允许读取或返回的最大条目数
        :return: 数据库迁移历史
        """
        result = await self.executor.run_local(
            lambda: self.database_runtime.get_alembic_history(limit=limit),
            label='读取 Alembic 历史',
        )
        return result if isinstance(result, dict) else {}

    async def get_redis_ping(self) -> dict[str, Any]:
        """
        为终端界面查询Redis 连接探测结果。

        :return: Redis 连接探测结果
        """
        result = await self.executor.run_async(
            self.operations_runtime.ping_redis,
            label='Redis 探活',
        )
        return result if isinstance(result, dict) else {}

    async def get_dependencies(self) -> dict[str, Any]:
        """
        为终端界面查询服务依赖的可用性。

        :return: 服务依赖的可用性
        """
        result = await self.executor.run_local(
            self.operations_runtime.get_dependency_versions,
            label='读取依赖信息',
        )
        return result if isinstance(result, dict) else {}

    async def get_server_info(self) -> dict[str, Any]:
        """
        为终端界面查询服务器运行信息。

        :return: 服务器运行信息
        """
        result = await self.executor.run_async(
            self.operations_runtime.get_server_info,
            label='读取服务器信息',
        )
        return result if isinstance(result, dict) else {}

    async def get_crypto_validation(self) -> dict[str, Any]:
        """
        为终端界面查询传输加密配置的校验结果。

        :return: 传输加密配置的校验结果
        """
        result = await self.executor.run_local(
            self.crypto_runtime.validate_crypto_config,
            label='校验传输加密配置',
        )
        return result if isinstance(result, dict) else {}

    async def get_crypto_public_key(self) -> dict[str, Any]:
        """
        为终端界面查询当前传输加密公钥。

        :return: 当前传输加密公钥
        """
        result = await self.executor.run_local(
            self.crypto_runtime.export_public_key,
            label='读取传输加密公钥',
        )
        return result if isinstance(result, dict) else {}

    async def get_cache_stats(self) -> dict[str, Any]:
        """
        为终端界面查询缓存命名空间统计。

        :return: 缓存命名空间统计
        """
        result = await self.executor.run_async(
            self.cache_runtime.get_cache_stats,
            label='读取缓存统计',
        )
        return result if isinstance(result, dict) else {}

    async def get_cache_keys(self, cache_name: str) -> dict[str, Any]:
        """
        为终端界面查询指定命名空间中的缓存键。

        :param cache_name: 缓存名称
        :return: 指定命名空间中的缓存键
        """
        result = await self.executor.run_async(
            lambda: self.cache_runtime.list_cache_keys(cache_name),
            label='读取缓存键',
        )
        return result if isinstance(result, dict) else {}

    async def get_cache_value(self, cache_name: str, cache_key: str) -> dict[str, Any]:
        """
        为终端界面查询指定缓存键的值。

        :param cache_name: 缓存名称
        :param cache_key: 缓存键名
        :return: 指定缓存键的值
        """
        result = await self.executor.run_async(
            lambda: self.cache_runtime.get_cache_value(cache_name, cache_key),
            label='读取缓存值',
        )
        return result if isinstance(result, dict) else {}

    async def get_cache_ttl(self, cache_name: str, cache_key: str) -> dict[str, Any]:
        """
        为终端界面查询指定缓存键的剩余有效期。

        :param cache_name: 缓存名称
        :param cache_key: 缓存键名
        :return: 指定缓存键的剩余有效期
        """
        result = await self.executor.run_async(
            lambda: self.cache_runtime.get_cache_ttl(cache_name, cache_key),
            label='读取缓存 TTL',
        )
        return result if isinstance(result, dict) else {}

    async def get_jobs(self) -> dict[str, Any]:
        """
        为终端界面查询调度任务列表。

        :return: 调度任务列表
        """
        result = await self.executor.run_async(
            lambda: self.job_runtime.list_jobs(paged=True, page_size=8),
            label='读取定时任务',
        )
        return result if isinstance(result, dict) else {}

    async def get_job_logs(
        self,
        *,
        job_name: str = '',
        status: str | None = None,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """
        为终端界面查询任务执行日志。

        :param job_name: 任务名称过滤条件
        :param status: 操作或记录所处的状态
        :param page_size: 每页数量
        :return: 任务执行日志
        """
        result = await self.executor.run_async(
            lambda: self.job_runtime.list_job_logs(
                job_name=job_name,
                status=status,
                paged=True,
                page_size=page_size,
            ),
            label='读取任务日志',
        )
        return result if isinstance(result, dict) else {}

    async def get_job_detail(self, job_id: int) -> dict[str, Any]:
        """
        为终端界面查询指定调度任务的详情。

        :param job_id: 任务ID
        :return: 指定调度任务的详情
        """
        result = await self.executor.run_async(
            lambda: self.job_runtime.get_job_detail(job_id),
            label='读取任务详情',
        )
        return result if isinstance(result, dict) else {}

    async def get_gen_tables(self) -> dict[str, Any]:
        """
        为终端界面查询已导入代码生成器的表。

        :return: 已导入代码生成器的表
        """
        result = await self.executor.run_async(
            lambda: self.gen_runtime.list_gen_tables(paged=True, page_size=8),
            label='读取代码生成业务表',
        )
        return result if isinstance(result, dict) else {}

    async def get_gen_db_tables(self, *, table_name: str = '', page_size: int = 8) -> dict[str, Any]:
        """
        为终端界面查询可供导入的数据库表。

        :param table_name: 表名称
        :param page_size: 每页数量
        :return: 可供导入的数据库表
        """
        result = await self.executor.run_async(
            lambda: self.gen_runtime.list_gen_db_tables(
                table_name=table_name,
                paged=True,
                page_size=page_size,
            ),
            label='读取可导入数据库表',
        )
        return result if isinstance(result, dict) else {}

    async def get_gen_detail(self, table_id: int) -> dict[str, Any]:
        """
        为终端界面查询生成表的详细配置。

        :param table_id: 代码生成表的记录标识
        :return: 生成表的详细配置
        """
        result = await self.executor.run_async(
            lambda: self.gen_runtime.get_gen_table_detail(table_id),
            label='读取代码生成详情',
        )
        return result if isinstance(result, dict) else {}

    async def get_gen_preview(self, table_id: int) -> dict[str, Any]:
        """
        为终端界面查询所选表的代码预览。

        :param table_id: 代码生成表的记录标识
        :return: 所选表的代码预览
        """
        result = await self.executor.run_async(
            lambda: self.gen_runtime.preview_code(table_id),
            label='生成代码预览',
        )
        return result if isinstance(result, dict) else {}

    async def get_gen_export_dry_run(self, table_name: str) -> dict[str, Any]:
        """
        为终端界面查询生成代码导出的预演结果。

        :param table_name: 表名称
        :return: 生成代码导出的预演结果
        """
        result = await self.executor.run_async(
            lambda: self.gen_runtime.export_code([table_name], mode='zip', dry_run=True),
            label='代码导出演练',
        )
        return result if isinstance(result, dict) else {}

    async def get_configs(self) -> dict[str, Any]:
        """
        为终端界面查询系统参数列表。

        :return: 系统参数列表
        """
        result = await self.executor.run_async(
            lambda: self.config_runtime.list_configs(paged=True, page_size=8),
            label='读取参数配置',
        )
        return result if isinstance(result, dict) else {}

    async def get_config_diagnostics(self) -> dict[str, Any]:
        """
        为终端界面查询系统配置的诊断结果。

        :return: 系统配置的诊断结果
        """
        result = await self.executor.run_async(
            lambda: self.config_runtime.diagnose_config(sample_limit=5),
            label='诊断参数配置',
        )
        return result if isinstance(result, dict) else {}

    async def get_config_detail(self, config_key: str) -> dict[str, Any]:
        """
        为终端界面查询指定系统参数的详情。

        :param config_key: 用于查找配置项的键
        :return: 指定系统参数的详情
        """
        result = await self.executor.run_async(
            lambda: self.config_runtime.get_config(config_key, source='both'),
            label='读取参数配置详情',
        )
        return result if isinstance(result, dict) else {}


TUI_RUNTIME_QUERIES = TuiRuntimeQueryService()
