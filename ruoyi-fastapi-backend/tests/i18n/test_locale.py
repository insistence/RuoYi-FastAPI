import asyncio
import gettext
import inspect
import json
import os
import subprocess
import sys
from io import BytesIO
from types import SimpleNamespace

import httpx
import pytest
from babel.messages.catalog import Catalog
from babel.messages.mofile import write_mo
from fastapi import FastAPI, Response
from sqlalchemy import create_engine, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.requests import Request
from starlette.types import Message

from common.annotation.cache_annotation import ApiCache
from common.context import LocaleContext, RequestContext
from exceptions.handle import handle_exception
from i18n import t
from i18n.locale import LocaleUtil
from i18n.registry import LocaleRegistry
from i18n.translator import SAFE_MESSAGE, I18nUtil
from middlewares.context_middleware import ContextCleanupMiddleware, add_context_cleanup_middleware
from middlewares.locale_middleware import add_locale_middleware
from module_admin.controller.user_controller import change_system_user_locale
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.user_vo import UserLocaleModel
from scripts.compile_i18n import compile_catalogs
from scripts.migrate_i18n import plan_migration
from utils.response_util import ResponseUtil


@pytest.fixture(autouse=True, scope='module')
def catalogs() -> None:
    compile_catalogs()


@pytest.mark.parametrize(
    ('header', 'expected'),
    [
        ('en-US', 'en-US'),
        ('en;q=0.8,zh-CN;q=0.9', 'zh-CN'),
        ('ja-JP;q=1,en-US;q=0.5', 'en-US'),
        ('en;q=0', 'zh-CN'),
        ('en;q=2,zh-CN', 'zh-CN'),
        ('en;q=bogus', 'zh-CN'),
        ('en_US', 'en-US'),
        ('zh-TW,en-US', 'en-US'),
        ('a' * 1025, 'zh-CN'),
    ],
)
def test_negotiation(header: str, expected: str) -> None:
    assert LocaleUtil.negotiate_language(header) == expected


@pytest.mark.parametrize('value', ['ja-JP', 'fr-CA', 'ar', 'de-DE-u-co-phonebk', 'auto'])
def test_preferences_are_extensible(value: str) -> None:
    assert UserLocaleModel(locale=value).locale == value
    with pytest.raises(ValueError):
        UserLocaleModel(locale=value, userId=2)


def test_locale_normalization() -> None:
    assert LocaleRegistry.normalize_locale('EN_us') == 'en-US'
    assert LocaleRegistry.normalize_locale('zh_hant_tw') == 'zh-Hant-TW'
    for value in ('../en', '', 'en;DROP', 'a' * 64, 'en-u-ca-gregory-u-nu-latn'):
        with pytest.raises(ValueError):
            LocaleRegistry.normalize_locale(value)


@pytest.mark.asyncio
@pytest.mark.parametrize('cleanup', [False, True])
async def test_concurrent_requests_legacy_and_exception_headers(cleanup: bool) -> None:
    app = FastAPI()
    handle_exception(app)
    if cleanup:
        add_context_cleanup_middleware(app)
    add_locale_middleware(app)

    @app.get('/message')
    async def message() -> Response:
        await asyncio.sleep(0.001)
        return ResponseUtil.success(headers={'Vary': 'Origin'})

    @app.get('/boom')
    async def boom() -> None:
        raise RuntimeError('secret-detail')

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url='http://test'
    ) as client:
        zh, en, legacy, failure = await asyncio.gather(
            client.get('/message', headers={'X-I18n-Version': '1', 'Accept-Language': 'zh-CN'}),
            client.get('/message', headers={'X-I18n-Version': '1', 'Accept-Language': 'en-US'}),
            client.get('/message', headers={'Accept-Language': 'en-US'}),
            client.get('/boom', headers={'X-I18n-Version': '1', 'Accept-Language': 'en-US'}),
        )
    assert zh.json()['msg'] == '操作成功'
    assert en.json()['msg'] == 'Operation successful'
    assert en.json()['msgKey'] == 'common.success'
    assert legacy.json()['msg'] == '操作成功'
    assert 'msgKey' not in legacy.json()
    assert 'content-language' not in legacy.headers
    assert set(en.headers['vary'].split(', ')) == {'Origin', 'Accept-Language', 'X-I18n-Version'}
    assert en.headers['content-language'] == failure.headers['content-language'] == 'en-US'
    assert 'secret-detail' not in failure.text
    assert failure.json()['data']['errorId']
    assert RequestContext.get_current_locale().version == 'legacy'


