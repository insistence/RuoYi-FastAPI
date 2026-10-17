import asyncio
import re
from pathlib import Path

import pytest
from playwright.async_api import expect

from common.browser_harness import BrowserHarness
from common.config import Config
from common.ui import button_name

pytestmark = pytest.mark.e2e


@pytest.mark.asyncio
async def test_form_builder_page(browser_harness: BrowserHarness) -> None:
    """编辑真实设计器并校验当前框架导出的组件内容。"""
    react = Config.frontend_framework == 'react'
    page = await browser_harness.new_page(authenticated=True)
    await page.goto(Config.frontend_url + '/tool/build')
    await page.get_by_role('button', name=button_name('清空')).click()
    await page.get_by_role('button', name=button_name('确定')).click()
    empty = page.locator('.builder-canvas-empty' if react else '.empty-info')
    await expect(empty).to_be_visible()
    await page.locator('.builder-palette button' if react else '.components-item').filter(has_text='单行文本').click()
    board = page.locator('.builder-canvas' if react else '.drawing-board')
    await expect(board.locator('.el-form-item, .ant-form-item')).to_have_count(1)
    panel = page.locator('.builder-properties' if react else '.right-board')
    await panel.get_by_placeholder('请输入字段名（v-model）', exact=True).fill('e2eCustomer')
    await panel.get_by_placeholder('请输入标题').fill('测试客户名称')
    await panel.get_by_placeholder('请输入占位提示', exact=True).fill('请填写测试客户')
    await expect(board.get_by_text('测试客户名称', exact=True)).to_be_visible()
    await expect(board.get_by_placeholder('请填写测试客户')).to_be_visible()
    await page.get_by_role(
        'button', name=re.compile('导出 React 文件' if react else '导出vue文件', re.IGNORECASE)
    ).click()
    dialog = page.get_by_role('dialog', name='选择生成类型')
    filename = 'e2e-customer.jsx' if react else 'e2e-customer.vue'
    await dialog.get_by_placeholder('请输入文件名').fill(filename)
    async with page.expect_download() as pending:
        await dialog.get_by_role('button', name=button_name('确定')).click()
    download = await pending.value
    assert download.suggested_filename == filename
    source = await asyncio.to_thread(Path(await download.path()).read_text, encoding='utf-8')
    if react:
        assert 'export default function' in source and "from 'antd'" in source
        assert '<Form' in source and 'name={"e2eCustomer"}' in source
        assert '<template>' not in source and 'v-model' not in source
    else:
        assert re.search(r'<script(?:\s+setup)?>', source), '导出文件缺少 Vue 脚本'
        assert '<template>' in source and '</script>' in source
    for expected in ('e2eCustomer', '测试客户名称', '请填写测试客户'):
        assert expected in source, f'导出文件缺少 {expected}'
    await expect(dialog).to_be_hidden()
    if react:
        preview = page.get_by_role('dialog', name='React 代码预览')
        await preview.locator('.ant-modal-close').click()
        await expect(preview).to_be_hidden()
    await page.get_by_role('button', name=button_name('清空')).click()
    await page.get_by_role('button', name=button_name('确定')).click()
    await expect(board.locator('.el-form-item, .ant-form-item')).to_have_count(0)
    await expect(empty).to_be_visible()
