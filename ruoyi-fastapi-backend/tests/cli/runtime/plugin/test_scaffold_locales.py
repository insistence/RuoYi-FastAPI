import json
from pathlib import Path

import pytest

from cli.runtime.plugin.scaffold.frontend import PluginFrontendScaffoldTemplateBuilder
from cli.runtime.plugin.scaffold.locales import PluginLocaleScaffoldBuilder


@pytest.mark.parametrize('framework', ['vue2', 'vue3', 'react'])
def test_source_plugin_views_use_local_namespace_and_reactive_host_adapter(framework: str) -> None:
    view = PluginFrontendScaffoldTemplateBuilder.build_crud_view('demo', framework)
    assert "import '../i18n'" in view
    assert 'plugin.demo:nameRequired' in view
    assert 'plugin.demo:deleteConfirm' in view
    assert 'plugin.demo:editTitle' in view
    assert '名称不能为空' not in view
    assert 'label="名称"' not in view
    if framework == 'react':
        assert 'useI18n()' in view
        assert 'useLocalizedFormErrors(form)' in view
    else:
        assert ':validate-on-rule-change="false"' in view
        assert "validateState === 'error'" in view
        assert 'dialogTitle =' not in view or 'computed(' in view


def test_plugin_locale_scaffold_keeps_future_languages_pending_in_its_own_directory(tmp_path: Path) -> None:
    frontend = tmp_path / 'web'
    meta = PluginLocaleScaffoldBuilder.load_metadata(frontend)
    meta['locales'].append({'code': 'ja-JP', 'enabled': True, 'fallback': ['en-US'], 'direction': 'ltr'})
    meta_path = frontend / 'src' / 'i18n' / 'locale-meta.json'
    meta_path.parent.mkdir(parents=True)
    meta_path.write_text(json.dumps(meta), encoding='utf-8')
    root = frontend / 'plugins' / 'demo'
    generated = dict(PluginLocaleScaffoldBuilder.build_files('demo', root, frontend))
    assert all(path.is_relative_to(root) for path in generated)
    zh = json.loads(generated[root / 'locales' / 'zh-CN.json'])
    en = json.loads(generated[root / 'locales' / 'en-US.json'])
    ja = json.loads(generated[root / 'locales' / 'ja-JP.json'])
    assert zh.keys() == en.keys() == ja.keys()
    assert all(value == '' for value in ja.values())
    assert "const namespace = 'plugin.demo'" in generated[root / 'i18n.js']
    assert 'removeResourceBundle(locale, namespace)' in generated[root / 'i18n.js']
    bundle = dict(PluginLocaleScaffoldBuilder.build_bundle_files(tmp_path / 'bundle', frontend))
    assert json.loads(bundle[tmp_path / 'bundle' / 'src' / 'locale-meta.json']) == meta
    assert all(value == '' for value in json.loads(bundle[tmp_path / 'bundle' / 'locales' / 'ja-JP.json']).values())


def test_plugin_locale_scaffold_rejects_locale_paths_outside_plugin(tmp_path: Path) -> None:
    meta = PluginLocaleScaffoldBuilder.load_metadata(tmp_path)
    meta['locales'].append({'code': '../escape'})
    path = tmp_path / 'src' / 'i18n' / 'locale-meta.json'
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(meta), encoding='utf-8')
    with pytest.raises(ValueError, match='路径分隔符'):
        PluginLocaleScaffoldBuilder.build_files('demo', tmp_path / 'plugins' / 'demo', tmp_path)
    with pytest.raises(ValueError, match='路径分隔符'):
        PluginLocaleScaffoldBuilder.build_bundle_files(tmp_path / 'bundle', tmp_path)
