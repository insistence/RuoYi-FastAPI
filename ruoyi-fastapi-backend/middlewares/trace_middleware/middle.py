from functools import wraps

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .ctx import TraceCtx
from .span import Span, get_current_span


class TraceASGIMiddleware:
    """
    FastAPI 中间件用法示例。

    ::

        app = FastAPI()
        app.add_middleware(TraceASGIMiddleware)

    :ivar app: 正在配置或处理请求的 ASGI 应用
    """

    def __init__(self, app: ASGIApp) -> None:
        """
        绑定需要跟踪请求的 ASGI 应用。

        :param app: 正在配置或处理请求的 ASGI 应用
        """
        self.app = app

    @staticmethod
    async def my_receive(receive: Receive, span: Span) -> Receive:
        """
        在接收请求体前启动跟踪并包装接收回调。

        :param receive: 读取下一条 ASGI 消息的异步回调
        :param span: HTTP 请求和响应的处理顺序如下
        :return: 供调用方使用的 ``my_receive``
        """
        await span.request_before()

        @wraps(receive)
        async def my_receive() -> Message:
            """
            接收一条 ASGI 消息并交给当前跟踪跨度记录。

            :return: 与当前结果一起返回的说明
            """
            message = await receive()
            await span.request_after(message)
            return message

        return my_receive

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """
        为 HTTP 请求建立跟踪跨度并包装消息收发。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        :param receive: 读取下一条 ASGI 消息的异步回调
        :param send: 发送 ASGI 消息的异步回调
        """
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        async with get_current_span(scope) as span:
            handle_outgoing_receive = await self.my_receive(receive, span)

            async def handle_outgoing_request(message: 'Message') -> None:
                """
                跟踪即将发送的 ASGI 响应消息。

                :param message: 与当前结果一起返回的说明
                """
                await span.response(message)
                await send(message)

            try:
                await self.app(scope, handle_outgoing_receive, handle_outgoing_request)
            finally:
                TraceCtx.clear()
