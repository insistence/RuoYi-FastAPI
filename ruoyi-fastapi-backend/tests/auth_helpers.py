from dataclasses import dataclass
from unittest.mock import AsyncMock

from fastapi import FastAPI


@dataclass
class AuthTestApp:
    """
    使用模拟认证服务的 FastAPI 测试应用。

    :ivar app: 注册路由和认证依赖的应用
    :ivar resolver: 记录当前用户解析调用的异步替身
    """

    app: FastAPI
    resolver: AsyncMock
