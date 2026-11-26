import contextvars
from uuid import uuid4

CTX_TRACE_ID: contextvars.ContextVar[str] = contextvars.ContextVar('trace-id', default='')
CTX_REQUEST_ID: contextvars.ContextVar[str] = contextvars.ContextVar('request-id', default='')
CTX_SPAN_ID: contextvars.ContextVar[str] = contextvars.ContextVar('span-id', default='')
CTX_REQUEST_PATH: contextvars.ContextVar[str] = contextvars.ContextVar('request-path', default='')
CTX_REQUEST_METHOD: contextvars.ContextVar[str] = contextvars.ContextVar('request-method', default='')


class TraceCtx:
    """保存当前请求的链路跟踪上下文。"""

    @staticmethod
    def set_trace_id() -> str:
        """
        设置当前请求的链路标识。

        :return: 供调用方使用的 ``_id``
        """
        _id = uuid4().hex
        CTX_TRACE_ID.set(_id)
        return _id

    @staticmethod
    def get_trace_id() -> str:
        """
        读取当前请求的链路标识。

        :return: 当前请求的链路标识
        """
        return CTX_TRACE_ID.get()

    @staticmethod
    def set_request_id() -> str:
        """
        设置当前请求的请求标识。

        :return: 供调用方使用的 ``_id``
        """
        _id = uuid4().hex
        CTX_REQUEST_ID.set(_id)
        return _id

    @staticmethod
    def get_request_id() -> str:
        """
        读取当前请求的请求标识。

        :return: 当前请求的请求标识
        """
        return CTX_REQUEST_ID.get()

    @staticmethod
    def set_span_id() -> str:
        """
        设置当前请求的跨度标识。

        :return: 供调用方使用的 ``_id``
        """
        _id = uuid4().hex
        CTX_SPAN_ID.set(_id)
        return _id

    @staticmethod
    def get_span_id() -> str:
        """
        读取当前请求的跨度标识。

        :return: 当前请求的跨度标识
        """
        return CTX_SPAN_ID.get()

    @staticmethod
    def set_request_path(path: str) -> None:
        """
        设置当前请求的路径。

        :param path: 要读取或处理的路径
        """
        CTX_REQUEST_PATH.set(path)

    @staticmethod
    def get_request_path() -> str:
        """
        读取当前请求的路径。

        :return: 当前请求的路径
        """
        return CTX_REQUEST_PATH.get()

    @staticmethod
    def set_request_method(method: str) -> None:
        """
        设置当前请求的HTTP 方法。

        :param method: 当前请求的 HTTP 方法
        """
        CTX_REQUEST_METHOD.set(method)

    @staticmethod
    def get_request_method() -> str:
        """
        读取当前请求的HTTP 方法。

        :return: 当前请求的HTTP 方法
        """
        return CTX_REQUEST_METHOD.get()

    @staticmethod
    def clear() -> None:
        """清除当前请求的链路标识和请求信息。"""
        CTX_TRACE_ID.set('')
        CTX_REQUEST_ID.set('')
        CTX_SPAN_ID.set('')
        CTX_REQUEST_PATH.set('')
        CTX_REQUEST_METHOD.set('')
