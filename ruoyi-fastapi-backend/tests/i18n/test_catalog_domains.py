import copy
import json
from collections.abc import Generator
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from babel.messages.catalog import Catalog
from babel.messages.mofile import write_mo
from babel.messages.pofile import write_po
from fastapi import FastAPI
from starlette.requests import Request

from common.annotation.cache_annotation import ApiCache
from common.context import LocaleContext, RequestContext
from common.vo import CrudResponseModel
from exceptions.exception import ServiceException
from i18n import t
from i18n.catalogs import CatalogRegistry, CatalogSpec
from i18n.message import I18nMessage
from i18n.translator import I18nUtil
from plugins.core.discovery.registry import PluginRegistry, RegisteredPlugin
from plugins.core.discovery.scanner import PluginScanner
from plugins.core.runtime.service.lifecycle.enable import (
    PluginEnabledLifecycleContext,
    PluginEnableUseCase,
    PluginUninstallLifecycleContext,
)
from plugins.core.runtime.service.lifecycle.install import PluginInstallLifecycleContext, PluginInstallUseCase
from plugins.core.runtime.service.lifecycle.upgrade import PluginUpgradeLifecycleContext, PluginUpgradeUseCase
from plugins.core.runtime.startup import PluginRuntimeStartupManager
from scripts.compile_i18n import compile_catalogs
from utils.response_util import ResponseUtil


@pytest.fixture(autouse=True)
def isolate_catalogs() -> Generator[None, None, None]:
    """为每个用例编译核心词库，并在结束后恢复注册表和指纹。"""
    compile_catalogs()
    original = CatalogRegistry._snapshots.copy()
    yield
    CatalogRegistry._snapshots = original
    CatalogRegistry._fingerprint = None


def write_plugin(root: Path, plugin_id: str = 'counts', english: str = 'Plugin ready') -> CatalogSpec:
    """创建真实 PO/MO，俄语三种复数用于验证 ngettext 的实际选择。"""
    directory = root / 'i18n'
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'locale-meta.json').write_text(
        json.dumps(
            {
                'defaultLocale': 'en-US',
                'locales': [{'code': 'en-US'}, {'code': 'ru-RU', 'fallback': ['en-US']}],
            }
        ),
        encoding='utf-8',
    )
    (root / 'plugin.yaml').write_text(
        f'id: {plugin_id}\nname: Counts\nversion: 1.0.0\nbackend:\n  module: plugins.{plugin_id}\n',
        encoding='utf-8',
    )
    spec = CatalogRegistry.plugin_spec(plugin_id, root)
    assert spec is not None
    for code in spec.locales:
        catalog = Catalog(locale=code.replace('-', '_'))
        catalog.add('common.success', english if code == 'en-US' else 'Готово')
        catalog.add(
            ('items.one', 'items.many'),
            (
                ('%(count)d item', '%(count)d items')
                if code == 'en-US'
                else ('%(count)d предмет', '%(count)d предмета', '%(count)d предметов')
            ),
        )
        catalog.add('wrapper', '%(message)s')
        path = spec.path(code, '.po')
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('wb') as output:
            write_po(output, catalog)
        with spec.path(code, '.mo').open('wb') as output:
            write_mo(output, catalog)
    return spec


@pytest.mark.parametrize(
    ('count', 'expected'), [(1, '1 предмет'), (2, '2 предмета'), (5, '5 предметов'), (21, '21 предмет')]
)
def test_plugin_plural_rules_and_domain_isolation(tmp_path: Path, count: int, expected: str) -> None:
    """验证俄语复数形式由插件词库决定，插件消息不进入核心域。"""
    write_plugin(tmp_path)
    CatalogRegistry.register_plugin('counts', tmp_path)
    assert t('items.one', domain='plugin.counts', locale='ru-RU', count=count, plural_key='items.many') == expected
    assert t('common.success', domain='plugin.counts', locale='ja-JP') == 'Plugin ready'
    assert t('common.success', locale='en-US') == 'Operation successful'
    assert t('items.one', locale='en-US', count=count, plural_key='items.many') == t(
        'common.unavailable', locale='en-US'
    )


