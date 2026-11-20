"""React templates preserve the generator's CRUD, tree, child-table and time contracts."""

import json
import subprocess
from pathlib import Path

import pytest
from jinja2 import StrictUndefined
from test_generated_time_contract import make_table, render_case

from module_generator.service.gen_service import GenTableService
from utils.gen_i18n_util import GenI18nUtil
from utils.template_util import TemplateInitializer, TemplateUtils


@pytest.mark.parametrize('db_type', ['mysql', 'postgresql'])
@pytest.mark.parametrize('category', ['crud', 'tree', 'sub'])
def test_react_templates_render_all_business_files(db_type: str, category: str) -> None:
    table = make_table(db_type, category, 'react-antd')
    rendered = render_case(db_type, category, 'react-antd')
    files = {TemplateUtils.get_file_name(name, table): text for name, text in rendered.items()}
    assert '' not in files
    assert len(files) == len(rendered)
    assert {name for name in files if name.startswith('frontend/')} == {
        'frontend/src/api/test/item.js',
        'frontend/src/views/test/item/index.jsx',
        'frontend/src/views/test/item/view.jsx',
    }
    page = files['frontend/src/views/test/item/index.jsx']
    assert 'serializeTimeFieldsForSubmit' in page
    assert 'prepareTimeFields' in page
    assert 'BusinessDateTimePicker' in page
    assert 'beginBirthday' in page
    assert 'beginOpeningTime' in page
    assert 'test:item:edit' in page
    assert 'ViewDrawer' in page
    assert '<template>' not in page
    assert 'useDict(' in page
    if category == 'tree':
        assert 'TreeSelect' in page
        assert 'blocked.has(item.parentId)' in page
    if category == 'sub':
        assert 'timedetailList' in page
        assert 'original, ...row' in page
        assert "name={[field.name, 'parentItemId']}" not in page


@pytest.mark.parametrize('category', ['crud', 'tree', 'sub'])
def test_react_templates_do_not_depend_on_missing_context(category: str) -> None:
    table = make_table('mysql', category, 'react-antd')
    context = TemplateUtils.prepare_context(table)
    environment = TemplateInitializer.init_jinja2()
    environment.undefined = StrictUndefined
    for name in TemplateUtils.get_template_list(table):
        if name.startswith('react/'):
            environment.get_template(name).render(**context)


@pytest.mark.parametrize('category', ['crud', 'tree', 'sub'])
def test_react_preview_preserves_unicode_and_safe_string_literals(category: str, tmp_path: Path) -> None:
    table = make_table('mysql', category, 'react-antd')
    label = '中文名称「测试」😀 "引号" \\路径 <标签> & 单引号\''
    table.columns[1].column_comment = label
    if table.sub_table:
        table.sub_table.columns[2].column_comment = '子表日期'
    context = TemplateUtils.prepare_context(table)
    environment = TemplateInitializer.init_jinja2()
    templates = TemplateUtils.get_template_list(table)
    filenames = [TemplateUtils.get_file_name(name, table) for name in templates]
    files = GenTableService._GenTableService__render_files(environment, [templates, filenames, context, table])
    namespace = context['i18nNamespace']
    resource = files[f'frontend/src/i18n/locales/zh-CN/{namespace}.json']
    assert '中文名称「测试」😀' in resource
    assert '\\u4e2d' not in resource
    assert '\ufffd' not in resource
    values = json.loads(resource)
    assert values['fields']['itemName']['label'] == label
    label_key = f'{namespace}:fields.itemName.label'
    sources = {name: content for name, content in files.items() if name.endswith('.jsx')}
    assert {Path(name).name for name in sources} == {'index.jsx', 'view.jsx'}
    for name, rendered in sources.items():
        # 预览和下载的 JSX 引用语言资源，避免将用户标签嵌入源码或原始 HTML。
        assert f"t('{label_key}')" in rendered
        assert '<标签>' not in rendered
        if category == 'sub' and not name.endswith('/view.jsx'):
            child = table.sub_table.columns[2]
            child_key = f'{namespace}:subfields.{table.sub_table.business_name}.{child.python_field}.label'
            assert f"t('{child_key}')" in rendered
            assert values['subfields'][table.sub_table.business_name][child.python_field]['label'] == '子表日期'

    specimen = tmp_path / 'unicode-preview.json'
    specimen.write_text(
        json.dumps(
            {'sources': sources, 'namespace': namespace, 'resources': values, 'label': label, 'key': label_key},
            ensure_ascii=False,
        ),
        encoding='utf-8',
    )
    script = r"""
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createRequire} = require('node:module');
const load = createRequire(process.argv[1] + '/package.json');
const specimen = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => {
  for (const [name, source] of Object.entries(specimen.sources)) {
    await load('vite').transformWithOxc(source, name, {lang:'jsx'});
  }
  const engine = load('i18next').createInstance();
  await engine.init({lng:'zh-CN', defaultNS:specimen.namespace, initAsync:false,
    resources:{'zh-CN':{[specimen.namespace]:specimen.resources}}, interpolation:{escapeValue:false}});
  const translated = engine.t(specimen.key);
  assert.equal(translated, specimen.label);
  const React = load('react');
  const html = load('react-dom/server').renderToStaticMarkup(React.createElement('span', null, translated));
  assert.ok(html.includes('中文名称「测试」😀'));
  assert.ok(html.includes('&lt;标签&gt;'));
  assert.ok(!html.includes('<标签>'));
})().catch(error => { console.error(error); process.exitCode = 1; });
"""
    app = GenI18nUtil.PROJECT_ROOT / 'ruoyi-fastapi-frontend/react/web'
    result = subprocess.run(
        ['node', '-e', script, str(app), str(specimen)],
        capture_output=True,
        text=True,
        encoding='utf-8',
        check=False,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
