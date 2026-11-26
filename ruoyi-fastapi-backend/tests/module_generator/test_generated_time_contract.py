import ast
import importlib.util
import json
import subprocess
import sys
from datetime import UTC, date, time
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import database
from config.env import AppConfig
from exceptions.exception import ServiceWarning
from module_generator.entity.vo.gen_vo import GenTableColumnModel, GenTableModel
from scripts.check_docstrings import BACKEND, sphinx_settings, violations
from utils import common_util
from utils.template_util import TemplateInitializer, TemplateUtils


def column(
    name: str, sql_type: str, python_type: str, *, pk: bool = False, query_type: str = 'EQ'
) -> GenTableColumnModel:
    """
    创建测试使用的 ``GenTableColumnModel`` 实例。

    :param name: 用于查找或标识当前对象的名称
    :param sql_type: 建表时使用的 SQL 列类型
    :param python_type: PYTHON类型
    :param pk: 该列是否为主键
    :param query_type: 查询方式（等于、不等于、大于、小于、范围）
    :return: 测试使用的 ``GenTableColumnModel`` 实例
    """
    return GenTableColumnModel(
        column_name=name,
        column_comment=name,
        column_type=sql_type,
        python_type=python_type,
        python_field=TemplateUtils.to_camel_case(name),
        is_pk='1' if pk else '0',
        is_insert='1',
        is_edit='0' if pk else '1',
        is_list='1',
        is_query='0' if pk else '1',
        query_type=query_type,
        html_type='time' if python_type == 'time' else 'datetime' if python_type in {'date', 'datetime'} else 'input',
    )


def make_table(db_type: str, category: str, web_type: str) -> GenTableModel:
    """
    根据数据库类型及模板类别构造代码生成样表。

    :param db_type: 数据库类型
    :param category: 测试的模板或记录类别
    :param web_type: 渲染模板的前端类型
    :return: 供调用方使用的 ``table``
    """
    instant = 'timestamp(3)' if db_type == 'mysql' else 'timestamp(3) with time zone'
    columns = [
        column('item_id', 'bigint', 'int', pk=True),
        column('item_name', 'varchar(64)', 'str'),
        column('birthday', 'date', 'date', query_type='BETWEEN'),
        column('opening_time', 'time(3)', 'time', query_type='BETWEEN'),
    ]
    if category != 'sub':
        columns.extend(
            [
                column('occurred_at', instant, 'datetime', query_type='BETWEEN'),
                column('alarm_at', instant, 'datetime'),
                column('create_time', instant, 'datetime'),
                column('update_time', instant, 'datetime'),
            ]
        )
    if category == 'tree':
        columns.append(column('parent_id', 'bigint', 'int'))
    table = GenTableModel(
        table_name='generated_time_item',
        table_comment='时间样例',
        class_name='TimeItem',
        tpl_category=category,
        tpl_web_type=web_type,
        package_name='module_generated_time',
        module_name='test',
        business_name='item',
        function_name='时间样例',
        function_author='test',
        form_col_num=2,
        options=json.dumps(
            {'genView': True, 'treeCode': 'item_id', 'treeParentCode': 'parent_id', 'treeName': 'item_name'}
        ),
        columns=columns,
        pk_column=columns[0],
    )
    if category == 'sub':
        children = [
            column('detail_id', 'bigint', 'int', pk=True),
            column('parent_item_id', 'bigint', 'int'),
            column('birthday', 'date', 'date'),
            column('occurred_at', instant, 'datetime'),
        ]
        table.sub_table_name = 'generated_time_detail'
        # 子表外键刻意使用不同于主表主键的名称，验证生成关联字段的映射。
        table.sub_table_fk_name = 'parent_item_id'
        table.sub_table = GenTableModel(
            table_name=table.sub_table_name,
            table_comment='子表',
            class_name='TimeDetail',
            business_name='detail',
            function_name='子表',
            columns=children,
            pk_column=children[0],
        )
    return table


def render_case(db_type: str, category: str, web_type: str, *, field_constraints: bool = False) -> dict[str, str]:
    """
    使用样表实际渲染所选模板。

    :param db_type: 数据库类型
    :param category: 测试的模板或记录类别
    :param web_type: 渲染模板的前端类型
    :param field_constraints: 是否生成必填字段校验方法和唯一性检查
    :return: 按模板名索引的生成代码
    """
    with patch.object(type(database.DataBaseConfig), 'get_source', return_value=SimpleNamespace(db_type=db_type)):
        table = make_table(db_type, category, web_type)
        if field_constraints:
            assert table.columns
            table.columns[1].unique = table.columns[1].required = True
            if table.sub_table:
                assert table.sub_table.columns
                table.sub_table.columns[1].required = True
        context = TemplateUtils.prepare_context(table)
        environment = TemplateInitializer.init_jinja2()
        return {
            name: environment.get_template(name).render(**context) for name in TemplateUtils.get_template_list(table)
        }


