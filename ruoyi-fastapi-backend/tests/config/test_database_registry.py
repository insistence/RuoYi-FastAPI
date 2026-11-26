from types import SimpleNamespace
from typing import Literal, Self
from unittest.mock import AsyncMock, MagicMock, call

import pytest
from sqlalchemy import URL
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import async_sessionmaker

from common.aspect.db_session import DBSessionDependency, get_db_session_provider
from config import database
from config.env import DataBaseSettings, DataSourceSettings
from exceptions.exception import DataSourceInitializationException, DataSourceUnavailableException

EXPECTED_CONNECT_TIMEOUT = 7


def _source(*, required: bool = True) -> DataSourceSettings:
    """
    构造使用测试连接参数的数据源配置。

    :param required: 该数据源是否必须在启动时可用
    :return: 注册表使用的数据源配置
    """
    return DataSourceSettings(
        db_type='mysql',
        db_host='db.example',
        db_port=3306,
        db_username='user',
        db_password='p@ss/w0rd',
        db_database='application',
        db_echo=False,
        db_connect_timeout=7,
        db_max_overflow=1,
        db_pool_size=1,
        db_pool_recycle=60,
        db_pool_timeout=2,
        db_required=required,
    )


def _settings(**sources: DataSourceSettings) -> DataBaseSettings:
    """
    配置注册表测试使用的默认数据源和附加数据源。

    :param sources: 按名称提供的各数据源配置
    :return: 以 primary 为默认源的数据库配置
    """
    return DataBaseSettings(_env_file=None, db_default_source='primary', db_sources=sources)


def test_database_urls_use_structured_url_and_hide_password() -> None:
    """以结构化 URL 表示数据库地址并隐藏密码。"""
    config = _source()
    async_url = database.build_async_sqlalchemy_database_url(config)
    sync_url = database.build_sync_sqlalchemy_database_url(config)

    assert isinstance(async_url, URL)
    assert async_url.drivername == 'mysql+asyncmy'
    assert sync_url.drivername == 'mysql+pymysql'
    assert async_url.password == 'p@ss/w0rd'
    assert 'p@ss' not in repr(async_url)


def test_error_details_without_driver_exception() -> None:
    """驱动原始异常缺失时，错误摘要仍能报告异常类型。"""
    error = OperationalError('SELECT 1', {}, OSError('connection lost'))
    error.orig = None
    assert database._error_details(error) == ('OperationalError', None)


@pytest.mark.parametrize(
    ('db_type', 'db_port', 'async_timeout_key', 'sync_timeout_key'),
    [
        ('mysql', 3306, 'connect_timeout', 'connect_timeout'),
        ('postgresql', 5432, 'timeout', 'connect_timeout'),
    ],
)
def test_engine_factories_use_driver_specific_connect_timeout(
    monkeypatch: pytest.MonkeyPatch,
    db_type: Literal['mysql', 'postgresql'],
    db_port: int,
    async_timeout_key: str,
    sync_timeout_key: str,
) -> None:
    """引擎工厂使用驱动对应的连接超时。"""
    config = _source()
    config.db_type = db_type
    config.db_port = db_port
    async_engine = object()
    sync_engine = object()
    captured_options: dict[str, dict[str, object]] = {}

    def create_async_engine(_url: URL, **options: object) -> object:
        """
        捕获异步引擎的创建参数。

        :param _url: 回调接收的目标 URL
        :param options: 调用方按名称传入的附加选项
        :return: 用于异步数据库操作的 SQLAlchemy 引擎
        """
        captured_options['async'] = options
        return async_engine

    def create_sync_engine(_url: URL, **options: object) -> object:
        """
        捕获同步引擎的创建参数。

        :param _url: 回调接收的目标 URL
        :param options: 调用方按名称传入的附加选项
        :return: 用于同步数据库操作的 SQLAlchemy 引擎
        """
        captured_options['sync'] = options
        return sync_engine

    monkeypatch.setattr(database, 'create_async_engine', create_async_engine)
    monkeypatch.setattr(database, 'create_engine', create_sync_engine)

    assert database.create_async_db_engine(config=config) is async_engine
    assert database.create_sync_db_engine(config=config) is sync_engine
    async_connect_args = captured_options['async']['connect_args']
    sync_connect_args = captured_options['sync']['connect_args']
    assert isinstance(async_connect_args, dict)
    assert isinstance(sync_connect_args, dict)
    assert async_connect_args[async_timeout_key] == EXPECTED_CONNECT_TIMEOUT
    assert sync_connect_args[sync_timeout_key] == EXPECTED_CONNECT_TIMEOUT
    if db_type == 'mysql':
        assert async_connect_args['init_command'] == "SET time_zone = '+00:00'"
        assert sync_connect_args['init_command'] == "SET time_zone = '+00:00'"
    else:
        assert async_connect_args['server_settings'] == {'timezone': 'UTC'}
        assert sync_connect_args['options'] == '-c timezone=UTC'
    assert captured_options['async']['pool_use_lifo'] is True
    assert captured_options['sync']['pool_use_lifo'] is True


