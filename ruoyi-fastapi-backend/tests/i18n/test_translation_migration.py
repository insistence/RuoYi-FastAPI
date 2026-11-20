import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import JSON, VARCHAR, BigInteger, MetaData, Table, create_engine, select, text, update
from sqlalchemy.dialects import mysql, postgresql, sqlite
from sqlalchemy.engine import Dialect

from i18n.registry import LOCALES
from module_admin.entity.do.dict_do import SysDictData, SysDictType
from module_admin.entity.do.menu_do import SysMenu
from scripts.migrate_i18n import (
    SEED_PATH,
    apply_seed_translations,
    plan_manual_translations,
    plan_migration,
    plan_seed_translations,
)

TRANSLATION_COLUMNS = (
    (SysMenu, 'menu_name_i18n'),
    (SysDictType, 'dict_name_i18n'),
    (SysDictData, 'dict_label_i18n'),
)


@pytest.mark.parametrize('model,name', TRANSLATION_COLUMNS)
@pytest.mark.parametrize(
    'dialect,expected', [(postgresql.dialect(), 'JSONB'), (mysql.dialect(), 'JSON'), (sqlite.dialect(), 'JSON')]
)
def test_translation_columns_compile_to_comparable_postgres_jsonb(
    model: type, name: str, dialect: Dialect, expected: str
) -> None:
    """菜单和字典的整行 DISTINCT 查询要求 PostgreSQL 译文列具备相等运算。"""
    column = model.__table__.c[name]
    assert column.type.compile(dialect=dialect) == expected


