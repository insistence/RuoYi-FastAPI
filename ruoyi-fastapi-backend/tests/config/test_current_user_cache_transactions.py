import asyncio
from collections.abc import AsyncIterator
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock

import anyio
import anyio.lowlevel
import pytest
import pytest_asyncio
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import (
    Column,
    Integer,
    String,
    Table,
    bindparam,
    create_engine,
    delete,
    insert,
    or_,
    select,
    text,
    update,
)
from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.exc import IntegrityError, SAWarning
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, aliased, mapped_column

from config.database import CurrentUserCacheSession, _track_current_user_statement, create_async_session_factory
from config.env import AppConfig
from config.get_redis import RedisUtil
from utils.cache_util import CurrentUserCacheUtil

SECOND_USER_ID = 2
_ORIGINAL_INVALIDATE = CurrentUserCacheSession._invalidate_cache


class CacheTestBase(DeclarativeBase):
    pass


class CacheUser(CacheTestBase):
    __tablename__ = 'sys_user'

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_name: Mapped[str] = mapped_column(String, unique=True)


class CacheRole(CacheTestBase):
    __tablename__ = 'sys_role'

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_name: Mapped[str] = mapped_column(String)


class CacheUserRole(CacheTestBase):
    __tablename__ = 'sys_user_role'

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(Integer, primary_key=True)


class CacheJob(CacheTestBase):
    __tablename__ = 'sys_job'

    job_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_name: Mapped[str] = mapped_column(String)


SHARED_TABLES = {
    name: Table(name, CacheTestBase.metadata, Column('id', Integer, primary_key=True), Column('name', String))
    for name in ('sys_menu', 'sys_dept', 'sys_post', 'sys_role_menu', 'sys_role_dept')
}


@pytest_asyncio.fixture
async def cache_transactions(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[SimpleNamespace]:
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', True)
    engine = create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "cache-transactions.db"}')
    async with engine.begin() as connection:
        await connection.run_sync(CacheTestBase.metadata.create_all)
        await connection.execute(
            insert(CacheUser), [{'user_id': 1, 'user_name': 'first'}, {'user_id': 2, 'user_name': 'second'}]
        )
        await connection.execute(insert(CacheRole), [{'role_id': 1, 'role_name': 'reader'}])
        await connection.execute(insert(CacheJob), [{'job_id': 1, 'job_name': 'job'}])
    invalidations = []

    async def invalidate(session: CurrentUserCacheSession, user_ids: set[int] | None) -> None:
        async with engine.connect() as connection:
            names = (await connection.execute(select(CacheUser.user_name).order_by(CacheUser.user_id))).scalars().all()
        invalidations.append((user_ids, names))

    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', invalidate)
    try:
        yield SimpleNamespace(engine=engine, sessions=create_async_session_factory(engine), invalidations=invalidations)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_user_change_invalidates_only_after_commit(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions() as db:
        user = await db.get(CacheUser, 1)
        user.user_name = 'changed'
        await db.flush()
        assert env.invalidations == []
        await db.commit()
        assert env.invalidations == [({1}, ['changed', 'second'])]
        assert CurrentUserCacheSession._CHANGE_KEY not in db.info


@pytest.mark.asyncio
@pytest.mark.parametrize('finish', ['rollback', 'close'])
async def test_rollback_and_close_discard_changes(cache_transactions: SimpleNamespace, finish: str) -> None:
    env = cache_transactions
    async with env.sessions() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='changed'))
        await getattr(db, finish)()
        assert env.invalidations == []
        assert CurrentUserCacheSession._CHANGE_KEY not in db.info


@pytest.mark.asyncio
async def test_nested_commit_waits_for_outer_commit(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='outer'))
        async with db.begin_nested():
            await db.execute(update(CacheUser).where(CacheUser.user_id == SECOND_USER_ID).values(user_name='inner'))
        assert env.invalidations == []
    assert env.invalidations == [({1, 2}, ['outer', 'inner'])]


