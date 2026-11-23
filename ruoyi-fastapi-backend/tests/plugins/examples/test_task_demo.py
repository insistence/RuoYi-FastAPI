import asyncio
from collections.abc import AsyncIterator
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
import pytest_asyncio
from fastapi import status
from sqlalchemy import func, select, text
from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.sql.elements import TextClause

from config.env import DataBaseConfig
from plugins.core.discovery.scanner import PluginScanner
from plugins.core.lifecycle.migration import (
    PluginMigrationHistoryRecord,
    PluginMigrationHistoryStore,
    PluginMigrationRunner,
)
from plugins.core.runtime.health import PluginHealthContext
from plugins.core.sdk import PluginHostContext, PluginRequestContext
from plugins.examples.python import task_demo
from plugins.examples.python.task_demo import create_plugin, health, service
from plugins.examples.python.task_demo.models import TaskInput, tasks

PLUGIN_ROOT = Path(__file__).resolve().parents[3] / 'plugins' / 'examples' / 'python' / 'task_demo'


@pytest.fixture(autouse=True)
def isolated_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    每个用例恢复插件自身的工厂引用，不共享测试连接池。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    """
    monkeypatch.setattr(task_demo._runtime, 'session_factory', None)


@pytest_asyncio.fixture
async def task_host(tmp_path: Path) -> AsyncIterator[PluginHostContext]:
    """
    仅适配迁移中的时间类型后在 SQLite 执行，不代表 PostgreSQL 方言实测。

    :param tmp_path: pytest 为当前用例创建的临时目录
    :yield: ``PluginHostContext`` 实例
    """
    engine = create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "tasks.db"}')
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with engine.begin() as connection:
            for name in ('001_init.sql', '002_priority.sql'):
                sql = (PLUGIN_ROOT / 'migrations' / 'postgresql' / name).read_text('utf-8')
                await connection.execute(text(sql.replace('TIMESTAMP(3) WITH TIME ZONE', 'DATETIME')))
        yield PluginHostContext(plugin_id='task_demo', resource_root=PLUGIN_ROOT, session_factory=sessions)
    finally:
        await engine.dispose()


def _context(host: PluginHostContext, permissions: frozenset[str] = frozenset({'*:*:*'})) -> PluginRequestContext:
    """
    构造测试专用可信身份；生产身份由宿主网关注入。

    :param host: 宿主注入的能力集合；不保存当前用户或请求数据库会话
    :param permissions: 当前调用允许使用的权限
    :return: 测试专用可信身份
    """
    return PluginRequestContext(host=host, user=SimpleNamespace(user_id=1), permissions=permissions)


def _client(host: PluginHostContext, permissions: frozenset[str] = frozenset({'*:*:*'})) -> httpx.AsyncClient:
    """
    将可信上下文注入插件子应用，使用真实 SDK HTTP 适配器检查权限与输入。

    :param host: 宿主注入的能力集合；不保存当前用户或请求数据库会话
    :param permissions: 当前调用允许使用的权限
    :return: ``httpx.AsyncClient`` 实例
    """
    child = create_plugin(host).app_factory(host)

    async def authenticated_app(scope: dict[str, Any], receive: Any, send: Any) -> None:
        """
        为插件请求注入已认证上下文后调用下游应用。

        :param scope: 当前操作使用的作用域
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        scope.setdefault('state', {})['plugin_context'] = _context(host, permissions)
        await child(scope, receive, send)

    return httpx.AsyncClient(transport=httpx.ASGITransport(app=authenticated_app), base_url='http://task.test')