@pytest.mark.parametrize('options', [{'count': 2}, {'plural_key': 'many'}, {'count': True, 'plural_key': 'many'}])
def test_plural_contract_requires_explicit_pair(options: dict) -> None:
    """验证调用方必须同时提供数量和复数消息标识。"""
    with pytest.raises(ValueError):
        t('one', **options)


def test_response_and_service_metadata_survive_copy_and_rendering(tmp_path: Path) -> None:
    """验证消息经过复制、服务异常及响应封装后仍保留域和复数信息。"""
    write_plugin(tmp_path)
    CatalogRegistry.register_plugin('counts', tmp_path)
    message = I18nMessage('已选择 2 项', msg_key='items.one', domain='plugin.counts', count=2, plural_key='items.many')
    deferred = copy.deepcopy(message)
    model = CrudResponseModel(
        is_success=True,
        message=str(message),
        msg_key=message.msg_key,
        domain=message.domain,
        count=message.count,
        plural_key=message.plural_key,
    )
    error = ServiceException(
        message=str(message), msg_key=message.msg_key, domain=message.domain, count=2, plural_key='items.many'
    )
    for locale, expected in [('ru-RU', '2 предмета'), ('en-US', '2 items')]:
        token = RequestContext.set_current_locale(LocaleContext(locale))
        try:
            responses = [
                ResponseUtil.success(msg=deferred, data={'nested': deferred}),
                ResponseUtil.success(msg=model.message),
                ResponseUtil.failure(msg=error.message, msg_key=error.msg_key, msg_params=error.msg_params),
                ResponseUtil.success(
                    msg=str(message), msg_key='items.one', domain='plugin.counts', count=2, plural_key='items.many'
                ),
            ]
            for response in responses:
                payload = json.loads(response.body)
                assert payload['msg'] == expected
                assert payload['msgKey'] == 'items.one'
                assert payload['msgDomain'] == 'plugin.counts'
                assert payload['msgCount'] == message.count
                assert payload['msgPluralKey'] == 'items.many'
                assert payload['msgParams']['count'] == message.count
            assert json.loads(responses[0].body)['data']['nested'] == expected
        finally:
            RequestContext.reset_current_locale(token)


