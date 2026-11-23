from __future__ import annotations

import asyncio
import hashlib
import json
import re
from http import HTTPStatus
from typing import TYPE_CHECKING
from urllib.parse import urlparse

from common.config import Config

if TYPE_CHECKING:
    from pathlib import Path

    from playwright.async_api import APIRequestContext, APIResponse, Browser, BrowserContext, Page, Playwright, Response

_API_TIMEOUT_MS = 15000
_LOGIN_MAX_ATTEMPTS = 3
_LOGIN_MAX_WAIT_SECONDS = 60


async def _wait_for_login_retry(response: APIResponse | Response, attempt: int, waited: int) -> int:
    """
    为 API 和表单登录共用等待预算，使用后端返回的秒数。

    :param response: 当前调用产生的响应
    :param attempt: 当前尝试的次数
    :param waited: 已经等待的时长
    :return: 本次重试后累计等待的秒数
    """
    assert attempt + 1 < _LOGIN_MAX_ATTEMPTS, '登录 HTTP 429：已达到最大尝试次数'
    retry_after = response.headers.get('retry-after', '').strip()
    assert retry_after.isascii() and retry_after.isdecimal(), f'登录 HTTP 429：Retry-After 无效：{retry_after!r}'
    delay = int(retry_after)
    assert delay <= _LOGIN_MAX_WAIT_SECONDS - waited, '登录 HTTP 429：Retry-After 超出累计等待上限'
    await asyncio.sleep(delay)
    return waited + delay


async def _login_token(response: APIResponse | Response) -> str:
    """
    非限流错误必须失败，成功响应必须携带有效令牌。

    :param response: 当前调用产生的响应
    :return: 用于身份验证或授权的令牌
    """
    assert response.ok, f'登录 HTTP 状态异常：{response.status}'
    payload = await response.json()
    token = payload.get('token') or (payload.get('data') or {}).get('token')
    assert token, f'登录未返回令牌：{payload.get("msg", "未知错误")}'
    return token


def artifact_directory(root: Path, node_id: str) -> Path:
    """
    为每个用例生成稳定、无路径跳转且适合 Windows 的诊断目录。

    :param root: 路径解析的基准目录
    :param node_id: pytest 标识当前测试节点的字符串
    :return: 当前用例的诊断产物目录
    """
    label = re.sub(r'[^a-zA-Z0-9_.-]+', '-', node_id).strip('-')[-80:] or 'test'
    digest = hashlib.sha256(node_id.encode()).hexdigest()[:12]
    return root / f'{label}-{digest}'


