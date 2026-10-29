import asyncio
import json
import shutil
import subprocess
import tempfile
import time
from collections.abc import AsyncIterator, Iterator
from dataclasses import replace
from pathlib import Path
from unittest.mock import AsyncMock

import anyio
import pytest
import pytest_asyncio
from redis.asyncio import Redis
from redis.asyncio.connection import ConnectionPool
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import ResponseError
from redis.exceptions import TimeoutError as RedisTimeoutError
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine

from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel
from utils.cache_util import CurrentUserCacheTicket, CurrentUserCacheUtil

USER_ID = 2
OTHER_USER_ID = 3
TTL_SECONDS = 5
TTL_MS = TTL_SECONDS * 1000
NAMESPACE = 'current-user-cache-test'


@pytest.fixture(scope='module')
def redis_socket() -> Iterator[str]:
    """启动只监听临时Unix socket的Redis，不访问开发环境Redis数据。"""
    executable = shutil.which('redis-server')
    if executable is None:
        pytest.skip('真实缓存脚本测试需要redis-server')
    with tempfile.TemporaryDirectory(prefix='user-cache-', dir='/tmp') as directory:
        socket_path = str(Path(directory) / 'redis.sock')
        process = subprocess.Popen(
            [
                executable,
                '--port',
                '0',
                '--unixsocket',
                socket_path,
                '--save',
                '',
                '--appendonly',
                'no',
                '--dir',
                directory,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            for _attempt in range(100):
                if process.poll() is not None:
                    pytest.fail('隔离Redis进程启动失败，请检查Unix socket权限')
                if Path(socket_path).exists():
                    break
                time.sleep(0.01)
            else:
                pytest.fail('隔离Redis进程未创建Unix socket')
            yield socket_path
        finally:
            process.terminate()
            process.wait(timeout=5)


@pytest_asyncio.fixture
async def cache_redis(redis_socket: str) -> AsyncIterator[Redis]:
    """每项测试使用独立客户端并清空专属测试实例。"""
    redis = Redis(unix_socket_path=redis_socket, decode_responses=True, socket_timeout=1)
    try:
        for _attempt in range(10):
            try:
                await asyncio.wait_for(redis.ping(), timeout=0.2)
                break
            except (RedisConnectionError, asyncio.TimeoutError):
                await asyncio.sleep(0.01)
        else:
            pytest.fail('隔离Redis测试实例未能启动')
        await redis.flushdb()
        yield redis
    finally:
        await redis.aclose()


def user_model(user_id: int = USER_ID, permission: str = 'demo:read') -> CurrentUserModel:
    return CurrentUserModel(
        permissions=[permission],
        roles=['reader'],
        user=UserInfoModel(userId=user_id, userName='reader', status='0', delFlag='0'),
        appTimezone='Asia/Shanghai',
        pwdChrtype='2',
        isDefaultModifyPwd=True,
        isPasswordExpired=True,
    )


async def prime_cache(redis: Redis, user_id: int = USER_ID) -> CurrentUserModel:
    user = user_model(user_id)
    cached, ticket = await CurrentUserCacheUtil.read(redis, NAMESPACE, user_id, TTL_SECONDS)
    assert cached is None
    assert ticket is not None
    assert await CurrentUserCacheUtil.write(redis, NAMESPACE, user_id, user, ticket)
    return user


@pytest.mark.asyncio
async def test_round_trip_isolates_models_and_omits_password_and_dynamic_fields(cache_redis: Redis) -> None:
    original = await prime_cache(cache_redis)
    cached, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    assert cached is not None
    assert ticket is None
    assert cached.permissions == original.permissions
    assert cached.user == original.user
    assert cached.pwd_chrtype == '0'
    assert cached.is_default_modify_pwd is False
    assert cached.is_password_expired is False
    cached.permissions.clear()
    cached.user.nick_name = 'changed'
    second, _ = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    assert second.permissions == original.permissions
    assert second.user.nick_name is None
    snapshot = await cache_redis.hget(CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)[2], 'payload')
    payload = json.loads(snapshot)
    assert set(payload) == {'permissions', 'roles', 'user'}
    assert 'password' not in payload['user']


@pytest.mark.asyncio
async def test_password_hash_is_never_serialized(cache_redis: Redis) -> None:
    _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    user = user_model()
    user.user.password = 'secret-hash'
    assert await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user, ticket)
    payload = await cache_redis.hget(CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)[2], 'payload')
    assert 'secret-hash' not in payload
    assert 'password' not in json.loads(payload)['user']
    cached, _ = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    assert cached.user.password is None


