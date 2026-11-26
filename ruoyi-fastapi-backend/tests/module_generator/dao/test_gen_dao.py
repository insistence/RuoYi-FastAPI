from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from config.env import DataBaseConfig
from module_generator.dao.gen_dao import GenTableColumnDao, GenTableDao
from module_generator.entity.vo.gen_vo import GenTablePageQueryModel
from utils.page_util import PageUtil
from utils.time_util import TimezoneUtil

TABLE_ID = 7
COLUMN_ID = 9
CLIENT_AUDIT_TIME = datetime(2000, 1, 1, tzinfo=UTC)


@pytest.mark.asyncio
async def test_get_gen_table_by_name_is_scoped_to_data_source() -> None:
    """按名称获取生成表时限定数据源。"""
    result = MagicMock()
    result.scalars.return_value.first.return_value = None
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)

    await GenTableDao.get_gen_table_by_name(db, 'orders', 'reporting')

    statement = db.execute.await_args_list[-1].args[0]
    params = statement.compile().params
    assert 'orders' in params.values()
    assert 'reporting' in params.values()


@pytest.mark.asyncio
async def test_get_gen_table_list_filters_source_when_requested() -> None:
    """生成表列表可按指定数据源过滤。"""
    query_object = GenTablePageQueryModel(data_source_name='reporting')

    with patch.object(PageUtil, 'paginate', new=AsyncMock(return_value=[])) as paginate:
        await GenTableDao.get_gen_table_list(AsyncMock(spec=AsyncSession), query_object, is_page=True)

    query = paginate.await_args_list[-1].args[1]
    assert 'reporting' in query.compile().params.values()


@pytest.mark.asyncio
async def test_get_gen_db_table_list_does_not_bind_unreferenced_model_defaults() -> None:
    """查询数据库表时跳过未引用的模型默认值。"""
    query_object = GenTablePageQueryModel(form_col_num=3)

    with patch.object(PageUtil, 'paginate', new=AsyncMock(return_value=[])) as paginate:
        result = await GenTableDao.get_gen_db_table_list(AsyncMock(spec=AsyncSession), query_object, is_page=True)

    query = paginate.await_args_list[-1].args[1]
    assert query.compile().params == {}
    assert result == []


@pytest.mark.asyncio
async def test_get_gen_db_table_list_only_binds_active_sql_filters() -> None:
    """查询数据库表时仅绑定启用的过滤条件。"""
    query_object = GenTablePageQueryModel(
        table_name='sys_user',
        table_comment='用户',
        begin_time='2026-07-01',
        end_time='2026-07-30',
        form_col_num=2,
    )

    with patch.object(PageUtil, 'paginate', new=AsyncMock(return_value=[])) as paginate:
        await GenTableDao.get_gen_db_table_list(AsyncMock(spec=AsyncSession), query_object)

    query = paginate.await_args_list[-1].args[1]
    compiled_sql = str(query.compile())
    bounds = TimezoneUtil.local_date_strings_to_utc('2026-07-01', '2026-07-30')
    assert bounds is not None
    begin, end = bounds
    assert query.compile().params == {
        'table_name': 'sys_user',
        'table_comment': '用户',
        'begin_time': begin,
        'end_time': end,
    }
    assert ')and ' not in compiled_sql


@pytest.mark.asyncio
async def test_get_gen_db_table_list_uses_target_source_config() -> None:
    """数据库表列表使用目标数据源配置。"""
    query_object = GenTablePageQueryModel()

    with patch.object(PageUtil, 'paginate', new=AsyncMock(return_value=[])) as paginate:
        await GenTableDao.get_gen_db_table_list(
            AsyncMock(spec=AsyncSession),
            query_object,
            excluded_table_names={'sys_user'},
            source_config=DataBaseConfig.default_source.model_copy(update={'db_type': 'postgresql'}),
        )

    query = paginate.await_args_list[-1].args[1]
    assert 'list_table' in str(query.compile())
    assert query.compile().params['excluded_table_names'] == ('sys_user',)


@pytest.mark.asyncio
async def test_edit_gen_table_keeps_alias_fields_while_excluding_audit_times() -> None:
    """编辑生成表时保留别名字段并排除审计时间。"""
    db = MagicMock()
    db.execute = AsyncMock()

    await GenTableDao.edit_gen_table_dao(
        db,
        {'tableId': TABLE_ID, 'tableName': 'orders', 'updateTime': CLIENT_AUDIT_TIME},
    )

    params = db.execute.await_args_list[-1].args[1][0]
    assert params['table_id'] == TABLE_ID
    assert params['table_name'] == 'orders'
    assert 'create_time' not in params
    assert 'update_time' not in params


@pytest.mark.asyncio
async def test_edit_gen_table_column_keeps_alias_fields_while_excluding_audit_times() -> None:
    """编辑生成表列时保留别名字段并排除审计时间。"""
    db = MagicMock()
    db.execute = AsyncMock()

    await GenTableColumnDao.edit_gen_table_column_dao(
        db,
        {'columnId': COLUMN_ID, 'columnName': 'order_id', 'updateTime': CLIENT_AUDIT_TIME},
    )

    params = db.execute.await_args_list[-1].args[1][0]
    assert params['column_id'] == COLUMN_ID
    assert params['column_name'] == 'order_id'
    assert 'create_time' not in params
    assert 'update_time' not in params