@pytest.mark.asyncio
async def test_nested_rollback_does_not_invalidate_rolled_back_user(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='outer'))
        savepoint = await db.begin_nested()
        await db.execute(update(CacheUser).where(CacheUser.user_id == SECOND_USER_ID).values(user_name='inner'))
        await savepoint.rollback()
    assert env.invalidations == [({1}, ['outer', 'second'])]


@pytest.mark.asyncio
async def test_nested_commit_then_outer_rollback_does_not_invalidate(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='outer'))
        async with db.begin_nested():
            await db.execute(update(CacheRole).values(role_name='changed'))
        await db.rollback()
    assert env.invalidations == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'statement, expected',
    [
        (update(CacheUser).where(CacheUser.user_id.in_([1, 2])).values(user_name=CacheUser.user_name + '-new'), {1, 2}),
        (
            update(CacheUser).where(CacheUser.user_id == 1, CacheUser.user_name == 'first').values(user_name='changed'),
            {1},
        ),
        (
            update(CacheUser)
            .where(or_(CacheUser.user_id == 1, CacheUser.user_name == 'second'))
            .values(user_name=CacheUser.user_name + '-new'),
            None,
        ),
        (update(CacheUser).where(CacheUser.user_id == 1).values(user_id=3), None),
        (delete(CacheUserRole).where(CacheUserRole.user_id == 1), {1}),
        (delete(CacheRole).where(CacheRole.role_id == 1), None),
        (text("UPDATE sys_user SET user_name = 'changed' WHERE user_id = 1"), None),
    ],
)
async def test_core_and_text_mutations_are_tracked(
    cache_transactions: SimpleNamespace, statement: Any, expected: set[int] | None
) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        await db.execute(statement)
    assert len(env.invalidations) == 1
    assert env.invalidations[0][0] == expected


@pytest.mark.asyncio
@pytest.mark.parametrize('alias_type', ['orm', 'core', 'nested'])
@pytest.mark.parametrize('operation', ['update', 'delete'])
@pytest.mark.parametrize(
    'model, id_column, name_column, tracked',
    [
        (CacheUser, 'user_id', 'user_name', True),
        (CacheRole, 'role_id', 'role_name', True),
        (CacheJob, 'job_id', 'job_name', False),
    ],
)
async def test_alias_mutations_invalidate_only_auth_tables(
    cache_transactions: SimpleNamespace,
    alias_type: str,
    operation: str,
    model: type[CacheTestBase],
    id_column: str,
    name_column: str,
    tracked: bool,
) -> None:
    env = cache_transactions
    if alias_type == 'orm':
        target = aliased(model)
        target_id = getattr(target, id_column)
    else:
        target = model.__table__.alias()
        if alias_type == 'nested':
            target = target.alias()
        target_id = target.c[id_column]
    statement = update(target).values({name_column: 'changed'}) if operation == 'update' else delete(target)
    async with env.sessions.begin() as db:
        result = await db.execute(statement.where(target_id == 1))
        assert result.rowcount == 1
        assert env.invalidations == []
    if tracked:
        assert len(env.invalidations) == 1
        assert env.invalidations[0][0] is None
    else:
        assert env.invalidations == []
    async with env.sessions() as db:
        row = await db.get(model, 1)
        if operation == 'update':
            assert getattr(row, name_column) == 'changed'
        else:
            assert row is None


@pytest.mark.asyncio
async def test_alias_target_with_original_table_filter_invalidates_all_users(
    cache_transactions: SimpleNamespace,
) -> None:
    env = cache_transactions
    users = CacheUser.__table__
    target = users.alias('target')
    statement = update(target).where(users.c.user_id == 1).values(user_name=target.c.user_name + '-changed')
    async with env.sessions.begin() as db:
        with pytest.warns(SAWarning, match='cartesian product'):
            await db.execute(statement)
    assert env.invalidations == [(None, ['first-changed', 'second-changed'])]