@pytest.mark.asyncio
@pytest.mark.parametrize('shared', [False, True])
async def test_invalidation_rejects_old_query_results(cache_redis: Redis, shared: bool) -> None:
    _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    assert await CurrentUserCacheUtil.invalidate(cache_redis, NAMESPACE, None if shared else {USER_ID})
    assert not await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user_model(), ticket)
    cached, replacement = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    assert cached is None
    assert (replacement.global_epoch, replacement.user_epoch) != (ticket.global_epoch, ticket.user_epoch)


@pytest.mark.asyncio
async def test_concurrent_queries_cannot_repopulate_after_invalidation(cache_redis: Redis) -> None:
    query_count = 8
    prepared = []
    all_started = asyncio.Event()
    complete_queries = asyncio.Event()

    async def query_and_fill() -> bool:
        _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
        prepared.append(ticket)
        if len(prepared) == query_count:
            all_started.set()
        await complete_queries.wait()
        return await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user_model(), ticket)

    tasks = [asyncio.create_task(query_and_fill()) for _ in range(query_count)]
    try:
        await asyncio.wait_for(all_started.wait(), timeout=2)
        assert await CurrentUserCacheUtil.invalidate(cache_redis, NAMESPACE, {USER_ID})
        complete_queries.set()
        assert not any(await asyncio.gather(*tasks))
        assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS))[0] is None
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


@pytest.mark.asyncio
async def test_user_invalidation_preserves_other_users_and_global_invalidates_all(cache_redis: Redis) -> None:
    await prime_cache(cache_redis, USER_ID)
    await prime_cache(cache_redis, OTHER_USER_ID)
    assert await CurrentUserCacheUtil.invalidate(cache_redis, NAMESPACE, {USER_ID})
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS))[0] is None
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, OTHER_USER_ID, TTL_SECONDS))[0] is not None
    assert await CurrentUserCacheUtil.invalidate(cache_redis, NAMESPACE)
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, OTHER_USER_ID, TTL_SECONDS))[0] is None


@pytest.mark.asyncio
@pytest.mark.parametrize('key_index', [0, 1])
async def test_missing_epoch_never_restores_existing_snapshot(cache_redis: Redis, key_index: int) -> None:
    await prime_cache(cache_redis)
    keys = CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)
    previous = await cache_redis.get(keys[key_index])
    await cache_redis.delete(keys[key_index])
    cached, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    assert cached is None
    assert ticket is not None
    assert await cache_redis.get(keys[key_index]) != previous


@pytest.mark.asyncio
async def test_fixed_deadline_is_not_extended_by_slow_fill_or_reads(cache_redis: Redis) -> None:
    _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    await asyncio.sleep(0.03)
    assert await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user_model(), ticket)
    snapshot_key = CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)[2]
    expiry = await cache_redis.pexpiretime(snapshot_key)
    assert expiry == ticket.deadline_ms
    assert await cache_redis.pttl(snapshot_key) < TTL_MS
    for _ in range(3):
        assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS))[0] is not None
    assert await cache_redis.pexpiretime(snapshot_key) == expiry


@pytest.mark.asyncio
async def test_user_epoch_has_idle_expiry_without_extending_snapshot_deadline(cache_redis: Redis) -> None:
    await prime_cache(cache_redis)
    global_key, user_key, snapshot_key = CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)
    epoch_ttl_ms = CurrentUserCacheUtil._USER_EPOCH_TTL_SECONDS * 1000
    assert 0 < await cache_redis.pttl(user_key) <= epoch_ttl_ms
    assert await cache_redis.ttl(global_key) == -1
    deadline = await cache_redis.pexpiretime(snapshot_key)
    await cache_redis.pexpire(user_key, TTL_MS)
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS))[0] is not None
    assert TTL_MS < await cache_redis.pttl(user_key) <= epoch_ttl_ms
    assert await cache_redis.pexpiretime(snapshot_key) == deadline


@pytest.mark.asyncio
async def test_invalidation_expires_user_epochs_but_keeps_global_epoch(cache_redis: Redis) -> None:
    assert await CurrentUserCacheUtil.invalidate(cache_redis, NAMESPACE, {USER_ID, OTHER_USER_ID})
    for user_id in (USER_ID, OTHER_USER_ID):
        user_key = CurrentUserCacheUtil._keys(NAMESPACE, user_id)[1]
        assert 0 < await cache_redis.ttl(user_key) <= CurrentUserCacheUtil._USER_EPOCH_TTL_SECONDS
    assert await CurrentUserCacheUtil.invalidate(cache_redis, NAMESPACE)
    assert await cache_redis.ttl(CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)[0]) == -1


