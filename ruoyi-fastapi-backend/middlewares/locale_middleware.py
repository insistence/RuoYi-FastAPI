from fastapi import FastAPI
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from common.context import RequestContext
from i18n.locale import LocaleUtil


class LocaleMiddleware:
    """
    请求语言中间件，注册在传输加密中间件外层
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """
        协商请求语言并在请求结束或取消时恢复上下文

        :param scope: ASGI 请求作用域
        :param receive: ASGI 接收函数
        :param send: ASGI 发送函数
        """
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        context = LocaleUtil.context_from_headers(Headers(scope=scope))
        scope.setdefault('state', {})['locale_context'] = context
        token = RequestContext.set_current_locale(context)

        async def send_localized(message: Message) -> None:
            if message['type'] == 'http.response.start':
                LocaleUtil.add_locale_headers(MutableHeaders(scope=message), context)
            await send(message)

        try:
            await self.app(scope, receive, send_localized)
        finally:
            RequestContext.reset_current_locale(token)


def add_locale_middleware(app: FastAPI) -> None:
    """
    添加请求语言中间件

    :param app: FastAPI对象
    """
    app.add_middleware(LocaleMiddleware)