def test_generated_python_docstrings(tmp_path: Path) -> None:
    """检查各类生成模板及插件脚手架输出的中文接口说明和多行摘要布局。"""
    sources = {
        f'{category}_{Path(name).stem}': source
        for category in ('crud', 'tree', 'sub')
        for name, source in render_case('mysql', category, 'element-plus', field_constraints=True).items()
        if name.endswith('.py.jinja2')
    }
    assert ':raises ServiceException:' in sources['crud_service.py']
    assert '校验子表的必填字段' in sources['sub_vo.py']
    assets = BACKEND / 'cli/runtime/plugin/scaffold/assets'
    for path in assets.rglob('*.py.tmpl'):
        sources[f'{path.parent.name}_{path.stem}'] = path.read_text(encoding='utf-8')
    with sphinx_settings() as settings:
        for name, source in sources.items():
            target = tmp_path / name
            target.write_text(source, encoding='utf-8')
            assert not list(violations(ast.parse(source), settings, target)), name
    subprocess.run(
        [sys.executable, '-m', 'ruff', 'check', '--no-cache', '--select', 'D213', str(tmp_path)],
        check=True,
    )


@pytest.mark.parametrize('category', ['crud', 'tree', 'sub'])
@pytest.mark.parametrize('web_type', ['element-ui', 'element-plus'])
def test_generated_frontend_contains_business_files_and_reuses_project_time_modules(
    category: str, web_type: str
) -> None:
    """生成的前端包含业务文件并复用项目时间模块。"""
    table = make_table('mysql', category, web_type)
    rendered = render_case('mysql', category, web_type)
    files = {TemplateUtils.get_file_name(name, table): content for name, content in rendered.items()}

    assert '' not in files
    assert len(files) == len(rendered)
    assert {path for path in files if path.startswith('frontend/')} == {
        'frontend/src/api/test/item.js',
        'frontend/src/views/test/item/index.vue',
        'frontend/src/views/test/item/view.vue',
    }
    page = files['frontend/src/views/test/item/index.vue']
    assert 'from "@/components/BusinessDateTimePicker"' in page
    assert 'serializeTimeFieldsForSubmit } from "@/utils/time"' in page
    assert 'initializeBusinessTimezone' not in page
    assert '@/api/login' not in page


def import_generated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, rendered: dict[str, str]) -> tuple:
    """
    加载已渲染的 Python 模块以测试生成代码。

    :param tmp_path: pytest 为当前用例创建的临时目录
    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    :param rendered: 已渲染的模板内容
    :return: 已渲染的 Python 模块以测试生成代码
    """

    class TestBase(DeclarativeBase):
        """为生成模块提供独立的 ORM 模型基类。"""

    monkeypatch.setattr(database, 'Base', TestBase)
    monkeypatch.setattr(common_util, 'Base', TestBase)
    for name in [
        'module_generated_time',
        'module_generated_time.entity',
        'module_generated_time.entity.do',
        'module_generated_time.entity.vo',
        'module_generated_time.dao',
    ]:
        package = ModuleType(name)
        package.__path__ = [str(tmp_path)]
        monkeypatch.setitem(sys.modules, name, package)
    modules = []
    for kind, folder in [('do', 'entity.do'), ('vo', 'entity.vo'), ('dao', 'dao')]:
        name = f'module_generated_time.{folder}.item_{kind}'
        path = tmp_path / f'item_{kind}.py'
        path.write_text(rendered[f'python/{kind}.py.jinja2'], encoding='utf-8')
        spec = importlib.util.spec_from_file_location(name, path)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        monkeypatch.setitem(sys.modules, name, module)
        spec.loader.exec_module(module)
        modules.append(module)
    return TestBase, *modules


