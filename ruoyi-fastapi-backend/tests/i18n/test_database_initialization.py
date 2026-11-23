from pathlib import Path

import pytest
from sqlalchemy import Column, MetaData, Table, create_engine, select
from sqlalchemy.dialects import mysql, postgresql, sqlite
from sqlalchemy.engine import Dialect

from module_admin.entity.do.dict_do import SysDictData, SysDictType
from module_admin.entity.do.menu_do import SysMenu

SQL_DIR = Path(__file__).resolve().parents[2] / 'sql'
SQL_FILES = (('ruoyi-fastapi.sql', 'JSON'), ('ruoyi-fastapi-pg.sql', 'JSONB'))
TRANSLATION_FIELDS = (
    (SysMenu, 'menu_name', ('系统管理', 'System administration')),
    (SysDictType, 'dict_name', ('用户性别', 'User gender')),
    (SysDictData, 'dict_label', ('男', 'Male')),
)


@pytest.mark.parametrize(
    'dialect,expected', [(postgresql.dialect(), 'JSONB'), (mysql.dialect(), 'JSON'), (sqlite.dialect(), 'JSON')]
)
def test_translation_columns_compile_to_comparable_postgres_jsonb(dialect: Dialect, expected: str) -> None:
    """菜单和字典的整行 DISTINCT 查询要求 PostgreSQL 译文列具备相等运算。"""
    for model, field, _ in TRANSLATION_FIELDS:
        column = model.__table__.c[f'{field}_i18n']
        assert column.type.compile(dialect=dialect) == expected


def test_fresh_database_user_locale_defaults() -> None:
    """新数据库为用户提供默认语言。"""
    for filename, _ in SQL_FILES:
        sql = (SQL_DIR / filename).read_text(encoding='utf-8')
        schema = sql.split('create table sys_user (', 1)[1].split('\n)', 1)[0]
        schema = ' '.join(schema.split())
        assert "locale varchar(63) not null default 'zh-CN'" in schema
        assert 'locale_revision bigint not null default 0' in schema


@pytest.mark.parametrize('model,field,example', TRANSLATION_FIELDS)
def test_fresh_database_scripts_insert_matching_translations(model: type, field: str, example: tuple[str, str]) -> None:
    """按两套脚本各自的建表顺序插入，逐行核对内置记录的原文和译文。"""
    name = model.__tablename__
    model_table = model.__table__
    translation = f'{field}_i18n'
    primary_key = next(iter(model_table.primary_key)).name
    results = []
    for filename, json_type in SQL_FILES:
        sql = (SQL_DIR / filename).read_text(encoding='utf-8')
        schema = sql.split(f'create table {name}', 1)[1].split('\n)', 1)[0]
        assert f'{translation} {json_type} NULL' in schema
        columns = []
        for line in schema.strip().splitlines():
            column = line.split()[0]
            if column in model_table.c:
                columns.append(
                    Column(
                        column,
                        model_table.c[column].type,
                        primary_key=column == primary_key,
                        comment=model_table.c[column].comment,
                    )
                )
        table = Table(name, MetaData(), *columns)
        with create_engine('sqlite:///:memory:').begin() as connection:
            table.create(connection)
            assert f'update {name} set' not in sql.lower()
            for line in sql.splitlines():
                if line.startswith(f'insert into {name} '):
                    assert line.startswith(f'insert into {name} values(')
                    connection.exec_driver_sql(line.replace('sysdate()', 'current_timestamp').replace('::jsonb', ''))
            rows = connection.execute(select(table.c[primary_key], table.c[field], table.c[translation]))
            entries = {key: (source, translations) for key, source, translations in rows}
        source, translations = entries[1]
        assert (source, translations['en-US']) == example
        assert all(translations['en-US'].strip() for _, translations in entries.values())
        results.append(entries)
    assert results[0] == results[1]
