import inspect
import json
from collections.abc import AsyncIterator
from http import HTTPStatus
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from common.aspect.db_session import get_db_session_provider
from config.env import I18nConfig
from exceptions.exception import ServiceException
from i18n.locale import LocaleUtil
from i18n.registry import LOCALES, LocaleRegistry
from module_admin.controller.login_controller import get_login_user_info, login
from module_admin.controller.user_controller import change_system_user_locale
from module_admin.dao.user_dao import UserDao
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel, UserLocaleModel, UserModel
from module_admin.service.login_service import LoginService
from module_admin.service.user_service import UserService
from utils.common_util import CamelCaseUtil


@pytest_asyncio.fixture
async def sessions() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """
    在独立数据库中创建测试会话工厂。

    :yield: 逐项产生的 ``factory``
    """
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
async def test_login_writes_only_an_explicit_valid_preference(
    sessions: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    """登录仅写入显式指定且有效的偏好。"""
    app = FastAPI()
    app.post('/login', summary='登录并设置语言', description='验证登录请求只保存显式提交且有效的语言偏好。')(
        inspect.unwrap(login)
    )
    app.state.redis = AsyncMock()
    async with sessions() as db:
        app.dependency_overrides[get_db_session_provider(None)] = lambda: db
        user = await db.get(SysUser, 1)
        monkeypatch.setattr(LoginService, 'authenticate_user', AsyncMock(return_value=(user, None)))
        monkeypatch.setattr(UserService, 'user_detail_services', AsyncMock(return_value=SimpleNamespace(data=user)))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            credentials = {'username': 'one', 'password': 'secret'}
            for fields, status, locale, revision in [
                ({'locale': 'en_US'}, HTTPStatus.OK, 'en-US', 1),
                ({'locale': 'invalid/tag'}, HTTPStatus.UNPROCESSABLE_ENTITY, 'en-US', 1),
                ({}, HTTPStatus.OK, 'en-US', 1),
                ({'locale': 'auto'}, HTTPStatus.OK, 'auto', 2),
            ]:
                response = await client.post('/login', data={**credentials, **fields})
                assert response.status_code == status
                await db.refresh(user)
                assert (user.locale, user.locale_revision) == (locale, revision)


@pytest.mark.asyncio
async def test_preference_endpoint_returns_monotonic_revision_and_get_info_preserves_bigint(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    """偏好接口返回递增版本且用户信息保留大整数精度。"""
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
    """其他用户编辑不能覆盖版本且语言变更可原子回滚。"""
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
    """更新语言时锁定记录并通过数据库递增版本。"""
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
    """用户偏好不存在时不会误报写入成功。"""
    async with sessions() as db:
        with pytest.raises(ServiceException):
            await UserService.update_user_locale_services(db, 999, 'missing', 'en-US')
        assert not db.in_transaction()


@pytest.mark.parametrize('tag', ['en-GB', 'en-AU', 'en-CA', 'en-Latn-GB', 'en-GB-u-ca-gregory'])
def test_explicit_english_language_family_fallback(tag: str) -> None:
    """显式回退到英语语系。"""
    assert LocaleRegistry.match_locale(tag) == 'en-US'
    assert LocaleUtil.negotiate_language(f'{tag};q=0.9,zh-CN;q=0.5') == 'en-US'


def test_exact_registered_locale_wins_and_chinese_scripts_do_not_merge(monkeypatch: pytest.MonkeyPatch) -> None:
    """已注册语言精确匹配优先且不合并不同中文书写体系。"""
    monkeypatch.setitem(LOCALES, 'en-GB', {'aliases': (), 'fallback': ('en-US',)})
    assert LocaleRegistry.match_locale('en-GB') == 'en-GB'
    assert LocaleRegistry.match_locale('zh-TW') is None
    assert LocaleRegistry.match_locale('zh-Hant') is None
    monkeypatch.setattr(I18nConfig, 'i18n_default_locale', 'en-US')
    assert LocaleUtil.negotiate_language('unsupported') == 'en-US'
    assert LocaleRegistry.fallback_chain('zh-CN') == ('zh-CN',)


def test_locale_endpoint_does_not_accept_client_revision() -> None:
    """语言接口拒绝客户端提供的版本。"""
    with pytest.raises(ValueError):
        UserLocaleModel(locale='en-US', revision='12')
