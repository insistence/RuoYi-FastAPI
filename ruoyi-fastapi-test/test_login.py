from __future__ import annotations

import asyncio
import re
from typing import TYPE_CHECKING

import pytest
from playwright.async_api import expect

if TYPE_CHECKING:
    from playwright.async_api import Route

    from common.browser_harness import BrowserHarness

pytestmark = [pytest.mark.e2e, pytest.mark.smoke]


async def test_login_page_loads(browser_harness: BrowserHarness) -> None:
    """登录表单完成渲染后才验收。"""
    page = await browser_harness.new_page()
    await page.goto('/login')
    await expect(page.get_by_placeholder('账号')).to_be_visible()
    await expect(page.get_by_placeholder('密码')).to_be_visible()
    await expect(page.get_by_role('button', name=re.compile(r'登\s*录'))).to_be_enabled()


@pytest.mark.parametrize(
    ('locale', 'message'),
    [('zh-CN', '正在加载系统资源，请耐心等待'), ('en-US', 'Loading system resources. Please wait.')],
)
async def test_loading_message_before_app_starts(browser_harness: BrowserHarness, locale: str, message: str) -> None:
    """延迟应用脚本，验证刷新期间可见的提示使用当前语言。"""
    page = await browser_harness.new_page()
    await page.goto('/login')
    language = page.get_by_role('button', name='语言', exact=True)
    await expect(language).to_be_visible()
    if locale == 'en-US':
        await language.click()
        await page.get_by_text('English', exact=True).click()
        language = page.get_by_role('button', name='Language', exact=True)
        await expect(language).to_be_visible()

    resume = asyncio.Event()
    entries = await page.locator('script[type="module"][src], script[defer][src]').evaluate_all(
        '(scripts) => scripts.map(script => script.src)'
    )
    assert entries

    async def delay_scripts(route: Route) -> None:
        """
        暂停页面脚本请求直到测试允许继续。

        :param route: 当前请求匹配的路由
        """
        await resume.wait()
        await route.continue_()

    await page.route(lambda url: url in entries, delay_scripts)
    loading = page.get_by_text(message, exact=True)
    try:
        await page.reload(wait_until='commit')
        await expect(loading).to_be_visible()
    finally:
        resume.set()
    await expect(language).to_be_visible()
    await expect(loading).to_be_hidden()


async def test_captcha_generation(browser_harness: BrowserHarness) -> None:
    """验证隔离测试环境确实关闭验证码。"""
    api = await browser_harness.api_context()
    response = await api.get('/captchaImage')
    assert response.ok
    assert (await response.json())['captchaEnabled'] is False
    page = await browser_harness.new_page()
    await page.goto('/login')
    await expect(page.get_by_placeholder('账号')).to_be_visible()
    await expect(page.get_by_placeholder('验证码')).to_have_count(0)


async def test_login_without_captcha(browser_harness: BrowserHarness) -> None:
    """真实登录 API 必须返回有效令牌。"""
    assert await browser_harness.login()


async def test_login_flow_with_playwright(browser_harness: BrowserHarness) -> None:
    """通过表单登录，验证首页内容在跳转和刷新后均可见。"""
    page = await browser_harness.new_page()
    await page.goto('/login')
    await expect(page.get_by_placeholder('账号')).to_be_visible()
    await expect(page.get_by_placeholder('验证码')).to_have_count(0)
    await browser_harness.login_through_page(page)
    dashboard = page.locator('.app-main')
    projects = dashboard.get_by_text('进行中的项目', exact=True)
    shortcut = dashboard.get_by_text(re.compile(r'^操作[一1]$'))
    await expect(projects).to_be_visible()
    await expect(shortcut).to_be_visible()
    await page.reload()
    await expect(projects).to_be_visible()
    await expect(shortcut).to_be_visible()
    assert not [event for event in browser_harness.events if event['kind'] == 'pageerror']


async def test_protected_routes_require_auth(browser_harness: BrowserHarness) -> None:
    """独立无 Cookie 上下文必须被路由守卫送回登录页。"""
    page = await browser_harness.new_page()
    await page.goto('/system/user')
    await page.wait_for_url('**/login**')
    await expect(page.get_by_placeholder('账号')).to_be_visible()
    await expect(page.get_by_placeholder('密码')).to_be_visible()


async def test_authenticated_access(browser_harness: BrowserHarness) -> None:
    """已登录用户必须加载用户管理数据表。"""
    page = await browser_harness.new_page(authenticated=True)
    await page.goto('/system/user')
    await expect(page.locator('.app-main .el-table, .app-main .ant-table')).to_be_visible()
    assert '/login' not in page.url