@pytest.mark.asyncio
async def test_refresh_and_unload_change_cache_partition_without_request_file_reads(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """验证刷新和卸载改变缓存分区，普通读取使用已加载的词库。"""
    write_plugin(tmp_path)
    CatalogRegistry.register_plugin('counts', tmp_path)
    request = Request(
        {'type': 'http', 'method': 'GET', 'path': '/test', 'query_string': b'', 'headers': [], 'path_params': {}}
    )
    request._body = b''
    cache = ApiCache('catalog-test', vary_by_user=False)
    first = await cache._build_cache_key(request)
    old_snapshot = CatalogRegistry.snapshot('plugin.counts')
    write_plugin(tmp_path, english='New release')
    assert t('common.success', domain='plugin.counts', locale='en-US') == 'Plugin ready'
    I18nUtil.refresh_catalogs('plugin.counts')
    second = await cache._build_cache_key(request)
    assert second != first
    assert old_snapshot.translations['en-US'].gettext('common.success') == 'Plugin ready'
    assert t('common.success', domain='plugin.counts', locale='en-US') == 'New release'

    def unexpected_read(path: Path) -> bytes:
        raise AssertionError(f'Request read catalog: {path}')

    monkeypatch.setattr(Path, 'read_bytes', unexpected_read)
    assert await cache._build_cache_key(request) == second
    assert t('common.success', domain='../../core', locale='en-US') == t('common.unavailable', locale='en-US')
    assert t('common.success', domain='plugin.counts', locale='en-US') == 'New release'
    CatalogRegistry.unregister_plugin('counts')
    assert await cache._build_cache_key(request) != second
    assert t('common.success', domain='plugin.counts', locale='en-US') == t('common.unavailable', locale='en-US')
    assert t('common.success', locale='en-US') == 'Operation successful'


def test_bad_upgrade_preserves_live_catalog_and_compiler_covers_registered_domain(tmp_path: Path) -> None:
    """验证升级失败会保留当前词库，编译器也会处理已注册的插件域。"""
    spec = write_plugin(tmp_path)
    CatalogRegistry.register_plugin('counts', tmp_path)
    fingerprint = CatalogRegistry.fingerprint()
    spec.path('en-US', '.mo').write_bytes(b'invalid')
    with pytest.raises(ValueError, match='Invalid compiled'):
        CatalogRegistry.register_plugin('counts', tmp_path)
    assert CatalogRegistry.fingerprint() == fingerprint
    assert t('common.success', domain='plugin.counts', locale='en-US') == 'Plugin ready'
    compile_catalogs()
    assert CatalogRegistry.fingerprint() == fingerprint
    assert t('items.one', domain='plugin.counts', locale='ru-RU', count=5, plural_key='items.many') == '5 предметов'


def test_catalog_registration_rejects_paths_and_cycles(tmp_path: Path) -> None:
    """验证插件注册会拒绝越界资源路径和循环回退。"""
    with pytest.raises(ValueError):
        CatalogRegistry.plugin_spec('../../core', tmp_path)
    write_plugin(tmp_path)
    metadata = tmp_path / 'i18n' / 'locale-meta.json'
    metadata.write_text(
        json.dumps({'defaultLocale': 'en-US', 'locales': [{'code': '../../outside'}]}), encoding='utf-8'
    )
    with pytest.raises(ValueError):
        CatalogRegistry.register_plugin('counts', tmp_path)
    metadata.write_text(
        json.dumps({'defaultLocale': 'en-US', 'locales': [{'code': 'en-US', 'fallback': ['en-US']}]}), encoding='utf-8'
    )
    with pytest.raises(ValueError, match='fallback'):
        CatalogRegistry.register_plugin('counts', tmp_path)


@pytest.mark.asyncio
async def test_catalog_refresh_during_request_does_not_write_old_release_cache(tmp_path: Path) -> None:
    """验证请求处理中刷新词库后，新译文不会写入旧缓存分区。"""
    write_plugin(tmp_path)
    CatalogRegistry.register_plugin('counts', tmp_path)
    app = FastAPI()
    app.state.redis = SimpleNamespace(get=AsyncMock(return_value=None), set=AsyncMock())
    request = Request(
        {
            'type': 'http',
            'method': 'GET',
            'path': '/test',
            'query_string': b'',
            'headers': [],
            'path_params': {},
            'app': app,
        }
    )
    request._body = b''

    @ApiCache('catalog-refresh', vary_by_user=False)
    async def endpoint(request: Request) -> object:
        write_plugin(tmp_path, english='New version')
        CatalogRegistry.refresh('plugin.counts')
        return ResponseUtil.success(msg=t('common.success', domain='plugin.counts', locale='en-US'))

    response = await endpoint(request)
    assert json.loads(response.body)['msg'] == 'New version'
    app.state.redis.get.assert_awaited_once()
    app.state.redis.set.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('use_case', 'context_type', 'method'),
    [
        (PluginInstallUseCase, PluginInstallLifecycleContext, '_install_step_build_precheck'),
        (PluginUpgradeUseCase, PluginUpgradeLifecycleContext, '_upgrade_step_build_precheck'),
        (PluginEnableUseCase, PluginEnabledLifecycleContext, '_enabled_step_build_precheck'),
    ],
)
async def test_invalid_catalog_is_rejected_before_lifecycle_writes(
    tmp_path: Path,
    use_case: type,
    context_type: type,
    method: str,
) -> None:
    """验证安装、启用和升级流程会在持久化之前拒绝损坏的词库。"""
    spec = write_plugin(tmp_path)
    CatalogRegistry.register_plugin('counts', tmp_path)
    previous = CatalogRegistry.fingerprint()
    spec.path('en-US', '.mo').write_bytes(b'broken')
    context = (
        context_type('counts', True, False, 'enable')
        if context_type is PluginEnabledLifecycleContext
        else context_type('counts', False)
    )
    context.discovered_plugin = SimpleNamespace(backend_path=tmp_path)
    with pytest.raises(ValueError, match='Invalid compiled'):
        await getattr(use_case.__new__(use_case), method)(context)
    assert CatalogRegistry.fingerprint() == previous


