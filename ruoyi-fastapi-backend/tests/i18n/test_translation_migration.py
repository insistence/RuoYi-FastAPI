import json
from pathlib import Path

from sqlalchemy import MetaData, Table, create_engine, select, text, update

from scripts.migrate_i18n import (
    SEED_PATH,
    apply_seed_translations,
    plan_manual_translations,
    plan_migration,
    plan_seed_translations,
)


def test_seed_migration_preserves_custom_names_existing_and_concurrent_translations() -> None:
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
    seeds = json.loads(SEED_PATH.read_text())
    for path in Path(SEED_PATH.parent).glob('*.sql'):
        sql = path.read_text()
        for table, entries in seeds.items():
            assert f'insert into {table} values' not in sql
            for entry in entries:
                assert (
                    f"update {table} set {entry['field']} = '{json.dumps(entry['translations'], ensure_ascii=False)}'"
                    in sql
                )