@pytest.mark.asyncio
async def test_crud_is_persistent_across_new_app_and_connection_pool(task_host: PluginHostContext) -> None:
    """任务随事务持久化，在重建子应用和连接池后仍可查询、更新与删除。"""
    async with _client(task_host) as client:
        info = await client.get('/api/info')
        assert info.json() == {'pluginId': 'task_demo', 'version': '1.1.0', 'canWrite': True}
        response = await client.post('/api/tasks', json={'title': '  第一个任务  ', 'description': '保留说明'})
        assert response.status_code == status.HTTP_201_CREATED
        created = response.json()
        assert created['title'] == '第一个任务'
        assert created['status'] == 'todo'
        assert created['priority'] == 'normal'
        assert created['createdAt'].endswith('Z')
        task_id = created['id']

    original_engine = task_host.session_factory.kw['bind']
    await original_engine.dispose()
    restarted_engine = create_async_engine(original_engine.url)
    restarted_host = replace(task_host, session_factory=async_sessionmaker(restarted_engine, expire_on_commit=False))
    try:
        async with _client(restarted_host) as client:
            assert (await client.get(f'/api/tasks/{task_id}')).json() == created
            response = await client.put(
                f'/api/tasks/{task_id}',
                json={'title': '已完成任务', 'description': '更新说明', 'status': 'done', 'priority': 'high'},
            )
            assert response.status_code == status.HTTP_200_OK
            updated = response.json()
            assert updated['createdAt'] == created['createdAt']
            assert updated['updatedAt'] >= created['updatedAt']
            assert updated['priority'] == 'high'
            assert updated['status'] == 'done'
            assert (await client.delete(f'/api/tasks/{task_id}')).json() == {'deleted': True}
            assert (await client.get(f'/api/tasks/{task_id}')).status_code == status.HTTP_404_NOT_FOUND
            assert (
                await client.put(f'/api/tasks/{task_id}', json={'title': '消失的任务'})
            ).status_code == status.HTTP_404_NOT_FOUND
            assert (await client.delete(f'/api/tasks/{task_id}')).status_code == status.HTTP_404_NOT_FOUND
            assert (await client.get('/api/tasks')).json()['total'] == 0
    finally:
        await restarted_engine.dispose()


@pytest.mark.asyncio
async def test_permissions_keep_reads_and_writes_independent(task_host: PluginHostContext) -> None:
    """只读用户无法写入，仅写用户不能读取；权限校验先于无效请求体解析。"""
    async with _client(task_host, frozenset({'task_demo:view'})) as reader:
        assert (await reader.get('/api/info')).json()['canWrite'] is False
        assert (await reader.get('/api/tasks')).json()['canWrite'] is False
        assert (await reader.post('/api/tasks', content='broken')).status_code == status.HTTP_403_FORBIDDEN
    async with _client(task_host, frozenset({'task_demo:write'})) as writer:
        response = await writer.post('/api/tasks', json={'title': '仅写身份创建'})
        assert response.status_code == status.HTTP_201_CREATED
        task_id = response.json()['id']
        assert (await writer.get('/api/info')).status_code == status.HTTP_403_FORBIDDEN
        assert (await writer.get('/api/tasks')).status_code == status.HTTP_403_FORBIDDEN
        assert (await writer.get(f'/api/tasks/{task_id}')).status_code == status.HTTP_403_FORBIDDEN
        assert (
            await writer.put(f'/api/tasks/{task_id}', json={'title': '仅写身份更新'})
        ).status_code == status.HTTP_200_OK
    async with _client(task_host, frozenset({'task_demo:view'})) as reader:
        assert (await reader.get(f'/api/tasks/{task_id}')).status_code == status.HTTP_200_OK
        assert (
            await reader.put(f'/api/tasks/{task_id}', json={'title': '禁止更新'})
        ).status_code == status.HTTP_403_FORBIDDEN
        assert (await reader.delete(f'/api/tasks/{task_id}')).status_code == status.HTTP_403_FORBIDDEN
        assert (await reader.get(f'/api/tasks/{task_id}')).json()['title'] == '仅写身份更新'
    async with _client(task_host, frozenset()) as anonymous:
        assert (await anonymous.get('/api/info')).status_code == status.HTTP_403_FORBIDDEN
    app = create_plugin(task_host).app_factory(task_host)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://task.test') as client:
        assert (await client.get('/api/info')).status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'payload',
    [
        {},
        {'title': ' \t\n'},
        {'title': 'a' * 121},
        {'title': '有效', 'description': 'b' * 501},
        {'title': '有效', 'status': 'pending'},
        {'title': '有效', 'priority': 'urgent'},
        {'title': '有效', 'owner': 'admin'},
        {'title': '有效', 'description': '\x00'},
        {'title': None},
    ],
)
async def test_create_and_update_reject_invalid_fields(task_host: PluginHostContext, payload: dict[str, Any]) -> None:
    """创建与更新共用输入边界，错误请求不产生数据写入。"""
    async with _client(task_host) as client:
        assert (await client.post('/api/tasks', json=payload)).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        assert (
            await client.put(f'/api/tasks/{"0" * 32}', json=payload)
        ).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        assert (await client.get('/api/tasks')).json()['total'] == 0