@pytest.mark.asyncio
async def test_startup_isolates_corrupt_plugin_and_keeps_plugins_without_catalogs(tmp_path: Path) -> None:
    """验证启动时隔离损坏的插件，并保留未声明词库的旧插件。"""
    valid, broken, plain = (tmp_path / name for name in ('valid', 'broken', 'plain'))
    write_plugin(valid, 'valid')
    spec = write_plugin(broken, 'broken')
    spec.path('en-US', '.mo').write_bytes(b'broken')
    plain.mkdir()
    (plain / 'plugin.yaml').write_text(
        'id: plain\nname: Plain\nversion: 1.0.0\nbackend:\n  module: plugins.plain\n', encoding='utf-8'
    )
    discovered = [PluginScanner(tmp_path).load_manifest(path / 'plugin.yaml') for path in (valid, broken, plain)]
    app = FastAPI()
    app.state.plugin_registry = PluginRegistry([RegisteredPlugin(item, None, True, 'installed') for item in discovered])
    manager = PluginRuntimeStartupManager(SimpleNamespace())
    await manager.prepare_enabled_plugin_catalogs(app, startup_write_enabled=False)
    assert {item.plugin_id for item in app.state.plugin_registry.list_enabled_plugins()} == {'valid', 'plain'}
    assert t('common.success', domain='plugin.valid', locale='en-US') == 'Plugin ready'
    assert t('common.success', domain='plugin.broken', locale='en-US') == t('common.unavailable', locale='en-US')
    manager.run_enabled_plugin_hooks = AsyncMock()
    await manager.shutdown(app, startup_write_enabled=False)
    assert t('common.success', domain='plugin.valid', locale='en-US') == t('common.unavailable', locale='en-US')


@pytest.mark.asyncio
async def test_lifecycle_commit_upgrade_disable_and_uninstall_publish_catalogs(tmp_path: Path) -> None:
    """验证插件事务提交后发布新译文，停用和卸载时移除相应词库。"""
    write_plugin(tmp_path)
    initial = CatalogRegistry.prepare_plugin('counts', tmp_path)
    installed = PluginInstallLifecycleContext('counts', False, catalog_snapshot=initial)
    installed.lifecycle_uow = SimpleNamespace(commit=AsyncMock())
    installed.plugin = SimpleNamespace(enabled='0')
    await PluginInstallUseCase.__new__(PluginInstallUseCase)._install_step_commit(installed)
    assert t('common.success', domain='plugin.counts', locale='en-US') == 'Plugin ready'
    write_plugin(tmp_path, english='Upgrade')
    upgrade = PluginUpgradeLifecycleContext(
        'counts', False, catalog_snapshot=CatalogRegistry.prepare_plugin('counts', tmp_path)
    )
    upgrade.lifecycle_uow = SimpleNamespace(commit=AsyncMock())
    upgrade.plugin = SimpleNamespace(enabled='0')
    await PluginUpgradeUseCase.__new__(PluginUpgradeUseCase)._upgrade_step_commit(upgrade)
    assert t('common.success', domain='plugin.counts', locale='en-US') == 'Upgrade'
    use_case = PluginEnableUseCase.__new__(PluginEnableUseCase)
    use_case.dependencies = SimpleNamespace(
        lifecycle_state_gateway=SimpleNamespace(
            set_plugin_enabled_state=AsyncMock(return_value=SimpleNamespace(is_success=True)),
            mark_plugin_uninstalled_state=AsyncMock(return_value=SimpleNamespace(is_success=True)),
        )
    )
    disabled = PluginEnabledLifecycleContext('counts', False, False, 'disable')
    await use_case._enabled_step_update_enabled_state(disabled)
    assert t('common.success', domain='plugin.counts', locale='en-US') == t('common.unavailable', locale='en-US')
    enabled = PluginEnabledLifecycleContext('counts', True, False, 'enable', catalog_snapshot=upgrade.catalog_snapshot)
    await use_case._enabled_step_update_enabled_state(enabled)
    assert t('common.success', domain='plugin.counts', locale='en-US') == 'Upgrade'
    await use_case._uninstall_step_mark_uninstalled(PluginUninstallLifecycleContext('counts', False))
    assert t('common.success', domain='plugin.counts', locale='en-US') == t('common.unavailable', locale='en-US')