def test_generated_models_publish_column_metadata(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """验证主表和子表的列说明能传递到数据库元数据与接口模式。"""
    table = make_table('mysql', 'sub', 'element-plus')
    assert table.pk_column is not None and table.columns
    assert table.sub_table is not None and table.sub_table.columns
    table.pk_column.column_comment = None
    label = """客户的 "VIP" 生日和 O'Brien 备注"""
    table.columns[2].column_comment = label
    table.sub_table.columns[2].column_comment = '  '
    with patch.object(type(database.DataBaseConfig), 'get_source', return_value=SimpleNamespace(db_type='mysql')):
        context = TemplateUtils.prepare_context(table)
    environment = TemplateInitializer.init_jinja2()
    rendered = {
        name: environment.get_template(name).render(**context)
        for name in ('python/do.py.jinja2', 'python/vo.py.jinja2', 'python/dao.py.jinja2')
    }
    _, orm, vo, _ = import_generated(tmp_path, monkeypatch, rendered)
    for mapped, model, name, expected in [
        (orm.TimeItem, vo.ItemModel, 'item_id', '字段 item_id'),
        (orm.TimeItem, vo.ItemModel, 'birthday', label),
        (orm.TimeDetail, vo.DetailModel, 'birthday', '字段 birthday'),
    ]:
        assert mapped.__table__.c[name].comment == expected
        assert model.model_fields[name].description == expected
    assert vo.ItemQueryModel.model_fields['begin_birthday'].description == f'开始{label}'
    assert vo.DetailModel.model_json_schema()['properties']['birthday']['description'] == '字段 birthday'
    assert table.sub_table.columns[2].column_comment == '  '


@pytest.mark.parametrize('db_type', ['mysql', 'postgresql'])
@pytest.mark.parametrize('category', ['crud', 'tree', 'sub'])
@pytest.mark.asyncio
async def test_generated_import_crud_and_query(
    db_type: str, category: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """验证生成模块的导入、增删改查和查询。"""
    base, _do, vo, dao = import_generated(tmp_path, monkeypatch, render_case(db_type, category, 'element-plus'))
    monkeypatch.setattr(AppConfig, 'app_timezone', 'America/New_York')
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    try:
        async with engine.begin() as connection:
            await connection.run_sync(base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            payload = {'itemId': 1, 'itemName': 'first', 'birthday': '2000-02-29', 'openingTime': '09:15:00.123'}
            if category != 'sub':
                payload.update(occurredAt='2026-03-08T03:30:00.123-04:00', alarmAt='2026-11-01T01:30:00.456-05:00')
            await dao.ItemDao.add_item_dao(session, vo.ItemModel(**payload))
            if category == 'sub':
                await dao.ItemDao.add_detail_dao(
                    session,
                    vo.DetailModel(
                        detail_id=10,
                        parent_item_id=1,
                        birthday='2000-02-29',
                        occurred_at='2026-11-01T01:30:00.456-05:00',
                    ),
                )
            await session.commit()
            result = await dao.ItemDao.get_item_detail_by_id(session, 1)
            assert result.birthday == date(2000, 2, 29)
            assert result.opening_time == time(9, 15, 0, 123000)
            instant = result.timedetail_list[0].occurred_at if category == 'sub' else result.occurred_at
            assert instant.tzinfo == UTC
            assert instant.microsecond == (456000 if category == 'sub' else 123000)
            serialized = vo.ItemModel.model_validate(result).model_dump(mode='json', by_alias=True)
            assert serialized['birthday'] == '2000-02-29'
            await dao.ItemDao.edit_item_dao(session, {'item_id': 1, 'item_name': 'changed'})
            await session.commit()
            filters = {'beginBirthday': '2000-02-29', 'endBirthday': '2000-02-29', 'beginOpeningTime': '09:00:00'}
            if category != 'sub':
                filters.update(beginOccurredAt='2026-03-08', endOccurredAt='2026-03-08')
            rows = await dao.ItemDao.get_item_list(session, vo.ItemPageQueryModel(**filters), is_page=False)
            assert len(rows) == 1
            assert rows[0]['itemName'] == 'changed'
            empty = await dao.ItemDao.get_item_list(
                session, vo.ItemPageQueryModel(end_birthday='2000-02-28'), is_page=False
            )
            assert empty == []
            if category == 'sub':
                await dao.ItemDao.edit_detail_dao(session, {'detail_id': 10, 'occurred_at': None})
                await dao.ItemDao.delete_detail_dao(session, vo.DetailModel(detail_id=10))
            await dao.ItemDao.delete_item_dao(session, vo.ItemModel(item_id=1))
            await session.commit()
            assert await dao.ItemDao.get_item_detail_by_id(session, 1) is None
        with pytest.raises(ValidationError):
            vo.ItemModel(birthday='2000-02-30')
        with pytest.raises(ValidationError):
            vo.ItemModel(opening_time='25:00:00')
        with pytest.raises(ValidationError):
            vo.ItemPageQueryModel(begin_birthday='2000-03-01', end_birthday='2000-02-29')
        with pytest.raises(ValidationError):
            (vo.DetailModel if category == 'sub' else vo.ItemModel)(occurred_at='2026-03-08 02:30:00')
    finally:
        await engine.dispose()


@pytest.mark.parametrize('column_type', ['timestamp(3) without time zone', 'timestamp', 'TIMESTAMP(6)'])
def test_rejects_postgres_ambiguous_timestamp(column_type: str) -> None:
    """拒绝 PostgreSQL 有歧义的时间戳。"""
    table = make_table('postgresql', 'crud', 'element-plus')
    assert table.columns
    table.columns[4].column_type = column_type
    with patch.object(type(database.DataBaseConfig), 'get_source', return_value=SimpleNamespace(db_type='postgresql')):
        with pytest.raises(ServiceWarning) as error:
            TemplateUtils.prepare_context(table)
        assert error.value.message is not None
        assert 'TIMESTAMP(3) WITH TIME ZONE' in error.value.message


def test_mysql_time_requires_explicit_time_of_day_control() -> None:
    """MySQL 时间字段需要明确的时刻控件。"""
    table = make_table('mysql', 'crud', 'element-plus')
    assert table.columns
    table.columns[3].html_type = 'datetime'
    with patch.object(type(database.DataBaseConfig), 'get_source', return_value=SimpleNamespace(db_type='mysql')):
        with pytest.raises(ServiceWarning) as error:
            TemplateUtils.prepare_context(table)
        assert error.value.message is not None
        assert 'MySQL TIME' in error.value.message
