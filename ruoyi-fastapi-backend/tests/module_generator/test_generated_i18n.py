import gettext
import io
import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from babel.messages.pofile import read_po, write_po
from jinja2 import StrictUndefined
from test_generated_time_contract import column, make_table

from exceptions.exception import ServiceException, ServiceWarning
from module_generator.entity.vo.gen_vo import GenTableModel, GenTableParamsModel
from module_generator.service.gen_service import GenTableService
from utils.gen_i18n_util import GenI18nUtil
from utils.template_util import TemplateInitializer, TemplateUtils


def render_info(table: GenTableModel) -> list[Any]:
    context = TemplateUtils.prepare_context(table)
    templates = TemplateUtils.get_template_list(table)
    return [templates, [TemplateUtils.get_file_name(name, table) for name in templates], context, table]


def render_files(table: GenTableModel) -> tuple[list[Any], dict[str, str]]:
    info = render_info(table)
    env = TemplateInitializer.init_jinja2()
    env.undefined = StrictUndefined
    return info, GenTableService._GenTableService__render_files(env, info)


def flatten(value: dict, prefix: str = '') -> dict:
    result = {}
    for key, entry in value.items():
        full = f'{prefix}.{key}' if prefix else key
        if isinstance(entry, dict):
            result.update(flatten(entry, full))
        else:
            result[full] = entry
    return result


