from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext, ElementHandle, Locator, Page

    from common.browser_harness import BrowserHarness


class BasePageTest:
    """
    为页面端到端测试提供通用的浏览器和登录操作。

    :ivar harness: 为当前用例管理资源的浏览器夹具
    :ivar context: 当前用例独立的浏览器上下文
    :ivar page: 在当前上下文中创建的测试页面
    :ivar token: 当前用例的登录令牌
    """

    harness: BrowserHarness
    context: BrowserContext
    page: Page
    token: str

    async def setup(self, harness: BrowserHarness) -> None:
        """
        创建独立上下文，浏览器和诊断资源由会话 fixture 管理。

        :param harness: 复用会话浏览器，每个用例独立管理上下文及失败诊断
        """
        self.harness = harness
        self.token = await harness.login()
        self.context = await harness.new_context(token=self.token)
        self.page = await self.context.new_page()

    async def goto_page(self, url: str) -> None:
        """
        访问指定页面。

        :param url: 当前请求的目标地址
        """
        await self.page.goto(url)

    async def select_department(self, dialog: Locator, label: str, department: str) -> None:
        """
        兼容 Element Plus 树选择器与 Vue2 的 vue-treeselect。

        :param dialog: 测试正在操作的对话框
        :param label: 显示给用户的标签
        :param department: 测试操作对应的部门
        """
        field = dialog.locator('.el-form-item').filter(has_text=label)
        await field.locator('.el-select__wrapper, .vue-treeselect__control').click()
        choices = self.page.locator(
            '.el-select-dropdown:visible .el-tree-node__content .el-select-dropdown__item, '
            '.vue-treeselect__menu .vue-treeselect__label:visible'
        )
        await choices.filter(has_text=re.compile(rf'^\s*{re.escape(department)}(?:\s*\(\d+\))?\s*$')).click()

    async def wait_for_page_title(self, title_text: str, timeout_ms: int = 10000) -> None:
        """
        等待页面标题出现。

        :param title_text: 标题主体文本
        :param timeout_ms: 等待超时的毫秒数
        """
        await self.page.wait_for_selector(f'div:has-text("{title_text}")', timeout=timeout_ms)
        page_title = await self.page.inner_text(f'div:has-text("{title_text}")')
        assert title_text in page_title

    async def wait_for_selector(self, selector: str, timeout_ms: int = 10000) -> None:
        """
        等待选择器出现。

        :param selector: 定位页面元素的选择器
        :param timeout_ms: 等待超时的毫秒数
        """
        await self.page.wait_for_selector(selector, timeout=timeout_ms)

    async def query_selector(self, selector: str) -> ElementHandle | None:
        """
        查询选择器元素。

        :param selector: 定位页面元素的选择器
        :return: 首个匹配的元素，未匹配时返回 ``None``
        """
        return await self.page.query_selector(selector)

    async def click_button(self, button_text: str) -> None:
        """
        点击按钮。

        :param button_text: 目标按钮显示的文字
        """
        button = await self.page.wait_for_selector(f'text="{button_text}"', timeout=5000)
        assert button is not None, f'未找到按钮：{button_text}'
        await button.click()

    async def fill_input(self, selector: str, value: str) -> None:
        """
        填充输入框。

        :param selector: 定位页面元素的选择器
        :param value: 待处理的输入值
        """
        await self.page.fill(selector, value)

    async def get_text_content(self, selector: str) -> str | None:
        """
        获取元素文本内容。

        :param selector: 定位页面元素的选择器
        :return: 匹配元素的文本，元素或文本不存在时返回 ``None``
        """
        element = await self.page.query_selector(selector)
        if element:
            return await element.text_content()
        return None

    async def get_table_total_rows(self) -> int:
        """
        获取表格总行数。

        :return: 表格总行数
        """
        element = self.page.locator('span.el-pagination__total').first
        text = await element.text_content()

        match = re.search(r'\d+', text or '')
        assert match is not None, f'分页总数缺少数字：{text!r}'
        return int(match.group())
