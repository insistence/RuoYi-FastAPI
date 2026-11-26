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
from tests.module_admin.service.helpers import make_query_db


def test_dept_tree_keeps_unnamed_root_with_its_children() -> None:
    """部门名称和父编号为空时，树仍应保留该部门及其子节点。"""
    root = SysDept(dept_id=10, dept_name=None, parent_id=None)
    child = SysDept(dept_id=11, dept_name='研发', parent_id=10)
    (tree,) = DeptService.list_to_tree([child, root])
    assert (tree.id, tree.label, tree.parent_id) == (10, '部门（10）', 0)
    assert tree.children is not None
    assert [node.id for node in tree.children] == [11]


async def _create_dept_table() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """
    在内存数据库中准备部门表。

    :return: 依次为 ``engine``、``session_maker`` 的元组
    """
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')

    @event.listens_for(engine.sync_engine, 'connect')
    def register_find_in_set(connection: Any, _record: Any) -> None:
        """
        为 SQLite 测试连接注册集合成员查找函数。

        :param connection: 当前操作使用的连接
        :param _record: 回调接收的记录
        """
        connection.create_function('find_in_set', 2, lambda value, values: int(str(value) in (values or '').split(',')))

    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all, tables=[SysDept.get_table()])
    return engine, session_maker


def test_parse_dept_sort_items_preserves_corresponding_order_values() -> None:
    """解析部门排序时保留各部门对应的顺序值。"""
    result = DeptService.parse_dept_sort_items(DeptSortModel(dept_ids='101, 102', order_nums='3, 1'))

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
    """部门排序拒绝无效参数。"""
    with pytest.raises(ServiceException) as exc_info:
        DeptService.parse_dept_sort_items(DeptSortModel(dept_ids=dept_ids, order_nums=order_nums))

    assert exc_info.value.message == '部门排序参数不正确'


@pytest.mark.asyncio
async def test_update_dept_sort_updates_all_rows_in_one_transaction() -> None:
    """在同一事务中更新全部部门排序。"""
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
                DeptSortModel(dept_ids='101,102', order_nums='5,4'),
            )
            rows = (await session.execute(select(SysDept.dept_id, SysDept.order_num).order_by(SysDept.dept_id))).all()

        assert result.is_success is True
        assert rows == [(101, 5), (102, 4)]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_update_dept_sort_rolls_back_and_wraps_database_error() -> None:
    """部门排序遇到数据库错误时回滚并转换异常。"""
    query_db = make_query_db()

    with (
        patch.object(DeptDao, 'update_dept_sort_dao', AsyncMock(side_effect=RuntimeError('database error'))),
        pytest.raises(ServiceException) as exc_info,
    ):
        await DeptService.update_dept_sort_services(
            query_db,
            DeptSortModel(dept_ids='101', order_nums='2'),
        )

    assert exc_info.value.message == '保存排序异常，请联系管理员'
    query_db.commit.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


async def _seed_dept_tree(session: AsyncSession) -> None:
    """
    写入供层级查询使用的部门测试数据。

    :param session: 当前操作共用的会话
    """
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
    """编辑部门时拒绝循环关系或无效上级且不写库。"""
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            query = select(SysDept.dept_id, SysDept.parent_id, SysDept.ancestors).order_by(SysDept.dept_id)
            before = (await session.execute(query)).all()
            with pytest.raises(ServiceException):
                await DeptService.edit_dept_services(
                    session, DeptModel(dept_id=101, parent_id=parent_id, dept_name='研发部门', order_num=1)
                )
            assert (await session.execute(query)).all() == before
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('parent_id', [0, 200])
async def test_edit_dept_moves_whole_subtree_and_rebuilds_ancestors(parent_id: int) -> None:
    """移动整个部门子树并重建祖先关系。"""
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            result = await DeptService.edit_dept_services(
                session,
                DeptModel(dept_id=101, parent_id=parent_id, dept_name='研发部门', ancestors='forged', order_num=1),
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
    """编辑部门时保留省略的上级并忽略外部提供的祖先。"""
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            query = select(SysDept.parent_id, SysDept.ancestors).where(SysDept.dept_id == dept_id)
            before = (await session.execute(query)).one()
            await DeptService.edit_dept_services(
                session, DeptModel(dept_id=dept_id, dept_name='新名称', ancestors='0,999', order_num=1)
            )
            assert (await session.execute(query)).one() == before
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('parent_id', [None, 201, 999])
async def test_add_dept_rejects_missing_or_deleted_parent(parent_id: int | None) -> None:
    """上级缺失或已删除时拒绝新增部门。"""
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            with pytest.raises(ServiceException) as exc_info:
                await DeptService.add_dept_services(
                    session, DeptModel(dept_id=300, parent_id=parent_id, dept_name='新部门', order_num=1)
                )
            assert exc_info.value.message == '上级部门不存在'
            assert await session.get(SysDept, 300) is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_moving_subtree_with_missing_ancestor_path_rolls_back() -> None:
    """祖级列表缺失时，移动部门应回滚，保留原有父子关系。"""
    engine, sessions = await _create_dept_table()
    try:
        async with sessions() as session:
            await _seed_dept_tree(session)
            dept_id = 101
            dept = await session.get(SysDept, dept_id)
            assert dept is not None
            previous_parent = dept.parent_id
            dept.ancestors = ''
            await session.commit()
            with pytest.raises(ValueError, match='部门祖级列表不完整'):
                await DeptService.edit_dept_services(
                    session, DeptModel(dept_id=dept_id, parent_id=200, dept_name='研发部门')
                )
            assert await session.scalar(select(SysDept.parent_id).where(SysDept.dept_id == dept_id)) == previous_parent
    finally:
        await engine.dispose()