@pytest.mark.asyncio
async def test_list_has_stable_pagination_filters_and_bridge_size_bound(task_host: PluginHostContext) -> None:
    """分页无重复且按状态筛选，最大 Unicode 数据页保持在 64 KiB 桥上限内。"""
    context = _context(task_host)
    total_tasks = 23
    completed_tasks = 3
    page_size = 20
    for index in range(total_tasks):
        await service.create_task(
            context,
            TaskInput(
                title='😀' * 120, description='😀' * 500, status='done' if index < completed_tasks else 'todo'
            ).model_dump(),
        )
    async with _client(task_host) as client:
        first = await client.get('/api/tasks?page=1&pageSize=20')
        second = await client.get('/api/tasks?page=2&pageSize=20')
        assert first.json()['total'] == total_tasks
        assert len(first.json()['items']) == page_size
        assert len(second.json()['items']) == total_tasks - page_size
        assert not {task['id'] for task in first.json()['items']} & {task['id'] for task in second.json()['items']}
        assert len(first.content) < 64 * 1024
        filtered = (await client.get('/api/tasks?status=done')).json()
        assert filtered['total'] == completed_tasks
        assert all(task['status'] == 'done' for task in filtered['items'])
        assert (await client.get('/api/tasks?page=99')).json()['items'] == []
        for query in ('page=0', 'pageSize=21', 'pageSize=0', 'status=bad', 'page=x', 'page=1&page=2', 'extra=x'):
            assert (await client.get(f'/api/tasks?{query}')).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        assert (await client.get('/api/tasks/not-an-id')).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


@pytest.mark.asyncio
async def test_exception_after_insert_rolls_back(task_host: PluginHostContext, monkeypatch: pytest.MonkeyPatch) -> None:
    """即使 SQL 已写入，响应构造失败也会回滚该次事务。"""

    def broken_payload(row: Any) -> dict[str, Any]:
        """
        模拟此操作抛出 RuntimeError 的情形。

        :param row: 当前读取或写入的数据行
        :raises RuntimeError: 模拟构造响应失败
        """
        raise RuntimeError('response construction failed')

    monkeypatch.setattr(service, '_task_payload', broken_payload)
    with pytest.raises(RuntimeError, match='response construction failed'):
        await service.create_task(_context(task_host), TaskInput(title='必须回滚').model_dump())
    async with task_host.session_factory() as db:
        assert await db.scalar(select(func.count()).select_from(tasks)) == 0


@pytest.mark.asyncio
async def test_cancel_after_insert_rolls_back_and_closes_owned_session(task_host: PluginHostContext) -> None:
    """取消发生在数据库写入之后时，显式事务回滚且下次写入仍可成功。"""
    inserted = asyncio.Event()
    closed = asyncio.Event()

    class PausedSession(AsyncSession):
        """在执行 SQL 时暂停以控制测试并发顺序。"""

        async def execute(self, statement: Any, *args: Any, **kwargs: Any) -> Any:
            """
            按测试场景处理数据库查询并提供结果。

            :param statement: 即将执行的数据库语句
            :param args: 传给被调用对象的位置参数
            :param kwargs: 传给被调用对象的关键字参数
            :return: 执行当前操作得到的结果
            """
            result = await super().execute(statement, *args, **kwargs)
            if getattr(statement, 'is_insert', False):
                inserted.set()
                await asyncio.Event().wait()
            return result

        async def close(self) -> None:
            """记录测试资源的关闭过程。"""
            await super().close()
            closed.set()

    paused_host = replace(
        task_host,
        session_factory=async_sessionmaker(task_host.session_factory.kw['bind'], class_=PausedSession),
    )
    operation = asyncio.create_task(
        service.create_task(_context(paused_host), TaskInput(title='取消任务').model_dump())
    )
    await asyncio.wait_for(inserted.wait(), timeout=5)
    operation.cancel()
    with pytest.raises(asyncio.CancelledError):
        await operation
    await asyncio.wait_for(closed.wait(), timeout=5)
    async with task_host.session_factory() as db:
        assert await db.scalar(select(func.count()).select_from(tasks)) == 0
    created = await service.create_task(_context(task_host), TaskInput(title='回滚后新任务').model_dump())
    assert created['title'] == '回滚后新任务'


