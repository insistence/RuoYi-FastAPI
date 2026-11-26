import json
from collections.abc import Callable
from http import HTTPStatus
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import APIRouter, FastAPI, Request
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from common.annotation.log_annotation import Log
from common.annotation.rate_limit_annotation import ApiRateLimit
from common.context import RequestContext
from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel
from module_admin.service.log_service import LogQueueService
from module_identity.controller.oauth_session_controller import (
    get_oauth_grant,
    oauth_grant_controller,
    oauth_session_controller,
    revoke_oauth_grants,
    revoke_oauth_sessions,
)
from module_identity.dao.oauth_access_policy_dao import OAuthAccessPolicyDao
from module_identity.dao.oauth_client_dao import OAuthClientDao
from module_identity.dao.oauth_grant_dao import OAuthGrantDao
from module_identity.entity.vo.oauth_session_vo import SessionRevokeModel
from module_identity.service.audit_service import AuditService
from module_identity.service.oauth_session_management_service import OAuthSessionManagementService
from module_identity.service.session_service import SsoSessionService
from tests.module_identity.support.sessions import RecordingSession


def _user() -> CurrentUserModel:
    """
    构造最小管理用户。

    :return: 最小管理用户
    """
    return CurrentUserModel(permissions=[], roles=[], user=UserInfoModel(user_id=1, user_name='admin'))


def _request() -> Request:
    """
    构造含最小 Redis 状态的管理请求。

    :return: 含最小 Redis 状态的管理请求
    """
    app = SimpleNamespace(state=SimpleNamespace(redis=SimpleNamespace()))

    async def receive() -> dict[str, object]:
        """
        提供下游 ASGI 应用读取的 HTTP 请求体消息。

        :return: 下游 ASGI 应用读取的 HTTP 请求体消息
        """
        return {'type': 'http.request', 'body': b'', 'more_body': False}

    return Request(
        {'type': 'http', 'method': 'DELETE', 'path': '/', 'query_string': b'', 'headers': [], 'app': app}, receive
    )


def _route_map(router: APIRouter) -> dict[tuple[str, str], APIRoute]:
    """
    索引路由路径、方法。

    :param router: 注册端点所用的路由器
    :return: 按路径和 HTTP 方法索引的路由
    """
    return {
        (route.path, method): route
        for route in router.routes
        if isinstance(route, APIRoute)
        for method in route.methods or ()
    }


def test_session_and_grant_routes_have_pre_auth_and_exact_permissions() -> None:
    """Session/Grant 路由必须使用规范权限。"""
    expected = {
        ('/system/oauth/session/list', 'GET'): 'system:oauthSession:list',
        ('/system/oauth/session/{sid}', 'GET'): 'system:oauthSession:list',
        ('/system/oauth/session/{sids}', 'DELETE'): 'system:oauthSession:revoke',
        ('/system/oauth/session/user/{user_id}', 'DELETE'): 'system:oauthSession:revoke',
    }
    routes = _route_map(oauth_session_controller)
    for key, perm in expected.items():
        assert perm in [getattr(dep.call, 'perm', None) for dep in routes[key].dependant.dependencies]
    assert oauth_session_controller.dependencies[0].dependency.__class__.__name__ == 'PreAuth'
    expected_grants = {
        ('/system/oauth/grant/list', 'GET'): 'system:oauthGrant:list',
        ('/system/oauth/grant/access/list', 'GET'): 'system:oauthGrant:list',
        ('/system/oauth/grant/{grant_id}', 'GET'): 'system:oauthGrant:list',
        ('/system/oauth/grant/{grant_ids}', 'DELETE'): 'system:oauthGrant:revoke',
        ('/system/oauth/grant/user/{user_id}/client/{client_id}/access', 'PUT'): 'system:oauthGrant:revoke',
    }
    routes = _route_map(oauth_grant_controller)
    for key, perm in expected_grants.items():
        assert perm in [getattr(dep.call, 'perm', None) for dep in routes[key].dependant.dependencies]


