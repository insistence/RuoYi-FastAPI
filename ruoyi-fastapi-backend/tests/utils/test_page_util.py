import pytest
from sqlalchemy import literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from module_admin.entity.do.dept_do import SysDept
from module_admin.entity.do.user_do import SysUser
from utils.page_util import PageUtil


@pytest.mark.asyncio
async def test_column_projection_keeps_keys_and_nulls_across_pages() -> None:
    """投影查询在列表和分页中都应保留列名与空值，超出最后一页仍返回总数。"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    records = union_all(
        select(literal(1).label('file_id'), literal(None).label('file_name')),
        select(literal(2), literal('文件')),
    ).subquery()
    query = select(records.c.file_id, records.c.file_name).order_by(records.c.file_id)
    expected = [{'fileId': 1, 'fileName': None}, {'fileId': 2, 'fileName': '文件'}]
    try:
        async with AsyncSession(engine) as db:
            assert await PageUtil.paginate(db, query, 1, 1, as_mappings=True) == expected
            for page_num in (1, 2, 3):
                page = await PageUtil.paginate(db, query, page_num, 1, True, as_mappings=True)
                assert page.rows == expected[page_num - 1 : page_num]
                assert page.total == len(expected)
                assert page.has_next == (page_num < len(expected))

            single_column = select(records.c.file_id).order_by(records.c.file_id)
            assert await PageUtil.paginate(db, single_column, 1, 2, as_mappings=True) == [{'fileId': 1}, {'fileId': 2}]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_joined_entities_keep_missing_department_in_both_page_modes() -> None:
    """外连接缺少部门时，完整结果和分页结果都应保留用户和空部门。"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SysUser.get_table().create)
            await conn.run_sync(SysDept.get_table().create)
        async with AsyncSession(engine) as db:
            db.add(SysUser(user_id=1, user_name='reader', nick_name='Reader'))
            await db.commit()
            query = select(SysUser, SysDept).outerjoin(SysDept, SysUser.dept_id == SysDept.dept_id)
            rows = await PageUtil.paginate(db, query, 1, 10, False)
            page = await PageUtil.paginate(db, query, 1, 10, True)
            assert isinstance(rows, list)
            assert page.rows == rows
            user, dept = rows[0]
            assert user is not None and user['userName'] == 'reader'
            assert dept is None
    finally:
        await engine.dispose()