class MemoryMigrationHistory(PluginMigrationHistoryStore):
    """
    保留各次调用结果的测试历史存储，数据库 DDL 仍在真实 SQLite 执行。

    :ivar records: 当前测试保存的记录
    :ivar successes: 成功完成的操作记录
    """

    def __init__(self) -> None:
        """初始化测试夹具的 ``records``, ``successes``。"""
        self.records: dict[tuple[str, str], PluginMigrationHistoryRecord] = {}
        self.successes: list[tuple[str, str, str]] = []

    async def get_record(
        self, query_db: Any, plugin_id: str, migration_path: str
    ) -> PluginMigrationHistoryRecord | None:
        """
        将存储值解码为交互记录。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param migration_path: migration 相对路径
        :return: 与交互标识对应的记录
        """
        return self.records.get((plugin_id, migration_path))

    async def record_running(
        self, query_db: Any, plugin_id: str, migration_path: str, checksum: str, version: str, statement_count: int
    ) -> None:
        """
        保存正在运行的迁移记录。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param migration_path: migration 相对路径
        :param checksum: 校验内容完整性使用的校验和
        :param version: 当前记录的版本
        :param statement_count: SQL 语句数量
        """
        self.records[plugin_id, migration_path] = PluginMigrationHistoryRecord(checksum=checksum, status='running')

    async def record_success(
        self, query_db: Any, plugin_id: str, migration_path: str, checksum: str, version: str, statement_count: int
    ) -> None:
        """
        保存成功完成的迁移记录。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param migration_path: migration 相对路径
        :param checksum: 校验内容完整性使用的校验和
        :param version: 当前记录的版本
        :param statement_count: SQL 语句数量
        """
        self.records[plugin_id, migration_path] = PluginMigrationHistoryRecord(checksum=checksum)
        self.successes.append((plugin_id, migration_path, version))

    async def record_failure(
        self,
        query_db: Any,
        plugin_id: str,
        migration_path: str,
        checksum: str,
        version: str,
        statement_count: int,
        error_message: str,
    ) -> None:
        """
        保存迁移失败的测试记录。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param migration_path: migration 相对路径
        :param checksum: 校验内容完整性使用的校验和
        :param version: 当前记录的版本
        :param statement_count: SQL 语句数量
        :param error_message: 记录到结果或审计日志中的错误详情
        """
        self.records[plugin_id, migration_path] = PluginMigrationHistoryRecord(
            checksum=checksum, status='failed', error_message=error_message
        )


class SqliteMigrationSession(AsyncSession):
    """仅在 SQL 执行边界适配 SQLite 时间类型，runner 校验的原始文件内容保持不变。"""

    async def execute(self, statement: Any, *args: Any, **kwargs: Any) -> Any:
        """
        按测试场景处理数据库查询并提供结果。

        :param statement: 即将执行的数据库语句
        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 底层模拟会话的查询结果
        """
        if isinstance(statement, TextClause) and 'TIMESTAMP(3) WITH TIME ZONE' in statement.text:
            statement = text(statement.text.replace('TIMESTAMP(3) WITH TIME ZONE', 'DATETIME'))
        return await super().execute(statement, *args, **kwargs)