def test_async_session_factory_disables_expiration_after_commit() -> None:
    """异步会话工厂禁用提交后过期。"""
    factory = database.create_async_session_factory(MagicMock())

    assert factory.kw['expire_on_commit'] is False


class _Begin:
    """
    提供事务上下文的测试替身。

    :ivar should_fail: 是否在此步骤模拟失败
    :ivar session_timezone: 为数据库会话设置的时区
    """

    def __init__(self, should_fail: bool = False, session_timezone: str = '+00:00') -> None:
        """
        初始化测试夹具的 ``should_fail``, ``session_timezone``。

        :param should_fail: 是否在此步骤模拟失败
        :param session_timezone: 为数据库会话设置的时区
        """
        self.should_fail = should_fail
        self.session_timezone = session_timezone

    async def __aenter__(self) -> Self:
        """
        进入异步上下文并提供测试资源。

        :raises RuntimeError: 模拟建立含敏感诊断的数据库会话失败
        :return: 当前实例
        """
        if self.should_fail:
            raise RuntimeError('password=secret')
        return self

    async def __aexit__(self, *_args: object) -> bool:
        """
        在此测试分支返回 False。

        :param _args: 调用方传入的其余位置参数
        :return: 此分支的固定值 ``False``
        """
        return False

    async def execute(self, statement: object) -> SimpleNamespace:
        """
        按测试场景处理数据库查询并提供结果。

        :param statement: 即将执行的数据库语句
        :return: ``SimpleNamespace`` 实例
        """
        scalar_value = 1 if str(statement) == 'SELECT 1' else self.session_timezone
        return SimpleNamespace(scalar_one=lambda: scalar_value)


class _Engine:
    """
    提供数据库引擎的测试替身。

    :ivar should_fail: 是否在此步骤模拟失败
    :ivar session_timezone: 为数据库会话设置的时区
    :ivar dispose: 释放测试资源时调用的函数
    """

    def __init__(self) -> None:
        """初始化测试夹具的 ``should_fail``, ``session_timezone``, ``dispose``。"""
        self.should_fail = True
        self.session_timezone = '+00:00'
        self.dispose = AsyncMock()

    def begin(self) -> _Begin:
        """
        提供受测试状态控制的事务上下文。

        :return: 受测试状态控制的事务上下文
        """
        return _Begin(self.should_fail, self.session_timezone)


@pytest.mark.asyncio
async def test_health_check_rejects_non_utc_database_session(monkeypatch: pytest.MonkeyPatch) -> None:
    """健康检查拒绝非 UTC 的数据库会话。"""
    engine = _Engine()
    engine.should_fail = False
    engine.session_timezone = 'SYSTEM'
    monkeypatch.setattr(database, 'create_async_db_engine', lambda config: engine)
    registry = database._DataSourceRegistry(_settings(primary=_source()))

    with pytest.raises(DataSourceInitializationException) as exc_info:
        await registry.initialize(log_enabled=False)

    assert exc_info.value.error_type == 'RuntimeError'
    assert registry._runtimes == {}


