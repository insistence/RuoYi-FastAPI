import argparse
import json
from pathlib import Path
from typing import Any

from sqlalchemy import JSON, MetaData, Table, inspect, select, text, update
from sqlalchemy.engine import Connection

from config.database import create_sync_db_engine
from config.env import I18nConfig
from i18n.registry import LOCALES, MAX_LOCALE_LENGTH
from scripts.verify_timezone_database import load_source

SEED_PATH = Path(__file__).resolve().parent.parent / 'sql' / 'i18n-seeds.json'


def plan_migration(connection: Connection) -> list[str]:
    """
    检查语言偏好和菜单、字典译文列并生成兼容升级语句

    :param connection: 数据库连接
    :return: 待执行的升级语句，字段已兼容时返回空列表
    """
    inspector = inspect(connection)
    columns = {column['name']: column for column in inspector.get_columns('sys_user')}
    statements = []
    if 'locale' in columns:
        column = columns['locale']
        if getattr(column['type'], 'length', None) != MAX_LOCALE_LENGTH or column['nullable']:
            raise ValueError('Existing sys_user.locale is incompatible; review the schema before migrating')
    else:
        statements.append("ALTER TABLE sys_user ADD COLUMN locale VARCHAR(63) NOT NULL DEFAULT 'zh-CN'")
    for table, name in (
        ('sys_menu', 'menu_name_i18n'),
        ('sys_dict_type', 'dict_name_i18n'),
        ('sys_dict_data', 'dict_label_i18n'),
    ):
        columns = {column['name']: column for column in inspector.get_columns(table)}
        if name in columns:
            column = columns[name]
            if not isinstance(column['type'], JSON) or not column['nullable']:
                raise ValueError(f'Existing {table}.{name} is incompatible; review the schema before migrating')
        else:
            statements.append(f'ALTER TABLE {table} ADD COLUMN {name} JSON NULL')
    return statements


def plan_seed_translations(connection: Connection) -> list[dict[str, Any]]:
    """
    为未改名的内置数据生成缺失译文补齐计划，不覆盖用户维护的译文

    :param connection: 数据库连接
    :return: 待补齐的译文补丁
    """
    seeds = json.loads(SEED_PATH.read_text(encoding='utf-8'))
    plan = []
    for table_name, entries in seeds.items():
        table = Table(table_name, MetaData(), autoload_with=connection)
        primary_key = next(iter(entries[0]['identity']))
        rows = connection.execute(
            select(table).where(table.c[primary_key].in_([entry['identity'][primary_key] for entry in entries]))
        ).mappings()
        existing = {row[primary_key]: row for row in rows}
        for entry in entries:
            row = existing.get(entry['identity'][primary_key])
            if row is None or any(row[column] != value for column, value in entry['identity'].items()):
                continue
            current = row.get(entry['field']) or {}
            if not isinstance(current, dict):
                raise ValueError(f'Existing {table_name}.{entry["field"]} must contain a JSON object')
            missing = {locale: value for locale, value in entry['translations'].items() if locale not in current}
            if missing:
                plan.append({**entry, 'table': table_name, 'translations': missing})
    return plan


def apply_seed_translations(connection: Connection, plan: list[dict[str, Any]]) -> None:
    """
    加锁读取最新译文后补齐种子数据，保留升级期间新增的译文

    :param connection: 数据库事务连接
    :param plan: 已检查的译文补齐计划
    """
    metadata = MetaData()
    for entry in plan:
        table = Table(entry['table'], metadata, autoload_with=connection, extend_existing=True)
        conditions = [table.c[column] == value for column, value in entry['identity'].items()]
        row = connection.execute(select(table).where(*conditions).with_for_update()).mappings().first()
        if row is None:
            continue
        current = dict(row[entry['field']] or {})
        for locale, translation in entry['translations'].items():
            current.setdefault(locale, translation)
        connection.execute(update(table).where(*conditions).values({entry['field']: current}))


def plan_manual_translations(connection: Connection, seeds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    列出种子不能自动补齐的自定义名称与已注册语言，保留现有内容供人工维护。

    :param connection: 数据库连接
    :param seeds: 本次拟补齐的内置译文
    :return: 待人工补译清单
    """
    pending = []
    for table_name, identity, original, field in (
        ('sys_menu', 'menu_id', 'menu_name', 'menu_name_i18n'),
        ('sys_dict_type', 'dict_id', 'dict_name', 'dict_name_i18n'),
        ('sys_dict_data', 'dict_code', 'dict_label', 'dict_label_i18n'),
    ):
        table = Table(table_name, MetaData(), autoload_with=connection)
        planned = {
            entry['identity'][identity]: entry['translations'] for entry in seeds if entry['table'] == table_name
        }
        for row in connection.execute(select(table)).mappings():
            current = row.get(field) or {}
            if not isinstance(current, dict):
                raise ValueError(f'Existing {table_name}.{field} must contain a JSON object')
            combined = {**planned.get(row[identity], {}), **current}
            missing = [
                code
                for code in LOCALES
                if code != I18nConfig.SOURCE_LOCALE
                and (not isinstance(combined.get(code), str) or not combined[code].strip())
            ]
            if missing:
                pending.append(
                    {
                        'table': table_name,
                        'identity': {identity: row[identity]},
                        'field': field,
                        'original': row[original],
                        'locales': missing,
                    }
                )
    return pending


def main() -> None:
    """
    执行国际化迁移命令，默认只输出升级计划
    """
    parser = argparse.ArgumentParser(description='Add language preference and translations; default is read-only')
    parser.add_argument('--env-file', default='.env.dev')
    parser.add_argument('--source')
    parser.add_argument('--config')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    engine = create_sync_db_engine(config=load_source(args), echo=False)
    try:
        with engine.begin() as connection:
            plan = plan_migration(connection)
            seeds = plan_seed_translations(connection)
            if args.apply:
                for statement in plan:
                    connection.execute(text(statement))
                apply_seed_translations(connection, seeds)
            report = {
                'mode': 'apply' if args.apply else 'check',
                'statements': plan,
                'translations': seeds,
                'manualTranslations': plan_manual_translations(connection, [] if args.apply else seeds),
            }
        print(json.dumps(report, ensure_ascii=False))
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()