def test_locale_context_clear_and_nested_reset() -> None:
    original = RequestContext.get_current_locale()
    outer_context = LocaleContext('en-US', 'v1')
    outer_token = RequestContext.set_current_locale(outer_context)
    try:
        inner_token = RequestContext.set_current_locale(LocaleContext('zh-CN', 'v1'))
        try:
            RequestContext.clear_all()
            assert RequestContext.get_current_locale() == LocaleContext()
        finally:
            RequestContext.reset_current_locale(inner_token)
        assert RequestContext.get_current_locale() == outer_context
    finally:
        RequestContext.reset_current_locale(outer_token)
    assert RequestContext.get_current_locale() == original


@pytest.mark.asyncio
@pytest.mark.parametrize('raise_error', [False, True])
async def test_context_cleanup_preserves_outer_locale(raise_error: bool) -> None:
    context = LocaleContext('en-US', 'v1')
    token = RequestContext.set_current_locale(context)

    async def call_next(request: Request) -> Response:
        assert RequestContext.get_current_locale() == context
        if raise_error:
            raise RuntimeError('request failed')
        return ResponseUtil.success()

    try:
        middleware = ContextCleanupMiddleware(FastAPI())
        request = Request({'type': 'http', 'headers': []})
        if raise_error:
            with pytest.raises(RuntimeError, match='request failed'):
                await middleware.dispatch(request, call_next)
        else:
            response = await middleware.dispatch(request, call_next)
            assert json.loads(response.body)['msg'] == 'Operation successful'
        assert RequestContext.get_current_locale() == context
    finally:
        RequestContext.reset_current_locale(token)


@pytest.mark.parametrize('module', ['common.context', 'i18n', 'module_admin.entity.vo.user_vo'])
def test_context_and_i18n_can_be_imported_in_any_order(module: str) -> None:
    subprocess.run(
        [
            sys.executable,
            '-c',
            (
                f'import {module}; from common.context import LocaleContext, RequestContext; '
                'assert RequestContext.get_current_locale() == LocaleContext(); '
                'assert LocaleContext().locale == "en-US"'
            ),
        ],
        check=True,
        capture_output=True,
        text=True,
        env={**os.environ, 'I18N_DEFAULT_LOCALE': 'en-US'},
    )


def test_explicit_key_wins_and_legacy_transport_text_is_unchanged() -> None:
    legacy = I18nUtil.message_fields('Decryption failed', msg_key='transport.decryptFailed')
    assert legacy == {'msg': 'Decryption failed'}
    token = RequestContext.set_current_locale(LocaleContext('en-US', 'v1'))
    try:
        response = ResponseUtil.success('旧文案', msg_key='profile.localeSaved')
        assert json.loads(response.body)['msg'] == 'Language preference saved'
        assert I18nUtil.message_fields('custom original')['msg'] == 'custom original'
        assert I18nUtil.translate('missing.internal.key') != 'missing.internal.key'
    finally:
        RequestContext.reset_current_locale(token)


@pytest.mark.asyncio
async def test_t_uses_call_time_context_and_keeps_explicit_locale_local() -> None:
    original = RequestContext.get_current_locale()

    async def render(locale: str) -> tuple[str, str, str]:
        context = LocaleContext(locale, 'v1')
        token = RequestContext.set_current_locale(context)
        try:
            await asyncio.sleep(0)
            text = t('common.success')
            explicit = t('common.success', locale='en-US')
            assert RequestContext.get_current_locale() == context
            return text, explicit, t('common.success')
        finally:
            RequestContext.reset_current_locale(token)

    zh, en = await asyncio.gather(render('zh-CN'), render('en-US'))
    assert zh == ('操作成功', 'Operation successful', '操作成功')
    assert en == ('Operation successful', 'Operation successful', 'Operation successful')
    assert RequestContext.get_current_locale() == original


