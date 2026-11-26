import asyncio
from threading import Event

import pytest

from cli.tui.queries import TuiQueryExecutor


@pytest.mark.asyncio
async def test_remote_query_timeout_returns_standard_failure() -> None:
    """远程查询超时后返回标准错误。"""
    executor = TuiQueryExecutor(remote_timeout_seconds=0.01)
    cancelled = asyncio.Event()

    async def slow_query() -> dict[str, object]:
        """
        模拟超时场景中的慢查询。

        :return: 包含 ``ok`` 的数据
        """
        try:
            await asyncio.sleep(10)
        finally:
            cancelled.set()
        return {'ok': True}

    result = await executor.run_async(slow_query, label='慢查询')

    assert isinstance(result, dict)
    assert result['ok'] is False
    assert result['timeout'] is True
    assert cancelled.is_set()


@pytest.mark.asyncio
async def test_cancelled_local_query_does_not_release_capacity_until_thread_finishes() -> None:
    """取消本地查询后等待线程结束才释放容量。"""
    executor = TuiQueryExecutor(local_timeout_seconds=0.1)
    started = Event()
    finish = Event()

    def blocking_query() -> dict[str, object]:
        """
        暂停查询以便测试任务超时和取消。

        :return: 包含 ``ok`` 的数据
        """
        started.set()
        finish.wait(timeout=2)
        return {'ok': True}

    first_task = asyncio.create_task(executor.run_local(blocking_query, label='第一查询'))
    await asyncio.to_thread(started.wait, 1)
    first_task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first_task

    second_task = asyncio.create_task(executor.run_local(blocking_query, label='第二查询'))
    await asyncio.sleep(0.05)
    third_result = await executor.run_local(blocking_query, label='第三查询')

    assert isinstance(third_result, dict)
    assert third_result['timeout'] is True

    finish.set()
    second_result = await second_task
    assert isinstance(second_result, dict)