@pytest.mark.asyncio
async def test_batch_revoke_is_atomic_and_reason_does_not_leak(
    monkeypatch: pytest.MonkeyPatch,
    oauth_management_client: Callable[[APIRouter, object, object], AsyncClient],
) -> None:
    """批量撤销失败时回滚且不回显内部敏感字段。"""
    db = RecordingSession()

    async def audit(*args: object, **kwargs: object) -> None:
        """
        完成无需返回值的回调。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        """
        return

    monkeypatch.setattr(AuditService, 'record', audit)

    async def enqueue(*args: object, **kwargs: object) -> None:
        """
        完成无需返回值的回调。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        """
        return

    monkeypatch.setattr(LogQueueService, 'enqueue_operation_log', enqueue)

    async def revoke(*args: object, **kwargs: object) -> bool:
        """
        在请求处理中撤销测试凭据。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises ValueError: 模拟撤销操作产生含敏感信息的错误
        :return: 此分支的固定值 ``True``
        """
        if args[2] == 'bad':
            raise ValueError('refresh_token_hash=do-not-leak')
        return True

    monkeypatch.setattr(SsoSessionService, 'revoke', revoke)
    token = RequestContext.set_current_user(_user())
    try:
        async with oauth_management_client(oauth_session_controller, db, _user()) as client:
            response = await client.request('DELETE', '/system/oauth/session/good,bad', json={'reason': '管理员操作'})
    finally:
        RequestContext.reset_current_user(token)
    assert response.status_code == HTTPStatus.OK
    assert response.json()['success'] is False
    assert b'refresh_token_hash' not in response.content
    assert b'do-not-leak' not in response.content
    assert db.commits == 0 and db.rollbacks == 1

    async def grant_revoke(*args: object, **kwargs: object) -> bool:
        """
        在此测试分支返回 True。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 此分支的固定值 ``True``
        """
        return True

    monkeypatch.setattr(OAuthGrantDao, 'targets', AsyncMock(return_value=[(2, 1)]))
    monkeypatch.setattr(OAuthAccessPolicyDao, 'lock_client', AsyncMock())
    monkeypatch.setattr(OAuthClientDao, 'id_for_pk', AsyncMock(return_value='client-2'))
    monkeypatch.setattr(OAuthGrantDao, 'revoke_for_user_client', AsyncMock(return_value=['grant-1']))
    token = RequestContext.set_current_user(_user())
    try:
        response = await revoke_oauth_grants(_request(), 'grant-1', SessionRevokeModel(reason='撤销'), db, _user())
    finally:
        RequestContext.reset_current_user(token)
    assert b'true' in response.body
    assert db.commits == 1