@pytest.mark.asyncio
@pytest.mark.parametrize('wrapper', ['columns', 'orm_text', 'orm_core'])
@pytest.mark.parametrize('finish', ['commit', 'rollback'])
async def test_wrapped_write_invalidates_only_after_commit(
    cache_transactions: SimpleNamespace, wrapper: str, finish: str
) -> None:
    env = cache_transactions
    raw_sql = text("UPDATE sys_user SET user_name = 'changed' WHERE user_id = 1 RETURNING user_id, user_name")
    if wrapper == 'columns':
        statement = raw_sql.columns(user_id=Integer, user_name=String)
    elif wrapper == 'orm_text':
        statement = select(CacheUser).from_statement(raw_sql)
    else:
        statement = select(CacheUser).from_statement(
            update(CacheUser).where(CacheUser.user_id == 1).values(user_name='changed').returning(CacheUser)
        )
    async with env.sessions() as db:
        result = await db.execute(statement)
        assert len(result.all()) == 1
        assert env.invalidations == []
        await getattr(db, finish)()
    expected_names = ['changed', 'second'] if finish == 'commit' else ['first', 'second']
    assert env.invalidations == ([(None, expected_names)] if finish == 'commit' else [])
    async with env.sessions() as db:
        assert (await db.scalars(select(CacheUser.user_name).order_by(CacheUser.user_id))).all() == expected_names


@pytest.mark.asyncio
@pytest.mark.parametrize('wrapper', ['columns', 'orm_text', 'orm_select', 'select_cte', 'text_cte', 'where_fragment'])
async def test_readonly_wrappers_and_sql_fragments_do_not_invalidate(
    cache_transactions: SimpleNamespace, wrapper: str
) -> None:
    env = cache_transactions
    raw_sql = text('SELECT user_id, user_name FROM sys_user WHERE user_id = 1')
    if wrapper == 'columns':
        statement = raw_sql.columns(user_id=Integer, user_name=String)
    elif wrapper == 'orm_text':
        statement = select(CacheUser).from_statement(raw_sql)
    elif wrapper == 'orm_select':
        statement = select(CacheUser).from_statement(select(CacheUser).where(CacheUser.user_id == 1))
    elif wrapper == 'select_cte':
        statement = select(select(CacheUser).where(CacheUser.user_id == 1).cte('users'))
    elif wrapper == 'text_cte':
        statement = select(raw_sql.columns(user_id=Integer, user_name=String).cte('users'))
    else:
        statement = select(CacheUser).where(text('user_id = 1'))
    async with env.sessions.begin() as db:
        result = await db.execute(statement)
        assert len(result.all()) == 1
    assert env.invalidations == []