@pytest.mark.asyncio
async def test_query_past_its_original_deadline_cannot_fill(cache_redis: Redis) -> None:
    _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    expired = replace(ticket, created_at_ms=ticket.created_at_ms - TTL_MS, deadline_ms=ticket.created_at_ms - 1)
    assert not await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user_model(), expired)
    assert await cache_redis.exists(CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)[2]) == 0


@pytest.mark.asyncio
async def test_late_older_query_cannot_replace_newer_snapshot(cache_redis: Redis) -> None:
    _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    older = replace(ticket, created_at_ms=ticket.created_at_ms - 100)
    assert await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user_model(permission='new'), ticket)
    assert not await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user_model(permission='old'), older)
    cached, _ = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    assert cached.permissions == ['new']


@pytest.mark.asyncio
async def test_shorter_configured_ttl_does_not_accept_previously_longer_snapshot(cache_redis: Redis) -> None:
    _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    old = replace(ticket, created_at_ms=ticket.created_at_ms - TTL_MS)
    assert await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user_model(), old)
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS * 2))[0] is not None
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS))[0] is None


@pytest.mark.asyncio
async def test_restored_expired_payload_is_not_accepted_even_if_redis_key_has_new_ttl(cache_redis: Redis) -> None:
    await prime_cache(cache_redis)
    snapshot_key = CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)[2]
    await cache_redis.hset(snapshot_key, 'deadline', 1)
    await cache_redis.expire(snapshot_key, TTL_SECONDS)
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS))[0] is None


@pytest.mark.asyncio
@pytest.mark.parametrize('damage', ['json', 'user_id', 'password', 'disabled', 'deleted', 'null'])
async def test_damaged_snapshot_is_not_used(cache_redis: Redis, damage: str) -> None:
    await prime_cache(cache_redis)
    key = CurrentUserCacheUtil._keys(NAMESPACE, USER_ID)[2]
    payload = json.loads(await cache_redis.hget(key, 'payload'))
    if damage == 'json':
        serialized = '{'
    else:
        if damage == 'user_id':
            payload['user']['userId'] = OTHER_USER_ID
        elif damage == 'password':
            payload['user']['password'] = 'unwanted-hash'
        elif damage == 'disabled':
            payload['user']['status'] = '1'
        elif damage == 'deleted':
            payload['user']['delFlag'] = '2'
        elif damage == 'null':
            payload['user'] = None
        serialized = json.dumps(payload)
    await cache_redis.hset(key, 'payload', serialized)
    cached, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    assert cached is None
    assert ticket is not None
    assert await CurrentUserCacheUtil.write(cache_redis, NAMESPACE, USER_ID, user_model(), ticket)


@pytest.mark.asyncio
async def test_namespaces_and_users_do_not_share_snapshots(cache_redis: Redis) -> None:
    await prime_cache(cache_redis)
    assert (await CurrentUserCacheUtil.read(cache_redis, 'another-database', USER_ID, TTL_SECONDS))[0] is None
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, OTHER_USER_ID, TTL_SECONDS))[0] is None


@pytest.mark.asyncio
async def test_empty_invalidation_does_not_invalidate_other_users(cache_redis: Redis) -> None:
    await prime_cache(cache_redis)
    assert await CurrentUserCacheUtil.invalidate(cache_redis, NAMESPACE, set())
    assert (await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS))[0] is not None


@pytest.mark.asyncio
@pytest.mark.parametrize('error_type', [RedisConnectionError, RedisTimeoutError, ResponseError])
async def test_cache_failure_returns_to_database_without_claiming_success(error_type: type[Exception]) -> None:
    redis = AsyncMock(spec=Redis)
    redis.eval.side_effect = error_type('unavailable')
    assert await CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, TTL_SECONDS) == (None, None)
    assert not await CurrentUserCacheUtil.invalidate(redis, NAMESPACE)
    ticket = CurrentUserCacheTicket('global', 'user', 0, TTL_MS)
    assert not await CurrentUserCacheUtil.write(redis, NAMESPACE, USER_ID, user_model(), ticket)


