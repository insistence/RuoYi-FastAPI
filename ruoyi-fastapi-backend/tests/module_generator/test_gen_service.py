from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession

from common.constant import GenConstant
from exceptions.exception import ServiceException
from module_generator.entity.vo.gen_vo import EditGenTableModel, GenTableColumnModel, GenTableModel
from module_generator.service.gen_service import GenTableService


@pytest.mark.asyncio
async def test_primary_keys_use_marked_column_or_first_child_column() -> None:
    """主表选择已标记的主键，子表未标记主键时选择自己的第一列。"""
    table = GenTableModel.model_validate(
        {
            'tplCategory': GenConstant.TPL_SUB,
            'columns': [{'columnName': 'name'}, {'columnName': 'id', 'isPk': '1'}],
            'subTable': {'columns': [{'columnName': 'child_id'}, {'columnName': 'detail'}]},
        }
    )
    await GenTableService.set_pk_column(table)
    assert table.pk_column is not None and table.pk_column.column_name == 'id'
    assert table.sub_table is not None and table.sub_table.pk_column is not None
    assert table.sub_table.pk_column.column_name == 'child_id'


@pytest.mark.asyncio
@pytest.mark.parametrize('columns', [None, []])
async def test_primary_key_requires_columns_or_an_existing_key(columns: list | None) -> None:
    """缺少字段时返回配置错误，已有的主键配置仍然有效。"""
    table = GenTableModel(columns=columns)
    with pytest.raises(ServiceException) as exc:
        await GenTableService.set_pk_column(table)
    assert exc.value.msg_key == 'generator.configurationRequired'
    table.pk_column = GenTableColumnModel(column_name='preset')
    await GenTableService.set_pk_column(table)
    assert table.pk_column.column_name == 'preset'


def test_get_data_source_list_services_returns_camel_case_response(monkeypatch: pytest.MonkeyPatch) -> None:
    """数据源列表服务以驼峰字段返回。"""
    settings = SimpleNamespace(
        db_default_source='primary',
        db_sources={
            'primary': SimpleNamespace(db_type='mysql'),
            'reporting': SimpleNamespace(db_type='postgresql'),
        },
    )
    monkeypatch.setattr('module_generator.service.gen_service.DataBaseConfig', settings)

    result = GenTableService.get_data_source_list_services()

    assert [item.model_dump(by_alias=True) for item in result] == [
        {'name': 'primary', 'dbType': 'mysql', 'isDefault': True},
        {'name': 'reporting', 'dbType': 'postgresql', 'isDefault': False},
    ]


@pytest.mark.asyncio
async def test_get_gen_db_table_list_by_name_services_transforms_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    """按名称查询数据库表的服务转换结果行。"""
    engine = create_engine('sqlite:///:memory:')
    with engine.connect() as connection:
        rows = connection.execute(
            text("select 'sys_user' as table_name, '用户表' as table_comment, null as create_time, null as update_time")
        ).fetchall()

    @asynccontextmanager
    async def session(_source_name: str) -> AsyncGenerator[object, None]:
        """
        为当前测试操作提供数据库会话。

        :param _source_name: 数据源名称
        :yield: 数据库会话
        """
        yield SimpleNamespace()

    settings = SimpleNamespace(
        db_default_source='primary',
        get_source=lambda _source_name: SimpleNamespace(db_type='mysql'),
    )
    registry = SimpleNamespace(session=session)
    monkeypatch.setattr('module_generator.service.gen_service.DataBaseConfig', settings)
    monkeypatch.setattr('module_generator.service.gen_service.DataSourceRegistry', registry)

    with patch(
        'module_generator.service.gen_service.GenTableDao.get_gen_db_table_list_by_names',
        new=AsyncMock(return_value=rows),
    ):
        result = await GenTableService.get_gen_db_table_list_by_name_services(
            AsyncMock(spec=AsyncSession), ['sys_user'], 'reporting'
        )

    assert result[0].table_name == 'sys_user'
    assert result[0].data_source_name == 'reporting'


@pytest.mark.asyncio
async def test_batch_gen_code_services_rejects_tables_from_other_sources() -> None:
    """批量生成时拒绝其他数据源的表。"""
    with (
        patch(
            'module_generator.service.gen_service.GenTableDao.get_gen_table_names',
            new=AsyncMock(return_value={'sys_user'}),
        ),
        patch('module_generator.service.gen_service.TemplateInitializer.init_jinja2') as init_jinja2,
        pytest.raises(ServiceException) as exc_info,
    ):
        await GenTableService.batch_gen_code_services(
            AsyncMock(spec=AsyncSession),
            ['sys_user', 'report_order'],
            'reporting',
        )

    assert exc_info.value.message == '业务表不存在或不属于数据源 reporting：report_order'
    init_jinja2.assert_not_called()


@pytest.mark.asyncio
async def test_edit_gen_table_services_preserves_alias_fields_for_both_daos() -> None:
    """编辑生成表时两个 DAO 均保留别名字段。"""
    table_id = 7
    column_id = 9
    page_object = EditGenTableModel(
        table_id=table_id,
        table_name='orders',
        update_by='admin',
        columns=[GenTableColumnModel(column_id=column_id, column_name='order_id')],
    )
    query_db = AsyncMock(spec=AsyncSession)
    table_info = SimpleNamespace(table_id=table_id, data_source_name='primary')

    with (
        patch.object(
            GenTableService,
            'get_gen_table_by_id_services',
            new=AsyncMock(return_value=table_info),
        ),
        patch(
            'module_generator.service.gen_service.GenTableDao.edit_gen_table_dao',
            new=AsyncMock(),
        ) as edit_table,
        patch(
            'module_generator.service.gen_service.GenTableColumnDao.edit_gen_table_column_dao',
            new=AsyncMock(),
        ) as edit_column,
    ):
        await GenTableService.edit_gen_table_services(query_db, page_object)

    table_payload = edit_table.await_args_list[-1].args[1]
    column_payload = edit_column.await_args_list[-1].args[1]
    assert table_payload['tableId'] == table_id
    assert table_payload['tableName'] == 'orders'
    assert column_payload['columnId'] == column_id
    assert column_payload['columnName'] == 'order_id'
    assert 'createTime' not in table_payload
    assert 'updateTime' not in table_payload
    assert 'createTime' not in column_payload
    assert 'updateTime' not in column_payload


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('configuration', 'expected_key'),
    [
        ({'tplCategory': 'tree'}, 'generator.treeCodeRequired'),
        ({'tplCategory': 'tree', 'params': {'treeCode': 'id'}}, 'generator.treeParentCodeRequired'),
        (
            {'tplCategory': 'tree', 'params': {'treeCode': 'id', 'treeParentCode': 'parent_id'}},
            'generator.treeNameRequired',
        ),
        ({'tplCategory': 'sub'}, 'generator.childTableRequired'),
        ({'tplCategory': 'sub', 'subTableName': 'detail'}, 'generator.childForeignKeyRequired'),
    ],
)
async def test_validate_edit_reports_missing_template_fields(configuration: dict, expected_key: str) -> None:
    """树表和主子表缺少必填配置时返回对应的错误消息。"""
    with pytest.raises(ServiceException) as error:
        await GenTableService.validate_edit(EditGenTableModel.model_validate(configuration))
    assert error.value.msg_key == expected_key