@pytest.mark.parametrize('operation', ['insert', 'update', 'delete'])
@pytest.mark.parametrize('outer', ['select', 'user_update', 'job_update'])
@pytest.mark.parametrize('auth_table', [True, False])
def test_nested_dml_cte_invalidates_auth_writes_conservatively(
    monkeypatch: pytest.MonkeyPatch, operation: str, outer: str, auth_table: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', True)
    target = CacheUser.__table__ if auth_table else CacheJob.__table__
    id_column, name_column = ('user_id', 'user_name') if auth_table else ('job_id', 'job_name')
    if operation == 'insert':
        mutation = insert(target).values({id_column: 3, name_column: 'created'})
    elif operation == 'update':
        mutation = update(target).where(target.c[id_column] == SECOND_USER_ID).values({name_column: 'changed'})
    else:
        mutation = delete(target).where(target.c[id_column] == SECOND_USER_ID)
    nested = mutation.returning(target.c[id_column]).cte('nested_change')
    if outer == 'select':
        statement = select(nested)
    elif outer == 'user_update':
        statement = update(CacheUser.__table__).where(CacheUser.user_id == 1).values(user_name='outer').add_cte(nested)
    else:
        statement = update(CacheJob.__table__).where(CacheJob.job_id == 1).values(job_name='outer').add_cte(nested)
    assert str(statement.compile(dialect=postgresql.dialect())).startswith('WITH nested_change AS')
    with CurrentUserCacheSession() as db, db.begin() as transaction:
        state = SimpleNamespace(
            statement=statement,
            session=db,
            invoke_statement=Mock(return_value=object()),
            is_insert=False,
            is_update=outer != 'select',
            is_delete=False,
            is_orm_statement=False,
            parameters=None,
            execution_options={},
        )
        _track_current_user_statement(state)
        if auth_table or outer == 'user_update':
            assert db.info[CurrentUserCacheSession._CHANGE_KEY] == {transaction: None if auth_table else {1}}
        else:
            assert CurrentUserCacheSession._CHANGE_KEY not in db.info
        transaction.rollback()


@pytest.mark.parametrize(
    'sql',
    [
        "EXPLAIN ANALYZE UPDATE sys_user SET user_name = 'changed' WHERE user_id = 1",
        "EXPLAIN(ANALYZE TRUE) UPDATE sys_user SET user_name = 'changed' WHERE user_id = 1",
    ],
)
def test_explain_analyze_write_requires_invalidation(monkeypatch: pytest.MonkeyPatch, sql: str) -> None:
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', True)
    with CurrentUserCacheSession() as db, db.begin() as transaction:
        state = SimpleNamespace(
            statement=text(sql),
            session=db,
            invoke_statement=Mock(return_value=object()),
            is_insert=False,
            is_update=False,
            is_delete=False,
        )
        _track_current_user_statement(state)
        assert db.info[CurrentUserCacheSession._CHANGE_KEY] == {transaction: None}
        transaction.rollback()


@pytest.mark.parametrize(
    'model, id_column, name_column, joined_model, joined_id_column, tracked',
    [
        (CacheUser, 'user_id', 'user_name', CacheJob, 'job_id', True),
        (CacheUser, 'user_id', 'user_name', CacheUser, 'user_id', True),
        (CacheRole, 'role_id', 'role_name', CacheJob, 'job_id', True),
        (CacheJob, 'job_id', 'job_name', CacheJob, 'job_id', False),
    ],
)
def test_join_update_tracks_auth_tables_after_sql_execution(
    monkeypatch: pytest.MonkeyPatch,
    model: type[CacheTestBase],
    id_column: str,
    name_column: str,
    joined_model: type[CacheTestBase],
    joined_id_column: str,
    tracked: bool,
) -> None:
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', True)
    target = model.__table__
    joined = joined_model.__table__.alias('joined')
    statement = (
        update(target.join(joined, target.c[id_column] == joined.c[joined_id_column]))
        .where(target.c[id_column] == 1)
        .values({target.c[name_column]: 'changed'})
    )
    assert ' INNER JOIN ' in str(statement.compile(dialect=mysql.dialect()))
    result = object()
    with CurrentUserCacheSession() as db, db.begin() as transaction:
        state = SimpleNamespace(
            statement=statement,
            session=db,
            invoke_statement=Mock(return_value=result),
            is_insert=False,
            is_update=True,
            is_delete=False,
            is_orm_statement=False,
            parameters=None,
            execution_options={},
        )
        assert _track_current_user_statement(state) is result
        state.invoke_statement.assert_called_once_with()
        if tracked:
            assert db.info[CurrentUserCacheSession._CHANGE_KEY] == {transaction: None}
        else:
            assert CurrentUserCacheSession._CHANGE_KEY not in db.info
        transaction.rollback()


@pytest.mark.asyncio
async def test_shared_change_overrides_user_scope(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='changed'))
        role = await db.get(CacheRole, 1)
        role.role_name = 'changed'
    assert env.invalidations == [(None, ['changed', 'second'])]


