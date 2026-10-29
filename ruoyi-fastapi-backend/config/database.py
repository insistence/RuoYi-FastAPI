import asyncio
import logging
from collections.abc import AsyncGenerator, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import cache
from typing import Any, TypeVar, cast

import anyio
import anyio.lowlevel
from pydantic import SecretStr
from sqlalchemy import URL, Engine, create_engine, event, inspect, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncConnection,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, FromStatement, ORMExecuteState, Session, SessionTransaction, sessionmaker
from sqlalchemy.sql import operators, visitors
from sqlalchemy.sql.dml import UpdateBase
from sqlalchemy.sql.elements import BinaryExpression, BindParameter, BooleanClauseList, TextClause
from sqlalchemy.sql.selectable import Alias, Join, TextualSelect
from sqlalchemy.util import await_only

from config.env import AppConfig, DataBaseConfig, DataBaseSettings, DataSourceSettings
from exceptions.exception import (
    DataSourceException,
    DataSourceInitializationException,
    DataSourceNotFoundException,
    DataSourceUnavailableException,
)
from utils.log_util import logger
from utils.time_util import TimezoneUtil

_HEALTH_RETRY_COOLDOWN = timedelta(seconds=5)
_SESSION_TIMEZONE_QUERY = {
    'mysql': 'SELECT @@session.time_zone',
    'postgresql': 'SHOW TIME ZONE',
}
_UTC_SESSION_TIMEZONES = {'+00:00', 'UTC', 'Etc/UTC'}
_QUIET_SQL_LOG_TOKEN = 'ruoyi_internal_sql'
_DatabaseEngine = TypeVar('_DatabaseEngine', Engine, AsyncEngine)


