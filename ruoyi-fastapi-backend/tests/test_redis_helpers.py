import subprocess
from unittest.mock import AsyncMock, Mock

import pytest
from redis.asyncio import Redis

from tests.redis_helpers import IsolatedRedisServer, absolute_expiry_ms, stop_redis_process
from tests.utils.test_current_user_cache_util import cache_redis, redis_socket  # noqa: F401

TERMINATION_WAIT_COUNT = 2
MISSING_KEY_TTL = -2


@pytest.mark.asyncio
@pytest.mark.parametrize('exited,run_id', [(True, 'owned'), (False, 'foreign')])
async def test_reset_refuses_dead_process_or_replaced_server(exited: bool, run_id: str) -> None:
    """子进程退出或端口被其他 Redis 接管时，绝不能执行清库。"""
    process = Mock()
    process.poll.return_value = 1 if exited else None
    client = AsyncMock(spec=Redis)
    client.info = AsyncMock(return_value={'run_id': run_id})
    client.flushdb = AsyncMock()
    server = IsolatedRedisServer(process, {}, 'owned')

    with pytest.raises(RuntimeError, match='refusing to clear'):
        await server.reset_database(client)

    client.flushdb.assert_not_awaited()
    if exited:
        client.info.assert_not_awaited()


def test_cleanup_waits_for_only_its_child_after_termination_timeout() -> None:
    """正常终止超时时继续回收同一个子进程，避免遗留测试实例。"""
    process = Mock()
    process.poll.return_value = None
    process.wait.side_effect = [subprocess.TimeoutExpired('isolated-redis', 5), 0]

    stop_redis_process(process)

    process.terminate.assert_called_once_with()
    process.kill.assert_called_once_with()
    assert process.wait.call_count == TERMINATION_WAIT_COUNT


@pytest.mark.asyncio
async def test_expiry_query_preserves_exact_deadline_and_missing_key_semantics(cache_redis: Redis) -> None:  # noqa: F811
    """兼容查询必须保留毫秒期限，而非通过本机时钟近似推算。"""
    seconds, micros = await cache_redis.time()
    deadline = seconds * 1000 + micros // 1000 + 60_000
    await cache_redis.set('expires', 'value')
    await cache_redis.pexpireat('expires', deadline)
    assert await absolute_expiry_ms(cache_redis, 'expires') == deadline
    await cache_redis.set('persistent', 'value')
    assert await absolute_expiry_ms(cache_redis, 'persistent') == -1
    assert await absolute_expiry_ms(cache_redis, 'missing') == MISSING_KEY_TTL