class BrowserHarness:
    """
    复用会话浏览器，每个用例独立管理上下文及失败诊断。

    :ivar playwright: 管理浏览器实例的 Playwright 对象
    :ivar browser: 执行页面操作的浏览器实例
    :ivar output: 命令或操作的输出
    :ivar contexts: 当前测试创建的浏览器上下文
    :ivar api_contexts: 当前测试使用的 API 请求上下文
    :ivar events: 保存已发出事件的序列
    :ivar token: 用于身份验证或授权的令牌
    """

    def __init__(self, playwright: Playwright, browser: Browser, output: Path) -> None:
        """
        保存浏览器实例、测试产物目录和事件记录。

        :param playwright: 管理浏览器实例的 Playwright 对象
        :param browser: 执行页面操作的浏览器实例
        :param output: 命令或操作的输出
        """
        self.playwright = playwright
        self.browser = browser
        self.output = output
        self.contexts: list[BrowserContext] = []
        self.api_contexts: list[APIRequestContext] = []
        self.events: list[dict[str, str]] = []
        self.token: str | None = None

    async def api_context(self, token: str | None = None) -> APIRequestContext:
        """
        创建随用例回收的 API 客户端。

        :param token: 用于身份验证或授权的令牌
        :return: 随用例回收的 API 客户端
        """
        # UI 操作之间可能长于后端的 keep-alive 超时。直连 API 的测试请求各自关闭连接。
        headers = {'Connection': 'close'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        context = await self.playwright.request.new_context(
            base_url=Config.backend_url,
            extra_http_headers=headers,
            timeout=_API_TIMEOUT_MS,
        )
        self.api_contexts.append(context)
        return context

    async def login(self) -> str:
        """
        用例内复用令牌；429 最多重试两次，总等待不超过 60 秒。

        :return: 用于身份验证或授权的令牌
        """
        if self.token:
            return self.token
        api = await self.api_context()
        waited = 0
        # 每次请求仍受 15 秒超时限制，三次请求加累计等待最多 105 秒。
        for attempt in range(_LOGIN_MAX_ATTEMPTS):
            response = await api.post('/login', form={'username': 'admin', 'password': 'admin123'})
            if response.status != HTTPStatus.TOO_MANY_REQUESTS:
                break
            waited = await _wait_for_login_retry(response, attempt, waited)
        self.token = await _login_token(response)
        return self.token

    async def login_through_page(self, page: Page, username: str = 'admin', password: str = 'admin123') -> str:
        """
        真实填写并提交登录表单，仅对 429 有界重试，不替换夹具的管理员令牌。

        :param page: 浏览器页面或要查询的页码
        :param username: 登录账号名称
        :param password: 认证使用的密码
        :return: 用于身份验证或授权的令牌
        """
        await page.get_by_placeholder('账号').fill(username)
        await page.get_by_placeholder('密码').fill(password)
        waited = 0
        for attempt in range(_LOGIN_MAX_ATTEMPTS):
            async with page.expect_response(
                lambda response: response.request.method == 'POST' and urlparse(response.url).path.endswith('/login'),
                timeout=_API_TIMEOUT_MS,
            ) as pending:
                await page.get_by_role('button', name=re.compile(r'登\s*录')).click(timeout=_API_TIMEOUT_MS)
            response = await pending.value
            if response.status != HTTPStatus.TOO_MANY_REQUESTS:
                break
            waited = await _wait_for_login_retry(response, attempt, waited)
        token = await _login_token(response)
        await page.wait_for_url('**/index', timeout=30000)
        return token

    async def new_context(self, *, token: str | None = None, **options) -> BrowserContext:
        """
        每次调用均创建隔离上下文，不继承前一用例 Cookie 或本地存储。

        :param token: 用于身份验证或授权的令牌
        :param options: 调用方按名称传入的附加选项
        :return: 当前操作所需的上下文
        """
        context = await self.browser.new_context(
            **{'base_url': Config.frontend_url, 'viewport': {'width': 1440, 'height': 1000}, **options}
        )
        self.contexts.append(context)
        context.set_default_timeout(15000)
        context.set_default_navigation_timeout(30000)
        await context.tracing.start(screenshots=True, snapshots=True, sources=True)
        context.on('page', self._record_page)
        if token:
            await context.add_cookies(
                [{'name': 'Admin-Token', 'value': token, 'url': Config.frontend_url, 'sameSite': 'Lax'}]
            )
        return context

    async def new_page(self, *, authenticated: bool = False, **options) -> Page:
        """
        创建可选已认证页面。

        :param authenticated: 是否以登录状态打开页面
        :param options: 调用方按名称传入的附加选项
        :return: 可选已认证页面
        """
        token = await self.login() if authenticated else None
        context = await self.new_context(token=token, **options)
        return await context.new_page()

    def _record_page(self, page: Page) -> None:
        """
        为新页面注册浏览器事件采集。

        :param page: 浏览器页面或要查询的页码
        """
        page.on('pageerror', lambda error: self.events.append({'kind': 'pageerror', 'message': str(error)}))
        page.on(
            'console',
            lambda message: (
                self.events.append({'kind': message.type, 'message': message.text})
                if message.type in {'warning', 'error'}
                else None
            ),
        )

    async def _save_screenshot(self, page: Page, context_index: int, page_index: int) -> None:
        """
        保存浏览器页面截图用于诊断测试失败。

        :param page: 浏览器页面或要查询的页码
        :param context_index: 要操作的浏览器上下文索引
        :param page_index: 目标页面在上下文中的索引
        """
        if page.is_closed():
            return
        try:
            await page.screenshot(
                path=str(self.output / f'context-{context_index}-page-{page_index}.png'),
                full_page=True,
                timeout=5000,
            )
        except Exception as exc:
            self.events.append({'kind': 'screenshot-error', 'message': str(exc)})

    async def _finish_context(self, context: BrowserContext, index: int, *, failed: bool) -> None:
        """
        结束浏览器上下文并收集测试产物。

        :param context: 当前操作所需的上下文
        :param index: 当前条目在序列中的位置
        :param failed: 当前尝试是否失败
        """
        try:
            if failed:
                for page_index, page in enumerate(context.pages):
                    await self._save_screenshot(page, index, page_index)
                await context.tracing.stop(path=str(self.output / f'context-{index}-trace.zip'))
            else:
                await context.tracing.stop()
        except Exception as exc:
            self.events.append({'kind': 'trace-error', 'message': str(exc)})
        finally:
            try:
                await context.close()
            except Exception as exc:
                self.events.append({'kind': 'context-close-error', 'message': str(exc)})

    async def _dispose_api(self, api: APIRequestContext) -> None:
        """
        释放浏览器测试使用的 API 请求上下文。

        :param api: 发起 API 请求的客户端
        """
        try:
            await api.dispose()
        except Exception as exc:
            self.events.append({'kind': 'api-dispose-error', 'message': str(exc)})

    async def finish(self, *, failed: bool) -> None:
        """
        失败时保留页面截图、trace 和控制台日志，再回收全部上下文。

        :param failed: 当前尝试是否失败
        """
        if failed:
            await asyncio.to_thread(self.output.mkdir, parents=True, exist_ok=True)
        for index, context in enumerate(self.contexts):
            await self._finish_context(context, index, failed=failed)
        for api in self.api_contexts:
            await self._dispose_api(api)
        self.contexts.clear()
        self.api_contexts.clear()
        if failed:
            await asyncio.to_thread(
                (self.output / 'browser-events.json').write_text,
                json.dumps(self.events, ensure_ascii=False, indent=2),
                encoding='utf-8',
            )