@pytest.mark.parametrize('dialect_name', ['postgresql', 'mysql'])
@pytest.mark.parametrize('existing', ['missing', 'json', 'jsonb'])
def test_translation_json_migration_plan_upgrades_postgres_and_is_repeatable(
    dialect_name: str, existing: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """旧 JSON 数据通过原列强转保留，兼容列不重复迁移，MySQL 不受影响。"""
    columns = {
        'sys_user': [
            {
                'name': 'locale',
                'type': VARCHAR(63),
                'nullable': False,
                'default': "'zh-CN'::character varying" if dialect_name == 'postgresql' else "'zh-CN'",
            },
            {'name': 'locale_revision', 'type': BigInteger(), 'nullable': False, 'default': '0'},
        ]
    }
    for model, name in TRANSLATION_COLUMNS:
        columns[model.__tablename__] = (
            []
            if existing == 'missing'
            else [{'name': name, 'type': postgresql.JSONB() if existing == 'jsonb' else JSON(), 'nullable': True}]
        )
    connection = SimpleNamespace(dialect=SimpleNamespace(name=dialect_name))
    monkeypatch.setattr('scripts.migrate_i18n.inspect', lambda _: SimpleNamespace(get_columns=columns.__getitem__))

    plan = plan_migration(connection)

    json_type = 'JSONB' if dialect_name == 'postgresql' else 'JSON'
    if existing == 'missing':
        assert plan == [
            f'ALTER TABLE {model.__tablename__} ADD COLUMN {name} {json_type} NULL'
            for model, name in TRANSLATION_COLUMNS
        ]
    elif dialect_name == 'postgresql' and existing == 'json':
        assert plan == [
            f'ALTER TABLE {model.__tablename__} ALTER COLUMN {name} TYPE JSONB USING {name}::jsonb'
            for model, name in TRANSLATION_COLUMNS
        ]
    else:
        assert plan == []
    for model, name in TRANSLATION_COLUMNS:
        columns[model.__tablename__] = [
            {'name': name, 'type': postgresql.JSONB() if dialect_name == 'postgresql' else JSON(), 'nullable': True}
        ]
    assert plan_migration(connection) == []


@pytest.mark.parametrize(
    'definition',
    [
        "CHAR(63) NOT NULL DEFAULT 'zh-CN'",
        "VARBINARY(63) NOT NULL DEFAULT 'zh-CN'",
        'VARCHAR(63) NOT NULL',
        "VARCHAR(63) NOT NULL DEFAULT 'en-US'",
    ],
)
def test_migration_rejects_incorrect_locale_column_type_or_default(definition: str) -> None:
    with create_engine('sqlite:///:memory:').begin() as db:
        db.execute(text(f'CREATE TABLE sys_user (locale {definition})'))
        with pytest.raises(ValueError, match=r'sys_user\.locale is incompatible'):
            plan_migration(db)


def test_seed_migration_preserves_custom_names_existing_and_concurrent_translations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(LOCALES, 'fr-FR', {'enabled': False, 'aliases': (), 'fallback': ('zh-CN',)})
    engine = create_engine('sqlite:///:memory:')
    try:
        with engine.begin() as connection:
            for statement in [
                'CREATE TABLE sys_user (user_id INTEGER PRIMARY KEY)',
                'CREATE TABLE sys_menu (menu_id INTEGER PRIMARY KEY, menu_name VARCHAR(50), path VARCHAR(200), perms VARCHAR(100))',
                'CREATE TABLE sys_dict_type (dict_id INTEGER PRIMARY KEY, dict_name VARCHAR(100), dict_type VARCHAR(100))',
                'CREATE TABLE sys_dict_data (dict_code INTEGER PRIMARY KEY, dict_label VARCHAR(100), dict_value VARCHAR(100), dict_type VARCHAR(100))',
                "INSERT INTO sys_menu VALUES (1, '系统管理', 'system', ''), (2, '自定义监控', 'monitor', '')",
                "INSERT INTO sys_dict_type VALUES (1, '用户性别', 'sys_user_sex')",
                "INSERT INTO sys_dict_data VALUES (1, '男', '0', 'sys_user_sex')",
            ]:
                connection.execute(text(statement))
            plan = plan_seed_translations(connection)
            manual = plan_manual_translations(connection, plan)
            assert manual == [
                {
                    'table': 'sys_menu',
                    'identity': {'menu_id': 2},
                    'field': 'menu_name_i18n',
                    'original': '自定义监控',
                    'locales': ['en-US'],
                }
            ]
            assert {entry['table'] for entry in plan} == {'sys_menu', 'sys_dict_type', 'sys_dict_data'}
            for statement in plan_migration(connection):
                connection.execute(text(statement))
            menu = Table('sys_menu', MetaData(), autoload_with=connection)
            connection.execute(
                update(menu).where(menu.c.menu_id == 1).values(menu_name_i18n={'en-US': 'My system', 'ja-JP': '管理'})
            )
            apply_seed_translations(connection, plan)
            assert plan_seed_translations(connection) == []
            assert plan_manual_translations(connection, []) == manual
            assert connection.scalar(select(menu.c.menu_name_i18n).where(menu.c.menu_id == 1)) == {
                'en-US': 'My system',
                'ja-JP': '管理',
            }
            assert connection.scalar(select(menu.c.menu_name_i18n).where(menu.c.menu_name == '自定义监控')) is None
            assert json.loads(connection.scalar(text('SELECT dict_label_i18n FROM sys_dict_data'))) == {'en-US': 'Male'}
    finally:
        engine.dispose()


def test_fresh_database_scripts_include_all_seed_translations_with_explicit_insert_columns() -> None:
    seeds = json.loads(SEED_PATH.read_text(encoding='utf-8'))
    for path in Path(SEED_PATH.parent).glob('*.sql'):
        sql = path.read_text(encoding='utf-8')
        assert 'locale_revision' in sql
        assert 'insert into sys_user values' not in sql
        json_type = 'JSONB' if path.name == 'ruoyi-fastapi-pg.sql' else 'JSON'
        for _, column in TRANSLATION_COLUMNS:
            assert f'{column} {json_type} NULL' in sql
        for table, entries in seeds.items():
            assert f'insert into {table} values' not in sql
            for entry in entries:
                assert (
                    f"update {table} set {entry['field']} = '{json.dumps(entry['translations'], ensure_ascii=False)}'"
                    in sql
                )
