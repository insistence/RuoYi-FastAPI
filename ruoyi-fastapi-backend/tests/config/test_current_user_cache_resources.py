import asyncio
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, call

import anyio
import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import update

from config.database import CurrentUserCacheSession, _DataSourceRegistry
from config.get_redis import RedisUtil
from tests.config.test_current_user_cache_transactions import (
    _ORIGINAL_INVALIDATE,
    CacheUser,
    cache_transactions,  # noqa: F401
)
from utils.cache_util import CurrentUserCacheUtil


@pytest.fixture
def shared_cache_client(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    """提交后失效借用应用连接，只监测新建和关闭行为。"""
    redis = SimpleNamespace(aclose=AsyncMock())
    create = AsyncMock(side_effect=AssertionError('借用应用Redis时不能另建连接池'))
    invalidate = AsyncMock(return_value=True)
    monkeypatch.setattr(RedisUtil, 'create_redis_pool', create)
    monkeypatch.setattr(CurrentUserCacheUtil, 'invalidate', invalidate)
    return SimpleNamespace(redis=redis, create=create, invalidate=invalidate)


@pytest.mark.asyncio
async def test_shared_redis_is_reused_across_commits(
    cache_transactions: SimpleNamespace,  # noqa: F811
    shared_cache_client: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', _ORIGINAL_INVALIDATE)
    shared = shared_cache_client
    async with cache_transactions.sessions(info={CurrentUserCacheSession._REDIS_KEY: shared.redis}) as db:
        for user_id, name in ((1, 'first-commit'), (2, 'second-commit')):
            await db.execute(update(CacheUser).where(CacheUser.user_id == user_id).values(user_name=name))
            await db.commit()
    namespace = CurrentUserCacheUtil.namespace_for_bind(cache_transactions.engine)
    assert shared.invalidate.await_args_list == [call(shared.redis, namespace, {1}), call(shared.redis, namespace, {2})]
    shared.create.assert_not_awaited()
    shared.redis.aclose.assert_not_awaited()
    async with cache_transactions.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'first-commit'
        assert (await db.get(CacheUser, 2)).user_name == 'second-commit'


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['redis', 'timeout'])
async def test_shared_cache_failure_preserves_commit_without_closing_pool(
    cache_transactions: SimpleNamespace,  # noqa: F811
    shared_cache_client: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', _ORIGINAL_INVALIDATE)
    monkeypatch.setattr(CurrentUserCacheSession, '_INVALIDATE_TIMEOUT_SECONDS', 0.01)
    shared = shared_cache_client
    stopped = anyio.Event()

    async def invalidate(*args: Any) -> None:
        if failure == 'redis':
            raise RedisConnectionError('shared cache unavailable')
        try:
            await anyio.sleep_forever()
        finally:
            stopped.set()

    shared.invalidate.side_effect = invalidate
    async with cache_transactions.sessions(info={CurrentUserCacheSession._REDIS_KEY: shared.redis}) as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))
        await db.commit()
    if failure == 'timeout':
        assert stopped.is_set()
    shared.create.assert_not_awaited()
    shared.redis.aclose.assert_not_awaited()
    async with cache_transactions.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'committed'