@pytest.mark.asyncio
async def test_session_controller_injects_redis_without_passing_request_to_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Session 管理 Controller 向 Service 传入精确 Redis 依赖，而非 FastAPI Request。"""
    monkeypatch.setattr(
        ApiRateLimit, '_acquire_rate_limit', AsyncMock(return_value={'allowed': True, 'remaining': 1, 'reset_at': 0})
    )
    monkeypatch.setattr(Log, '_get_oper_location', AsyncMock(return_value='测试'))
    db = RecordingSession()
    request = _request()
    captured: dict[str, object] = {}

    async def revoke_sessions(*args: object, **kwargs: object) -> int:
        """
        记录批量撤销的参数并返回影响数量。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 此分支的固定值 ``1``
        """
        captured['args'] = args
        captured['kwargs'] = kwargs
        return 1

    monkeypatch.setattr(OAuthSessionManagementService, 'revoke_sessions', revoke_sessions)

    async def enqueue_operation_log(*args: object, **kwargs: object) -> None:
        """
        完成无需返回值的回调。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        """
        return

    monkeypatch.setattr(LogQueueService, 'enqueue_operation_log', enqueue_operation_log)
    token = RequestContext.set_current_user(_user())
    try:
        response = await revoke_oauth_sessions(request, 'sid-1', SessionRevokeModel(reason='管理员操作'), db, _user())
    finally:
        RequestContext.reset_current_user(token)
    assert b'true' in response.body
    assert isinstance(captured['args'], tuple)
    assert captured['args'][1] is request.app.state.redis
    assert not isinstance(captured['args'][1], Request)


@pytest.mark.asyncio
async def test_grant_detail_never_returns_refresh_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    """Grant 详情只返回安全 DTO。"""
    row = SimpleNamespace(
        grant_id='g1',
        user_id=1,
        subject_id='s1',
        client_pk=2,
        granted_scopes=['openid'],
        granted_resources=[],
        status='active',
        consented_at=None,
        expires_at=None,
        refresh_token_hash='must-not-return',
    )

    async def get_grant(*args: object, **kwargs: object) -> object:
        """
        向调用方返回 ``row``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 与查询匹配的记录
        """
        return row

    async def execute(*args: object, **kwargs: object) -> object:
        """
        创建测试使用的 ``SimpleNamespace`` 实例。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 测试使用的 ``SimpleNamespace`` 实例
        """
        return SimpleNamespace(all=list, scalars=lambda: SimpleNamespace(all=list, first=lambda: None))

    monkeypatch.setattr(OAuthGrantDao, 'get_by_grant_id', get_grant)

    async def client_id(*args: object, **kwargs: object) -> str:
        """
        返回固定值 ``client-2``。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 此分支的固定值 ``'client-2'``
        """
        return 'client-2'

    monkeypatch.setattr(OAuthClientDao, 'id_for_pk', client_id)
    db = AsyncMock(spec=AsyncSession)
    db.execute.side_effect = execute
    response = await get_oauth_grant('g1', db)
    assert b'refresh_token_hash' not in response.body


@pytest.mark.asyncio
@pytest.mark.parametrize('grant_ids', ['grant-1', 'grant-1,grant-2'])
async def test_grant_revoke_runs_rate_limit_and_operation_log(monkeypatch: pytest.MonkeyPatch, grant_ids: str) -> None:
    """HTTP 撤销请求经过完整装饰器链并记录实际请求和撤销结果。"""
    db = RecordingSession()
    user = _user()
    path = f'/system/oauth/grant/{grant_ids}'
    route = _route_map(oauth_grant_controller)[('/system/oauth/grant/{grant_ids}', 'DELETE')]
    app = FastAPI()
    app.state.redis = SimpleNamespace()
    app.include_router(oauth_grant_controller)
    for dependency in route.dependant.dependencies:
        if dependency.call is None:
            continue
        if dependency.name == 'query_db':
            app.dependency_overrides[dependency.call] = lambda: db
        elif dependency.name == 'current_user':
            app.dependency_overrides[dependency.call] = lambda: user
        else:
            app.dependency_overrides[dependency.call] = lambda: None
    rate_limit = AsyncMock(return_value={'allowed': True, 'remaining': 9, 'reset_at': 60})
    expected_ids = grant_ids.split(',')
    revoke = AsyncMock(return_value=expected_ids)
    audit = AsyncMock()
    operation_log = AsyncMock()
    monkeypatch.setattr(ApiRateLimit, '_acquire_rate_limit', rate_limit)
    monkeypatch.setattr(OAuthGrantDao, 'targets', AsyncMock(return_value=[(2, 1)]))
    monkeypatch.setattr(OAuthAccessPolicyDao, 'lock_client', AsyncMock())
    monkeypatch.setattr(OAuthClientDao, 'id_for_pk', AsyncMock(return_value='client-2'))
    monkeypatch.setattr(OAuthGrantDao, 'revoke_for_user_client', revoke)
    monkeypatch.setattr(AuditService, 'record', audit)
    monkeypatch.setattr(LogQueueService, 'enqueue_operation_log', operation_log)
    token = RequestContext.set_current_user(user)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://testserver') as client:
            response = await client.request('DELETE', path, json={'reason': '管理员撤销'})
    finally:
        RequestContext.reset_current_user(token)
    expected_ids = grant_ids.split(',')
    result = response.json()
    assert response.status_code == HTTPStatus.OK
    assert result['success'] is True
    assert result['data']['count'] == len(expected_ids)
    revoke.assert_awaited_once_with(db, 1, 2, '管理员撤销')
    assert audit.await_count == len(expected_ids)
    assert db.commits == 1 and db.rollbacks == 0
    rate_limit.assert_awaited_once()
    operation_log.assert_awaited_once()
    logged_request, logged_operation, _ = operation_log.call_args.args
    assert isinstance(logged_request, Request)
    assert logged_request is rate_limit.call_args.args[-1]
    assert logged_operation.oper_url == path
    assert json.loads(logged_operation.json_result)['data']['count'] == len(expected_ids)


@pytest.mark.asyncio
@pytest.mark.parametrize('blocked', [True, False])
async def test_access_policy_runs_rate_limit_and_operation_log(monkeypatch: pytest.MonkeyPatch, blocked: bool) -> None:
    """禁止及解除访问通过真实 HTTP 装饰器链，准确传递用户、应用和原因。"""
    db, user = RecordingSession(), _user()
    path = '/system/oauth/grant/user/7/client/business-app/access'
    route = _route_map(oauth_grant_controller)[('/system/oauth/grant/user/{user_id}/client/{client_id}/access', 'PUT')]
    app = FastAPI()
    app.state.redis = SimpleNamespace()
    app.include_router(oauth_grant_controller)
    for dependency in route.dependant.dependencies:
        if dependency.call is None:
            continue
        if dependency.name == 'query_db':
            app.dependency_overrides[dependency.call] = lambda: db
        elif dependency.name == 'current_user':
            app.dependency_overrides[dependency.call] = lambda: user
        else:
            app.dependency_overrides[dependency.call] = lambda: None
    rate_limit = AsyncMock(return_value={'allowed': True, 'remaining': 9, 'reset_at': 60})
    save = AsyncMock(return_value=1 if blocked else 0)
    operation_log = AsyncMock()
    monkeypatch.setattr(ApiRateLimit, '_acquire_rate_limit', rate_limit)
    monkeypatch.setattr(OAuthSessionManagementService, 'set_access', save)
    monkeypatch.setattr(LogQueueService, 'enqueue_operation_log', operation_log)
    token = RequestContext.set_current_user(user)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://testserver') as client:
            response = await client.put(path, json={'blocked': blocked, 'reason': '管理员操作'})
    finally:
        RequestContext.reset_current_user(token)
    assert response.status_code == HTTPStatus.OK and response.json()['success'] is True
    assert response.json()['data']['accessStatus'] == ('blocked' if blocked else 'allowed')
    save.assert_awaited_once_with(db, 7, 'business-app', blocked, 'admin', '管理员操作')
    operation_log.assert_awaited_once()
    assert operation_log.call_args.args[0] is rate_limit.call_args.args[-1]
