import argparse
import asyncio
import json
import os
import re
import threading
import time
from collections.abc import Awaitable, Callable
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from playwright.async_api import Locator, Page, Route, async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
TOKEN = 'isolated-mobile-smoke-token'
LOGIN_BUTTON_MIN_WIDTH = 250
LOGIN_BUTTON_MIN_HEIGHT = 44
USER = {
    'userId': 7,
    'userName': 'ci-user',
    'nickName': '移动端 CI',
    'avatar': '',
    'phonenumber': '13800000000',
    'email': 'mobile-ci@example.test',
    'createTime': '2026-01-01T00:00:00Z',
    'timeZone': 'America/New_York',
}


def create_api_handler(errors: list[str], observed: list[dict[str, Any]]) -> Callable[[Route], Awaitable[None]]:
    """
    创建隔离 API 处理函数，向共享记录追加请求及异常。

    :param errors: 本次验收收集的异常说明
    :param observed: 实际发出的 API 请求记录
    :return: 供浏览器路由使用的异步处理函数
    """

    async def api(route: Route) -> None:
        """
        隔离 API 边界，记录真实构建发出的认证和时区请求。

        :param route: 当前浏览器 API 请求
        :return: None
        """
        request = route.request
        path = urlparse(request.url).path.removeprefix('/dev-api')
        headers = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'}
        if request.method == 'OPTIONS':
            await route.fulfill(status=204, headers=headers)
            return
        observed.append(
            {
                'path': path,
                'method': request.method,
                'authorization': request.headers.get('authorization'),
                'timezone': request.headers.get('x-timezone'),
            }
        )
        payload: dict[str, Any]
        if path == '/transport/crypto/frontend-config':
            payload = {
                'code': 200,
                'data': {
                    'transportCryptoEnabled': False,
                    'transportCryptoMode': 'off',
                    'transportCryptoActive': False,
                    'configExpireAt': int(time.time()) + 600,
                },
            }
        elif path == '/captchaImage':
            payload = {'code': 200, 'captchaEnabled': False}
        elif path == '/login':
            if 'ci-user' not in (request.post_data or ''):
                errors.append('登录请求未包含输入的用户名')
            payload = {'code': 200, 'token': TOKEN}
        elif path == '/getInfo':
            payload = {
                'code': 200,
                'user': USER,
                'roles': ['admin'],
                'permissions': ['*:*:*'],
                'appTimezone': 'Asia/Shanghai',
            }
        elif path == '/system/user/profile':
            payload = {'code': 200, 'data': USER, 'postGroup': 'CI', 'roleGroup': '管理员'}
        elif path == '/logout':
            payload = {'code': 200}
        else:
            errors.append(f'未预期的 API 请求：{path}')
            await route.fulfill(status=500, json={'code': 500, 'msg': 'unexpected smoke request'}, headers=headers)
            return
        await route.fulfill(json=payload, headers=headers)

    return api


async def check_login_styles(framework: str, page: Page, login_button: Locator) -> dict[str, Any]:
    """验证移动端构建确实生成了布局、渐变和图标样式。"""
    styles = await login_button.evaluate(
        """element => {
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return { width: rect.width, height: rect.height,
                background: style.backgroundImage, radius: style.borderRadius }
        }"""
    )
    assert styles['width'] >= LOGIN_BUTTON_MIN_WIDTH and styles['height'] >= LOGIN_BUTTON_MIN_HEIGHT, styles
    assert 'linear-gradient' in styles['background'], styles
    assert float(styles['radius'].removesuffix('px')) > 0, styles
    if framework != 'react':
        icon_mask = await page.locator('.i-mdi-account').first.evaluate(
            'element => getComputedStyle(element).maskImage'
        )
        assert 'url(' in icon_mask, f'Tailwind 图标未生成：{icon_mask}'
    if framework == 'vue2':
        body = page.locator('uni-page-body')
        header = page.locator('uni-page-head .uni-page-head')
        await expect(body).to_have_css('display', 'block')
        await expect(header).to_have_css('position', 'fixed')
        layout = await body.evaluate(
            """element => ({
                bodyHeight: element.getBoundingClientRect().height,
                headerHeight: document.querySelector('uni-page-head .uni-page-head').getBoundingClientRect().height,
                viewportHeight: window.innerHeight
            })"""
        )
        assert round(layout['bodyHeight'] + layout['headerHeight']) >= layout['viewportHeight'], layout
        styles['pageLayout'] = layout
    return styles