@pytest.mark.asyncio
async def test_initialize_can_suppress_worker_startup_logs(monkeypatch: pytest.MonkeyPatch) -> None:
    """初始化时可关闭工作进程启动日志。"""
    primary_engine = _Engine()
    primary_engine.should_fail = False
    optional_engine = _Engine()
    monkeypatch.setattr(
        database,
        'create_async_db_engine',
        lambda config: primary_engine if config.db_required else optional_engine,
    )
    registry = database._DataSourceRegistry(_settings(primary=_source(), reporting=_source(required=False)))
    source_logger = MagicMock()
    monkeypatch.setattr(database, 'logger', source_logger)

    await registry.initialize(log_enabled=False)

    source_logger.bind.assert_not_called()
    assert registry._runtimes['primary'].available
    assert not registry._runtimes['reporting'].available

    optional_engine.should_fail = False
    registry._runtimes['reporting'].next_retry_at = None
    async with registry.connection('reporting'):
        pass
    source_logger.bind.assert_not_called()
    await registry.dispose_all()


@pytest.mark.asyncio
async def test_initialize_logs_source_name(monkeypatch: pytest.MonkeyPatch) -> None:
    """初始化日志包含数据源名称。"""
    engine = _Engine()
    engine.should_fail = False
    monkeypatch.setattr(database, 'create_async_db_engine', lambda config: engine)
    registry = database._DataSourceRegistry(_settings(primary=_source()))
    source_logger = MagicMock()
    monkeypatch.setattr(database, 'logger', source_logger)

    await registry.initialize()

    source_logger.bind.assert_called_once_with(
        data_source='primary', database_type='mysql', required=True, session_timezone='+00:00'
    )
    source_logger.bind.return_value.info.assert_called_once_with('✅ 数据源 primary 初始化成功，sessionTimeZone=+00:00')
    await registry.dispose_all()


@pytest.mark.asyncio
async def test_optional_source_recovers_after_cooldown(monkeypatch: pytest.MonkeyPatch) -> None:
    """可选数据源在冷却期后恢复。"""
    primary_engine = _Engine()
    primary_engine.should_fail = False
    optional_engine = _Engine()
    monkeypatch.setattr(
        database,
        'create_async_db_engine',
        lambda config: primary_engine if config.db_required else optional_engine,
    )
    settings = _settings(primary=_source(), reporting=_source(required=False))
    registry = database._DataSourceRegistry(settings)

    await registry.initialize()
    assert not registry._runtimes['reporting'].available
    optional_engine.should_fail = False
    runtime = registry._runtimes['reporting']
    runtime.next_retry_at = None
    async with registry.connection('reporting'):
        pass
    assert runtime.available
    await registry.dispose_all()


@pytest.mark.asyncio
async def test_optional_engine_creation_failure_degrades_and_recovers(monkeypatch: pytest.MonkeyPatch) -> None:
    """可选引擎创建失败后可降级并恢复。"""
    primary_config = _source()
    optional_config = _source(required=False)
    primary_engine = _Engine()
    primary_engine.should_fail = False
    optional_engine = _Engine()
    optional_engine.should_fail = False
    optional_creation_fails = True

    def create_engine(config: DataSourceSettings) -> _Engine:
        """
        根据测试数据源配置创建引擎替身。

        :param config: 当前对象使用的配置
        :raises ModuleNotFoundError: 模拟可选数据源的驱动未安装
        :return: 为目标数据源选择的测试引擎
        """
        nonlocal optional_creation_fails
        if config is optional_config and optional_creation_fails:
            raise ModuleNotFoundError('driver is not installed')
        return optional_engine if config is optional_config else primary_engine

    monkeypatch.setattr(database, 'create_async_db_engine', create_engine)
    registry = database._DataSourceRegistry(_settings(primary=primary_config, reporting=optional_config))

    await registry.initialize()
    runtime = registry._runtimes['reporting']
    assert runtime.async_engine is None
    assert not runtime.available

    optional_creation_fails = False
    runtime.next_retry_at = None
    async with registry.connection('reporting'):
        pass

    assert runtime.async_engine is optional_engine
    assert runtime.available
    await registry.dispose_all()


