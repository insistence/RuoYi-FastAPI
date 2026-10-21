from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from config.database import Base
from exceptions.exception import ServiceException
from module_admin.dao.dept_dao import DeptDao
from module_admin.entity.do.dept_do import SysDept
from module_admin.entity.vo.dept_vo import DeptModel, DeptSortModel
from module_admin.service.dept_service import DeptService


async def _create_dept_table() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')

    @event.listens_for(engine.sync_engine, 'connect')
    def register_find_in_set(connection: Any, _record: Any) -> None:
        connection.create_function('find_in_set', 2, lambda value, values: int(str(value) in (values or '').split(',')))

    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all, tables=[SysDept.__table__])
    return engine, session_maker


def test_parse_dept_sort_items_preserves_corresponding_order_values() -> None:
    result = DeptService.parse_dept_sort_items(DeptSortModel(deptIds='101, 102', orderNums='3, 1'))

    assert result == [
        {'dept_id': 101, 'order_num': 3},
        {'dept_id': 102, 'order_num': 1},
    ]


@pytest.mark.parametrize(
    ('dept_ids', 'order_nums'),
    [
        ('101,102', '1'),
        ('101,101', '1,2'),
        ('101,invalid', '1,2'),
        ('101,102', '1,-1'),
        ('', ''),
    ],
)
def test_parse_dept_sort_items_rejects_invalid_parameters(dept_ids: str, order_nums: str) -> None:
    with pytest.raises(ServiceException) as exc_info:
        DeptService.parse_dept_sort_items(DeptSortModel(deptIds=dept_ids, orderNums=order_nums))

    assert exc_info.value.message == '部门排序参数不正确'


@pytest.mark.asyncio
async def test_update_dept_sort_updates_all_rows_in_one_transaction() -> None:
    engine, session_maker = await _create_dept_table()
    try:
        async with session_maker() as session:
            session.add_all(
                [
                    SysDept(dept_id=101, dept_name='研发部门', order_num=1),
                    SysDept(dept_id=102, dept_name='测试部门', order_num=2),
                ]
            )
            await session.commit()

            result = await DeptService.update_dept_sort_services(
                session,
                DeptSortModel(deptIds='101,102', orderNums='5,4'),
            )
            rows = (await session.execute(select(SysDept.dept_id, SysDept.order_num).order_by(SysDept.dept_id))).all()

        assert result.is_success is True
        assert rows == [(101, 5), (102, 4)]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_update_dept_sort_rolls_back_and_wraps_database_error() -> None:
    query_db = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())

    with (
        patch.object(DeptDao, 'update_dept_sort_dao', AsyncMock(side_effect=RuntimeError('database error'))),
        pytest.raises(ServiceException) as exc_info,
    ):
        await DeptService.update_dept_sort_services(
            query_db,
            DeptSortModel(deptIds='101', orderNums='2'),
        )

    assert exc_info.value.message == '保存排序异常，请联系管理员'
    query_db.commit.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


async def _seed_dept_tree(session: AsyncSession) -> None:
    session.add_all(
        [
            SysDept(dept_id=100, parent_id=0, ancestors='0', dept_name='总部门'),
            SysDept(dept_id=101, parent_id=100, ancestors='0,100', dept_name='研发部门'),
            SysDept(dept_id=102, parent_id=101, ancestors='0,100,101', dept_name='研发小组'),
            SysDept(dept_id=103, parent_id=102, ancestors='0,100,101,102', dept_name='研发子组'),
            SysDept(dept_id=200, parent_id=100, ancestors='0,100', dept_name='测试部门'),
            SysDept(dept_id=201, parent_id=100, ancestors='0,100', dept_name='已删除部门', del_flag='2'),
        ]
    )
    await session.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize('parent_id', [101, 102, 103, 201, 999])
async def test_edit_dept_rejects_cycles_and_invalid_parents_without_writing(parent_id: int) -> None:
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            query = select(SysDept.dept_id, SysDept.parent_id, SysDept.ancestors).order_by(SysDept.dept_id)
            before = (await session.execute(query)).all()
            with pytest.raises(ServiceException):
                await DeptService.edit_dept_services(
                    session, DeptModel(deptId=101, parentId=parent_id, deptName='研发部门', orderNum=1)
                )
            assert (await session.execute(query)).all() == before
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('parent_id', [0, 200])
async def test_edit_dept_moves_whole_subtree_and_rebuilds_ancestors(parent_id: int) -> None:
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            result = await DeptService.edit_dept_services(
                session,
                DeptModel(deptId=101, parentId=parent_id, deptName='研发部门', ancestors='forged', orderNum=1),
            )
            ancestor_prefix = '0' if parent_id == 0 else '0,100,200'
            rows = (
                await session.execute(
                    select(SysDept.dept_id, SysDept.parent_id, SysDept.ancestors)
                    .where(SysDept.dept_id.in_([101, 102, 103]))
                    .order_by(SysDept.dept_id)
                )
            ).all()
            assert result.is_success
            assert rows == [
                (101, parent_id, ancestor_prefix),
                (102, 101, f'{ancestor_prefix},101'),
                (103, 102, f'{ancestor_prefix},101,102'),
            ]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('dept_id', [100, 101])
async def test_edit_dept_preserves_omitted_parent_and_ignores_supplied_ancestors(dept_id: int) -> None:
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            query = select(SysDept.parent_id, SysDept.ancestors).where(SysDept.dept_id == dept_id)
            before = (await session.execute(query)).one()
            await DeptService.edit_dept_services(
                session, DeptModel(deptId=dept_id, deptName='新名称', ancestors='0,999', orderNum=1)
            )
            assert (await session.execute(query)).one() == before
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('parent_id', [None, 201, 999])
async def test_add_dept_rejects_missing_or_deleted_parent(parent_id: int | None) -> None:
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            with pytest.raises(ServiceException) as exc_info:
                await DeptService.add_dept_services(
                    session, DeptModel(deptId=300, parentId=parent_id, deptName='新部门', orderNum=1)
                )
            assert exc_info.value.message == '上级部门不存在'
            assert await session.get(SysDept, 300) is None
    finally:
        await engine.dispose()
