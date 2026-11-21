from pathlib import Path

import pytest
from babel.messages.catalog import Catalog
from babel.messages.pofile import read_po, write_po

from i18n.catalogs import CatalogRegistry
from scripts.compile_i18n import compile_catalogs


@pytest.fixture
def core_modules(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """创建独立的核心词库，包含不同上下文的同名消息和按语言变化的复数。"""
    monkeypatch.setattr('i18n.catalogs.CATALOG_ROOT', tmp_path)
    monkeypatch.setattr('scripts.compile_i18n.SOURCE_PLUGINS', tmp_path / 'plugins')
    monkeypatch.setattr(CatalogRegistry, '_snapshots', {})
    monkeypatch.setattr(CatalogRegistry, '_fingerprint', None)
    for locale in ('zh-CN', 'en-US'):
        directory = tmp_path / locale / 'LC_MESSAGES/core'
        directory.mkdir(parents=True)
        actions = Catalog(locale=locale.replace('-', '_'))
        actions.add('open', '打开' if locale == 'zh-CN' else 'Open the item', context='action')
        with (directory / 'common.po').open('wb') as output:
            write_po(output, actions)
        items = Catalog(locale=locale.replace('-', '_'))
        items.add('open', '开放' if locale == 'zh-CN' else 'Open for business', context='status')
        items.add(('item.one', 'item.many'), ('条',) if locale == 'zh-CN' else ('item', 'items'))
        with (directory / 'generated.test.item.po').open('wb') as output:
            write_po(output, items)
    return tmp_path


def test_core_modules_compile_to_one_runtime_domain(core_modules: Path) -> None:
    """验证业务和公共 PO 合入各语言的 core.mo，保留上下文和复数规则。"""
    compile_catalogs()
    translations = CatalogRegistry.snapshot('core').translations
    assert translations['en-US'].pgettext('action', 'open') == 'Open the item'
    assert translations['en-US'].pgettext('status', 'open') == 'Open for business'
    assert translations['en-US'].ngettext('item.one', 'item.many', 2) == 'items'
    assert translations['zh-CN'].ngettext('item.one', 'item.many', 2) == '条'
    assert sorted(core_modules.rglob('*.mo')) == sorted(
        core_modules / locale / 'LC_MESSAGES/core.mo' for locale in ('zh-CN', 'en-US')
    )


@pytest.mark.parametrize('defect', ['missing_module', 'missing_key', 'duplicate_key', 'wrong_context', 'wrong_plural'])
def test_invalid_core_module_preserves_last_good_catalogs(core_modules: Path, defect: str) -> None:
    """模块、消息身份或复数定义不完整时，保留各语言上次发布的二进制文件。"""
    compile_catalogs()
    artifacts = {path: path.read_bytes() for path in core_modules.rglob('*.mo')}
    # 中文有待发布的变更，英文校验失败时也不能把该变更提前发布。
    chinese = core_modules / 'zh-CN/LC_MESSAGES/core/common.po'
    chinese.write_text(chinese.read_text(encoding='utf-8').replace('打开', '打开项目'), encoding='utf-8')
    path = core_modules / 'en-US/LC_MESSAGES/core/generated.test.item.po'
    if defect == 'missing_module':
        path.unlink()
    else:
        with path.open('rb') as source:
            catalog = read_po(source)
        if defect == 'duplicate_key':
            catalog.add('open', 'Open', context='action')
        elif defect == 'wrong_plural':
            catalog.delete('item.one')
            catalog.add(('item.one', 'item.other'), ('item', 'items'))
        else:
            catalog.delete('open', context='status')
            if defect == 'wrong_context':
                catalog.add('open', 'Open for business', context='other')
        with path.open('wb') as output:
            write_po(output, catalog)

    with pytest.raises(ValueError) as error:
        compile_catalogs()
    assert path.name in str(error.value)
    if defect == 'duplicate_key':
        assert 'open' in str(error.value)
    assert {path: path.read_bytes() for path in artifacts} == artifacts
