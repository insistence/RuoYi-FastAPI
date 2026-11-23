import logging
from types import SimpleNamespace
from unittest.mock import MagicMock

from pytest import MonkeyPatch

from cli.core import context_factory
from cli.core.context_factory import CliRuntimeState


def test_suppress_sqlalchemy_logs_disables_echo_for_all_sources(monkeypatch: MonkeyPatch) -> None:
    """关闭 SQLAlchemy 日志时禁用全部数据源的 echo。"""
    sources = {
        'primary': SimpleNamespace(db_echo=True),
        'reporting': SimpleNamespace(db_echo=True),
    }
    env_module = SimpleNamespace(DataBaseConfig=SimpleNamespace(db_sources=sources))
    loggers: dict[str, MagicMock] = {}

    monkeypatch.setattr(context_factory, 'import_module', lambda _name: env_module)

    def get_logger(name: str) -> MagicMock:
        """
        按名称创建并记录日志替身。

        :param name: 用于查找或标识当前对象的名称
        :return: 供调用方使用的 ``logger``
        """
        logger = MagicMock()
        loggers[name] = logger
        return logger

    monkeypatch.setattr(
        context_factory,
        'logging',
        SimpleNamespace(WARNING=logging.WARNING, getLogger=get_logger),
    )

    state = CliRuntimeState()
    state.suppress_sqlalchemy_logs()

    assert all(not source.db_echo for source in sources.values())
    assert state.sqlalchemy_logs_suppressed is True
    assert set(loggers) == {
        'sqlalchemy',
        'sqlalchemy.engine',
        'sqlalchemy.engine.Engine',
        'sqlalchemy.pool',
    }
    for logger in loggers.values():
        logger.setLevel.assert_called_once_with(logging.WARNING)