def test_t_interpolates_parameters_and_preserves_safe_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    def load_catalog(code: str) -> gettext.GNUTranslations:
        catalog = Catalog(locale=code.replace('-', '_'))
        if code == 'zh-CN':
            catalog.add('example.greeting', '你好，%(name)s')
            catalog.add('example.fallback', '已处理 %(count)d 项')
        else:
            catalog.add('example.greeting', 'Hello, %(name)s')
        output = BytesIO()
        write_mo(output, catalog)
        output.seek(0)
        return gettext.GNUTranslations(output)

    monkeypatch.setattr(I18nUtil, '_load_catalog', staticmethod(load_catalog))
    assert t('example.greeting', {'name': 'Ada'}, locale='en-US') == 'Hello, Ada'
    assert t('example.greeting', {'name': 'Ada'}, locale='zh-CN') == '你好，Ada'
    assert t('example.fallback', {'count': 2}, locale='en-US') == '已处理 2 项'
    assert t('example.greeting', locale='en-US') == SAFE_MESSAGE
    assert t('example.missing', locale='en-US') == SAFE_MESSAGE


@pytest.mark.asyncio
async def test_api_cache_separates_language_and_capability() -> None:
    async def receive() -> Message:
        return {'type': 'http.request', 'body': b''}

    request = Request(
        {'type': 'http', 'method': 'GET', 'path': '/test', 'query_string': b'', 'headers': [], 'path_params': {}},
        receive,
    )
    cache = ApiCache(namespace='i18n-test', vary_by_user=False)
    values = []
    contexts = [LocaleContext(), LocaleContext('zh-CN', 'v1'), LocaleContext('en-US', 'v1')]
    for context in contexts:
        token = RequestContext.set_current_locale(context)
        try:
            values.append(await cache._build_cache_key(request))
        finally:
            RequestContext.reset_current_locale(token)
    assert len(set(values)) == len(contexts)


@pytest.mark.asyncio
async def test_locale_endpoint_only_changes_current_account() -> None:
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    try:
        async with engine.begin() as connection:
            await connection.run_sync(SysUser.__table__.create)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with sessions() as db:
            db.add_all(
                [
                    SysUser(user_id=1, user_name='one', nick_name='One'),
                    SysUser(user_id=2, user_name='two', nick_name='Two'),
                ]
            )
            await db.commit()
            current = SimpleNamespace(user=SimpleNamespace(user_id=1, user_name='one'))
            response = await inspect.unwrap(change_system_user_locale)(
                SimpleNamespace(), UserLocaleModel(locale='ja-JP'), db, current
            )
            assert json.loads(response.body)['data']['locale'] == 'ja-JP'
        async with sessions() as db:
            users = (await db.scalars(select(SysUser).order_by(SysUser.user_id))).all()
            assert [user.locale for user in users] == ['ja-JP', 'zh-CN']
            assert users[0].nick_name == 'One'
    finally:
        await engine.dispose()


def test_schema_expansion_is_repeatable_and_preserves_data() -> None:
    engine = create_engine('sqlite:///:memory:')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE sys_user (user_id INTEGER PRIMARY KEY, user_name VARCHAR(30))'))
        connection.execute(text("INSERT INTO sys_user VALUES (1, 'existing')"))
        for table in ('sys_menu', 'sys_dict_type', 'sys_dict_data'):
            connection.execute(text(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY)'))
        for statement in plan_migration(connection):
            connection.execute(text(statement))
        assert plan_migration(connection) == []
        assert connection.execute(text('SELECT user_name, locale FROM sys_user')).one() == ('existing', 'zh-CN')
    engine.dispose()
