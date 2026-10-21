from collections.abc import Callable
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient

from common.annotation.log_annotation import Log
from common.annotation.rate_limit_annotation import ApiRateLimit
from exceptions.handle import handle_exception


@pytest.fixture
def oauth_management_client(monkeypatch: pytest.MonkeyPatch) -> Callable[[APIRouter, object, object], AsyncClient]:
    """构造使用真实路由和全局异常处理器的管理端 HTTP 客户端。"""
    monkeypatch.setattr(Log, '_get_oper_location', AsyncMock(return_value='测试'))
    monkeypatch.setattr(
        ApiRateLimit, '_acquire_rate_limit', AsyncMock(return_value={'allowed': True, 'remaining': 1, 'reset_at': 0})
    )

    def create_client(router: APIRouter, session: object, current_user: object) -> AsyncClient:
        """替换数据库和认证依赖，保留控制器、装饰器及异常响应链。"""
        app = FastAPI()
        app.state.redis = SimpleNamespace()
        app.state.oidc_registered_cors_origins = ('https://old.example',)
        handle_exception(app)
        app.include_router(router)
        for route in router.routes:
            if not isinstance(route, APIRoute):
                continue
            for dependency in route.dependant.dependencies:
                if dependency.name == 'query_db':
                    app.dependency_overrides[dependency.call] = lambda: session
                elif dependency.name == 'current_user':
                    app.dependency_overrides[dependency.call] = lambda: current_user
                else:
                    app.dependency_overrides[dependency.call] = lambda: None
        return AsyncClient(transport=ASGITransport(app=app), base_url='http://testserver')

    return create_client