@pytest.mark.asyncio
async def test_required_engine_creation_failure_disposes_other_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    """必需引擎创建失败时释放其他数据源。"""
    primary_config = _source()
    optional_config = _source(required=False)
    optional_engine = _Engine()
    optional_engine.should_fail = False

    def create_engine(config: DataSourceSettings) -> _Engine:
        """
        根据测试数据源配置创建引擎替身。

        :param config: 当前对象使用的配置
        :raises ModuleNotFoundError: 模拟必需数据源的驱动未安装
        :return: 供调用方使用的 ``optional_engine``
        """
        if config is primary_config:
            raise ModuleNotFoundError('required driver is not installed')
        return optional_engine

    monkeypatch.setattr(database, 'create_async_db_engine', create_engine)
    registry = database._DataSourceRegistry(_settings(primary=primary_config, reporting=optional_config))

    with pytest.raises(DataSourceInitializationException):
        await registry.initialize()

    optional_engine.dispose.assert_awaited_once_with()
    assert registry._runtimes == {}


@pytest.mark.asyncio
async def test_initialize_logs_all_sources_and_safe_failure_details(monkeypatch: pytest.MonkeyPatch) -> None:
    """初始化日志列出全部数据源并隐藏敏感错误信息。"""
    primary_engine = _Engine()
    reporting_engine = _Engine()
    reporting_engine.should_fail = False
    monkeypatch.setattr(
        database,
        'create_async_db_engine',
        lambda config: primary_engine if config.db_required else reporting_engine,
    )
    registry = database._DataSourceRegistry(_settings(primary=_source(), reporting=_source(required=False)))
    source_logger = MagicMock()
    monkeypatch.setattr(database, 'logger', source_logger)

    with pytest.raises(DataSourceInitializationException) as exc_info:
        await registry.initialize()

    assert exc_info.value.error_type == 'RuntimeError'
    assert exc_info.value.error_code is None
    assert source_logger.bind.call_args_list == [
        call(
            data_source='primary',
            database_type='mysql',
            required=True,
            error_type='RuntimeError',
            error_code=None,
        ),
        call(data_source='reporting', database_type='mysql', required=False, session_timezone='+00:00'),
    ]
    source_logger.bind.return_value.error.assert_called_once_with(
        '❌ 必需数据源 primary 连接检查失败，错误类型：RuntimeError'
    )
    source_logger.bind.return_value.info.assert_called_once_with(
        '✅ 数据源 reporting 初始化成功，sessionTimeZone=+00:00'
    )
    assert 'secret' not in str(source_logger.mock_calls)


@pytest.mark.asyncio
async def test_invalidated_operational_error_marks_source_down_then_recovers(monkeypatch: pytest.MonkeyPatch) -> None:
    """连接失效时标记数据源离线并允许恢复。"""
    engine = _Engine()
    engine.should_fail = False
    monkeypatch.setattr(database, 'create_async_db_engine', lambda config: engine)
    registry = database._DataSourceRegistry(_settings(primary=_source()))
    await registry.initialize()
    runtime = registry._runtimes['primary']
    runtime.async_session_factory = async_sessionmaker()
    failed_session = None
    with pytest.raises(DataSourceUnavailableException):
        async with registry.session() as failed_session:
            await failed_session.begin()
            raise OperationalError(
                'SELECT 1',
                {},
                RuntimeError('connection lost'),
                connection_invalidated=True,
            )

    assert failed_session is not None
    assert not failed_session.in_transaction()
    assert not runtime.available
    with pytest.raises(DataSourceUnavailableException):
        async with registry.session():
            pass

    runtime.next_retry_at = None
    async with registry.session() as session:
        assert session is not None
    assert runtime.available
    await registry.dispose_all()


