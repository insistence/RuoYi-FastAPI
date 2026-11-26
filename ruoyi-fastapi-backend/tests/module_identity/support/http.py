from urllib.parse import urlencode

from fastapi import FastAPI, Request


def make_request(
    redis: object,
    *,
    headers: dict[str, str] | None = None,
    query: list[tuple[str, str]] | None = None,
    host: str = '127.0.0.1',
) -> Request:
    """
    构造携带客户端地址和应用缓存的 HTTP 请求。

    :param redis: 注入到应用状态的测试缓存
    :param headers: 请求头
    :param query: 保留顺序和重复键的查询参数
    :param host: 请求来源地址
    :return: 供控制器或服务直接使用的请求
    """
    app = FastAPI()
    app.state.redis = redis
    return Request(
        {
            'type': 'http',
            'method': 'GET',
            'path': '/',
            'app': app,
            'headers': [
                (key.lower().encode('latin-1'), value.encode('latin-1')) for key, value in (headers or {}).items()
            ],
            'query_string': urlencode(query or []).encode('ascii'),
            'client': (host, 12345),
        }
    )
