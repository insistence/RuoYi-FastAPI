import asyncio
from typing import TYPE_CHECKING

import pytest
from loguru import logger

from utils.log_util import LoggerInitializer

if TYPE_CHECKING:
    from loguru import Record


def build_log_record(*, level: str, extra: dict[str, object]) -> 'Record':
    """
    从 Loguru 捕获指定级别和附加字段的日志记录。

    :param level: 日志或结果使用的级别
    :param extra: 添加到默认数据上的额外字段
    :return: Logger filter 所需的最小日志记录
    """
    records: list[Record] = []
    handler = logger.add(lambda message: records.append(message.record), level=level)
    try:
        logger.bind(**extra).log(level, '启动日志过滤测试')
    finally:
        logger.remove(handler)
    return records[0]


@pytest.mark.parametrize('level', ['INFO', 'WARNING', 'ERROR'])
def test_startup_worker_role_never_suppresses_log_records(level: str) -> None:
    """校验启动标签和非 leader 标记不再充当日志访问控制。"""
    initializer = LoggerInitializer()
    record = build_log_record(
        level=level,
        extra={
            'startup_phase': 'application_startup',
            'startup_log_enabled': False,
        },
    )

    assert initializer._filter(record) is True
    assert record['extra']['startup_phase'] == 'application_startup'
    assert record['extra']['startup_log_enabled'] is False


def test_startup_worker_role_never_suppresses_info_or_error_file_records() -> None:
    """校验info与error文件filter同样只按级别分流，不按worker角色丢弃。"""
    initializer = LoggerInitializer()
    info_record = build_log_record(
        level='INFO',
        extra={'startup_phase': 'application_startup', 'startup_log_enabled': False},
    )
    error_record = build_log_record(
        level='ERROR',
        extra={'startup_phase': 'application_startup', 'startup_log_enabled': False},
    )

    assert initializer._info_file_filter(info_record) is True
    assert initializer._error_file_filter(error_record) is True


@pytest.mark.asyncio
async def test_background_task_inheriting_old_startup_context_still_emits_logs() -> None:
    """校验 create_task 复制旧启动上下文后，后台任务日志仍然可见。"""
    initializer = LoggerInitializer()
    outputs: list[str] = []
    handler_id = logger.add(
        lambda message: outputs.append(message.record['message']),
        filter=initializer._filter,
        format='{message}',
    )

    async def emit_from_background_task() -> None:
        """在复制的上下文中输出后台任务日志。"""
        await asyncio.sleep(0)
        logger.info('background startup log')

    try:
        with logger.contextualize(startup_phase='application_startup', startup_log_enabled=False):
            task = asyncio.create_task(emit_from_background_task())
        await task
    finally:
        logger.remove(handler_id)

    assert outputs == ['background startup log']
