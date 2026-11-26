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
from sqlalchemy.ext.asyncio import AsyncSession
from test_generated_time_contract import column, make_table

from common.context import LocaleContext
from exceptions.exception import ServiceException, ServiceWarning
from i18n.translator import I18nUtil
from module_generator.entity.vo.gen_vo import GenTableModel, GenTableParamsModel
from module_generator.service.gen_service import GenTableService
from utils.gen_i18n_util import GenI18nUtil
from utils.template_util import TemplateInitializer, TemplateUtils


def render_info(table: GenTableModel) -> list[Any]:
    """
    根据表定义生成模板预览内容。

    :param table: 代码生成业务表模型
    :return: 模板清单、对应的文件名及渲染上下文
    """
    context = TemplateUtils.prepare_context(table)
    templates = TemplateUtils.get_template_list(table)
    return [templates, [TemplateUtils.get_file_name(name, table) for name in templates], context, table]


def render_files(table: GenTableModel) -> tuple[list[Any], dict[str, str]]:
    """
    使用测试上下文渲染代码生成文件。

    :param table: 代码生成业务表模型
    :return: 预览信息及渲染得到的文件
    """
    info = render_info(table)
    env = TemplateInitializer.init_jinja2()
    env.undefined = StrictUndefined
    return info, GenTableService._render_files(env, info)


