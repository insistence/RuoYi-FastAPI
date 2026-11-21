import asyncio
import gettext
import inspect
import json
import os
import subprocess
import sys
from io import BytesIO
from itertools import count
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from babel.messages.catalog import Catalog
from babel.messages.mofile import write_mo
from fastapi import FastAPI, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import Message

from common.annotation.cache_annotation import ApiCache
from common.context import LocaleContext, RequestContext
from config.env import I18nConfig, TransportCryptoConfig
from exceptions.handle import handle_exception
from i18n import t
from i18n.catalogs import CatalogRegistry
from i18n.locale import LocaleUtil
from i18n.registry import LOCALES, LocaleRegistry
from i18n.translation import TranslationUtil
from i18n.translator import SAFE_MESSAGE, I18nUtil
from middlewares.context_middleware import ContextCleanupMiddleware, add_context_cleanup_middleware
from middlewares.locale_middleware import add_locale_middleware
from middlewares.transport_crypto_middleware import TransportCryptoMiddleware
from module_admin.controller.user_controller import change_system_user_locale
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.user_vo import UserLocaleModel
from scripts.compile_i18n import compile_catalogs
from utils.response_util import ResponseUtil
from utils.transport_crypto_util import TransportCryptoUtil, TransportKeyPair, TransportKeyProvider


@pytest.fixture(autouse=True, scope='module')
def catalogs() -> None:
    """编译本组用例使用的核心中英文词库。"""
    compile_catalogs()


@pytest.mark.parametrize(
    ('header', 'expected'),
    [
        ('en-US', 'en-US'),
        ('en;q=0.8,zh-CN;q=0.9', 'zh-CN'),
        ('ja-JP;q=1,en-US;q=0.5', 'en-US'),
        ('en;q=0', 'zh-CN'),
        ('zh-CN;q=0,*;q=1', 'en-US'),
        ('*;q=1,zh;q=0', 'en-US'),
        ('*;q=0,en-US;q=0.4', 'en-US'),
        ('*;q=0.9,zh-CN;q=0.2', 'en-US'),
        ('en;q=0,en-US;q=1', 'en-US'),
        ('en-GB;q=0.2,zh-CN;q=0.5,en-AU;q=0.8', 'en-US'),
        ('*;q=0', 'zh-CN'),
        ('en;q=2,zh-CN', 'zh-CN'),
        ('en;q=bogus', 'zh-CN'),
        ('en_US', 'en-US'),
        ('zh-TW,en-US', 'en-US'),
        ('a' * 1025, 'zh-CN'),
    ],
)
def test_negotiation(header: str, expected: str) -> None:
    """验证语言范围的权重、排除项和通配符共同决定请求语言。"""
    assert LocaleUtil.negotiate_language(header) == expected


def test_disabled_locales_are_excluded_from_negotiation_catalogs_and_names(monkeypatch: pytest.MonkeyPatch) -> None:
    """验证停用语言从协商结果、发布词库和显示名称的回退链中移除。"""
    monkeypatch.setitem(LOCALES['en-US'], 'enabled', False)
    monkeypatch.setitem(LOCALES, 'en-GB', {'aliases': (), 'fallback': ('en-US',)})
    assert LocaleRegistry.enabled_locales() == ('zh-CN', 'en-GB')
    assert all(LocaleRegistry.match_locale(tag) is None for tag in ('en-US', 'en', 'en-AU'))
    assert LocaleRegistry.fallback_chain('en-GB') == ('en-GB', 'zh-CN')
    assert CatalogRegistry.core_spec().locales == ('zh-CN', 'en-GB')
    assert LocaleUtil.negotiate_language('en;q=0,*;q=1') == 'zh-CN'
    assert TranslationUtil.resolve('原名', {'en-US': 'Name'}, locale='en-US') == '原名'
    assert UserLocaleModel(locale='en-US').locale == 'en-US'
    monkeypatch.setattr(I18nConfig, 'i18n_default_locale', 'en-US')
    with pytest.raises(ValueError, match='registered and enabled'):
        CatalogRegistry.core_spec()


