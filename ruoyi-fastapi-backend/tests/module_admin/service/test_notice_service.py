from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from config.database import Base
from exceptions.exception import ServiceException
from module_admin.dao.notice_dao import NoticeDao
from module_admin.entity.do.dept_do import SysDept
from module_admin.entity.do.notice_do import SysNotice, SysNoticeRead
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.notice_vo import DeleteNoticeModel, NoticeReadUserPageQueryModel
from module_admin.service.notice_service import NoticeService

CURRENT_USER_ID = 10
CLOSED_NOTICE_ID = 6
EXPECTED_UNREAD_COUNT = 3
EXPECTED_READ_COUNT = 2
EXPECTED_VISIBLE_READ_USER_COUNT = 2


async def _create_notice_tables() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """
    为通知测试创建数据库表及会话。

    :return: 依次为 ``engine``、``session_maker`` 的元组
    """
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.execute(
            text(
                """
                create table sys_notice (
                    notice_id integer primary key autoincrement,
                    notice_title varchar(50) not null,
                    notice_type char(1) not null,
                    notice_content blob,
                    status char(1) default '0',
                    create_by varchar(64) default '',
                    create_time datetime,
                    update_by varchar(64) default '',
                    update_time datetime,
                    remark varchar(255)
                )
                """
            )
        )
        await connection.run_sync(
            Base.metadata.create_all,
            tables=[SysDept.__table__, SysUser.__table__, SysNoticeRead.__table__],
        )
    return engine, session_maker


def _notice(notice_id: int, status: str = '0') -> SysNotice:
    """
    创建测试使用的 ``SysNotice`` 实例。

    :param notice_id: 公告ID
    :param status: 操作或记录所处的状态
    :return: 测试使用的 ``SysNotice`` 实例
    """
    return SysNotice(
        notice_id=notice_id,
        notice_title=f'公告{notice_id}',
        notice_type='1',
        notice_content=f'内容{notice_id}'.encode(),
        status=status,
        create_by='admin',
        create_time=datetime(2026, 3, notice_id, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_get_notice_top_returns_latest_normal_notices_with_read_status() -> None:
    """置顶公告返回最新正常公告及阅读状态。"""
    engine, session_maker = await _create_notice_tables()
    try:
        async with session_maker() as session:
            session.add_all(
                [_notice(notice_id, status='1' if notice_id == CLOSED_NOTICE_ID else '0') for notice_id in range(1, 8)]
            )
            await NoticeDao.add_notice_reads(session, CURRENT_USER_ID, [5, 7])
            await session.commit()

            result = await NoticeService.get_notice_top_services(session, CURRENT_USER_ID)

        assert [notice.notice_id for notice in result.data] == [7, 5, 4, 3, 2]
        assert {notice.notice_id for notice in result.data if notice.is_read} == {5, 7}
        assert result.unread_count == EXPECTED_UNREAD_COUNT
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_mark_notice_read_is_idempotent_for_single_and_batch_requests() -> None:
    """单个及批量标记已读均支持重复请求。"""
    engine, session_maker = await _create_notice_tables()
    try:
        async with session_maker() as session:
            await NoticeService.mark_notice_read_services(session, CURRENT_USER_ID, [1])
            await NoticeService.mark_notice_read_services(session, CURRENT_USER_ID, [1, 2, 2])
            read_count = (
                await session.execute(
                    select(func.count()).select_from(SysNoticeRead).where(SysNoticeRead.user_id == CURRENT_USER_ID)
                )
            ).scalar_one()

        assert read_count == EXPECTED_READ_COUNT
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_get_notice_read_user_list_supports_search_and_pagination() -> None:
    """公告阅读用户列表支持搜索和分页。"""
    engine, session_maker = await _create_notice_tables()
    try:
        async with session_maker() as session:
            session.add(SysDept(dept_id=100, dept_name='研发部'))
            session.add_all(
                [
                    SysUser(
                        user_id=1,
                        dept_id=100,
                        user_name='alice',
                        nick_name='爱丽丝',
                        phonenumber='13800000001',
                        del_flag='0',
                    ),
                    SysUser(
                        user_id=2,
                        dept_id=100,
                        user_name='bob',
                        nick_name='鲍勃',
                        phonenumber='13800000002',
                        del_flag='0',
                    ),
                    SysUser(
                        user_id=3,
                        dept_id=100,
                        user_name='deleted',
                        nick_name='已删除',
                        phonenumber='13800000003',
                        del_flag='2',
                    ),
                ]
            )
            session.add_all(
                [
                    SysNoticeRead(notice_id=1, user_id=1, read_time=datetime(2026, 7, 30, 10, 0, tzinfo=UTC)),
                    SysNoticeRead(notice_id=1, user_id=2, read_time=datetime(2026, 7, 30, 11, 0, tzinfo=UTC)),
                    SysNoticeRead(notice_id=1, user_id=3, read_time=datetime(2026, 7, 30, 12, 0, tzinfo=UTC)),
                    SysNoticeRead(notice_id=2, user_id=1, read_time=datetime(2026, 7, 30, 13, 0, tzinfo=UTC)),
                ]
            )
            await session.commit()

            page = await NoticeService.get_notice_read_user_list_services(
                session,
                NoticeReadUserPageQueryModel(noticeId=1, pageNum=1, pageSize=1),
            )
            search_page = await NoticeService.get_notice_read_user_list_services(
                session,
                NoticeReadUserPageQueryModel(noticeId=1, searchValue='ali'),
            )

        assert page.total == EXPECTED_VISIBLE_READ_USER_COUNT
        assert page.rows[0]['userName'] == 'bob'
        assert page.rows[0]['deptName'] == '研发部'
        assert search_page.total == 1
        assert search_page.rows[0]['userName'] == 'alice'
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_delete_notice_removes_read_records_in_same_transaction() -> None:
    """删除公告时在同一事务清理阅读记录。"""
    engine, session_maker = await _create_notice_tables()
    try:
        async with session_maker() as session:
            session.add(_notice(1))
            await NoticeDao.add_notice_reads(session, CURRENT_USER_ID, [1])
            await session.commit()

            result = await NoticeService.delete_notice_services(session, DeleteNoticeModel(noticeIds='1'))
            notice_count = (await session.execute(select(func.count()).select_from(SysNotice))).scalar_one()
            read_count = (await session.execute(select(func.count()).select_from(SysNoticeRead))).scalar_one()

        assert result.is_success is True
        assert notice_count == 0
        assert read_count == 0
    finally:
        await engine.dispose()


def test_parse_notice_ids_deduplicates_values_and_rejects_invalid_input() -> None:
    """解析公告标识时去重并拒绝无效输入。"""
    assert NoticeService.parse_notice_ids('1, 2,1,,3') == [1, 2, 3]

    with pytest.raises(ServiceException) as exc_info:
        NoticeService.parse_notice_ids('1,invalid')

    assert exc_info.value.message == '公告ID格式不正确'
