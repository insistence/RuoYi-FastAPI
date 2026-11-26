from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from module_admin.dao.log_dao import LoginLogDao
from module_admin.entity.do.log_do import SysLogininfor
from module_admin.entity.vo.log_vo import LoginLogPageQueryModel


@pytest.mark.asyncio
async def test_login_logs_use_requested_column_or_latest_time() -> None:
    """登录日志支持按驼峰列名排序，缺少有效排序条件时优先返回最近记录。"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    table = SysLogininfor.get_table()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(table.create)
        async with AsyncSession(engine) as db:
            db.add_all(
                [
                    SysLogininfor(info_id=1, login_time=datetime(2025, 1, 1, tzinfo=UTC)),
                    SysLogininfor(info_id=2, login_time=datetime(2025, 1, 2, tzinfo=UTC)),
                ]
            )
            await db.flush()
            for parameters, expected in [
                ({'orderByColumn': 'infoId', 'isAsc': 'ascending'}, [1, 2]),
                ({'orderByColumn': 'infoId', 'isAsc': 'descending'}, [2, 1]),
                ({'orderByColumn': 'metadata', 'isAsc': 'ascending'}, [2, 1]),
                ({'isAsc': 'ascending'}, [2, 1]),
                ({}, [2, 1]),
            ]:
                result = await LoginLogDao.get_login_log_list(db, LoginLogPageQueryModel.model_validate(parameters))
                assert isinstance(result, list)
                assert [row['infoId'] for row in result] == expected
    finally:
        await engine.dispose()