@pytest.mark.asyncio
async def test_readonly_and_unchanged_orm_object_do_not_invalidate(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        user = await db.get(CacheUser, 1)
        user.user_name = 'first'
        await db.execute(text('SELECT 1'))
    assert env.invalidations == []


@pytest.mark.asyncio
async def test_disabled_cache_does_not_register_mutations(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', False)
    async with cache_transactions.sessions.begin() as db:
        await db.execute(update(CacheUser).values(user_name=CacheUser.user_name + '-new'))
        user = await db.get(CacheUser, 1)
        user.user_name = 'changed'
    assert cache_transactions.invalidations == []


@pytest.mark.asyncio
async def test_failed_commit_does_not_invalidate(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions() as db:
        user = await db.get(CacheUser, 1)
        user.user_name = 'second'
        with pytest.raises(IntegrityError):
            await db.commit()
        await db.rollback()
        assert CurrentUserCacheSession._CHANGE_KEY not in db.info
    assert env.invalidations == []


@pytest.mark.asyncio
async def test_cancellation_before_commit_rolls_back(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    entered = asyncio.Event()

    async def mutate() -> None:
        async with env.sessions.begin() as db:
            await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='cancelled'))
            entered.set()
            await asyncio.Event().wait()

    task = asyncio.create_task(mutate())
    await entered.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert env.invalidations == []
    async with env.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'first'


@pytest.mark.asyncio
async def test_cancellation_after_commit_does_not_undo_committed_data(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = cache_transactions
    entered = asyncio.Event()

    async def invalidate(session: CurrentUserCacheSession, user_ids: set[int] | None) -> None:
        assert user_ids == {1}
        entered.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', invalidate)

    async def mutate() -> None:
        async with env.sessions() as db:
            await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))
            await db.commit()

    task = asyncio.create_task(mutate())
    await entered.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    async with env.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'committed'
    assert env.invalidations == []


@pytest.mark.asyncio
@pytest.mark.parametrize('table_name', list(SHARED_TABLES))
async def test_all_shared_permission_tables_invalidate_global(
    cache_transactions: SimpleNamespace, table_name: str
) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        await db.execute(insert(SHARED_TABLES[table_name]).values(id=1, name='changed'))
    assert env.invalidations == [(None, ['first', 'second'])]


@pytest.mark.asyncio
async def test_multiple_savepoint_levels_preserve_parent_changes(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='outer'))
        nested = await db.begin_nested()
        async with db.begin_nested():
            await db.execute(update(CacheRole).values(role_name='changed'))
        await nested.rollback()
    assert env.invalidations == [({1}, ['outer', 'second'])]


@pytest.mark.asyncio
async def test_session_can_be_reused_after_commit_and_rollback(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='first-commit'))
        await db.commit()
        await db.execute(update(CacheRole).values(role_name='discard'))
        await db.rollback()
        await db.execute(update(CacheUser).where(CacheUser.user_id == SECOND_USER_ID).values(user_name='second-commit'))
        await db.commit()
    assert env.invalidations == [({1}, ['first-commit', 'second']), ({2}, ['first-commit', 'second-commit'])]


@pytest.mark.asyncio
async def test_disabled_cache_does_not_compile_tracking_sql(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = cache_transactions
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', False)

    def unexpected_scope(*args: Any) -> None:
        pytest.fail('关闭缓存后不应分析用户变更范围')

    monkeypatch.setattr(CurrentUserCacheSession, '_where_user_ids', unexpected_scope)
    monkeypatch.setattr(CurrentUserCacheSession, '_has_unscoped_write', unexpected_scope)
    async with env.sessions.begin() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='changed'))
    assert env.invalidations == []


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['create', 'invalidate', 'close', 'timeout', 'create_timeout', 'close_timeout'])
async def test_cache_failure_does_not_turn_committed_write_into_error(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    env = cache_transactions
    redis = SimpleNamespace(aclose=AsyncMock())
    create = AsyncMock(return_value=redis)
    invalidate = AsyncMock(return_value=True)
    if failure == 'create':
        create.side_effect = RedisConnectionError('unavailable')
    elif failure == 'invalidate':
        invalidate.side_effect = RedisConnectionError('unavailable')
    elif failure == 'close':
        redis.aclose.side_effect = RedisConnectionError('unavailable')
    else:

        async def blocked(*args: Any) -> None:
            await asyncio.Event().wait()

        if failure == 'create_timeout':
            create.side_effect = blocked
        elif failure == 'close_timeout':
            redis.aclose.side_effect = blocked
        else:
            invalidate.side_effect = blocked
    monkeypatch.setattr(RedisUtil, 'create_redis_pool', create)
    monkeypatch.setattr(CurrentUserCacheUtil, 'invalidate', invalidate)
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', _ORIGINAL_INVALIDATE)
    async with env.sessions.begin() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))
    async with env.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'committed'
    if failure not in ('create', 'create_timeout'):
        redis.aclose.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_session_commit_survives_missing_greenlet_and_closes_coroutine(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, recwarn: pytest.WarningsRecorder
) -> None:
    engine = create_engine(cache_transactions.engine.url.set(drivername='sqlite'))
    create = AsyncMock()
    monkeypatch.setattr(RedisUtil, 'create_redis_pool', create)
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', _ORIGINAL_INVALIDATE)
    try:
        with CurrentUserCacheSession(bind=engine) as db:
            db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))
            db.commit()
            assert CurrentUserCacheSession._CHANGE_KEY not in db.info
        async with cache_transactions.sessions() as db:
            assert (await db.get(CacheUser, 1)).user_name == 'committed'
        create.assert_not_awaited()
        assert not [warning for warning in recwarn if issubclass(warning.category, RuntimeWarning)]
    finally:
        engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('stage', ['metadata', 'invalidate'])
