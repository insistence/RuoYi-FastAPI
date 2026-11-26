from collections.abc import Callable
from http import HTTPStatus
from types import SimpleNamespace

import pytest
from fastapi import APIRouter, Request
from fastapi.routing import APIRoute
from httpx import AsyncClient

from common.context import RequestContext
from module_admin.service.log_service import LogQueueService
from module_identity.controller.oauth_client_controller import (
    get_system_oauth_client_list,
    oauth_client_controller,
)
from module_identity.entity.vo.oauth_client_vo import ClientPageQueryModel, ClientSecretResponseModel
from module_identity.service.oauth_management_service import (
    OAuthClientManagementError,
    OAuthClientManagementService,
)
from module_identity.service.runtime_service import OidcRuntimeService
from tests.module_identity.support.sessions import RecordingSession


@pytest.fixture(autouse=True)
def _request_context(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    为日志装饰器提供当前用户上下文。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    """
    monkeypatch.setattr(RequestContext, 'get_current_user', staticmethod(_user))

    async def enqueue_operation_log(*args: object, **kwargs: object) -> None:
        """
        完成无需返回值的回调。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        """
        return

    monkeypatch.setattr(LogQueueService, 'enqueue_operation_log', enqueue_operation_log)


def _user() -> SimpleNamespace:
    """
    构造最小当前用户对象。

    :return: 最小当前用户对象
    """
    return SimpleNamespace(user=SimpleNamespace(user_name='admin', dept=SimpleNamespace(dept_name='测试部门')))


def _client_payload() -> dict[str, object]:
    """
    构造通过请求模型校验的客户端创建参数。

    :return: 通过请求模型校验的客户端创建参数
    """
    return {
        'clientName': '测试客户端',
        'clientType': 'public',
        'tokenEndpointAuthMethod': 'none',
        'redirectUris': ['https://client.example/callback'],
    }


def _request() -> Request:
    """
    构造带可观察 CORS 快照的请求。

    :return: 带可观察 CORS 快照的请求
    """
    app = SimpleNamespace(state=SimpleNamespace(oidc_registered_cors_origins=('https://old.example',)))

    async def receive() -> dict[str, object]:
        """
        提供下游 ASGI 应用读取的 HTTP 请求体消息。

        :return: 下游 ASGI 应用读取的 HTTP 请求体消息
        """
        return {'type': 'http.request', 'body': b'', 'more_body': False}

    return Request(
        {
            'type': 'http',
            'method': 'POST',
            'path': '/',
            'headers': [],
            'query_string': b'',
            'app': app,
        },
        receive=receive,
    )


def _routes() -> list[APIRoute]:
    """
    返回 Client Router 的 HTTP 路由。

    :return: Client Router 的 HTTP 路由
    """
    return [route for route in oauth_client_controller.routes if isinstance(route, APIRoute)]


def test_client_router_paths_methods_permissions_and_pre_auth() -> None:
    """Client 路由必须完整覆盖规范路径并逐端点声明权限。"""
    expected = {
        ('/system/oauth/client/list', 'GET'): 'system:oauthClient:list',
        ('/system/oauth/client/{client_id}', 'GET'): 'system:oauthClient:query',
        ('/system/oauth/client', 'POST'): 'system:oauthClient:add',
        ('/system/oauth/client', 'PUT'): 'system:oauthClient:edit',
        ('/system/oauth/client/{client_ids}', 'DELETE'): 'system:oauthClient:remove',
        ('/system/oauth/client/changeStatus', 'PUT'): 'system:oauthClient:edit',
        ('/system/oauth/client/{client_id}/secret', 'POST'): 'system:oauthClient:rotateSecret',
        ('/system/oauth/client/{client_id}/secret/{secret_id}', 'DELETE'): 'system:oauthClient:rotateSecret',
        ('/system/oauth/client/{client_id}/uri', 'POST'): 'system:oauthClient:edit',
        ('/system/oauth/client/{client_id}/uri/{uri_id}', 'DELETE'): 'system:oauthClient:edit',
    }
    routes = {(route.path, method): route for route in _routes() for method in route.methods or ()}
    assert set(routes) == set(expected)
    for key, permission in expected.items():
        dependency_calls = [getattr(item.call, 'perm', None) for item in routes[key].dependant.dependencies]
        assert permission in dependency_calls
    assert oauth_client_controller.dependencies
    assert oauth_client_controller.dependencies[0].dependency.__class__.__name__ == 'PreAuth'


@pytest.mark.asyncio
async def test_client_create_commits_and_secret_is_only_in_rotation_response(
    monkeypatch: pytest.MonkeyPatch,
    oauth_management_client: Callable[[APIRouter, object, object], AsyncClient],
) -> None:
    """写操作由服务层管理事务，轮换响应含明文而普通错误不包含敏感字段。"""
    session = RecordingSession()

    async def fake_create(*args: object, **kwargs: object) -> object:
        """
        创建测试使用的 ``SimpleNamespace`` 实例。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 测试使用的 ``SimpleNamespace`` 实例
        """
        return SimpleNamespace(model_dump=lambda **_: {'clientId': 'cli_test'})

    monkeypatch.setattr(OAuthClientManagementService, 'create_client', fake_create)
    async with oauth_management_client(oauth_client_controller, session, _user()) as client:
        response = await client.post('/system/oauth/client', json=_client_payload())
    assert response.status_code == HTTPStatus.OK
    assert response.json()['success'] is True
    assert b'cs1.' not in response.content
    assert session.commits == 0 and session.rollbacks == 0

    secret = ClientSecretResponseModel(
        client_id='cli_test',
        secret_id='secret-1',
        client_secret='cs1.one-time-secret',
        secret_hint='...cret',
        not_before='2026-01-01T00:00:00Z',
    )

    async def fake_rotate(*args: object, **kwargs: object) -> ClientSecretResponseModel:
        """
        向调用方返回 ``secret``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 测试使用的密钥
        """
        return secret

    monkeypatch.setattr(OAuthClientManagementService, 'rotate_secret', fake_rotate)
    async with oauth_management_client(oauth_client_controller, session, _user()) as client:
        rotation_response = await client.post('/system/oauth/client/cli_test/secret', json={})
    assert rotation_response.status_code == HTTPStatus.OK
    assert rotation_response.json()['success'] is True
    assert b'cs1.one-time-secret' in rotation_response.content
    assert session.commits == 0

    async def fake_fail(*args: object, **kwargs: object) -> object:
        """
        模拟此操作抛出 OAuthClientManagementError 的情形。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises OAuthClientManagementError: 模拟客户端管理请求被拒绝
        """
        raise OAuthClientManagementError('OAuth Client request rejected')

    monkeypatch.setattr(OAuthClientManagementService, 'create_client', fake_fail)
    async with oauth_management_client(oauth_client_controller, session, _user()) as client:
        failed = await client.post('/system/oauth/client', json=_client_payload())
    assert failed.status_code == HTTPStatus.OK
    assert failed.json()['success'] is False
    assert failed.json()['msg'] == 'OAuth Client request rejected'
    assert b'secret_hash' not in failed.content
    assert b'cs1.' not in failed.content
    assert session.rollbacks == 0


@pytest.mark.asyncio
async def test_client_batch_failure_rolls_back_all_items(
    monkeypatch: pytest.MonkeyPatch,
    oauth_management_client: Callable[[APIRouter, object, object], AsyncClient],
) -> None:
    """批量停用任一项失败时整体回滚，不提前提交。"""
    session = RecordingSession()
    calls: list[str] = []

    async def fake_disable(*args: object, **kwargs: object) -> object:
        """
        模拟批量禁用客户端时的逐项结果。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises OAuthClientManagementError: 模拟待停用的客户端不存在
        :return: ``SimpleNamespace`` 实例
        """
        client_id = args[1]
        assert isinstance(client_id, str)
        calls.append(client_id)
        if client_id == 'cli_bad':
            raise OAuthClientManagementError('client not found')
        return SimpleNamespace()

    monkeypatch.setattr(OAuthClientManagementService, '_soft_disable', fake_disable)
    async with oauth_management_client(oauth_client_controller, session, _user()) as client:
        response = await client.delete('/system/oauth/client/cli_good,cli_bad')
    assert response.status_code == HTTPStatus.OK
    assert response.json()['success'] is False
    assert response.json()['msg'] == 'client not found'
    assert calls == ['cli_good', 'cli_bad']
    assert session.commits == 0
    assert session.rollbacks == 1


@pytest.mark.asyncio
async def test_cors_snapshot_refresh_failure_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """提交后 CORS 快照刷新失败时清空旧快照，确保失败闭合。"""
    request = _request()

    async def fail_refresh(*args: object, **kwargs: object) -> tuple[str, ...]:
        """
        模拟此操作抛出 RuntimeError 的情形。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises RuntimeError: 模拟刷新数据时数据库不可用
        """
        raise RuntimeError('database unavailable')

    monkeypatch.setattr(OidcRuntimeService, 'refresh_cors_snapshot', fail_refresh)
    await OidcRuntimeService.cors_snapshot_callback(request.scope['app'])()
    assert request.app.state.oidc_registered_cors_origins == ()


@pytest.mark.asyncio
async def test_client_list_uses_real_total_and_actor_failure_is_mapped(
    monkeypatch: pytest.MonkeyPatch,
    oauth_management_client: Callable[[APIRouter, object, object], AsyncClient],
) -> None:
    """列表返回服务层全量计数，actor 缺失时稳定返回业务失败。"""
    session = RecordingSession()

    async def fake_rows(*args: object, **kwargs: object) -> list[str]:
        """
        返回查询使用的固定测试行。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 查询使用的固定测试行
        """
        return ['row-1', 'row-2']

    async def fake_count(*args: object, **kwargs: object) -> int:
        """
        返回固定值 ``37``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 此分支的固定值 ``37``
        """
        return 37

    monkeypatch.setattr(OAuthClientManagementService, 'list_clients', fake_rows)
    monkeypatch.setattr(OAuthClientManagementService, 'count_clients', fake_count)
    response = await get_system_oauth_client_list(ClientPageQueryModel(), session)
    assert b'"total":37' in response.body
    assert b'"rows":["row-1","row-2"]' in response.body

    async with oauth_management_client(oauth_client_controller, session, SimpleNamespace(user=None)) as client:
        failed = await client.post('/system/oauth/client', json=_client_payload())
    assert failed.status_code == HTTPStatus.OK
    assert failed.json()['success'] is False
    assert failed.json()['msg'] == '当前操作者不可用'
    assert b'actor' not in failed.content
    assert session.rollbacks == 0