def test_header_limits_only_log_counts(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    """验证超限告警只记录原因及累计次数。"""
    monkeypatch.setattr('i18n.locale._overlong_headers', count(1))
    monkeypatch.setattr('i18n.locale._excess_ranges', count(1))
    for _ in range(3):
        LocaleUtil.negotiate_language('sensitive' * 128)
    LocaleUtil.negotiate_language(','.join(['sensitive'] * 21))
    assert [record.getMessage() for record in caplog.records] == [
        'i18n negotiation limit: reason=length count=1',
        'i18n negotiation limit: reason=length count=2',
        'i18n negotiation limit: reason=range_count count=1',
    ]


def test_missing_translation_uses_localized_safe_message_and_logs_only_metadata(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """验证缺词时返回本地化通用提示，日志不包含插值参数。"""
    message = t('example.missing', {'password': 'private-value'}, locale='en-US')
    assert message == 'The service is temporarily unavailable. Please try again later.'
    assert 'domain=core locale=en-US key=example.missing version=' in caplog.text
    assert 'private-value' not in caplog.text
    assert 'password' not in caplog.text


@pytest.mark.parametrize('value', ['ja-JP', 'fr-CA', 'ar', 'de-DE-u-co-phonebk', 'auto'])
def test_preferences_are_extensible(value: str) -> None:
    """验证账号偏好可保存合法的扩展语言标签。"""
    assert UserLocaleModel(locale=value).locale == value
    with pytest.raises(ValueError):
        UserLocaleModel(locale=value, userId=2)


def test_locale_normalization() -> None:
    """验证语言标签规范化，并拒绝无效标签及重复扩展。"""
    assert LocaleRegistry.normalize_locale('EN_us') == 'en-US'
    assert LocaleRegistry.normalize_locale('zh_hant_tw') == 'zh-Hant-TW'
    for value in ('../en', '', 'en;DROP', 'a' * 64, 'en-u-ca-gregory-u-nu-latn'):
        with pytest.raises(ValueError):
            LocaleRegistry.normalize_locale(value)


@pytest.mark.parametrize(
    ('existing', 'expected'),
    [
        (('Origin', 'Accept-Encoding'), ['Origin, Accept-Encoding, Accept-Language']),
        (('Origin', 'Accept-Encoding, accept-language'), ['Origin', 'Accept-Encoding, accept-language']),
        (('Origin', '*'), ['Origin', '*']),
    ],
)
def test_locale_headers_preserve_all_vary_lines(existing: tuple[str, ...], expected: list[str]) -> None:
    """验证多行 Vary 中的维度和通配符都保留，按大小写无关的名称去重。"""
    headers = MutableHeaders()
    for value in existing:
        headers.append('Vary', value)
    LocaleUtil.add_locale_headers(headers, LocaleContext('en-US'))
    assert headers.getlist('vary') == expected
    assert headers['content-language'] == 'en-US'


@pytest.mark.asyncio
@pytest.mark.parametrize('cleanup', [False, True])
async def test_concurrent_requests_negotiate_language_and_set_exception_headers(cleanup: bool) -> None:
    """验证并发请求各自保留语言，异常响应也会附加协商头。"""
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
        zh, en, default, failure = await asyncio.gather(
            client.get('/message', headers={'Accept-Language': 'zh-CN'}),
            client.get('/message', headers={'Accept-Language': 'en-US'}),
            client.get('/message'),
            client.get('/boom', headers={'Accept-Language': 'en-US'}),
        )
    assert zh.json()['msg'] == '操作成功'
    assert en.json()['msg'] == 'Operation successful'
    assert en.json()['msgKey'] == 'common.success'
    assert default.json()['msg'] == zh.json()['msg']
    assert default.json()['msgKey'] == zh.json()['msgKey'] == 'common.success'
    assert default.headers['content-language'] == 'zh-CN'
    assert set(en.headers['vary'].split(', ')) == {'Origin', 'Accept-Language'}
    assert en.headers['content-language'] == failure.headers['content-language'] == 'en-US'
    assert 'secret-detail' not in failure.text
    assert failure.json()['data']['errorId']
    assert RequestContext.get_current_locale() == LocaleContext()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('locale', 'kid', 'key', 'message'),
    [
        ('zh-CN', 'current', 'transport.decryptFailed', '加密请求解析失败'),
        ('en-US', 'current', 'transport.decryptFailed', 'Unable to decrypt the request'),
        ('zh-CN', 'expired', 'transport.keyExpired', '密钥版本不存在'),
        ('en-US', 'expired', 'transport.keyExpired', 'The encryption key is no longer available'),
    ],
)
async def test_transport_key_errors_keep_retry_keys(
    monkeypatch: pytest.MonkeyPatch, locale: str, kid: str, key: str, message: str
) -> None:
    """验证密钥不存在及请求密钥解密失败时，客户端可用稳定标识判断是否换钥。"""
    monkeypatch.setattr(TransportCryptoConfig, 'transport_crypto_enabled', True)
    monkeypatch.setattr(TransportCryptoConfig, 'transport_crypto_mode', 'optional')
    monkeypatch.setattr(TransportKeyProvider, '_key_pairs', {'current': TransportKeyPair('current', 'test', 'test')})
    private_key = Mock()
    private_key.decrypt.side_effect = ValueError('provider diagnostic')
    monkeypatch.setattr(
        'utils.transport_crypto_util.serialization.load_pem_private_key', Mock(return_value=private_key)
    )

    async def decrypt_request(*args: object) -> None:
        TransportCryptoUtil.decrypt_request_key({'kid': kid, 'ek': ''})

    monkeypatch.setattr(TransportCryptoMiddleware, '_decrypt_request', decrypt_request)
    app = FastAPI()
    app.add_middleware(TransportCryptoMiddleware)
    add_locale_middleware(app)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/message', headers={'Accept-Language': locale, 'X-Transport-Encrypt': '1'})
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.headers['content-language'] == locale
    assert response.json() == {'code': 400, 'msg': message, 'msgKey': key, 'msgParams': {}, 'success': False}


def test_locale_context_clear_and_nested_reset() -> None:
    """验证清理及重置内层语言上下文后可恢复外层状态。"""
    original = RequestContext.get_current_locale()
    outer_context = LocaleContext('en-US')
    outer_token = RequestContext.set_current_locale(outer_context)
    try:
        inner_token = RequestContext.set_current_locale(LocaleContext('zh-CN'))
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
    """验证请求清理中间件在成功和异常时都保留外层语言。"""
    context = LocaleContext('en-US')
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
    """验证请求上下文与翻译模块的导入顺序不影响默认语言。"""
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


def test_explicit_message_key_takes_precedence_in_both_languages() -> None:
    """验证中英文响应均优先使用显式指定的语义标识。"""
    fields = I18nUtil.message_fields('Decryption failed', msg_key='transport.decryptFailed')
    assert fields == {'msg': '加密请求解析失败', 'msgKey': 'transport.decryptFailed', 'msgParams': {}}
    token = RequestContext.set_current_locale(LocaleContext('en-US'))
    try:
        response = ResponseUtil.success('旧文案', msg_key='profile.localeSaved')
        assert json.loads(response.body)['msg'] == 'Language preference saved'
        assert I18nUtil.message_fields('custom original')['msg'] == 'custom original'
        assert I18nUtil.translate('missing.internal.key') != 'missing.internal.key'
    finally:
        RequestContext.reset_current_locale(token)


@pytest.mark.asyncio
async def test_t_uses_call_time_context_and_keeps_explicit_locale_local() -> None:
    """验证即时翻译读取当前请求语言，显式语言参数只影响本次调用。"""
    original = RequestContext.get_current_locale()

    async def render(locale: str) -> tuple[str, str, str]:
        context = LocaleContext(locale)
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
    """验证参数插值、缺词回退和通用提示。"""

    def load_catalog(code: str, domain: str = 'core') -> gettext.GNUTranslations:
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
async def test_api_cache_uses_effective_language() -> None:
    """验证相同有效语言共享缓存，不同语言分别缓存。"""

    async def receive() -> Message:
        return {'type': 'http.request', 'body': b''}

    request = Request(
        {'type': 'http', 'method': 'GET', 'path': '/test', 'query_string': b'', 'headers': [], 'path_params': {}},
        receive,
    )
    cache = ApiCache(namespace='i18n-test', vary_by_user=False)
    values = []
    contexts = [LocaleContext(), LocaleContext('zh-CN'), LocaleContext('en-US')]
    for context in contexts:
        token = RequestContext.set_current_locale(context)
        try:
            values.append(await cache._build_cache_key(request))
        finally:
            RequestContext.reset_current_locale(token)
    assert values[0] == values[1] != values[2]


@pytest.mark.asyncio
async def test_locale_endpoint_only_changes_current_account() -> None:
    """验证语言偏好接口只能更新当前登录账号。"""
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