@pytest.mark.asyncio
@pytest.mark.parametrize('result', [None, 1, [], ['global', 'user', '1', '2'], ['global', 'user', None, '2', '']])
async def test_malformed_redis_response_falls_back_to_database(result: object) -> None:
    redis = AsyncMock(spec=Redis)
    redis.eval.return_value = result
    assert await CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, TTL_SECONDS) == (None, None)


@pytest.mark.asyncio
@pytest.mark.parametrize('operation', ['read', 'write', 'invalidate'])
async def test_slow_cache_operation_is_bounded_and_cancelled(
    cache_redis: Redis, operation: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    stopped = asyncio.Event()

    async def slow_eval(*args: object) -> None:
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    redis = AsyncMock(spec=Redis)
    redis.eval.side_effect = slow_eval
    monkeypatch.setattr(CurrentUserCacheUtil, '_OPERATION_TIMEOUT_SECONDS', 0.01)
    if operation == 'read':
        assert await CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, TTL_SECONDS) == (None, None)
    elif operation == 'write':
        assert not await CurrentUserCacheUtil.write(redis, NAMESPACE, USER_ID, user_model(), ticket)
    else:
        assert not await CurrentUserCacheUtil.invalidate(redis, NAMESPACE)
    assert stopped.is_set()


@pytest.mark.asyncio
@pytest.mark.parametrize('operation', ['read', 'write', 'invalidate'])
async def test_cancellation_is_propagated(cache_redis: Redis, operation: str) -> None:
    _, ticket = await CurrentUserCacheUtil.read(cache_redis, NAMESPACE, USER_ID, TTL_SECONDS)
    redis = AsyncMock(spec=Redis)
    redis.eval.side_effect = asyncio.CancelledError
    with pytest.raises(asyncio.CancelledError):
        if operation == 'read':
            await CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, TTL_SECONDS)
        elif operation == 'write':
            await CurrentUserCacheUtil.write(redis, NAMESPACE, USER_ID, user_model(), ticket)
        else:
            await CurrentUserCacheUtil.invalidate(redis, NAMESPACE)


@pytest.mark.asyncio
async def test_cancelling_caller_stops_pending_redis_operation() -> None:
    started = asyncio.Event()
    stopped = asyncio.Event()

    async def blocking_eval(*args: object) -> None:
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    redis = AsyncMock(spec=Redis)
    redis.eval.side_effect = blocking_eval
    task = asyncio.create_task(CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, TTL_SECONDS))
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert stopped.is_set()


@pytest.mark.asyncio
@pytest.mark.parametrize('operation', ['read', 'write', 'invalidate'])
@pytest.mark.parametrize('cancellation', ['task_group', 'deadline'])
async def test_anyio_parent_cancellation_is_not_converted_to_cache_fallback(operation: str, cancellation: str) -> None:
    started = anyio.Event()
    stopped = anyio.Event()
    results = []

    async def blocking_eval(*args: object) -> None:
        started.set()
        try:
            await anyio.sleep_forever()
        finally:
            stopped.set()

    redis = AsyncMock(spec=Redis)
    redis.eval.side_effect = blocking_eval
    ticket = CurrentUserCacheTicket('global', 'user', 0, TTL_MS)

    async def run_operation() -> None:
        if operation == 'read':
            result = await CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, TTL_SECONDS)
        elif operation == 'write':
            result = await CurrentUserCacheUtil.write(redis, NAMESPACE, USER_ID, user_model(), ticket)
        else:
            result = await CurrentUserCacheUtil.invalidate(redis, NAMESPACE)
        results.append(result)

    if cancellation == 'task_group':
        async with anyio.create_task_group() as group:
            group.start_soon(run_operation)
            await started.wait()
            group.cancel_scope.cancel()
    else:
        with pytest.raises(TimeoutError), anyio.fail_after(0.01):
            await run_operation()

    assert stopped.is_set()
    assert results == []