def flatten(value: dict, prefix: str = '') -> dict:
    """
    将嵌套翻译资源展开为键值映射。

    :param value: 待处理的输入值
    :param prefix: 路径或键的公共前缀
    :return: 执行当前操作得到的结果
    """
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
    """生成代码注册字面模块键并可编译。"""
    table = make_table('mysql', category, web_type)
    assert table.columns
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
(async () => {
for (const [name, source] of Object.entries(files)) {
  if (name.endsWith('.jsx')) {
    await load('vite').transformWithOxc(source, name, {lang:'jsx'});
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
})().catch(error => { console.error(error); process.exitCode = 1; });
"""
    result = subprocess.run(
        ['node', '-e', script, str(app), str(target), framework], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, result.stderr


def test_generator_uses_configured_locales_and_reports_unknown_translations() -> None:
    """生成器采用配置的语言并报告未知译文。"""
    table = make_table('mysql', 'crud', 'element-ui')
    assert table.options
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


@pytest.mark.parametrize('explicit', [False, True])
def test_backend_only_generation_needs_no_frontend_checkout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, explicit: bool
) -> None:
    """仅生成后端代码无需前端工作目录。"""
    monkeypatch.setattr(GenI18nUtil, 'PROJECT_ROOT', tmp_path)
    table = make_table('mysql', 'crud', 'element-plus')
    if explicit:
        table.options = json.dumps({'i18nLocales': ['en-US', 'fr-FR']})
    info, files = render_files(table)
    expected = ['zh-CN', 'en-US', 'fr-FR'] if explicit else ['zh-CN', 'en-US']
    assert info[2]['generatedI18n'].locales == expected
    for locale in expected:
        assert f'frontend/src/i18n/locales/{locale}/generated.test.item.json' in files
        assert f'backend/i18n/catalogs/{locale}/LC_MESSAGES/core/generated.test.item.po' in files


def test_explicit_languages_do_not_require_reading_target_metadata(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """显式指定语言后无需读取目标元数据。"""
    monkeypatch.setattr(GenI18nUtil, 'PROJECT_ROOT', tmp_path)
    meta = tmp_path / 'ruoyi-fastapi-frontend/vue3/web/src/i18n/locale-meta.json'
    meta.parent.mkdir(parents=True)
    meta.write_text('not valid JSON', encoding='utf-8')
    table = make_table('mysql', 'crud', 'element-plus')
    table.options = json.dumps({'i18nLocales': ['fr-FR']})
    assert GenI18nUtil(table).locales == ['zh-CN', 'fr-FR']
    table.options = '{}'
    with pytest.raises(ServiceWarning):
        GenI18nUtil(table)


@pytest.mark.asyncio
@pytest.mark.parametrize('locale', ['zh-CN', 'en-US'])
async def test_generation_failure_keeps_internal_paths_out_of_messages(locale: str) -> None:
    """生成失败的消息不泄露内部路径。"""
    table = make_table('mysql', 'crud', 'element-ui')
    secret = 'C:/private/application/secrets.py'
    with (
        patch.object(
            GenTableService, '_GenTableService__get_gen_render_info', AsyncMock(return_value=render_info(table))
        ),
        patch.object(GenTableService, '_get_output_root', side_effect=PermissionError(secret)),
        pytest.raises(ServiceException) as error,
    ):
        assert table.table_name is not None
        await GenTableService.generate_code_services(AsyncMock(spec=AsyncSession), table.table_name)
    fields = I18nUtil.message_fields(
        error.value.message,
        msg_key=error.value.msg_key,
        msg_params=error.value.msg_params,
        context=LocaleContext(locale),
    )
    assert secret not in json.dumps(fields)
    assert fields['msgParams'] == {'table_name': table.table_name}


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
    """生成器拒绝冲突的数据源和无效语言选项。"""
    table = make_table('mysql', 'crud', 'element-ui')
    assert table.options
    table.options = json.dumps({**json.loads(table.options), **options})
    with pytest.raises(ServiceWarning):
        TemplateUtils.prepare_context(table)


def test_generator_parameter_model_keeps_explicit_language_options() -> None:
    """生成参数模型保留显式语言选项。"""
    value = GenTableParamsModel(
        i18n_source_locale='zh-CN', i18n_locales=['en-US', 'fr-FR'], i18n_translations={'fr-FR': {'title': 'Titre'}}
    ).model_dump(by_alias=True, exclude_unset=True)
    assert value['i18nSourceLocale'] == 'zh-CN'
    assert value['i18nLocales'] == ['en-US', 'fr-FR']
    assert value['i18nTranslations']['fr-FR']['title'] == 'Titre'


def test_field_keys_are_stable_when_comments_change() -> None:
    """修改注释后字段键保持稳定。"""
    table = make_table('mysql', 'crud', 'element-ui')
    first, first_files = render_files(table)
    table.function_name = '另一个显示名称'
    assert table.columns
    table.columns[1].column_comment = '另一个字段名'
    second, second_files = render_files(table)
    path = 'frontend/src/i18n/locales/zh-CN/generated.test.item.json'
    assert first[2]['i18nNamespace'] == second[2]['i18nNamespace']
    assert flatten(json.loads(first_files[path])).keys() == flatten(json.loads(second_files[path])).keys()


@pytest.mark.asyncio
async def test_preview_zip_and_disk_include_resources_without_overwriting_translations(tmp_path: Path) -> None:
    """预览、压缩包及磁盘输出均含资源且保留已有译文。"""
    table = make_table('mysql', 'crud', 'element-ui')
    table.gen_path = str(tmp_path)
    info = render_info(table)
    with patch.object(
        GenTableService,
        '_GenTableService__get_gen_render_info',
        new=AsyncMock(side_effect=lambda *_: render_info(table)),
    ):
        assert table.table_name is not None
        await GenTableService.generate_code_services(AsyncMock(spec=AsyncSession), table.table_name)
        path = tmp_path / 'frontend/src/i18n/locales/en-US/generated.test.item.json'
        english = json.loads(path.read_text(encoding='utf-8'))
        english['fields']['itemName']['label'] = 'Handwritten name'
        english['custom'] = {'kept': 'Manual text'}
        path.write_text(json.dumps(english), encoding='utf-8')
        po_path = tmp_path / 'backend/i18n/catalogs/en-US/LC_MESSAGES/core/generated.test.item.po'
        po_path.write_text(
            GenI18nUtil.merge_po(
                GenI18nUtil.po_content({'generated.test.item.fields.itemName.label': 'Manual export heading'}, 'en-US'),
                po_path.read_text(encoding='utf-8'),
            ),
            encoding='utf-8',
        )
        assert table.columns
        table.columns.append(column('new_label', 'varchar(64)', 'str'))
        await GenTableService.generate_code_services(AsyncMock(spec=AsyncSession), table.table_name)
        english = json.loads(path.read_text(encoding='utf-8'))
        assert english['fields']['itemName']['label'] == 'Handwritten name'
        assert english['custom']['kept'] == 'Manual text'
        assert english['fields']['newLabel']['label'] == ''
        pending = json.loads((tmp_path / 'i18n/generated.test.item.pending.json').read_text(encoding='utf-8'))
        assert 'generated.test.item:fields.itemName.label' not in pending['en-US']['frontend']
        with po_path.open('rb') as source:
            catalog = read_po(source)
        assert catalog['generated.test.item.fields.itemName.label'].string == 'Manual export heading'
        assert 'generated.test.item.fields.newLabel.label' in catalog
        assert not list((tmp_path / 'backend').rglob('*.mo'))

        with patch(
            'module_generator.service.gen_service.GenTableDao.get_gen_table_names',
            new=AsyncMock(return_value={table.table_name}),
        ):
            content = await GenTableService.batch_gen_code_services(AsyncMock(spec=AsyncSession), [table.table_name])
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert 'frontend/src/views/test/item/index.vue' in archive.namelist()
        assert 'frontend/src/i18n/locales/zh-CN/generated.test.item.json' in archive.namelist()
        assert 'backend/i18n/catalogs/zh-CN/LC_MESSAGES/core/generated.test.item.po' in archive.namelist()
        assert not any(name.endswith('.mo') for name in archive.namelist())
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
        preview = await GenTableService.preview_code_services(AsyncMock(spec=AsyncSession), 1)
    assert 'vue/index.vue.jinja2' in preview
    assert 'frontend/src/i18n/locales/zh-CN/generated.test.item.json' in preview
    assert 'backend/i18n/catalogs/zh-CN/LC_MESSAGES/core/generated.test.item.po' in preview


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('relative_path', 'invalid'),
    [
        ('frontend/src/i18n/locales/en-US/generated.test.item.json', '{invalid'),
        ('backend/i18n/catalogs/en-US/LC_MESSAGES/core/generated.test.item.po', 'msgid "broken"\nmsgstr no-quotes'),
    ],
)
async def test_invalid_existing_catalog_stops_before_overwriting_generated_source(
    tmp_path: Path, relative_path: str, invalid: str
) -> None:
    """已有翻译目录无效时停止覆盖生成的源码。"""
    table = make_table('mysql', 'crud', 'element-ui')
    table.gen_path = str(tmp_path)
    source = tmp_path / 'frontend/src/views/test/item/index.vue'
    source.parent.mkdir(parents=True)
    source.write_text('Keep the existing source', encoding='utf-8')
    catalog = tmp_path / relative_path
    catalog.parent.mkdir(parents=True)
    catalog.write_text(invalid, encoding='utf-8')
    with (
        patch.object(
            GenTableService, '_GenTableService__get_gen_render_info', new=AsyncMock(return_value=render_info(table))
        ),
        pytest.raises(ServiceWarning) as caught,
    ):
        assert table.table_name is not None
        await GenTableService.generate_code_services(AsyncMock(spec=AsyncSession), table.table_name)
    assert caught.value.msg_key == 'generator.i18nCatalogInvalid'
    assert source.read_text(encoding='utf-8') == 'Keep the existing source'
    assert catalog.read_text(encoding='utf-8') == invalid


def test_invalid_po_is_rejected_and_unreviewed_translations_stay_pending() -> None:
    """拒绝无效 PO 文件并将未审核译文保留为待审。"""
    path = 'backend/i18n/catalogs/en-US/LC_MESSAGES/core/generated.test.item.po'
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
async def test_batch_generation_writes_one_backend_catalog_per_business_module() -> None:
    """批量生成对每个业务模块只写一份后端翻译目录。"""
    first = make_table('mysql', 'crud', 'element-ui')
    second = first.model_copy(deep=True)
    second.table_name = 'second_table'
    second.business_name = 'second'
    second.class_name = 'Second'
    assert first.table_name is not None
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
        content = await GenTableService.batch_gen_code_services(AsyncMock(spec=AsyncSession), list(tables))
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert len(archive.namelist()) == len(set(archive.namelist()))
        for locale in ('zh-CN', 'en-US'):
            for business in ('item', 'second'):
                namespace = f'generated.test.{business}'
                path = f'backend/i18n/catalogs/{locale}/LC_MESSAGES/core/{namespace}.po'
                catalog = read_po(io.BytesIO(archive.read(path)))
                assert f'{namespace}.fields.itemName.label' in catalog
                assert all(
                    isinstance(message.id, str) and message.id.startswith(f'{namespace}.')
                    for message in catalog
                    if message.id
                )


def test_generated_output_does_not_write_directly_into_an_existing_application() -> None:
    """生成文件不会直接写入已有应用。"""
    table = make_table('mysql', 'crud', 'element-ui')
    table.gen_path = str(GenI18nUtil.PROJECT_ROOT / 'ruoyi-fastapi-frontend/vue2/web/src')
    with pytest.raises(ServiceWarning) as caught:
        GenTableService._get_output_root(table)
    assert caught.value.msg_key == 'generator.outputMustBeBundleRoot'


@pytest.mark.parametrize('web_type', ['element-ui', 'element-plus', 'react-antd'])
def test_pinned_x18n_rejects_pending_translations_and_accepts_reviewed_generated_keys(
    web_type: str, tmp_path: Path
) -> None:
    """锁定版本的 x18n 拒绝待审译文并接受已审核的生成键。"""
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
    command = ['node', str(app / 'node_modules/@x18n/cli/bin.mjs'), '--root', str(tmp_path)]
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