async def test_listener_failure_does_not_change_committed_database_result(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, stage: str
) -> None:
    invalidate = AsyncMock(side_effect=RuntimeError('cache listener unavailable'))
    async with cache_transactions.sessions() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))
        with monkeypatch.context() as patch:
            if stage == 'metadata':
                patch.setattr(
                    db.sync_session, 'get_nested_transaction', Mock(side_effect=RuntimeError('invalid state'))
                )
            else:
                patch.setattr(CurrentUserCacheSession, '_invalidate_cache', invalidate)
            await db.commit()
        assert CurrentUserCacheSession._CHANGE_KEY not in db.info
    async with cache_transactions.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'committed'
    if stage == 'invalidate':
        invalidate.assert_awaited_once_with({1})
    assert cache_transactions.invalidations == []


@pytest.mark.asyncio
async def test_commit_invalidation_and_cleanup_support_python310(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delattr(asyncio, 'timeout', raising=False)
    redis = SimpleNamespace(aclose=AsyncMock())
    create = AsyncMock(return_value=redis)
    invalidate = AsyncMock(return_value=True)
    monkeypatch.setattr(RedisUtil, 'create_redis_pool', create)
    monkeypatch.setattr(CurrentUserCacheUtil, 'invalidate', invalidate)
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', _ORIGINAL_INVALIDATE)
    async with cache_transactions.sessions.begin() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))
    create.assert_awaited_once_with(log_enabled=False, log_start_enabled=False)
    invalidate.assert_awaited_once_with(redis, CurrentUserCacheUtil.namespace_for_bind(cache_transactions.engine), {1})
    redis.aclose.assert_awaited_once()
    async with cache_transactions.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'committed'


@pytest.mark.asyncio
async def test_unknown_namespace_does_not_invalidate_another_database(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    create = AsyncMock()
    monkeypatch.setattr(RedisUtil, 'create_redis_pool', create)
    monkeypatch.setattr(CurrentUserCacheUtil, 'namespace_for_bind', lambda bind: None)
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', _ORIGINAL_INVALIDATE)
    async with cache_transactions.sessions.begin() as db:
        await db.execute(update(CacheRole).values(role_name='changed'))
    create.assert_not_awaited()


@pytest.mark.asyncio
async def test_cancellation_closes_cache_client_and_preserves_commit(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    redis = SimpleNamespace(aclose=AsyncMock())
    monkeypatch.setattr(RedisUtil, 'create_redis_pool', AsyncMock(return_value=redis))
    monkeypatch.setattr(CurrentUserCacheUtil, 'invalidate', AsyncMock(side_effect=asyncio.CancelledError))
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', _ORIGINAL_INVALIDATE)
    async with cache_transactions.sessions() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))
        with pytest.raises(asyncio.CancelledError):
            await db.commit()
        assert CurrentUserCacheSession._CHANGE_KEY not in db.info
    redis.aclose.assert_awaited_once()
    async with cache_transactions.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'committed'


