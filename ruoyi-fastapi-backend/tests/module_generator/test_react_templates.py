"""React templates preserve the generator's CRUD, tree, child-table and time contracts."""

import json
import re

import pytest
from jinja2 import StrictUndefined
from test_generated_time_contract import make_table, render_case

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
        'frontend/api/test/item.js',
        'frontend/views/test/item/index.jsx',
        'frontend/views/test/item/view.jsx',
    }
    page = files['frontend/views/test/item/index.jsx']
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
def test_react_preview_preserves_unicode_and_safe_string_literals(category: str) -> None:
    table = make_table('mysql', category, 'react-antd')
    label = '中文名称「测试」😀 "引号" \\路径 <标签> & 单引号\''
    table.columns[1].column_comment = label
    if table.sub_table:
        table.sub_table.columns[2].column_comment = '子表日期'
    context = TemplateUtils.prepare_context(table)
    environment = TemplateInitializer.init_jinja2()
    for name in TemplateUtils.get_template_list(table):
        if not name.startswith('react/') or not name.endswith('.jsx.jinja2'):
            continue
        rendered = environment.get_template(name).render(**context)
        assert '中文名称「测试」😀' in rendered
        assert '\\u4e2d' not in rendered
        assert '\ufffd' not in rendered
        # The same string feeds preview and UTF-8 downloads. Verify that labels
        # remain valid JSON/JS literals with their original value after escaping.
        literals = re.findall(r'"(?:[^"\\]|\\.)*"', rendered)
        assert label in [json.loads(value) for value in literals if '中文名称' in value]
        assert '<标签>' not in rendered
        if category == 'sub' and name != 'react/view.jsx.jinja2':
            assert '子表日期' in rendered