@pytest.mark.parametrize('web_type', ['element-ui', 'element-plus', 'react-antd'])
@pytest.mark.parametrize('category', ['crud', 'tree', 'sub'])
def test_generated_sources_register_literal_module_keys_and_compile(
    web_type: str, category: str, tmp_path: Path
) -> None:
    table = make_table('mysql', category, web_type)
    table.columns[1].is_required = '1'
    table.columns[1].column_comment = '名称“业务”'
    info, files = render_files(table)
    namespace = info[2]['i18nNamespace']
    source_path = f'frontend/src/i18n/locales/zh-CN/{namespace}.json'
    values = flatten(json.loads(files[source_path]))
    assert values['fields.itemName.label'] == '名称“业务”'
    assert values['title'] == '时间样例'
    assert values['detailTitle'] == '时间样例详情'
    referenced = set()
    source_files = {}
    for name, content in files.items():
        if name.endswith(('.vue', '.jsx')):
            referenced.update(re.findall(r"(?:\$t|\bt)\(['\"](generated\.[^'\"]+)['\"]", content))
            source_files[name] = content
        if name.endswith('.py'):
            compile(content, name, 'exec')
    assert referenced
    assert referenced <= {f'{namespace}:{key}' for key in values}
    assert not any('i18nFieldKey' in content for content in source_files.values())
    if category == 'sub':
        assert any(key.startswith('subfields.detail.') for key in values)
    target = tmp_path / 'sources.json'
    target.write_text(json.dumps(source_files), encoding='utf-8')
    framework = GenI18nUtil.FRAMEWORKS[web_type]
    app = GenI18nUtil.PROJECT_ROOT / 'ruoyi-fastapi-frontend' / framework / 'web'
    script = r"""
const fs = require('node:fs');
const {createRequire} = require('node:module');
const load = createRequire(process.argv[1] + '/package.json');
const files = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [name, source] of Object.entries(files)) {
  if (name.endsWith('.jsx')) {
    load('@babel/parser').parse(source, {sourceType:'module', plugins:['jsx']});
  } else if (process.argv[3] === 'vue2') {
    const compiler = load('vue-template-compiler');
    const parsed = compiler.parseComponent(source);
    const result = compiler.compile(parsed.template.content);
    if (result.errors.length) throw Error(JSON.stringify(result.errors));
    load('@babel/parser').parse(parsed.script.content, {sourceType:'module'});
  } else {
    const compiler = load('@vue/compiler-sfc');
    const parsed = compiler.parse(source);
    if (parsed.errors.length) throw Error(JSON.stringify(parsed.errors));
    compiler.compileScript(parsed.descriptor, {id:'generated'});
    const result = compiler.compileTemplate({source:parsed.descriptor.template.content, filename:name, id:'generated'});
    if (result.errors.length) throw Error(JSON.stringify(result.errors));
  }
}
"""
    result = subprocess.run(
        ['node', '-e', script, str(app), str(target), framework], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, result.stderr


def test_generator_uses_configured_locales_and_reports_unknown_translations() -> None:
    table = make_table('mysql', 'crud', 'element-ui')
    options = json.loads(table.options)
    options.update(
        i18nLocales=['en-US', 'fr-FR'],
        i18nTranslations={'en-US': {'title': 'Appointments', 'fields.itemName.label': 'Name'}},
    )
    table.options = json.dumps(options)
    info, files = render_files(table)
    assert info[2]['generatedI18n'].locales == ['zh-CN', 'en-US', 'fr-FR']
    english = json.loads(files['frontend/src/i18n/locales/en-US/generated.test.item.json'])
    french = json.loads(files['frontend/src/i18n/locales/fr-FR/generated.test.item.json'])
    assert english['title'] == 'Appointments'
    assert english['fields']['itemName']['label'] == 'Name'
    assert french['title'] == ''
    pending = json.loads(files['i18n/generated.test.item.pending.json'])
    assert 'generated.test.item:title' not in pending['en-US']['frontend']
    assert 'generated.test.item:title' in pending['fr-FR']['frontend']
    assert 'i18n:check' in files['i18n/generated.test.item.README.md']


@pytest.mark.parametrize(
    'options',
    [
        {'i18nSourceLocale': 'en-US'},
        {'i18nLocales': ['../../other-app']},
        {'i18nLocales': []},
        {'i18nTranslations': {'en-US': {'deleteConfirm': 'Missing interpolation'}}},
    ],
)
def test_generator_rejects_conflicting_sources_and_invalid_locale_options(options: dict[str, Any]) -> None:
    table = make_table('mysql', 'crud', 'element-ui')
    table.options = json.dumps({**json.loads(table.options), **options})
    with pytest.raises(ServiceWarning):
        TemplateUtils.prepare_context(table)


def test_generator_parameter_model_keeps_explicit_language_options() -> None:
    value = GenTableParamsModel(
        i18nSourceLocale='zh-CN', i18nLocales=['en-US', 'fr-FR'], i18nTranslations={'fr-FR': {'title': 'Titre'}}
    ).model_dump(by_alias=True, exclude_unset=True)
    assert value['i18nSourceLocale'] == 'zh-CN'
    assert value['i18nLocales'] == ['en-US', 'fr-FR']
    assert value['i18nTranslations']['fr-FR']['title'] == 'Titre'


def test_field_keys_are_stable_when_comments_change() -> None:
    table = make_table('mysql', 'crud', 'element-ui')
    first, first_files = render_files(table)
    table.function_name = '另一个显示名称'
    table.columns[1].column_comment = '另一个字段名'
    second, second_files = render_files(table)
    path = 'frontend/src/i18n/locales/zh-CN/generated.test.item.json'
    assert first[2]['i18nNamespace'] == second[2]['i18nNamespace']
    assert flatten(json.loads(first_files[path])).keys() == flatten(json.loads(second_files[path])).keys()


@pytest.mark.asyncio
async def test_preview_zip_and_disk_include_resources_without_overwriting_translations(tmp_path: Path) -> None:
    table = make_table('mysql', 'crud', 'element-ui')
    table.gen_path = str(tmp_path)
    info = render_info(table)
    with patch.object(
        GenTableService,
        '_GenTableService__get_gen_render_info',
        new=AsyncMock(side_effect=lambda *_: render_info(table)),
    ):
        await GenTableService.generate_code_services(object(), table.table_name)
        path = tmp_path / 'frontend/src/i18n/locales/en-US/generated.test.item.json'
        english = json.loads(path.read_text())
        english['fields']['itemName']['label'] = 'Handwritten name'
        english['custom'] = {'kept': 'Manual text'}
        path.write_text(json.dumps(english), encoding='utf-8')
        po_path = tmp_path / 'backend/i18n/catalogs/en-US/LC_MESSAGES/core.po'
        po_path.write_text(
            GenI18nUtil.merge_po(
                GenI18nUtil.po_content({'generated.test.item.fields.itemName.label': 'Manual export heading'}, 'en-US'),
                po_path.read_text(),
            ),
            encoding='utf-8',
        )
        table.columns.append(column('new_label', 'varchar(64)', 'str'))
        await GenTableService.generate_code_services(object(), table.table_name)
        english = json.loads(path.read_text())
        assert english['fields']['itemName']['label'] == 'Handwritten name'
        assert english['custom']['kept'] == 'Manual text'
        assert english['fields']['newLabel']['label'] == ''
        pending = json.loads((tmp_path / 'i18n/generated.test.item.pending.json').read_text())
        assert 'generated.test.item:fields.itemName.label' not in pending['en-US']['frontend']
        with po_path.with_suffix('.mo').open('rb') as compiled:
            translations = gettext.GNUTranslations(compiled)
        assert translations.gettext('generated.test.item.fields.itemName.label') == 'Manual export heading'

        with patch(
            'module_generator.service.gen_service.GenTableDao.get_gen_table_names',
            new=AsyncMock(return_value={table.table_name}),
        ):
            content = await GenTableService.batch_gen_code_services(object(), [table.table_name])
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert 'frontend/src/views/test/item/index.vue' in archive.namelist()
        assert 'frontend/src/i18n/locales/zh-CN/generated.test.item.json' in archive.namelist()
        assert 'backend/i18n/catalogs/zh-CN/LC_MESSAGES/core.mo' in archive.namelist()
        assert 'i18n/generated.test.item.pending.json' in archive.namelist()

    with (
        patch(
            'module_generator.service.gen_service.GenTableDao.get_gen_table_by_id',
            new=AsyncMock(return_value=table.model_dump()),
        ),
        patch.object(GenTableService, 'set_sub_table', new=AsyncMock()),
        patch.object(GenTableService, 'set_pk_column', new=AsyncMock()),
        patch('module_generator.service.gen_service.TemplateUtils.prepare_context', return_value=info[2]),
    ):
        preview = await GenTableService.preview_code_services(object(), 1)
    assert 'vue/index.vue.jinja2' in preview
    assert 'frontend/src/i18n/locales/zh-CN/generated.test.item.json' in preview


@pytest.mark.asyncio
async def test_invalid_existing_catalog_stops_before_overwriting_generated_source(tmp_path: Path) -> None:
    table = make_table('mysql', 'crud', 'element-ui')
    table.gen_path = str(tmp_path)
    source = tmp_path / 'frontend/src/views/test/item/index.vue'
    source.parent.mkdir(parents=True)
    source.write_text('Keep the existing source', encoding='utf-8')
    catalog = tmp_path / 'frontend/src/i18n/locales/en-US/generated.test.item.json'
    catalog.parent.mkdir(parents=True)
    catalog.write_text('{invalid', encoding='utf-8')
    with (
        patch.object(
            GenTableService, '_GenTableService__get_gen_render_info', new=AsyncMock(return_value=render_info(table))
        ),
        pytest.raises(ServiceWarning) as caught,
    ):
        await GenTableService.generate_code_services(object(), table.table_name)
    assert caught.value.msg_key == 'generator.i18nCatalogInvalid'
    assert source.read_text() == 'Keep the existing source'
    assert catalog.read_text() == '{invalid'


@pytest.mark.asyncio
async def test_catalog_compilation_finishes_before_any_generated_file_is_written(tmp_path: Path) -> None:
    table = make_table('mysql', 'crud', 'element-ui')
    table.gen_path = str(tmp_path)
    source = tmp_path / 'frontend/src/views/test/item/index.vue'
    source.parent.mkdir(parents=True)
    source.write_text('Keep the existing source', encoding='utf-8')
    with (
        patch.object(
            GenTableService, '_GenTableService__get_gen_render_info', new=AsyncMock(return_value=render_info(table))
        ),
        patch.object(GenI18nUtil, 'compile_po', side_effect=[b'compiled source', ValueError('Invalid target catalog')]),
        pytest.raises(ServiceException),
    ):
        await GenTableService.generate_code_services(object(), table.table_name)
    assert source.read_text() == 'Keep the existing source'
    assert not (tmp_path / 'backend').exists()


def test_invalid_po_is_rejected_and_unreviewed_translations_stay_pending() -> None:
    path = 'backend/i18n/catalogs/en-US/LC_MESSAGES/core.po'
    table = make_table('mysql', 'crud', 'element-ui')
    info, files = render_files(table)
    with pytest.raises(ServiceWarning) as caught:
        GenI18nUtil.merge_content(path, 'msgid "broken"\nmsgstr no-quotes', files[path])
    assert caught.value.msg_key == 'generator.i18nCatalogInvalid'
    catalog = read_po(io.StringIO(files[path]))
    key = 'generated.test.item.fields.itemName.label'
    catalog[key].string = 'Unreviewed name'
    catalog[key].flags.add('fuzzy')
    content = io.BytesIO()
    write_po(content, catalog)
    files[path] = content.getvalue().decode()
    info[2]['generatedI18n'].refresh_pending(files)
    pending = json.loads(files['i18n/generated.test.item.pending.json'])
    assert key in pending['en-US']['backend']


@pytest.mark.asyncio
async def test_batch_generation_merges_backend_catalogs_without_duplicate_zip_entries() -> None:
    first = make_table('mysql', 'crud', 'element-ui')
    second = first.model_copy(deep=True)
    second.table_name = 'second_table'
    second.business_name = 'second'
    second.class_name = 'Second'
    tables = {first.table_name: first, second.table_name: second}
    with (
        patch.object(
            GenTableService,
            '_GenTableService__get_gen_render_info',
            new=AsyncMock(side_effect=lambda _db, name, _source: render_info(tables[name])),
        ),
        patch(
            'module_generator.service.gen_service.GenTableDao.get_gen_table_names',
            new=AsyncMock(return_value=set(tables)),
        ),
    ):
        content = await GenTableService.batch_gen_code_services(object(), list(tables))
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert len(archive.namelist()) == len(set(archive.namelist()))
        catalog = read_po(io.BytesIO(archive.read('backend/i18n/catalogs/zh-CN/LC_MESSAGES/core.po')))
        assert 'generated.test.item.fields.itemName.label' in catalog
        assert 'generated.test.second.fields.itemName.label' in catalog


def test_generated_output_does_not_write_directly_into_an_existing_application() -> None:
    table = make_table('mysql', 'crud', 'element-ui')
    table.gen_path = str(GenI18nUtil.PROJECT_ROOT / 'ruoyi-fastapi-frontend/vue2/web/src')
    with pytest.raises(ServiceWarning) as caught:
        GenTableService._GenTableService__get_output_root(table)
    assert caught.value.msg_key == 'generator.outputMustBeBundleRoot'


@pytest.mark.parametrize('web_type', ['element-ui', 'element-plus', 'react-antd'])
def test_pinned_x18n_rejects_pending_translations_and_accepts_reviewed_generated_keys(
    web_type: str, tmp_path: Path
) -> None:
    table = make_table('mysql', 'crud', web_type)
    info, files = render_files(table)
    app = info[2]['generatedI18n'].app_root
    shutil.copytree(app / 'src/i18n/locales', tmp_path / 'src/i18n/locales')
    for name, content in files.items():
        if name.startswith('frontend/src/'):
            path = tmp_path / name.removeprefix('frontend/')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
    (tmp_path / 'x18n.config.mjs').write_text(
        "export default {sourceLocale:'zh-CN', locales:['zh-CN','en-US'], presets:['i18next'], "
        "resources:[{pattern:'src/i18n/locales/{locale}/{namespace}.json'}], "
        "namespace:{separator:':',default:'common'}, usage:{include:['src/**/*.{vue,jsx}'], "
        "calls:[{callee:'t'},{callee:'$t'}]}, checks:{'empty-translation':'error','missing-key':'error'}}",
        encoding='utf-8',
    )
    command = [str(app / 'node_modules/.bin/x18n'), '--root', str(tmp_path)]
    check = ['check', '--only', 'missing-key,empty-translation,placeholder-mismatch', '--json']
    result = subprocess.run([*command, *check], capture_output=True, text=True, check=False)
    report = json.loads(result.stdout)
    assert result.returncode == 1
    assert any(item['code'] == 'empty-translation' for item in report['diagnostics'])
    assert not any(item['code'] == 'missing-key' for item in report['diagnostics']), report
    namespace = info[2]['i18nNamespace']
    source = flatten(json.loads(files[f'frontend/src/i18n/locales/zh-CN/{namespace}.json']))
    # 测试夹具模拟补译，保留全部命名参数，由真实 CLI 校验发布门禁。
    translations = {
        f'{namespace}:{key}': 'Reviewed ' + ' '.join(re.findall(r'\{\{[^{}]+\}\}', value))
        for key, value in source.items()
    }
    payload = tmp_path / 'reviewed.json'
    payload.write_text(json.dumps({'en-US': translations}), encoding='utf-8')
    applied = subprocess.run([*command, 'apply', str(payload), '--json'], capture_output=True, text=True, check=False)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    verified = subprocess.run([*command, *check], capture_output=True, text=True, check=False)
    assert verified.returncode == 0, verified.stdout + verified.stderr