@pytest.mark.asyncio
@pytest.mark.parametrize('cancellation', ['scope', 'task_group', 'deadline'])
@pytest.mark.parametrize('stage', ['invalidate', 'close'])
async def test_anyio_cancellation_finishes_cache_cleanup_and_preserves_commit(  # noqa: PLR0915
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, cancellation: str, stage: str
) -> None:
    entered = anyio.Event()
    release_close = anyio.Event()
    closed = anyio.Event()
    cancelled = anyio.Event()
    cleanup_cancelled = anyio.Event()
    cancel_scope = None

    async def invalidate(*args: Any) -> None:
        if stage != 'invalidate':
            return
        entered.set()
        if cancellation == 'scope':
            cancel_scope.cancel()
        elif cancellation == 'deadline':
            cancel_scope.deadline = anyio.current_time() + 0.01
        await anyio.sleep_forever()

    async def close() -> None:
        if stage == 'close':
            entered.set()
            if cancellation == 'scope':
                cancel_scope.cancel()
            elif cancellation == 'deadline':
                cancel_scope.deadline = anyio.current_time()
            else:
                await release_close.wait()
        await anyio.lowlevel.checkpoint()
        closed.set()

    redis = SimpleNamespace(aclose=AsyncMock(side_effect=close))

    async def invalidate_cache(session: CurrentUserCacheSession, user_ids: set[int] | None) -> None:
        try:
            await _ORIGINAL_INVALIDATE(session, user_ids)
        except anyio.get_cancelled_exc_class():
            cleanup_cancelled.set()
            raise

    monkeypatch.setattr(RedisUtil, 'create_redis_pool', AsyncMock(return_value=redis))
    monkeypatch.setattr(CurrentUserCacheUtil, 'invalidate', AsyncMock(side_effect=invalidate))
    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', invalidate_cache)
    async with cache_transactions.sessions() as db:
        await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))

        async def commit() -> None:
            try:
                await db.commit()
            except anyio.get_cancelled_exc_class():
                cancelled.set()
                raise

        if cancellation == 'scope':
            with anyio.CancelScope() as cancel_scope:
                await commit()
            assert cancel_scope.cancelled_caught
        elif cancellation == 'task_group':
            async with anyio.create_task_group() as group:
                group.start_soon(commit)
                await entered.wait()
                group.cancel_scope.cancel()
                release_close.set()
        else:
            with pytest.raises(TimeoutError), anyio.fail_after(None) as cancel_scope:
                await commit()
        assert cancelled.is_set()
        assert cleanup_cancelled.is_set()
        assert closed.is_set()
        assert CurrentUserCacheSession._CHANGE_KEY not in db.info
    redis.aclose.assert_awaited_once()
    async with cache_transactions.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'committed'