def test_time_columns_compile_to_repository_database_contract() -> None:
    """基础类型按真实数据库方言编译为宿主要求的毫秒 UTC 存储类型。"""
    for name in ('created_at', 'updated_at'):
        column = tasks.c[name]
        assert column.type.compile(dialect=mysql.dialect()) == 'DATETIME(3)'
        assert column.type.compile(dialect=postgresql.dialect()) == 'TIMESTAMP(3) WITH TIME ZONE'


def _unavailable_sessions() -> None:
    """
    在调用时报告预期的测试失败：query_db 应优先于插件保存的会话工厂。

    :raises AssertionError: query_db 应优先于插件保存的会话工厂
    """
    raise AssertionError('query_db 应优先于插件保存的会话工厂')


@pytest.mark.asyncio
async def test_migration_upgrade_preserves_old_rows_and_history_skips_replay(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """通过实际 runner 在 SQLite 适配时间类型后执行迁移，覆盖旧行保留和历史幂等。"""
    monkeypatch.setattr(DataBaseConfig.default_source, 'db_type', 'postgresql')
    current = PluginScanner(PLUGIN_ROOT.parent).load_manifest(PLUGIN_ROOT / 'plugin.yaml')
    legacy_manifest = current.manifest.model_copy(deep=True)
    legacy_manifest.version = '1.0.0'
    legacy_manifest.backend.migrations = [path for path in legacy_manifest.backend.migrations if '/001_' in path]
    legacy = replace(current, manifest=legacy_manifest)
    engine = create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "upgrade.db"}')
    sessions = async_sessionmaker(engine, class_=SqliteMigrationSession, expire_on_commit=False)
    history = MemoryMigrationHistory()
    health_context = PluginHealthContext(plugin_id='task_demo', discovered_plugin=current)
    try:
        assert (await health(health_context))['status'] == 'unavailable'
        host = PluginHostContext(plugin_id='task_demo', resource_root=PLUGIN_ROOT, session_factory=sessions)
        create_plugin(host)
        assert (await health(health_context))['status'] == 'unhealthy'
        async with sessions() as db:
            assert (await health(replace(health_context, query_db=db)))['ok'] is False
            await db.rollback()
            original = await PluginMigrationRunner(legacy, history, manage_execution_transaction=True).run(db)
            assert len(original) == 1 and not original[0].skipped
            await db.execute(
                text(
                    'INSERT INTO ruoyi_plugin_task_demo '
                    '(id, title, description, status, created_at, updated_at) '
                    "VALUES (:id, '旧任务', '保留描述', 'done', '2026-01-01 00:00:00', '2026-01-02 00:00:00')"
                ),
                {'id': 'a' * 32},
            )
            await db.commit()
            assert (await health(health_context))['ok'] is False
            assert (await health(replace(health_context, query_db=db)))['ok'] is False
            await db.rollback()
            upgrade = await PluginMigrationRunner(current, history, manage_execution_transaction=True).run(db)
            assert [result.skipped for result in upgrade] == [True, False]
            assert (await health(replace(health_context, query_db=db)))['ok'] is True
            row = (await db.execute(select(tasks))).mappings().one()
            assert (row['title'], row['description'], row['status'], row['priority']) == (
                '旧任务',
                '保留描述',
                'done',
                'normal',
            )
            assert row['created_at'].isoformat() == '2026-01-01T00:00:00+00:00'
            repeat = await PluginMigrationRunner(current, history, manage_execution_transaction=True).run(db)
            assert all(result.skipped for result in repeat)
            expected_migrations = 2
            assert len(history.successes) == expected_migrations
        assert (await health(health_context))['ok'] is True

        monkeypatch.setattr(task_demo._runtime, 'session_factory', _unavailable_sessions)
        async with sessions() as db:
            assert (await health(replace(health_context, query_db=db)))['ok'] is True
        async with _client(host) as client:
            legacy_task = (await client.get(f'/api/tasks/{"a" * 32}')).json()
            assert legacy_task['priority'] == 'normal'
            assert legacy_task['title'] == '旧任务'
            assert legacy_task['createdAt'] == '2026-01-01T00:00:00.000Z'
    finally:
        await engine.dispose()
