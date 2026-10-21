from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import pytest
from playwright.async_api import expect

from common.config import Config
from tool.test_code_gen import GenTableTest

if TYPE_CHECKING:
    from playwright.async_api import Route

    from common.browser_harness import BrowserHarness

pytestmark = pytest.mark.harness


@pytest.mark.parametrize('framework', ['vue2', 'vue3', 'react'])
@pytest.mark.parametrize('delayed', ['none', 'response', 'render'])
async def test_edit_table_waits_for_details_and_ignores_departing_search_form(
    browser_harness: BrowserHarness, monkeypatch: pytest.MonkeyPatch, framework: str, delayed: str
) -> None:
    """详情响应或表单回填延迟时，编辑仍须等待初始值且不能误填离场查询表单。"""
    monkeypatch.setattr(Config, 'frontend_framework', framework)
    page = await browser_harness.new_page()
    saved = {'tableName': 'example', 'tableComment': 'original'}
    html = """
    <div class="app-main">
      <form id="search">
        <div class="el-form-item ant-form-item">表名称<input value="example"></div>
        <div class="el-form-item ant-form-item">表描述<input id="search-comment" value="search filter"></div>
        <button type="button" onclick="fetch('/tool/gen/list')">搜索</button>
      </form>
      <div class="el-table__body-wrapper"><table><tbody class="ant-table-tbody">
        <tr class="el-table__row ant-table-row"><td>example</td><td id="saved-comment">original</td><td>
          <button>预览</button><button onclick="edit()">编辑</button>
        </td></tr>
      </tbody></table></div>
      <section id="editor" hidden>
        <button role="tab" id="basic-tab" onclick="showPanel('basic')">基本信息</button>
        <button role="tab" id="generate-tab" onclick="showPanel('generate')">生成信息</button>
        <div role="tabpanel" id="basic" aria-labelledby="basic-tab">
          <div class="el-form-item ant-form-item">表描述<input id="edit-comment"></div>
        </div>
        <div role="tabpanel" id="generate" aria-labelledby="generate-tab" hidden>
          <div class="ant-form-item"><label class="ant-form-item-label">前端类型</label>
            <button class="ant-select" onclick="document.querySelector('#options').hidden = false">模板</button>
          </div>
          <div id="options" class="ant-select-dropdown" hidden>
            <button class="ant-select-item-option" onclick="this.parentElement.hidden = true">React Ant Design 模板</button>
          </div>
        </div>
        <button onclick="save()">提交</button>
      </section>
    </div>
    <script>
      let details;
      function edit() {
        history.pushState({}, '', '/tool/gen-edit/index/1');
        document.querySelector('#editor').hidden = false;
        details = fetch('/tool/gen/1').then(response => response.json()).then(async payload => {
          await new Promise(resolve => setTimeout(resolve, RENDER_DELAY));
          document.querySelector('#edit-comment').value = payload.data.info.tableComment;
        });
      }
      function showPanel(id) {
        document.querySelectorAll('[role=tabpanel]').forEach(panel => panel.hidden = panel.id !== id);
      }
      async function save() {
        await details;
        const comment = document.querySelector('#edit-comment').value;
        await fetch('/tool/gen', {method: 'PUT', body: JSON.stringify({tableComment: comment})});
        document.querySelector('#saved-comment').textContent = comment;
        document.querySelector('#editor').hidden = true;
        history.pushState({}, '', '/tool/gen');
      }
    </script>
    """.replace('RENDER_DELAY', '500' if delayed == 'render' else '0')

    async def respond(route: Route) -> None:
        if route.request.method == 'PUT':
            saved.update(route.request.post_data_json)
            await route.fulfill(json={'code': 200})
        elif route.request.url.endswith('/tool/gen/list'):
            await route.fulfill(json={'code': 200, 'rows': [saved]})
        elif route.request.url.endswith('/tool/gen/1'):
            if delayed == 'response':
                await asyncio.sleep(0.5)
            await route.fulfill(json={'code': 200, 'data': {'info': saved}})
        else:
            await route.fulfill(content_type='text/html; charset=utf-8', body=html)

    await page.route('http://codegen.test/**', respond)
    await page.goto('http://codegen.test/tool/gen')
    view = GenTableTest()
    view.page, view.table_id, view.table_name = page, 1, 'example'
    await view.edit_table()
    await expect(page.locator('#search-comment')).to_have_value('search filter')
    assert saved['tableComment'] == view.table_comment