async def run_smoke(framework: str, base_url: str, output: Path) -> None:
    """
    使用真实 H5 构建验证登录、持久化身份和个人资料页。

    :param framework: vue2、vue3 或 react
    :param base_url: 本次测试的开发服务器或静态文件服务器
    :param output: 浏览器报告目录
    :return: None
    """
    logs: list[str] = []
    errors: list[str] = []
    observed: list[dict[str, Any]] = []
    api = create_api_handler(errors, observed)

    async with async_playwright() as playwright:
        executable = os.environ.get('RUOYI_SMOKE_BROWSER_EXECUTABLE')
        browser = await playwright.chromium.launch(
            headless=True, **({'executable_path': executable} if executable else {})
        )
        context = await browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='UTC')
        await context.tracing.start(screenshots=True, snapshots=True, sources=True)
        await context.route('http://localhost:9099/**', api)
        await context.route(f'{base_url}/dev-api/**', api)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: logs.append(f'{message.type}: {message.text}'))
        failed = False
        try:
            await page.goto(f'{base_url}/#/pages/login')
            await expect(page.locator('input[type="text"]')).to_be_visible(timeout=30000)
            await expect(page.locator('input')).to_have_count(2, timeout=15000)
            button = page.get_by_role('button') if framework == 'react' else page.locator('uni-button')
            login_button = button.filter(has_text=re.compile(r'登\s*录'))
            login_styles = await check_login_styles(framework, page, login_button)
            await page.screenshot(path=str(output / 'login.png'))
            await page.locator('input[type="text"]').fill('ci-user')
            await page.locator('input[type="password"]').fill('ci-test-password')
            await login_button.click()
            await expect(page).to_have_url(re.compile(r'/pages/index'), timeout=30000)
            await page.goto(f'{base_url}/#/pages/mine/info/index')
            await expect(page.get_by_text(USER['nickName'], exact=True)).to_be_visible(timeout=30000)
            await expect(page.get_by_text('2025-12-31 19:00:00', exact=True)).to_be_visible(timeout=15000)
            profile_requests = [request for request in observed if request['path'] == '/system/user/profile']
            assert profile_requests, '个人资料页未发送真实 API 请求'
            assert all(request['authorization'] == f'Bearer {TOKEN}' for request in profile_requests)
            assert all(request['timezone'] == 'America/New_York' for request in profile_requests)
            assert not errors, errors
            (output / 'result.json').write_text(
                json.dumps(
                    {'framework': framework, 'ok': True, 'loginStyles': login_styles, 'requests': observed},
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding='utf-8',
            )
            print(f'{framework}: H5 login, persisted session and timezone profile PASS')
        except BaseException:
            failed = True
            await page.screenshot(path=str(output / 'failure.png'), full_page=True)
            (output / 'page.html').write_text(await page.content(), encoding='utf-8')
            raise
        finally:
            (output / 'browser.log').write_text('\n'.join([*logs, *errors]), encoding='utf-8')
            await context.tracing.stop(**({'path': str(output / 'trace.zip')} if failed else {}))
            await context.close()
            await browser.close()


def main() -> None:
    """
    验证现有开发服务器或临时 H5 静态服务，结束后关闭自身创建的资源。

    :return: None
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('--framework', choices=('vue2', 'vue3', 'react'), required=True)
    parser.add_argument('--base-url', help='验证已启动的 H5 开发服务器，不启动静态文件服务')
    parser.add_argument('--output', type=Path, help='浏览器诊断文件的输出目录')
    args = parser.parse_args()
    output = args.output or ROOT / 'target/ci/mobile-smoke' / args.framework
    if args.base_url and not args.output:
        output /= 'dev'
    output.mkdir(parents=True, exist_ok=True)
    if args.base_url:
        base_url = args.base_url.rstrip('/')
        deadline = time.monotonic() + 180
        while True:
            try:
                with urlopen(Request(base_url, headers={'Accept': 'text/html'}), timeout=3) as response:
                    if response.status == HTTPStatus.OK:
                        break
            except OSError:
                if time.monotonic() >= deadline:
                    raise TimeoutError(f'H5 开发服务器未就绪：{base_url}') from None
            if time.monotonic() >= deadline:
                raise TimeoutError(f'H5 开发服务器未就绪：{base_url}')
            time.sleep(0.5)
        asyncio.run(run_smoke(args.framework, base_url, output))
        return
    build_path = 'dist/h5' if args.framework == 'react' else 'dist/build/h5'
    distribution = ROOT / 'ruoyi-fastapi-frontend' / args.framework / 'mobile' / build_path
    if not (distribution / 'index.html').is_file():
        raise SystemExit(f'请先构建 H5：{distribution}')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(distribution)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        asyncio.run(run_smoke(args.framework, f'http://127.0.0.1:{server.server_port}', output))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == '__main__':
    main()