class _QuietSqlLogFilter(logging.Filter):
    """
    按连接日志标记过滤内部SQL，保留警告和错误
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """
        判断是否保留当前SQLAlchemy日志

        :param record: 待输出的日志记录
        :return: 是否保留日志
        """
        return (
            record.levelno >= logging.WARNING
            or not isinstance(record.msg, str)
            or not record.msg.startswith(f'[{_QUIET_SQL_LOG_TOKEN}] ')
        )


_QUIET_SQL_LOG_FILTER = _QuietSqlLogFilter()


def quiet_sql_engine(engine: _DatabaseEngine) -> _DatabaseEngine:
    """
    创建复用原连接池、只过滤自身常规SQL日志的引擎视图

    :param engine: 注册中心管理的同步或异步引擎
    :return: 带有内部SQL日志标记的引擎视图，由原引擎统一管理连接池
    """
    sync_engine = engine.sync_engine if isinstance(engine, AsyncEngine) else engine
    logger_name = 'sqlalchemy.engine.Engine'
    if sync_engine.logging_name:
        logger_name = f'{logger_name}.{sync_engine.logging_name}'
    # Logger过滤同时覆盖echo自动创建的Handler和应用日志转发，不修改共享日志等级。
    logging.getLogger(logger_name).addFilter(_QUIET_SQL_LOG_FILTER)
    return cast('_DatabaseEngine', engine.execution_options(logging_token=_QUIET_SQL_LOG_TOKEN))


def _error_details(exc: BaseException) -> tuple[str, int | None]:
    """
    提取不含连接凭据和SQL参数的安全错误摘要

    :param exc: 原始异常或数据源异常
    :return: 异常类型和数字错误码
    """
    if isinstance(exc, DataSourceException):
        return exc.error_type or type(exc).__name__, exc.error_code
    original = exc.orig if isinstance(exc, DBAPIError) else exc
    error_code = original.args[0] if original.args and isinstance(original.args[0], int) else None
    return type(original).__name__, error_code


def _error_log_suffix(error_type: str, error_code: int | None) -> str:
    """
    构建数据源错误日志摘要

    :param error_type: 异常类型
    :param error_code: 数字错误码
    :return: 不含敏感信息的日志后缀
    """
    code_text = f'，错误码：{error_code}' if error_code is not None else ''
    return f'，错误类型：{error_type}{code_text}'


@dataclass(frozen=True, slots=True)
class DatabaseDriverAdapter:
    """
    数据库驱动适配器
    """

    db_type: str
    async_driver: str
    sync_driver: str
    async_connect_timeout_key: str
    sync_connect_timeout_key: str

    def build_url(self, config: DataSourceSettings, *, sync: bool) -> URL:
        """
        根据数据源配置构建SQLAlchemy数据库连接URL

        :param config: 数据源配置
        :param sync: 是否构建同步数据库连接URL
        :return: SQLAlchemy数据库连接URL
        """
        return URL.create(
            drivername=self.sync_driver if sync else self.async_driver,
            username=config.db_username,
            password=_secret_value(config.db_password),
            host=config.db_host,
            port=int(config.db_port),
            database=config.db_database,
        )

    def build_connect_args(self, config: DataSourceSettings, *, sync: bool) -> dict[str, Any]:
        """
        构建数据库驱动连接参数

        :param config: 数据源配置
        :param sync: 是否构建同步数据库连接参数
        :return: 数据库驱动连接参数
        """
        timeout_key = self.sync_connect_timeout_key if sync else self.async_connect_timeout_key
        connect_args: dict[str, Any] = {timeout_key: config.db_connect_timeout}
        if self.db_type == 'postgresql':
            if sync:
                connect_args['options'] = '-c timezone=UTC'
            else:
                connect_args['server_settings'] = {'timezone': 'UTC'}
        elif self.db_type == 'mysql':
            connect_args['init_command'] = "SET time_zone = '+00:00'"
        return connect_args


_DATABASE_DRIVER_ADAPTERS = {
    adapter.db_type: adapter
    for adapter in (
        DatabaseDriverAdapter(
            db_type='mysql',
            async_driver='mysql+asyncmy',
            sync_driver='mysql+pymysql',
            async_connect_timeout_key='connect_timeout',
            sync_connect_timeout_key='connect_timeout',
        ),
        DatabaseDriverAdapter(
            db_type='postgresql',
            async_driver='postgresql+asyncpg',
            sync_driver='postgresql+psycopg2',
            async_connect_timeout_key='timeout',
            sync_connect_timeout_key='connect_timeout',
        ),
    )
}


def _secret_value(value: SecretStr | str) -> str:
    """
    获取密码配置的原始值

    :param value: 密码配置
    :return: 密码原始值
    """
    return value.get_secret_value() if isinstance(value, SecretStr) else value


def _database_source(config: DataBaseSettings | DataSourceSettings) -> DataSourceSettings:
    """
    获取指定配置对应的数据源配置

    :param config: 数据库集合配置或单个数据源配置
    :return: 单个数据源配置
    """
    return config.get_source() if isinstance(config, DataBaseSettings) else config


def _driver_adapter(config: DataSourceSettings) -> DatabaseDriverAdapter:
    """
    获取数据库驱动适配器

    :param config: 数据源配置
    :return: 数据库驱动适配器
    """
    adapter = _DATABASE_DRIVER_ADAPTERS.get(config.db_type)
    if adapter is None:
        raise ValueError(f'不支持的数据库类型：{config.db_type!r}')
    return adapter


def _build_url(config: DataSourceSettings, *, sync: bool) -> URL:
    """
    使用对应的数据库驱动适配器构建连接URL

    :param config: 数据源配置
    :param sync: 是否构建同步数据库连接URL
    :return: SQLAlchemy数据库连接URL
    """
    return _driver_adapter(config).build_url(config, sync=sync)


def build_async_sqlalchemy_database_url(config: DataBaseSettings | DataSourceSettings | None = None) -> URL:
    """
    构建异步SQLAlchemy数据库连接URL

    :param config: 数据库集合配置或单个数据源配置
    :return: 异步SQLAlchemy数据库连接URL
    """
    return _build_url(_database_source(config or DataBaseConfig), sync=False)


def build_sync_sqlalchemy_database_url(config: DataBaseSettings | DataSourceSettings | None = None) -> URL:
    """
    构建同步SQLAlchemy数据库连接URL

    :param config: 数据库集合配置或单个数据源配置
    :return: 同步SQLAlchemy数据库连接URL
    """
    return _build_url(_database_source(config or DataBaseConfig), sync=True)


def _engine_options(config: DataSourceSettings, echo: bool | None = None) -> dict[str, Any]:
    """
    构建数据库引擎连接池参数

    :param config: 数据源配置
    :param echo: 是否输出SQLAlchemy SQL日志
    :return: 数据库引擎连接池参数
    """
    return {
        'echo': config.db_echo if echo is None else echo,
        'max_overflow': config.db_max_overflow,
        'pool_size': config.db_pool_size,
        'pool_recycle': config.db_pool_recycle,
        'pool_timeout': config.db_pool_timeout,
        'pool_pre_ping': True,
        'pool_use_lifo': True,
    }


def create_async_db_engine(
    echo: bool | None = None, config: DataBaseSettings | DataSourceSettings | None = None
) -> AsyncEngine:
    """
    创建异步SQLAlchemy Engine

    :param echo: 是否输出SQLAlchemy SQL日志
    :param config: 数据库集合配置或单个数据源配置
    :return: 异步SQLAlchemy Engine
    """
    source = _database_source(config or DataBaseConfig)
    adapter = _driver_adapter(source)
    return create_async_engine(
        adapter.build_url(source, sync=False),
        connect_args=adapter.build_connect_args(source, sync=False),
        **_engine_options(source, echo),
    )


def create_sync_db_engine(
    echo: bool | None = None, config: DataBaseSettings | DataSourceSettings | None = None
) -> Engine:
    """
    创建同步SQLAlchemy Engine

    :param echo: 是否输出SQLAlchemy SQL日志
    :param config: 数据库集合配置或单个数据源配置
    :return: 同步SQLAlchemy Engine
    """
    source = _database_source(config or DataBaseConfig)
    adapter = _driver_adapter(source)
    return create_engine(
        adapter.build_url(source, sync=True),
        connect_args=adapter.build_connect_args(source, sync=True),
        **_engine_options(source, echo),
    )


class CurrentUserCacheSession(Session):
    """
    登记当前用户资料和权限变更，在事务提交后使缓存失效
    """

    _USER_TABLES = frozenset({'sys_user', 'sys_user_role', 'sys_user_post'})
    _SHARED_TABLES = frozenset({'sys_role', 'sys_menu', 'sys_dept', 'sys_post', 'sys_role_menu', 'sys_role_dept'})
    _CHANGE_KEY = 'current_user_cache_changes'
    _REDIS_KEY = 'current_user_cache_redis'
    _INVALIDATE_TIMEOUT_SECONDS = 0.3
    _CLOSE_TIMEOUT_SECONDS = 0.2

    @staticmethod
    def _table_names(table: Any) -> set[str]:
        """
        解析别名和多表更新目标中的原始表名

        :param table: SQLAlchemy写入目标
        :return: 原始表名集合
        """
        if isinstance(table, Alias):
            return CurrentUserCacheSession._table_names(table.element)
        if isinstance(table, Join):
            return CurrentUserCacheSession._table_names(table.left) | CurrentUserCacheSession._table_names(table.right)
        name = getattr(table, 'name', None)
        return {name} if name is not None else set()

    @staticmethod
    def _has_unscoped_write(statement: Any) -> bool:
        """
        识别原生SQL和包装语句中无法精确定位用户的写入

        :param statement: SQLAlchemy执行语句
        :return: 是否需要全局失效
        """
        for element in visitors.iterate(statement):
            raw_sql = element if element is statement else None
            if isinstance(element, (FromStatement, TextualSelect)):
                raw_sql = element.element
            if isinstance(raw_sql, TextClause):
                # 只识别完整SQL，WHERE等位置的文本片段不表示写入。
                sql = raw_sql.text.lstrip().upper()
                if not sql.startswith(('SELECT ', 'SELECT\n', 'SHOW ', 'PRAGMA ')):
                    return True
            if isinstance(element, UpdateBase) and element is not statement:
                names = CurrentUserCacheSession._table_names(element.table)
                if names & (CurrentUserCacheSession._USER_TABLES | CurrentUserCacheSession._SHARED_TABLES):
                    return True
        return False

    def _record_cache_change(self, user_ids: set[int] | None) -> None:
        """
        按当前事务登记变更，None表示共享权限或无法确定用户范围

        :param user_ids: 需要失效的用户ID集合
        :return: None
        """
        transaction = self.get_nested_transaction() or self.get_transaction()
        if transaction is None:
            return
        changes = self.info.setdefault(self._CHANGE_KEY, {})
        if transaction not in changes:
            changes[transaction] = user_ids
        elif changes[transaction] is not None:
            changes[transaction] = None if user_ids is None else changes[transaction] | user_ids

    @classmethod
    def _where_user_ids(cls, clause: Any, table_name: str, parameters: Any) -> set[int] | None:
        """
        仅识别明确的用户ID等值条件，复杂条件保守失效全部快照

        :param clause: 更新或删除语句的条件
        :param table_name: 目标表名
        :param parameters: 执行参数
        :return: 用户ID集合，无法确定时返回None
        """
        if isinstance(clause, BooleanClauseList) and clause.operator is operators.and_:
            for item in clause.clauses:
                ids = cls._where_user_ids(item, table_name, parameters)
                if ids is not None:
                    return ids
            return None
        if not isinstance(clause, BinaryExpression) or clause.operator not in (operators.eq, operators.in_op):
            return None
        column, value = clause.left, clause.right
        if isinstance(column, BindParameter) and clause.operator is operators.eq:
            column, value = value, column
        if (
            getattr(column, 'name', None) != 'user_id'
            or getattr(getattr(column, 'table', None), 'name', None) != table_name
            or not isinstance(value, BindParameter)
            or value.callable is not None
        ):
            return None
        parameter_sets = parameters if isinstance(parameters, (list, tuple)) else [parameters or {}]
        user_ids = set()
        for item in parameter_sets:
            if not isinstance(item, Mapping):
                return None
            raw = item.get(value.key, value.value)
            values = raw if clause.operator is operators.in_op and isinstance(raw, (list, tuple, set)) else [raw]
            if not all(isinstance(user_id, int) and not isinstance(user_id, bool) for user_id in values):
                return None
            user_ids.update(values)
        return user_ids

    async def _invalidate_cache(self, user_ids: set[int] | None) -> None:
        """
        提交完成后轮换缓存版本，Redis异常由短时硬过期兜底

        :param user_ids: 需要失效的用户ID集合，None表示全部用户
        :return: None
        """
        from config.get_redis import RedisUtil  # noqa: PLC0415
        from utils.cache_util import CurrentUserCacheUtil  # noqa: PLC0415

        redis = self.info.get(self._REDIS_KEY)
        owns_redis = redis is None
        try:
            # 限制提交后的缓存失效等待时间，超时后仍需完成连接清理。
            with anyio.fail_after(self._INVALIDATE_TIMEOUT_SECONDS):
                namespace = CurrentUserCacheUtil.namespace_for_bind(self.get_bind())
                if namespace is None:
                    return
                if owns_redis:
                    redis = await RedisUtil.create_redis_pool(log_enabled=False, log_start_enabled=False)
                await CurrentUserCacheUtil.invalidate(redis, namespace, user_ids)
        except Exception as exc:
            logger.warning(f'当前用户缓存失效失败，将等待缓存过期：{type(exc).__name__}')
        finally:
            if owns_redis and redis is not None:
                try:
                    # 外层取消不能反复中断资源清理，关闭仍受自身超时限制。
                    with anyio.fail_after(self._CLOSE_TIMEOUT_SECONDS, shield=True):
                        await redis.aclose()
                except Exception as exc:
                    logger.warning(f'关闭当前用户缓存连接失败：{type(exc).__name__}')
        # 关闭期间被屏蔽的外层取消仍需交还调用方。
        await anyio.lowlevel.checkpoint_if_cancelled()


@event.listens_for(CurrentUserCacheSession, 'do_orm_execute', retval=True)
def _track_current_user_statement(state: ORMExecuteState) -> Any:
    """
    登记成功执行的用户及权限写入，覆盖ORM批量操作和Core语句

    :param state: 当前SQL执行状态
    :return: 原语句执行结果
    """
    result = state.invoke_statement()
    if not AppConfig.app_current_user_cache_enabled:
        return result
    try:
        statement = state.statement
        if CurrentUserCacheSession._has_unscoped_write(statement):
            state.session._record_cache_change(None)
        elif state.is_insert or state.is_update or state.is_delete:
            target = getattr(statement, 'table', None)
            table_names = CurrentUserCacheSession._table_names(target)
            table_name = next(iter(table_names)) if len(table_names) == 1 else None
            if table_names & CurrentUserCacheSession._SHARED_TABLES or (
                isinstance(target, (Alias, Join)) and table_names & CurrentUserCacheSession._USER_TABLES
            ):
                # 别名及多表写入的WHERE可能引用其他表，不能据此缩小目标用户范围。
                state.session._record_cache_change(None)
            elif table_name in CurrentUserCacheSession._USER_TABLES:
                ids = CurrentUserCacheSession._where_user_ids(
                    getattr(statement, 'whereclause', None), table_name, state.parameters
                )
                bulk_entity = None
                if (
                    state.is_update
                    and state.is_orm_statement
                    and isinstance(state.parameters, list)
                    and state.execution_options.get('dml_strategy') in (None, 'auto', 'bulk')
                ):
                    try:
                        bulk_entity = statement.entity_description.get('entity')
                    except (AttributeError, KeyError):
                        pass
                assigned_columns = list(getattr(statement, '_values', None) or {})
                assigned_columns.extend(column for column, _value in getattr(statement, '_ordered_values', None) or ())
                if state.is_update and any(getattr(column, 'key', column) == 'user_id' for column in assigned_columns):
                    # 用户归属变更需覆盖新旧用户，自定义绑定及表达式不能只按参数名判断。
                    ids = None
                elif bulk_entity is not None:
                    # ORM批量更新会自动附加主键条件，用户资料和登录时间更新走此路径。
                    values = [item.get('user_id') for item in state.parameters]
                    ids = (
                        set(values)
                        if all(isinstance(value, int) and not isinstance(value, bool) for value in values)
                        else None
                    )
                elif state.is_update and (
                    'user_id' in statement.compile().params
                    or any(
                        isinstance(parameters, Mapping) and 'user_id' in parameters
                        for parameters in (
                            state.parameters if isinstance(state.parameters, (list, tuple)) else [state.parameters]
                        )
                    )
                ):
                    # 修改主键或未知用户范围时不能只失效原用户。
                    ids = None
                state.session._record_cache_change(ids)
    except Exception as exc:
        # SQL已执行成功，范围分析失败不能改变业务结果。
        logger.warning(f'当前用户缓存变更范围分析失败，将失效全部快照：{type(exc).__name__}')
        state.session._record_cache_change(None)
    return result


@event.listens_for(CurrentUserCacheSession, 'before_flush')
def _track_current_user_flush(session: CurrentUserCacheSession, _context: Any, _instances: Any) -> None:
    """
    登记ORM对象变更，覆盖直接修改用户和权限模型的入口

    :param session: 当前数据库会话
    :param _context: 刷新上下文
    :param _instances: 刷新对象
    :return: None
    """
    if not AppConfig.app_current_user_cache_enabled:
        return
    for instance in session.new | session.dirty | session.deleted:
        state = inspect(instance)
        table_name = state.mapper.local_table.name
        if instance in session.dirty and not session.is_modified(instance, include_collections=False):
            continue
        if table_name in CurrentUserCacheSession._USER_TABLES:
            user_id = getattr(instance, 'user_id', None)
            if user_id is None:
                session._record_cache_change(None)
            else:
                previous_ids = state.attrs.user_id.history.deleted
                session._record_cache_change({user_id, *previous_ids})
        elif table_name in CurrentUserCacheSession._SHARED_TABLES:
            session._record_cache_change(None)


@event.listens_for(CurrentUserCacheSession, 'after_commit')
def _invalidate_current_user_cache(session: CurrentUserCacheSession) -> None:
    """
    保存点提交只合并记录，最外层提交后才执行缓存失效

    :param session: 当前数据库会话
    :return: None
    """
    try:
        transaction = session.get_nested_transaction() or session.get_transaction()
        changes = session.info.get(session._CHANGE_KEY, {})
        if transaction not in changes:
            return
        user_ids = changes.pop(transaction)
        if transaction.nested:
            parent = transaction.parent
            if parent not in changes:
                changes[parent] = user_ids
            elif changes[parent] is not None:
                changes[parent] = None if user_ids is None else changes[parent] | user_ids
            return
        session.info.pop(session._CHANGE_KEY, None)
        if user_ids != set():
            await_only(session._invalidate_cache(user_ids))
    except Exception as exc:
        # 数据库已提交，缓存监听器异常不能改变提交结果，取消仍向上传播。
        session.info.pop(session._CHANGE_KEY, None)
        logger.warning(f'当前用户缓存提交监听失败，将等待缓存过期：{type(exc).__name__}')


@event.listens_for(CurrentUserCacheSession, 'after_transaction_end')
def _discard_current_user_changes(session: CurrentUserCacheSession, transaction: SessionTransaction) -> None:
    """
    清理已结束事务的记录，回滚和关闭会话不影响Redis缓存

    :param session: 当前数据库会话
    :param transaction: 已结束的事务
    :return: None
    """
    changes = session.info.get(session._CHANGE_KEY)
    if changes is not None:
        changes.pop(transaction, None)
        if not changes:
            session.info.pop(session._CHANGE_KEY, None)


def create_async_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """
    创建异步Session工厂

    :param engine: 异步SQLAlchemy Engine
    :return: 异步Session工厂
    """
    return async_sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        sync_session_class=CurrentUserCacheSession,
    )


def create_sync_session_factory(engine: Engine) -> sessionmaker:
    """
    创建同步Session工厂

    :param engine: 同步SQLAlchemy Engine
    :return: 同步Session工厂
    """
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


@dataclass(slots=True)
class DataSourceRuntime:
    """
    数据源运行时状态
    """

    name: str
    config: DataSourceSettings
    async_engine: AsyncEngine | None = None
    async_session_factory: async_sessionmaker[AsyncSession] | None = None
    sync_engine: Engine | None = None
    available: bool = False
    last_health_check_at: datetime | None = None
    next_retry_at: datetime | None = None
    session_timezone: str | None = None
    health_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class _DataSourceRegistry:
    """
    数据源注册中心
    """

    def __init__(self, settings: DataBaseSettings | None = None) -> None:
        self.settings = settings or DataBaseConfig
        self._runtimes: dict[str, DataSourceRuntime] = {}
        self._initialized = False
        self._log_enabled = True
        self._configs = dict(self.settings.db_sources)
        self._cache_redis: Any | None = None

    def set_cache_redis(self, redis: Any | None) -> None:
        """
        绑定应用生命周期管理的Redis，数据库会话只借用连接池

        :param redis: 应用Redis客户端，None表示解除绑定
        :return: None
        """
        self._cache_redis = redis

    def _resolve_name(self, name: str | None = None) -> str:
        """
        解析并校验数据源名称

        :param name: 数据源名称
        :return: 已配置的数据源名称
        """
        source_name = name or self.settings.db_default_source
        if source_name not in self._configs:
            raise DataSourceNotFoundException(source_name)
        return source_name

    def _runtime(self, name: str | None = None) -> DataSourceRuntime:
        """
        获取或创建数据源运行时状态

        :param name: 数据源名称
        :return: 数据源运行时状态
        """
        source_name = self._resolve_name(name)
        runtime = self._runtimes.get(source_name)
        if runtime is None:
            runtime = DataSourceRuntime(name=source_name, config=self._configs[source_name])
            self._runtimes[source_name] = runtime
        return runtime

    @staticmethod
    def _mark_unavailable(runtime: DataSourceRuntime) -> None:
        """
        标记数据源不可用并设置下次重试时间

        :param runtime: 数据源运行时状态
        :return: None
        """
        now = TimezoneUtil.utc_now()
        runtime.available = False
        runtime.session_timezone = None
        runtime.last_health_check_at = now
        runtime.next_retry_at = now + _HEALTH_RETRY_COOLDOWN

    @staticmethod
    def _data_source_error(
        exception_type: type[DataSourceException],
        runtime: DataSourceRuntime,
        exc: BaseException,
    ) -> DataSourceException:
        """将底层异常转换为不泄露连接信息的数据源异常。"""
        error_type, error_code = _error_details(exc)
        return exception_type(runtime.name, error_type=error_type, error_code=error_code)

    @classmethod
    def _ensure_async_resources(cls, runtime: DataSourceRuntime) -> None:
        """
        确保数据源异步引擎和Session工厂已创建

        :param runtime: 数据源运行时状态
        :return: None
        """
        if runtime.async_engine is not None and runtime.async_session_factory is not None:
            return
        try:
            engine = create_async_db_engine(config=runtime.config)
            session_factory = create_async_session_factory(engine)
        except Exception as exc:
            cls._mark_unavailable(runtime)
            raise cls._data_source_error(DataSourceInitializationException, runtime, exc) from None
        runtime.async_engine = engine
        runtime.async_session_factory = session_factory

    async def initialize(self, log_enabled: bool = True) -> None:
        """
        初始化并检查所有数据源的连接状态

        :param log_enabled: 是否输出数据源启动日志
        :return: None
        """
        self._log_enabled = log_enabled
        if self._initialized:
            return
        names = tuple(self._configs)
        results = await asyncio.gather(*(self._check_health(name) for name in names), return_exceptions=True)
        default_name = self._resolve_name()
        required_failure: tuple[str, BaseException] | None = None
        for name, result in zip(names, results, strict=True):
            config = self._configs[name]
            required = config.db_required or name == default_name
            healthy = not isinstance(result, BaseException)
            error_type = None
            error_code = None
            if not healthy:
                error_type, error_code = _error_details(result)
            if log_enabled:
                log_context: dict[str, Any] = {
                    'data_source': name,
                    'database_type': config.db_type,
                    'required': required,
                }
                if error_type is not None:
                    log_context['error_type'] = error_type
                    log_context['error_code'] = error_code
                elif healthy:
                    log_context['session_timezone'] = self._runtime(name).session_timezone
                source_logger = logger.bind(**log_context)
                if healthy:
                    source_logger.info(
                        f'✅ 数据源 {name} 初始化成功，sessionTimeZone={self._runtime(name).session_timezone}'
                    )
                elif required:
                    source_logger.error(f'❌ 必需数据源 {name} 连接检查失败{_error_log_suffix(error_type, error_code)}')
                else:
                    source_logger.warning(
                        f'⚠️ 非必需数据源 {name} 连接检查失败，应用将降级启动{_error_log_suffix(error_type, error_code)}'
                    )
            if not healthy and required and required_failure is None:
                required_failure = (name, result)
        if required_failure is not None:
            name, result = required_failure
            error_type, error_code = _error_details(result)
            await self.dispose_all()
            raise DataSourceInitializationException(
                name,
                error_type=error_type,
                error_code=error_code,
            ) from None
        self._initialized = True

    def get_async_engine(self, name: str | None = None) -> AsyncEngine:
        """
        获取数据源异步引擎

        :param name: 数据源名称
        :return: 异步SQLAlchemy Engine
        """
        runtime = self._runtime(name)
        self._ensure_async_resources(runtime)
        assert runtime.async_engine is not None
        return runtime.async_engine

    def get_sync_engine(self, name: str | None = None) -> Engine:
        """
        获取数据源同步引擎

        :param name: 数据源名称
        :return: 同步SQLAlchemy Engine
        """
        runtime = self._runtime(name)
        if runtime.sync_engine is None:
            try:
                runtime.sync_engine = create_sync_db_engine(config=runtime.config)
            except Exception as exc:
                raise self._data_source_error(DataSourceInitializationException, runtime, exc) from None
        return runtime.sync_engine

    async def _check_health(self, name: str) -> None:
        """
        检查指定数据源的连接状态

        :param name: 数据源名称
        :return: None
        """
        runtime = self._runtime(name)
        async with runtime.health_lock:
            await self._check_health_locked(runtime)

    async def _check_health_locked(self, runtime: DataSourceRuntime) -> None:
        """
        在持有健康检查锁时检查数据源连接状态

        :param runtime: 数据源运行时状态
        :return: None
        """
        try:
            self._ensure_async_resources(runtime)
            assert runtime.async_engine is not None
            async with runtime.async_engine.begin() as connection:
                await connection.execute(text('SELECT 1'))
                timezone_result = await connection.execute(text(_SESSION_TIMEZONE_QUERY[runtime.config.db_type]))
                session_timezone = str(timezone_result.scalar_one())
                if session_timezone not in _UTC_SESSION_TIMEZONES:
                    raise RuntimeError(f'数据库session timezone必须为UTC，实际为{session_timezone}')
                runtime.session_timezone = session_timezone
        except Exception as exc:
            self._mark_unavailable(runtime)
            raise self._data_source_error(DataSourceUnavailableException, runtime, exc) from None
        runtime.available = True
        runtime.last_health_check_at = TimezoneUtil.utc_now()
        runtime.next_retry_at = None

    async def _ensure_available(self, runtime: DataSourceRuntime) -> None:
        """
        确保指定数据源当前可用

        :param runtime: 数据源运行时状态
        :return: None
        """
        async with runtime.health_lock:
            if runtime.available:
                return
            now = TimezoneUtil.utc_now()
            if runtime.next_retry_at is not None and now < runtime.next_retry_at:
                raise DataSourceUnavailableException(runtime.name)
            await self._check_health_locked(runtime)
            if self._log_enabled:
                logger.bind(data_source=runtime.name, session_timezone=runtime.session_timezone).info(
                    f'✅ 数据源 {runtime.name} 连接已恢复，sessionTimeZone={runtime.session_timezone}'
                )

    @asynccontextmanager
    async def connection(self, name: str | None = None) -> AsyncGenerator[AsyncConnection, None]:
        """
        创建指定数据源的异步数据库连接事务

        :param name: 数据源名称
        :return: 异步数据库连接
        """
        runtime = self._runtime(name)
        await self._ensure_available(runtime)
        assert runtime.async_engine is not None
        try:
            async with runtime.async_engine.begin() as connection:
                yield connection
        except DBAPIError as exc:
            if not exc.connection_invalidated:
                raise
            self._mark_unavailable(runtime)
            raise self._data_source_error(DataSourceUnavailableException, runtime, exc) from None

    @asynccontextmanager
    async def session(self, name: str | None = None, *, log_sql: bool = True) -> AsyncGenerator[AsyncSession, None]:
        """
        创建指定数据源的异步数据库会话

        :param name: 数据源名称
        :param log_sql: 是否保留数据源原有的SQL日志设置，False时只过滤此会话的常规SQL日志
        :return: 异步数据库会话
        """
        runtime = self._runtime(name)
        await self._ensure_available(runtime)
        factory = runtime.async_session_factory
        assert factory is not None
        session_options: dict[str, Any] = {}
        if not log_sql:
            assert runtime.async_engine is not None
            session_options['bind'] = quiet_sql_engine(runtime.async_engine)
        try:
            async with factory(**session_options) as current_db:
                if self._cache_redis is not None:
                    current_db.info[CurrentUserCacheSession._REDIS_KEY] = self._cache_redis
                yield current_db
        except DBAPIError as exc:
            if not exc.connection_invalidated:
                raise
            self._mark_unavailable(runtime)
            raise self._data_source_error(DataSourceUnavailableException, runtime, exc) from None

    async def dispose_all(self) -> None:
        """
        释放所有数据源的同步和异步引擎

        :return: None
        """
        runtimes = tuple(self._runtimes.values())
        self._cache_redis = None
        self._runtimes.clear()
        self._initialized = False
        for runtime in runtimes:
            if runtime.sync_engine is not None:
                try:
                    runtime.sync_engine.dispose()
                except Exception as exc:
                    error_type, error_code = _error_details(exc)
                    logger.bind(
                        data_source=runtime.name,
                        engine_type='sync',
                        error_type=error_type,
                        error_code=error_code,
                    ).warning(f'⚠️ 数据源 {runtime.name} 同步Engine释放失败{_error_log_suffix(error_type, error_code)}')
        async_resources = [(runtime, engine) for runtime in runtimes if (engine := runtime.async_engine) is not None]
        results = await asyncio.gather(
            *(engine.dispose() for _, engine in async_resources),
            return_exceptions=True,
        )
        for (runtime, _), result in zip(async_resources, results, strict=True):
            if isinstance(result, Exception):
                error_type, error_code = _error_details(result)
                logger.bind(
                    data_source=runtime.name,
                    engine_type='async',
                    error_type=error_type,
                    error_code=error_code,
                ).warning(f'⚠️ 数据源 {runtime.name} 异步Engine释放失败{_error_log_suffix(error_type, error_code)}')
            elif isinstance(result, BaseException):
                raise result


DataSourceRegistry = _DataSourceRegistry()


class Base(AsyncAttrs, DeclarativeBase):
    pass


@cache
def get_data_source_base(source_name: str) -> type[DeclarativeBase]:
    """
    获取指定数据源独立且可复用的ORM元数据基类

    :param source_name: 数据源名称
    :return: ORM元数据基类
    """
    DataBaseConfig.get_source(source_name)

    class NamedDataSourceBase(AsyncAttrs, DeclarativeBase):
        pass

    NamedDataSourceBase.__name__ = f'{source_name.title().replace("_", "").replace("-", "")}DataSourceBase'
    return NamedDataSourceBase