@pytest.mark.asyncio
async def test_non_invalidated_operational_error_does_not_mark_source_down(monkeypatch: pytest.MonkeyPatch) -> None:
    """未使连接失效的操作异常不会标记数据源离线。"""
    engine = _Engine()
    engine.should_fail = False
    monkeypatch.setattr(database, 'create_async_db_engine', lambda config: engine)
    registry = database._DataSourceRegistry(_settings(primary=_source()))
    await registry.initialize()
    runtime = registry._runtimes['primary']

    runtime.async_session_factory = async_sessionmaker()

    with pytest.raises(OperationalError):
        async with registry.session():
            raise OperationalError('UPDATE sys_user', {}, RuntimeError('deadlock'))

    assert runtime.available
    assert runtime.next_retry_at is None
    await registry.dispose_all()


@pytest.mark.asyncio
async def test_multiple_sources_have_independent_engines_and_factories(monkeypatch: pytest.MonkeyPatch) -> None:
    """多个数据源使用独立引擎和会话工厂。"""
    primary_config = _source()
    reporting_config = _source(required=False)
    engines = {id(primary_config): _Engine(), id(reporting_config): _Engine()}
    for engine in engines.values():
        engine.should_fail = False
    monkeypatch.setattr(database, 'create_async_db_engine', lambda config: engines[id(config)])
    registry = database._DataSourceRegistry(_settings(primary=primary_config, reporting=reporting_config))

    await registry.initialize()

    assert registry.get_async_engine() is engines[id(primary_config)]
    assert registry.get_async_engine('reporting') is engines[id(reporting_config)]
    assert (
        registry._runtimes['primary'].async_session_factory is not registry._runtimes['reporting'].async_session_factory
    )
    await registry.dispose_all()


@pytest.mark.asyncio
async def test_dispose_all_releases_sync_and_async_engines(monkeypatch: pytest.MonkeyPatch) -> None:
    """统一释放同步和异步引擎。"""
    engine = _Engine()
    engine.should_fail = False
    sync_engine = MagicMock()
    monkeypatch.setattr(database, 'create_async_db_engine', lambda config: engine)
    monkeypatch.setattr(database, 'create_sync_db_engine', lambda config: sync_engine)
    registry = database._DataSourceRegistry(_settings(primary=_source()))
    await registry.initialize()
    assert registry.get_sync_engine() is sync_engine

    await registry.dispose_all()

    sync_engine.dispose.assert_called_once_with()
    engine.dispose.assert_awaited_once_with()
    assert registry._runtimes == {}


@pytest.mark.asyncio
async def test_dispose_all_attempts_every_engine_when_disposal_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    """某个引擎释放失败后仍尝试释放其他引擎。"""
    registry = database._DataSourceRegistry(_settings(primary=_source(), reporting=_source(required=False)))
    primary = registry._runtime('primary')
    reporting = registry._runtime('reporting')
    primary.sync_engine = MagicMock()
    reporting.sync_engine = MagicMock()
    primary.sync_engine.dispose.side_effect = RuntimeError('sync failed')
    primary.async_engine = MagicMock()
    reporting.async_engine = MagicMock()
    primary.async_engine.dispose = AsyncMock(side_effect=RuntimeError('async failed'))
    reporting.async_engine.dispose = AsyncMock()
    source_logger = MagicMock()
    monkeypatch.setattr(database, 'logger', source_logger)

    await registry.dispose_all()

    primary.sync_engine.dispose.assert_called_once_with()
    reporting.sync_engine.dispose.assert_called_once_with()
    primary.async_engine.dispose.assert_awaited_once_with()
    reporting.async_engine.dispose.assert_awaited_once_with()
    expected_warning_count = 2
    assert source_logger.bind.return_value.warning.call_count == expected_warning_count
    assert registry._runtimes == {}


def test_dependency_provider_is_cached_per_source() -> None:
    """按数据源缓存依赖提供器。"""
    assert get_db_session_provider('reporting') is get_db_session_provider('reporting')
    assert get_db_session_provider('reporting') is not get_db_session_provider('archive')
    assert DBSessionDependency('reporting').dependency is get_db_session_provider('reporting')
