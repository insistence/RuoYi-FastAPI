from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


class ApiResponseHeaderMiddleware(BaseHTTPMiddleware):
    """接口响应头追加中间件。"""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        在响应返回前统一追加接口响应头。

        :param request: 当前 HTTP 请求
        :param call_next: 调用下一层请求处理器的异步回调
        :return: 当前调用产生的响应
        """
        response = await call_next(request)
        api_response_headers = getattr(request.state, 'api_response_headers', None)
        if api_response_headers:
            response.headers.update(api_response_headers)
        return response


def add_api_response_header_middleware(app: FastAPI) -> None:
    """
    添加接口响应头追加中间件。

    :param app: FastAPI对象
    """
    app.add_middleware(ApiResponseHeaderMiddleware)