@pytest.mark.asyncio
@pytest.mark.parametrize('operation', ['read', 'write', 'invalidate'])
@pytest.mark.parametrize('cancellation', ['timeout', 'anyio', 'task', 'repeated_task', 'late_anyio', 'late_task'])
async def test_cancellation_waits_for_redis_connection_release(  # noqa: PLR0915
    operation: str, cancellation: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """使用真实连接池模拟命令等待及归还连接时的锁竞争。"""
    pool = ConnectionPool(max_connections=1, decode_responses=True)
    monkeypatch.setattr(pool, 'ensure_connection', AsyncMock())
    redis = Redis(connection_pool=pool)
    started = asyncio.Event()
    cleanup_started = asyncio.Event()
    cancelled = asyncio.Event()
    results = []
    request_scope = anyio.CancelScope()
    timed_out = cancellation in ('timeout', 'late_anyio', 'late_task')
    monkeypatch.setattr(CurrentUserCacheUtil, '_OPERATION_TIMEOUT_SECONDS', 0.02 if timed_out else 1)

    async def blocking_command(*args: object, **kwargs: object) -> None:
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cleanup_started.set()

    monkeypatch.setattr(redis, '_send_command_parse_response', blocking_command)
    ticket = CurrentUserCacheTicket('global', 'user', 0, TTL_MS)

    async def run_operation() -> None:
        with request_scope:
            try:
                if operation == 'read':
                    result = await CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, TTL_SECONDS)
                elif operation == 'write':
                    result = await CurrentUserCacheUtil.write(redis, NAMESPACE, USER_ID, user_model(), ticket)
                else:
                    result = await CurrentUserCacheUtil.invalidate(redis, NAMESPACE)
                results.append(result)
            except asyncio.CancelledError:
                cancelled.set()
                raise

    task = asyncio.create_task(run_operation())
    try:
        await asyncio.wait_for(started.wait(), timeout=1)
        async with pool._lock:
            if cancellation == 'anyio':
                request_scope.cancel()
            elif cancellation in ('task', 'repeated_task'):
                task.cancel()
            await asyncio.wait_for(cleanup_started.wait(), timeout=1)
            if cancellation == 'late_anyio':
                request_scope.cancel()
            elif cancellation in ('repeated_task', 'late_task'):
                task.cancel()
            await asyncio.sleep(0)
            assert not task.done()
            assert len(pool._in_use_connections) == 1

        if cancellation in ('task', 'repeated_task', 'late_task'):
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(task, timeout=1)
        else:
            await asyncio.wait_for(task, timeout=1)
        assert len(pool._in_use_connections) == 0
        assert len(pool._available_connections) == 1
        if cancellation == 'timeout':
            assert results == [(None, None) if operation == 'read' else False]
            assert not cancelled.is_set()
        else:
            assert results == []
            assert cancelled.is_set()
        monkeypatch.setattr(redis, '_send_command_parse_response', AsyncMock(return_value=True))
        assert await redis.ping()
    finally:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await redis.aclose()
        await pool.aclose()


@pytest.mark.asyncio
@pytest.mark.parametrize('cancellation', ['timeout', 'task'])
async def test_redis_cleanup_error_does_not_replace_timeout_or_cancellation(
    cancellation: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = asyncio.Event()

    async def failing_cleanup(*args: object) -> None:
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            raise RuntimeError('cleanup failed')

    redis = AsyncMock(spec=Redis)
    redis.eval.side_effect = failing_cleanup
    monkeypatch.setattr(CurrentUserCacheUtil, '_OPERATION_TIMEOUT_SECONDS', 0.02 if cancellation == 'timeout' else 1)
    task = asyncio.create_task(CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, TTL_SECONDS))
    await asyncio.wait_for(started.wait(), timeout=1)
    if cancellation == 'task':
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    else:
        assert await task == (None, None)


@pytest.mark.asyncio
async def test_disabled_cache_never_accesses_redis() -> None:
    redis = AsyncMock(spec=Redis)
    assert await CurrentUserCacheUtil.read(redis, NAMESPACE, USER_ID, 0) == (None, None)
    redis.eval.assert_not_called()


def test_namespace_is_stable_for_engine_and_connection_and_unknown_bind_bypasses() -> None:
    engine = create_engine('sqlite://')
    try:
        with engine.connect() as connection:
            assert CurrentUserCacheUtil.namespace_for_bind(engine) == CurrentUserCacheUtil.namespace_for_bind(
                connection
            )
        assert CurrentUserCacheUtil.namespace_for_bind(object()) is None
        assert CurrentUserCacheUtil.namespace_for_bind(None) is None
    finally:
        engine.dispose()


@pytest.mark.asyncio
async def test_async_and_sync_bind_share_namespace() -> None:
    engine = create_async_engine('sqlite+aiosqlite://')
    try:
        async with engine.connect() as connection:
            namespace = CurrentUserCacheUtil.namespace_for_bind(engine)
            assert namespace == CurrentUserCacheUtil.namespace_for_bind(engine.sync_engine)
            assert namespace == CurrentUserCacheUtil.namespace_for_bind(connection)
    finally:
        await engine.dispose()
