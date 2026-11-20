from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from playwright.async_api import expect

from common.config import Config
from system.page import SystemPage

if TYPE_CHECKING:
    from common.browser_harness import BrowserHarness

pytestmark = pytest.mark.harness


@pytest.mark.parametrize('framework', ['vue2', 'vue3', 'react'])
@pytest.mark.parametrize('source_label', ['菜单名称', '字典名称', '数据标签'])
async def test_source_and_translation_fields_are_selected_exactly(
    browser_harness: BrowserHarness, monkeypatch: pytest.MonkeyPatch, framework: str, source_label: str
) -> None:
    """真实浏览器验证语言说明不会造成漏选，也不会把译文或同名前缀当作原文。"""
    monkeypatch.setattr(Config, 'frontend_framework', framework)
    page = await browser_harness.new_page()
    field_class = 'ant-form-item' if framework == 'react' else 'el-form-item'
    label_class = 'ant-form-item-label' if framework == 'react' else 'el-form-item__label'
    source = f'{source_label} · 原文：简体中文' if framework == 'react' else source_label
    translated = {'react': f'{source_label} · English', 'vue2': '翻译（English）', 'vue3': 'English译文'}[framework]
    await page.set_content(
        '<form>'
        f'<div class="{field_class}"><label class="{label_class}">{source}</label>'
        '<input id="source" value="原始名称"></div>'
        f'<div class="{field_class}"><label class="{label_class}">{translated}</label>'
        '<input id="english" value="Original name"></div>'
        f'<div class="{field_class}"><label class="{label_class}">{source_label}扩展</label>'
        '<input id="unrelated" value="unchanged"></div>'
        '</form>'
    )
    view = SystemPage()
    view.page = page
    form = page.locator('form')
    await view.fill(form, source_label, '已修改原文')
    await view.translation_input(form, source_label).fill('Updated English name')
    await expect(page.locator('#source')).to_have_value('已修改原文')
    await expect(page.locator('#english')).to_have_value('Updated English name')
    await expect(page.locator('#unrelated')).to_have_value('unchanged')