@pytest.mark.asyncio
@pytest.mark.parametrize('cancellation', ['asyncio', 'task_group'])
async def test_cancelled_shared_invalidation_preserves_borrowed_pool(
    cache_transactions: SimpleNamespace,  # noqa: F811
    shared_cache_client: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    cancellation: str,
) -> None:
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', _ORIGINAL_INVALIDATE)
    shared = shared_cache_client
    entered = anyio.Event()
    stopped = anyio.Event()
    cancelled = anyio.Event()

    async def invalidate(*args: Any) -> None:
        entered.set()
        try:
            await anyio.sleep_forever()
        finally:
            stopped.set()

    shared.invalidate.side_effect = invalidate
    async with cache_transactions.sessions(info={CurrentUserCacheSession._REDIS_KEY: shared.redis}) as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))

        async def commit() -> None:
            try:
                await db.commit()
            except asyncio.CancelledError:
                cancelled.set()
                raise

        if cancellation == 'asyncio':
            pending = asyncio.create_task(commit())
            try:
                await entered.wait()
                pending.cancel()
                with pytest.raises(asyncio.CancelledError):
                    await pending
            finally:
                if not pending.done():
                    pending.cancel()
                    await asyncio.gather(pending, return_exceptions=True)
        else:
            async with anyio.create_task_group() as group:
                group.start_soon(commit)
                await entered.wait()
                group.cancel_scope.cancel()
        assert cancelled.is_set()
        assert stopped.is_set()
        assert CurrentUserCacheSession._CHANGE_KEY not in db.info
    shared.create.assert_not_awaited()
    shared.redis.aclose.assert_not_awaited()
    async with cache_transactions.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'committed'


def _registry(env: SimpleNamespace) -> _DataSourceRegistry:
    """使用隔离SQLite引擎验证会话资源注入，不访问配置中的业务数据源。"""
    registry = _DataSourceRegistry(
        SimpleNamespace(db_default_source='primary', db_sources={'primary': object(), 'reporting': object()})
    )
    for name in ('primary', 'reporting'):
        runtime = registry._runtime(name)
        runtime.async_engine = env.engine
        runtime.async_session_factory = env.sessions
        runtime.available = True
    return registry


@pytest.mark.asyncio
@pytest.mark.parametrize('source', [None, 'reporting'])
@pytest.mark.parametrize('log_sql', [True, False])
async def test_registry_sessions_borrow_registered_cache_client(
    cache_transactions: SimpleNamespace,  # noqa: F811
    shared_cache_client: SimpleNamespace,
    source: str | None,
    log_sql: bool,
) -> None:
    registry = _registry(cache_transactions)
    redis = shared_cache_client.redis
    registry.set_cache_redis(redis)
    try:
        async with registry.session(source, log_sql=log_sql) as db:
            assert db.info[CurrentUserCacheSession._REDIS_KEY] is redis
            assert isinstance(db.sync_session, CurrentUserCacheSession)
            assert (await db.get(CacheUser, 1)).user_name == 'first'
    finally:
        await registry.dispose_all()
    assert registry._cache_redis is None
    shared_cache_client.create.assert_not_awaited()
    redis.aclose.assert_not_awaited()


@pytest.mark.asyncio
async def test_detaching_shared_redis_only_changes_new_sessions(
    cache_transactions: SimpleNamespace,  # noqa: F811
    shared_cache_client: SimpleNamespace,
) -> None:
    registry = _registry(cache_transactions)
    redis = shared_cache_client.redis
    registry.set_cache_redis(redis)
    try:
        async with registry.session() as first:
            registry.set_cache_redis(None)
            async with registry.session() as second:
                assert first.info[CurrentUserCacheSession._REDIS_KEY] is redis
                assert second.info.get(CurrentUserCacheSession._REDIS_KEY) is None
    finally:
        await registry.dispose_all()
    redis.aclose.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('dispose_failure', [False, True])
async def test_registry_disposal_releases_reference_without_closing_borrowed_client(
    cache_transactions: SimpleNamespace,  # noqa: F811
    shared_cache_client: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    dispose_failure: bool,
) -> None:
    registry = _registry(cache_transactions)
    redis = shared_cache_client.redis
    registry.set_cache_redis(redis)
    with monkeypatch.context() as patch:
        if dispose_failure:
            patch.setattr(
                type(cache_transactions.engine), 'dispose', AsyncMock(side_effect=RuntimeError('dispose failed'))
            )
        await registry.dispose_all()
    assert registry._cache_redis is None
    assert registry._runtimes == {}
    redis.aclose.assert_not_awaited()
