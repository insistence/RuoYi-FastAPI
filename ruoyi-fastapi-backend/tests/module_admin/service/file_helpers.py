from fastapi import FastAPI, Request


def make_file_request(
    *, headers: list[tuple[bytes, bytes]] | None = None, client: tuple[str, int] | None = None
) -> Request:
    """
    构造挂载在 API 前缀下的文件服务请求。

    :param headers: 原始 HTTP 请求头
    :param client: 客户端地址和端口
    :return: 带独立应用状态的请求
    """
    return Request(
        {
            'type': 'http',
            'scheme': 'https',
            'server': ('example.test', 443),
            'root_path': '/prod-api',
            'path': '/prod-api/common',
            'headers': headers or [],
            'client': client,
            'app': FastAPI(),
        }
    )
