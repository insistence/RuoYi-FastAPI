from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from starlette.types import Message, Scope

from .ctx import TraceCtx


class Span:
    """
    HTTP 请求和响应的处理顺序如下。

    ::

        request(before) --> request(after) --> response(before) --> response(after)

    :ivar scope: 当前操作使用的作用域
    """

    def __init__(self, scope: Scope) -> None:
        """
        保存当前请求的 ASGI 作用域。

        :param scope: 该 ASGI 连接的类型、路径和请求头等信息
        """
        self.scope = scope

    async def request_before(self) -> None:
        """request_before: 处理header信息等, 如记录请求体信息。"""
        TraceCtx.set_trace_id()
        TraceCtx.set_request_id()
        TraceCtx.set_span_id()
        TraceCtx.set_request_path(self.scope.get('path', ''))
        TraceCtx.set_request_method(self.scope.get('method', ''))

    async def request_after(self, message: Message) -> Message:
        r"""
        request_after: 处理请求bytes， 如记录请求参数。

        ASGI 请求消息示例::

            message: {
                'type': 'http.request',
                'body': b'{\r\n    "name": "\xe8\x8b\x8f\xe8\x8b\x8f\xe8\x8b\x8f"\r\n}',
                'more_body': False,
            }

        :param message: 与当前结果一起返回的说明
        :return: 与当前结果一起返回的说明
        """
        return message

    async def response(self, message: Message) -> Message:
        """
        在响应开始时写入请求、追踪和跨度标识。

        :param message: 与当前结果一起返回的说明
        :return: 与当前结果一起返回的说明
        """
        if message['type'] == 'http.response.start':
            message['headers'].append((b'request-id', TraceCtx.get_request_id().encode()))
            message['headers'].append((b'trace-id', TraceCtx.get_trace_id().encode()))
            message['headers'].append((b'span-id', TraceCtx.get_span_id().encode()))
        return message


@asynccontextmanager
async def get_current_span(scope: Scope) -> AsyncGenerator[Span, None]:
    """
    为当前 ASGI 作用域提供跟踪跨度。

    :param scope: 该 ASGI 连接的类型、路径和请求头等信息
    :yield: ``Span`` 实例
    """
    yield Span(scope)
