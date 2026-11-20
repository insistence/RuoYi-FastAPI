import inspect
import json
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config.env import I18nConfig
from exceptions.exception import ServiceException
from i18n.locale import LocaleUtil
from i18n.registry import LOCALES, LocaleRegistry
from module_admin.controller.login_controller import get_login_user_info
from module_admin.controller.user_controller import change_system_user_locale
from module_admin.dao.user_dao import UserDao
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel, UserLocaleModel, UserModel
from module_admin.service.user_service import UserService
from scripts.migrate_i18n import plan_migration
from utils.common_util import CamelCaseUtil


@pytest_asyncio.fixture
async def sessions() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    async with engine.begin() as connection:
        await connection.run_sync(SysUser.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory.begin() as db:
        db.add_all(
            [
                SysUser(user_id=1, user_name='one', nick_name='One', password='hash'),
                SysUser(user_id=2, user_name='two', nick_name='Two', password='hash'),
            ]
        )
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_preference_endpoint_returns_monotonic_revision_and_get_info_preserves_bigint(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    current = SimpleNamespace(user=SimpleNamespace(user_id=1, user_name='one'))
    async with sessions() as db:
        first = await inspect.unwrap(change_system_user_locale)(
            SimpleNamespace(), UserLocaleModel(locale='en_US'), db, current
        )
        second = await inspect.unwrap(change_system_user_locale)(
            SimpleNamespace(), UserLocaleModel(locale='en-US'), db, current
        )
    assert json.loads(first.body)['data'] == {'locale': 'en-US', 'revision': '1'}
    assert json.loads(second.body)['data'] == {'locale': 'en-US', 'revision': '2'}
    async with sessions.begin() as db:
        user = await db.get(SysUser, 1)
        user.locale_revision = 2**53 + 1
    async with sessions() as db:
        result = await UserService.update_user_locale_services(db, 1, 'one', 'auto')
        assert result.result == {'locale': 'auto', 'revision': str(2**53 + 2)}
    async with sessions() as db:
        user = await db.get(SysUser, 1)
        info = CurrentUserModel(permissions=[], roles=[], user=UserInfoModel(**CamelCaseUtil.transform_result(user)))
        response = await get_login_user_info(SimpleNamespace(), info)
        assert json.loads(response.body)['user']['localeRevision'] == str(2**53 + 2)
        untouched = await db.get(SysUser, 2)
        assert (untouched.locale, untouched.locale_revision) == ('zh-CN', 0)


@pytest.mark.asyncio
async def test_other_user_edits_cannot_overwrite_revision_and_locale_rollback_is_atomic(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async with sessions.begin() as db:
        result = await UserDao.edit_user_dao(db, {'user_id': 1, 'locale': 'en-GB', 'locale_revision': 999})
        assert result == {'locale': 'en-GB', 'revision': '1'}
    async with sessions.begin() as db:
        await UserDao.edit_user_dao(db, {'user_id': 1, 'nick_name': 'Changed', 'locale_revision': 0})
    async with sessions() as db:
        await UserDao.edit_user_dao(db, {'user_id': 1, 'locale': 'ja-JP'})
        await db.rollback()
    async with sessions() as db:
        user = await db.get(SysUser, 1)
        assert (user.locale, user.locale_revision, user.nick_name) == ('en-GB', 1, 'Changed')
        added = await UserDao.add_user_dao(
            db, UserModel(userId=3, userName='three', nickName='Three', localeRevision='999')
        )
        assert added.locale_revision == 0


@pytest.mark.asyncio
async def test_locale_update_locks_the_row_and_uses_database_increment() -> None:
    db = SimpleNamespace(scalar=AsyncMock(side_effect=[1, 42]), execute=AsyncMock())
    assert await UserDao.edit_user_dao(db, {'user_id': 1, 'locale': 'en-US'}) == {'locale': 'en-US', 'revision': '42'}
    lock = db.scalar.call_args_list[0].args[0]
    update = db.execute.call_args.args[0]
    for dialect in (mysql.dialect(), postgresql.dialect()):
        assert 'FOR UPDATE' in str(lock.compile(dialect=dialect))
        sql = str(update.compile(dialect=dialect))
        assert 'locale_revision=(sys_user.locale_revision +' in sql


@pytest.mark.asyncio
async def test_missing_user_preference_does_not_report_a_successful_write(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    async with sessions() as db:
        with pytest.raises(ServiceException):
            await UserService.update_user_locale_services(db, 999, 'missing', 'en-US')
        assert not db.in_transaction()


def test_revision_migration_is_repeatable_and_preserves_existing_users() -> None:
    engine = create_engine('sqlite:///:memory:')
    try:
        with engine.begin() as connection:
            connection.execute(
                text("CREATE TABLE sys_user (user_id INTEGER PRIMARY KEY, locale VARCHAR(63) NOT NULL DEFAULT 'zh-CN')")
            )
            connection.execute(text("INSERT INTO sys_user VALUES (1, 'en-US')"))
            for table in ('sys_menu', 'sys_dict_type', 'sys_dict_data'):
                connection.execute(text(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY)'))
            for statement in plan_migration(connection):
                connection.execute(text(statement))
            assert plan_migration(connection) == []
            assert connection.execute(text('SELECT locale, locale_revision FROM sys_user')).one() == ('en-US', 0)
            connection.execute(text('UPDATE sys_user SET locale_revision = 123'))
            assert plan_migration(connection) == []
            assert str(connection.scalar(text('SELECT locale_revision FROM sys_user'))) == '123'
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    'definition',
    ['INTEGER NOT NULL DEFAULT 0', 'BIGINT NULL DEFAULT 0', 'BIGINT NOT NULL DEFAULT 1', 'BIGINT NOT NULL'],
)
def test_revision_migration_rejects_incompatible_existing_columns(definition: str) -> None:
    engine = create_engine('sqlite:///:memory:')
    try:
        with engine.begin() as connection:
            connection.execute(
                text(f'CREATE TABLE sys_user (user_id INTEGER PRIMARY KEY, locale_revision {definition})')
            )
            with pytest.raises(ValueError, match=r'sys_user\.locale_revision is incompatible'):
                plan_migration(connection)
    finally:
        engine.dispose()


@pytest.mark.parametrize('tag', ['en-GB', 'en-AU', 'en-CA', 'en-Latn-GB', 'en-GB-u-ca-gregory'])
def test_explicit_english_language_family_fallback(tag: str) -> None:
    assert LocaleRegistry.match_locale(tag) == 'en-US'
    assert LocaleUtil.negotiate_language(f'{tag};q=0.9,zh-CN;q=0.5') == 'en-US'


def test_exact_registered_locale_wins_and_chinese_scripts_do_not_merge(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(LOCALES, 'en-GB', {'aliases': (), 'fallback': ('en-US',)})
    assert LocaleRegistry.match_locale('en-GB') == 'en-GB'
    assert LocaleRegistry.match_locale('zh-TW') is None
    assert LocaleRegistry.match_locale('zh-Hant') is None
    monkeypatch.setattr(I18nConfig, 'i18n_default_locale', 'en-US')
    assert LocaleUtil.negotiate_language('unsupported') == 'en-US'
    assert LocaleRegistry.fallback_chain('zh-CN') == ('zh-CN',)


def test_locale_endpoint_does_not_accept_client_revision() -> None:
    with pytest.raises(ValueError):
        UserLocaleModel(locale='en-US', revision='12')