@pytest.mark.asyncio
async def test_concurrent_commits_invalidate_each_user_without_shared_state(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    entered = asyncio.Event()
    release = asyncio.Event()
    invalidations = []

    async def invalidate(session: CurrentUserCacheSession, user_ids: set[int] | None) -> None:
        if user_ids == {1}:
            entered.set()
            await release.wait()
        invalidations.append(user_ids)

    monkeypatch.setattr(CurrentUserCacheSession, '_invalidate_cache', invalidate)

    async def mutate(user_id: int) -> None:
        async with cache_transactions.sessions.begin() as db:
            await db.execute(update(CacheUser).where(CacheUser.user_id == user_id).values(user_name=f'user-{user_id}'))

    first = asyncio.create_task(mutate(1))
    await entered.wait()
    await mutate(SECOND_USER_ID)
    release.set()
    await first
    assert invalidations == [{2}, {1}]


@pytest.mark.asyncio
async def test_orm_bulk_user_update_uses_primary_key_scope(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        await db.execute(update(CacheUser), [{'user_id': 1, 'user_name': 'changed'}])
    assert env.invalidations == [({1}, ['changed', 'second'])]


@pytest.mark.asyncio
async def test_core_bulk_update_cannot_assume_parameter_is_a_primary_key_filter(
    cache_transactions: SimpleNamespace,
) -> None:
    env = cache_transactions
    async with env.sessions.begin() as db:
        await db.execute(
            update(CacheUser.__table__).where(CacheUser.user_id == 1), [{'user_id': 3, 'user_name': 'changed'}]
        )
    assert env.invalidations[0][0] is None


@pytest.mark.asyncio
@pytest.mark.parametrize('assignment', ['bind', 'expression', 'ordered', 'parameters', 'orm_bulk'])
async def test_user_relation_move_invalidates_old_and_new_users(
    cache_transactions: SimpleNamespace, assignment: str
) -> None:
    env = cache_transactions
    relation = CacheUserRole.__table__
    async with env.engine.begin() as connection:
        await connection.execute(insert(relation).values(user_id=1, role_id=1))
    statement = update(relation).where(relation.c.user_id == 1)
    parameters = None
    if assignment == 'bind':
        statement = statement.values(user_id=bindparam('next_id'))
        parameters = {'next_id': SECOND_USER_ID}
    elif assignment == 'expression':
        statement = statement.values(user_id=relation.c.user_id + 1)
    elif assignment == 'ordered':
        statement = statement.ordered_values((relation.c.user_id, bindparam('next_id')))
        parameters = {'next_id': SECOND_USER_ID}
    elif assignment == 'parameters':
        statement = statement.values(role_id=1)
        parameters = {'user_id': SECOND_USER_ID}
    else:
        statement = update(CacheUserRole).values(user_id=bindparam('next_id'))
        parameters = [{'user_id': 1, 'role_id': 1, 'next_id': SECOND_USER_ID}]
    async with env.sessions.begin() as db:
        await db.execute(statement, parameters)
    assert env.invalidations == [(None, ['first', 'second'])]
    async with env.sessions() as db:
        assert await db.get(CacheUserRole, (1, 1)) is None
        assert await db.get(CacheUserRole, (SECOND_USER_ID, 1)) is not None


@pytest.mark.asyncio
async def test_core_tuple_parameters_commit_with_precise_user_scope(cache_transactions: SimpleNamespace) -> None:
    env = cache_transactions
    users = CacheUser.__table__
    statement = update(users).where(users.c.user_id == bindparam('target_id')).values(user_name=bindparam('next_name'))
    parameters = ({'target_id': 1, 'next_name': 'changed-first'}, {'target_id': 2, 'next_name': 'changed-second'})
    async with env.sessions.begin() as db:
        await db.execute(statement, parameters)
    assert env.invalidations == [({1, 2}, ['changed-first', 'changed-second'])]


@pytest.mark.asyncio
async def test_scope_analysis_failure_preserves_sql_result_and_invalidates_globally(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = cache_transactions

    def failed_scope(*args: Any) -> None:
        raise ValueError('unexpected parameter format')

    monkeypatch.setattr(CurrentUserCacheSession, '_where_user_ids', failed_scope)
    async with env.sessions.begin() as db:
        result = await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='committed'))
        assert result.rowcount == 1
    assert env.invalidations == [(None, ['committed', 'second'])]


@pytest.mark.asyncio
async def test_sql_execution_failure_still_propagates_before_scope_analysis(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = cache_transactions

    def unexpected_scope(*args: Any) -> None:
        pytest.fail('SQL执行失败后不应分析缓存变更范围')

    monkeypatch.setattr(CurrentUserCacheSession, '_where_user_ids', unexpected_scope)
    with pytest.raises(IntegrityError):
        async with env.sessions.begin() as db:
            await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='second'))
    assert env.invalidations == []
    async with env.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'first'


@pytest.mark.asyncio
async def test_scope_analysis_cancellation_is_not_swallowed(
    cache_transactions: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = cache_transactions

    def cancelled_scope(*args: Any) -> None:
        raise asyncio.CancelledError

    monkeypatch.setattr(CurrentUserCacheSession, '_where_user_ids', cancelled_scope)
    with pytest.raises(asyncio.CancelledError):
        async with env.sessions.begin() as db:
            await db.execute(update(CacheUser).where(CacheUser.user_id == 1).values(user_name='cancelled'))
    assert env.invalidations == []
    async with env.sessions() as db:
        assert (await db.get(CacheUser, 1)).user_name == 'first'
