from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
import pytest_asyncio
from playwright.async_api import async_playwright

from common.browser_harness import BrowserHarness, artifact_directory
from common.config import Config

E2E_OUTPUT_ROOT = Path(os.environ.get('E2E_OUTPUT_DIR', 'target/e2e')).resolve()

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Generator

    from playwright.async_api import Browser, Playwright


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(
    item: pytest.Item, call: pytest.CallInfo
) -> Generator[None, pytest.TestReport, pytest.TestReport]:
    """
    在浏览器 fixture 回收前保存调用结果，确保断言失败仍能导出诊断。

    :param item: 当前要处理的条目
    :param call: 需要执行或验证的调用
    :yield: 上下文就绪后将控制权交给调用方
    :return: 当前测试阶段生成的报告
    """
    report = yield
    setattr(item, f'rep_{report.when}', report)
    return report


@pytest_asyncio.fixture(scope='session', loop_scope='session')
async def e2e_browser() -> AsyncIterator[tuple[Playwright, Browser]]:
    """
    一次 pytest 会话只启动一个 Chromium 进程。

    :yield: 依次为 ``playwright``、``browser`` 的元组
    """
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            channel=Config.browser_channel,
            executable_path=os.environ.get('TEST_BROWSER_EXECUTABLE') or None,
        )
        try:
            yield playwright, browser
        finally:
            await browser.close()


@pytest_asyncio.fixture(loop_scope='session')
async def browser_harness(
    e2e_browser: tuple[Playwright, Browser], request: pytest.FixtureRequest
) -> AsyncIterator[BrowserHarness]:
    """
    每个用例有自己的上下文、诊断目录和 API 客户端。

    :param e2e_browser: 执行端到端流程的浏览器
    :param request: pytest 当前用例的请求上下文
    :yield: 为端到端测试管理资源的夹具
    """
    harness = BrowserHarness(*e2e_browser, artifact_directory(E2E_OUTPUT_ROOT, request.node.nodeid))
    try:
        yield harness
    finally:
        failed = any(
            report.failed
            for phase in ('setup', 'call')
            if (report := getattr(request.node, f'rep_{phase}', None)) is not None
        )
        await harness.finish(failed=failed)
