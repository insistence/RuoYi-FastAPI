import asyncio
from collections.abc import AsyncIterator, Iterator
from types import SimpleNamespace
from typing import Annotated
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import APIRouter, Depends, FastAPI, Request, status
from sqlalchemy import ColumnElement

from common.aspect.data_scope import DataScopeDependency
from common.aspect.db_session import get_db_session_provider
from common.aspect.interface_auth import RoleInterfaceAuthDependency, UserInterfaceAuthDependency
from common.aspect.pre_auth import CurrentUserDependency, PreAuthDependency
from common.context import RequestContext
from config.env import AppConfig
from exceptions.exception import AuthException
from exceptions.handle import handle_exception
from middlewares.context_middleware import add_context_cleanup_middleware
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.role_vo import RoleModel
from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel
from module_admin.service.login_service import LoginService, oauth2_scheme
from utils.dependency_util import DependencyUtil

USER_IDS = {'alice': 1, 'bob': 2}
TWO_AUTH_CALLS = 2
THREE_AUTH_CALLS = 3


def _user(user_id: int) -> CurrentUserModel:
    return CurrentUserModel(
        permissions=[f'user:{user_id}:read'],
        roles=['reader'],
        user=UserInfoModel(
            userId=user_id,
            userName=f'user-{user_id}',
            role=[RoleModel(roleId=2, roleKey='reader', dataScope='5', status='0', delFlag='0')],
        ),
    )


@pytest.fixture
def auth_app(monkeypatch: pytest.MonkeyPatch) -> Iterator[SimpleNamespace]:
    monkeypatch.setattr(AppConfig, 'app_root_path', '')
    app = FastAPI()
    handle_exception(app)
    add_context_cleanup_middleware(app)

    async def database() -> AsyncIterator[object]:
        yield object()

    async def authenticate(request: Request, token: str, db: object, *, refresh_session: bool) -> CurrentUserModel:
        assert refresh_session
        normalized = token.removeprefix('Bearer ').strip() if token.startswith('Bearer ') else token
        if normalized not in USER_IDS:
            raise AuthException(message='用户token已失效，请重新登录')
        # 交错多个请求，验证请求状态和上下文没有跨用户复用。
        await asyncio.sleep(0)
        current_user = _user(USER_IDS[normalized])
        RequestContext.set_current_user(current_user)
        return current_user

    resolver = AsyncMock(side_effect=authenticate)
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    app.dependency_overrides[get_db_session_provider(None)] = database

    @app.get('/both', dependencies=[PreAuthDependency()])
    async def both(
        user: Annotated[CurrentUserModel, CurrentUserDependency()],
        same_user: Annotated[CurrentUserModel, CurrentUserDependency()],
    ) -> dict:
        await asyncio.sleep(0)
        return {
            'userId': user.user.user_id,
            'contextUserId': RequestContext.get_current_user().user.user_id,
            'sameUser': user is same_user,
            'permissions': user.permissions,
        }

    @app.get('/current')
    async def current(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> dict:
        return {'userId': user.user.user_id}

    @app.get('/direct', dependencies=[PreAuthDependency()])
    async def direct(
        user: Annotated[CurrentUserModel, CurrentUserDependency()],
        direct_user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user)],
    ) -> dict:
        return {'userId': user.user.user_id, 'sameUser': user is direct_user}

    @app.get('/pre', dependencies=[PreAuthDependency()])
    async def pre() -> dict:
        return {'userId': RequestContext.get_current_user().user.user_id}

    excluded = PreAuthDependency([{'path': '/public/{name}', 'methods': ['GET'], 'ignore_paths': ['/public/private']}])

    @app.api_route('/public/{name}', methods=['GET', 'POST'], dependencies=[excluded])
    async def public(name: str) -> dict:
        return {'name': name}

    @app.get('/excluded-current', dependencies=[PreAuthDependency([{'path': '/excluded-current'}])])
    async def excluded_current(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> dict:
        return {'userId': user.user.user_id}

    try:
        yield SimpleNamespace(app=app, resolver=resolver)
    finally:
        RequestContext.clear_all()


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['/both', '/current', '/pre', '/direct'])
async def test_request_authentication_runs_once(auth_app: SimpleNamespace, path: str) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get(path, headers={'Authorization': 'Bearer alice'})
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['userId'] == USER_IDS['alice']
    auth_app.resolver.assert_awaited_once()
    if path == '/both':
        assert response.json()['sameUser']
        assert response.json()['contextUserId'] == USER_IDS['alice']


@pytest.mark.asyncio
async def test_new_requests_reauthenticate_even_with_the_same_token(auth_app: SimpleNamespace) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        for _ in range(2):
            response = await client.get('/both', headers={'Authorization': 'Bearer alice'})
            assert response.status_code == status.HTTP_200_OK
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS
    first, second = auth_app.resolver.await_args_list
    assert first.args[0] is not second.args[0]


@pytest.mark.asyncio
async def test_parallel_requests_keep_user_and_context_separate(auth_app: SimpleNamespace) -> None:
    tokens = ['alice', 'bob', 'alice', 'bob']
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        responses = await asyncio.gather(
            *(client.get('/both', headers={'Authorization': f'Bearer {token}'}) for token in tokens)
        )
    assert auth_app.resolver.await_count == len(tokens)
    for token, response in zip(tokens, responses, strict=True):
        body = response.json()
        assert body['userId'] == body['contextUserId'] == USER_IDS[token]
        assert body['permissions'] == [f'user:{USER_IDS[token]}:read']
        assert body['sameUser']


@pytest.mark.asyncio
async def test_excluded_route_keeps_path_method_and_ignore_rules(auth_app: SimpleNamespace) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/public/free')
        assert response.json() == {'name': 'free'}
        for method, path in [('POST', '/public/free'), ('GET', '/public/private')]:
            response = await client.request(method, path)
            assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
            assert response.json()['msg'] == '用户未登录，请先完成登录'
        response = await client.get('/excluded-current')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['/both', '/current', '/pre'])
async def test_missing_token_preserves_existing_auth_response(auth_app: SimpleNamespace, path: str) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get(path)
    expected_status = status.HTTP_401_UNAUTHORIZED if path == '/current' else status.HTTP_200_OK
    assert response.status_code == expected_status
    assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    if path == '/current':
        assert response.headers['www-authenticate'] == 'Bearer'
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('authorization', ['Bearer invalid', 'Basic alice', 'Bearer'])
@pytest.mark.parametrize('path', ['/both', '/current', '/pre'])
async def test_invalid_token_and_header_cannot_reuse_authentication(
    auth_app: SimpleNamespace, authorization: str, path: str
) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        valid = await client.get('/both', headers={'Authorization': 'Bearer alice'})
        assert valid.json()['userId'] == USER_IDS['alice']
        denied = await client.get(path, headers={'Authorization': authorization})
    assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED


def test_current_user_dependency_keeps_original_oauth_token_url(auth_app: SimpleNamespace) -> None:
    security = auth_app.app.openapi()['components']['securitySchemes']['OAuth2PasswordBearer']
    assert security['flows']['password']['tokenUrl'] == 'login'


@pytest.mark.asyncio
async def test_direct_calls_authenticate_each_time(monkeypatch: pytest.MonkeyPatch) -> None:
    request = Request({'type': 'http', 'headers': []})
    database = object()
    resolver = AsyncMock(side_effect=[_user(USER_IDS['alice']), _user(USER_IDS['alice'])])
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    first = await LoginService.get_current_user(request, 'alice', database)
    second = await LoginService.get_current_user(request, 'alice', database)
    assert second is not first
    assert resolver.await_count == TWO_AUTH_CALLS
    assert not hasattr(request.state, '_current_user_auth')


@pytest.mark.asyncio
async def test_failed_authentication_is_not_saved(monkeypatch: pytest.MonkeyPatch) -> None:
    request = Request({'type': 'http', 'headers': []})
    database = object()
    user = _user(USER_IDS['alice'])
    resolver = AsyncMock(side_effect=[AuthException(message='认证失败'), user])
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    with pytest.raises(AuthException):
        await LoginService.get_current_user(request, 'alice', database)
    assert not hasattr(request.state, '_current_user_auth')
    assert await LoginService.get_current_user(request, 'alice', database) is user
    assert resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_cancelled_authentication_is_not_saved(monkeypatch: pytest.MonkeyPatch) -> None:
    request = Request({'type': 'http', 'headers': []})
    database = object()
    entered = asyncio.Event()

    async def blocked(*args: object, **kwargs: object) -> CurrentUserModel:
        entered.set()
        await asyncio.Event().wait()
        raise AssertionError('cancelled request resumed')

    resolver = AsyncMock(side_effect=blocked)
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    task = asyncio.create_task(LoginService.get_current_user(request, 'alice', database))
    await asyncio.wait_for(entered.wait(), timeout=2)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert not hasattr(request.state, '_current_user_auth')
    user = _user(USER_IDS['alice'])
    resolver.side_effect = None
    resolver.return_value = user
    assert await LoginService.get_current_user(request, 'alice', database) is user
    assert resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_excluded_route_matches_configured_root_path(
    auth_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(AppConfig, 'app_root_path', '/dev-api')
    transport = httpx.ASGITransport(app=auth_app.app, root_path='/dev-api')
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        response = await client.get('/dev-api/public/free', headers={'Authorization': 'Bearer invalid'})
        assert response.json() == {'name': 'free'}
        response = await client.get('/dev-api/public/private')
        assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_original_dependency_override_applies_to_both_declarations(auth_app: SimpleNamespace) -> None:
    user = _user(USER_IDS['bob'])
    override_calls = []

    async def override() -> CurrentUserModel:
        override_calls.append(user)
        return user

    @auth_app.app.get(
        '/overridden',
        dependencies=[PreAuthDependency(), UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read')],
    )
    async def overridden(
        current_user: Annotated[CurrentUserModel, CurrentUserDependency()],
        direct_user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user)],
    ) -> dict:
        return {
            'userId': current_user.user.user_id,
            'contextUserId': RequestContext.get_current_user().user.user_id,
            'sameUser': current_user is direct_user,
        }

    auth_app.app.dependency_overrides[LoginService.get_current_user] = override
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/overridden')
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {'userId': USER_IDS['bob'], 'contextUserId': USER_IDS['bob'], 'sameUser': True}
    assert override_calls == [user]
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_calls_without_request_state_authenticate_each_time(monkeypatch: pytest.MonkeyPatch) -> None:
    request = SimpleNamespace()
    database = object()
    resolver = AsyncMock(return_value=_user(USER_IDS['alice']))
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    await LoginService.get_current_user(request, 'alice', database)
    await LoginService.get_current_user(request, 'alice', database)
    assert resolver.await_count == TWO_AUTH_CALLS
    assert not hasattr(request, 'state')


@pytest.mark.asyncio
async def test_plugin_session_validation_never_reuses_main_request_result(monkeypatch: pytest.MonkeyPatch) -> None:
    request = Request({'type': 'http', 'headers': []})
    database = object()
    resolver = AsyncMock(return_value=_user(USER_IDS['alice']))
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    await LoginService.get_current_user(request, 'alice', database)
    await LoginService.get_current_user_for_plugin_session(request, 'alice', database)
    await LoginService.get_current_user_for_plugin_session(request, 'alice', database)
    assert resolver.await_count == THREE_AUTH_CALLS
    assert [call.kwargs['refresh_session'] for call in resolver.await_args_list] == [True, False, False]


@pytest.mark.asyncio
async def test_non_string_token_keeps_auth_exception_conversion() -> None:
    request = Request({'type': 'http', 'headers': []})
    with pytest.raises(AuthException) as exc_info:
        await LoginService.get_current_user(request, b'invalid', object())
    assert exc_info.value.message == '用户token已失效，请重新登录'
    assert not hasattr(request.state, '_current_user_auth')


@pytest.mark.asyncio
async def test_use_cache_false_reauthenticates_after_pre_auth(auth_app: SimpleNamespace) -> None:
    @auth_app.app.get('/fresh', dependencies=[PreAuthDependency()])
    async def fresh(
        first: Annotated[CurrentUserModel, CurrentUserDependency()],
        current: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
    ) -> dict:
        return {
            'sameUser': first is current,
            'userId': current.user.user_id,
            'currentContext': RequestContext.get_current_user() is current,
        }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/fresh', headers={'Authorization': 'Bearer alice'})
    assert response.json() == {'sameUser': False, 'userId': USER_IDS['alice'], 'currentContext': True}
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_use_cache_false_does_not_fall_back_to_previous_success(auth_app: SimpleNamespace) -> None:
    @auth_app.app.get('/fresh-denied', dependencies=[PreAuthDependency()])
    async def fresh_denied(
        current: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
    ) -> dict:
        raise AssertionError('failed authentication was ignored')

    auth_app.resolver.side_effect = [_user(USER_IDS['alice']), AuthException(message='令牌已撤销')]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/fresh-denied', headers={'Authorization': 'Bearer alice'})
    assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert response.json()['msg'] == '令牌已撤销'
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_later_pre_auth_cannot_restore_permissions_before_forced_authentication(
    auth_app: SimpleNamespace,
) -> None:
    initial_user = _user(USER_IDS['bob'])
    refreshed_user = _user(USER_IDS['bob'])
    refreshed_user.permissions = []
    users = iter([initial_user, refreshed_user])
    observed_users = []

    async def authenticate(request: Request, token: str, db: object, *, refresh_session: bool) -> CurrentUserModel:
        user = next(users)
        RequestContext.set_current_user(user)
        return user

    async def observe_context() -> None:
        observed_users.append(RequestContext.get_current_user())

    auth_app.resolver.side_effect = authenticate

    @auth_app.app.get('/revoked-permissions', dependencies=[PreAuthDependency()])
    async def revoked_permissions(
        fresh: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
        another: Annotated[CurrentUserModel, PreAuthDependency()],
        observed: Annotated[None, Depends(observe_context)],
        permitted: Annotated[bool, UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read')],
    ) -> dict:
        raise AssertionError('revoked permission was restored from the dependency cache')

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/revoked-permissions', headers={'Authorization': 'Bearer bob'})
    assert response.json()['code'] == status.HTTP_403_FORBIDDEN
    assert observed_users == [refreshed_user]
    assert observed_users[0] is refreshed_user
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
@pytest.mark.parametrize('authorization', [None, 'Bearer alice', 'Bearer invalid', 'Basic invalid'])
async def test_public_route_never_authenticates(auth_app: SimpleNamespace, authorization: str | None) -> None:
    headers = {'Authorization': authorization} if authorization is not None else {}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/public/free', headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {'name': 'free'}
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_explicit_current_user_still_authenticates_on_excluded_route(auth_app: SimpleNamespace) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/excluded-current', headers={'Authorization': 'Bearer bob'})
        assert response.json() == {'userId': USER_IDS['bob']}
        denied = await client.get('/excluded-current', headers={'Authorization': 'Bearer invalid'})
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_nested_current_user_dependency_requires_login_on_excluded_route(auth_app: SimpleNamespace) -> None:
    async def identity(user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user)]) -> int:
        return user.user.user_id

    @auth_app.app.get('/nested', dependencies=[PreAuthDependency([{'path': '/nested'}])])
    async def nested(user_id: Annotated[int, Depends(identity)]) -> dict:
        return {'userId': user_id}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        denied = await client.get('/nested')
        assert denied.status_code == status.HTTP_401_UNAUTHORIZED
        accepted = await client.get('/nested', headers={'Authorization': 'Bearer bob'})
    assert accepted.json() == {'userId': USER_IDS['bob']}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_override_cannot_add_authentication_to_an_excluded_dependency_without_login(
    auth_app: SimpleNamespace,
) -> None:
    async def identity() -> int:
        return 0

    async def authenticated_identity(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> int:
        return user.user.user_id

    @auth_app.app.get('/override-nested', dependencies=[PreAuthDependency([{'path': '/override-nested'}])])
    async def nested(user_id: Annotated[int, Depends(identity)]) -> dict:
        return {'userId': user_id}

    auth_app.app.dependency_overrides[identity] = authenticated_identity
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        denied = await client.get('/override-nested')
        assert denied.status_code == status.HTTP_401_UNAUTHORIZED
        accepted = await client.get('/override-nested', headers={'Authorization': 'Bearer bob'})
    assert accepted.json() == {'userId': USER_IDS['bob']}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_direct_call_without_a_token_requires_login() -> None:
    request = Request({'type': 'http', 'headers': []})
    with pytest.raises(AuthException) as exc_info:
        await LoginService.get_current_user(request, None, object())
    assert exc_info.value.message == '用户未登录，请先完成登录'


@pytest.mark.asyncio
@pytest.mark.parametrize('excluded_first', [True, False])
async def test_excluded_pre_auth_cannot_cancel_another_auth_requirement(
    auth_app: SimpleNamespace, excluded_first: bool
) -> None:
    dependencies = [PreAuthDependency([{'path': '/mixed'}]), PreAuthDependency()]
    if not excluded_first:
        dependencies.reverse()

    @auth_app.app.get('/mixed', dependencies=dependencies)
    async def mixed() -> dict:
        return {'userId': RequestContext.get_current_user().user.user_id}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        denied = await client.get('/mixed')
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        assert denied.json()['msg'] == '用户未登录，请先完成登录'
        accepted = await client.get('/mixed', headers={'Authorization': 'Bearer bob'})
    assert accepted.json() == {'userId': USER_IDS['bob']}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_multiple_excluded_pre_auth_dependencies_do_not_require_login(auth_app: SimpleNamespace) -> None:
    @auth_app.app.get(
        '/all-public',
        dependencies=[
            PreAuthDependency([{'path': '/all-public'}]),
            PreAuthDependency([{'path': '/all-public', 'methods': ['GET']}]),
        ],
    )
    async def public() -> dict:
        return {'public': True}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/all-public', headers={'Authorization': 'Bearer invalid'})
    assert response.json() == {'public': True}
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('pre_auth_first', [True, False])
async def test_first_required_dependency_keeps_missing_token_response(
    auth_app: SimpleNamespace, pre_auth_first: bool
) -> None:
    dependencies = [PreAuthDependency(), CurrentUserDependency()]
    if not pre_auth_first:
        dependencies.reverse()

    @auth_app.app.get('/ordered', dependencies=dependencies)
    async def ordered() -> dict:
        return {'ok': True}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/ordered')
    expected_status = status.HTTP_200_OK if pre_auth_first else status.HTTP_401_UNAUTHORIZED
    assert response.status_code == expected_status
    assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_failed_request_does_not_reuse_a_previous_authentication(auth_app: SimpleNamespace) -> None:
    authenticate = auth_app.resolver.side_effect
    auth_app.resolver.side_effect = AuthException(message='认证失败')
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        failed = await client.get('/both', headers={'Authorization': 'Bearer alice'})
        assert failed.json()['code'] == status.HTTP_401_UNAUTHORIZED
        auth_app.resolver.side_effect = authenticate
        accepted = await client.get('/both', headers={'Authorization': 'Bearer alice'})
    assert accepted.json()['userId'] == USER_IDS['alice']
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_cancelled_request_does_not_affect_following_authentication(auth_app: SimpleNamespace) -> None:
    authenticate = auth_app.resolver.side_effect
    entered = asyncio.Event()

    async def blocked(*args: object, **kwargs: object) -> CurrentUserModel:
        entered.set()
        await asyncio.Event().wait()
        raise AssertionError('cancelled request resumed')

    auth_app.resolver.side_effect = blocked
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        task = asyncio.create_task(client.get('/both', headers={'Authorization': 'Bearer alice'}))
        await asyncio.wait_for(entered.wait(), timeout=2)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        auth_app.resolver.side_effect = authenticate
        response = await client.get('/both', headers={'Authorization': 'Bearer bob'})
    assert response.json()['userId'] == response.json()['contextUserId'] == USER_IDS['bob']
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_interface_role_and_data_permissions_are_still_checked(auth_app: SimpleNamespace) -> None:
    @auth_app.app.get(
        '/scope',
        dependencies=[
            PreAuthDependency(),
            UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read'),
            RoleInterfaceAuthDependency('reader'),
        ],
    )
    async def scope(
        user: Annotated[CurrentUserModel, CurrentUserDependency()],
        data_scope: Annotated[ColumnElement, DataScopeDependency(SysUser)],
    ) -> dict:
        return {'userId': user.user.user_id, 'scope': str(data_scope.compile(compile_kwargs={'literal_binds': True}))}

    @auth_app.app.get(
        '/forbidden-permission',
        dependencies=[PreAuthDependency(), UserInterfaceAuthDependency('system:user:delete')],
    )
    @auth_app.app.get(
        '/forbidden-role',
        dependencies=[PreAuthDependency(), RoleInterfaceAuthDependency('administrator')],
    )
    async def forbidden() -> dict:
        raise AssertionError('permission check was skipped')

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        accepted = await client.get('/scope', headers={'Authorization': 'Bearer bob'})
        assert accepted.json() == {'userId': USER_IDS['bob'], 'scope': f'sys_user.user_id = {USER_IDS["bob"]}'}
        for path in ['/forbidden-permission', '/forbidden-role']:
            denied = await client.get(path, headers={'Authorization': 'Bearer bob'})
            assert denied.json()['code'] == status.HTTP_403_FORBIDDEN
    assert auth_app.resolver.await_count == THREE_AUTH_CALLS


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['/pre', '/both', '/current'])
@pytest.mark.parametrize('scheme', ['Bearer', 'bearer', 'BEARER'])
async def test_authentication_accepts_standard_bearer_scheme_case_insensitively(
    auth_app: SimpleNamespace, path: str, scheme: str
) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get(path, headers={'Authorization': f'{scheme} alice'})
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['userId'] == USER_IDS['alice']
    auth_app.resolver.assert_awaited_once()
    assert auth_app.resolver.await_args.args[1] == 'alice'


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['/pre', '/both', '/current'])
@pytest.mark.parametrize('authorization', ['alice', 'Basic alice'])
async def test_authentication_rejects_non_bearer_authorization(
    auth_app: SimpleNamespace, path: str, authorization: str
) -> None:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get(path, headers={'Authorization': authorization})
    assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    expected_status = status.HTTP_401_UNAUTHORIZED if path == '/current' else status.HTTP_200_OK
    assert response.status_code == expected_status
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('excluded', [False, True])
async def test_explicit_oauth_dependency_returns_bare_token_and_still_requires_login(
    auth_app: SimpleNamespace, excluded: bool
) -> None:
    exclude_routes = [{'path': '/token'}] if excluded else None

    @auth_app.app.get('/token', dependencies=[PreAuthDependency(exclude_routes)])
    async def token_endpoint(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
        return {'token': token}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        for headers in [{}, {'Authorization': 'alice'}, {'Authorization': 'Basic alice'}]:
            denied = await client.get('/token', headers=headers)
            assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        accepted = await client.get('/token', headers={'Authorization': 'Bearer alice'})
    assert accepted.json() == {'token': 'alice'}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_unrelated_override_keeps_an_excluded_route_public(auth_app: SimpleNamespace) -> None:
    async def language() -> str:
        return 'en'

    async def translated_language() -> str:
        return 'zh'

    router = APIRouter(dependencies=[PreAuthDependency([{'path': '/translated/public'}])])

    @router.get('/public')
    async def public(locale: Annotated[str, Depends(language)]) -> dict:
        return {'locale': locale}

    auth_app.app.include_router(router, prefix='/translated')
    auth_app.app.dependency_overrides[language] = translated_language
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/translated/public')
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {'locale': 'zh'}
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('nested', [False, True])
@pytest.mark.parametrize('requirement', ['current_user', 'pre_auth', 'oauth'])
async def test_parent_router_authentication_cannot_be_excluded_by_child(
    auth_app: SimpleNamespace, nested: bool, requirement: str
) -> None:
    users = []

    async def require_user(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> None:
        users.append(user)

    requirements = {
        'current_user': Depends(require_user),
        'pre_auth': PreAuthDependency(),
        'oauth': Depends(oauth2_scheme),
    }
    path = '/parent/child/profile' if nested else '/parent/profile'
    router = APIRouter(dependencies=[PreAuthDependency([{'path': path}])])

    @router.get('/profile')
    async def profile() -> dict:
        return {'protected': True}

    if nested:
        parent = APIRouter()
        parent.include_router(router, prefix='/child')
        router = parent
    auth_app.app.include_router(router, prefix='/parent', dependencies=[requirements[requirement]])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        denied = await client.get(path)
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        assert users == []
        accepted = await client.get(path, headers={'Authorization': 'Bearer alice'})
    assert accepted.status_code == status.HTTP_200_OK
    assert accepted.json() == {'protected': True}
    auth_app.resolver.assert_awaited_once()
    if requirement == 'current_user':
        assert [user.user.user_id for user in users] == [USER_IDS['alice']]


@pytest.mark.asyncio
async def test_router_inclusions_keep_their_own_authentication_requirements(auth_app: SimpleNamespace) -> None:
    async def require_user(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> None:
        assert user.user.user_id == USER_IDS['alice']

    router = APIRouter(dependencies=[PreAuthDependency([{'path': '/open/info'}, {'path': '/secured/info'}])])

    @router.get('/info')
    async def info() -> dict:
        return {'available': True}

    auth_app.app.include_router(router, prefix='/open')
    auth_app.app.include_router(router, prefix='/secured', dependencies=[Depends(require_user)])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        public = await client.get('/open/info')
        assert public.json() == {'available': True}
        denied = await client.get('/secured/info')
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        accepted = await client.get('/secured/info', headers={'Authorization': 'Bearer alice'})
        assert accepted.json() == {'available': True}
        public_again = await client.get('/open/info', headers={'Authorization': 'Bearer invalid'})
        assert public_again.json() == {'available': True}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_parent_override_added_authentication_is_required(auth_app: SimpleNamespace) -> None:
    async def identity() -> None:
        return None

    async def authenticated_identity(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> None:
        assert user.user.user_id == USER_IDS['alice']

    router = APIRouter(dependencies=[PreAuthDependency([{'path': '/overridden/public'}])])

    @router.get('/public')
    async def public() -> dict:
        return {'available': True}

    auth_app.app.include_router(router, prefix='/overridden', dependencies=[Depends(identity)])
    auth_app.app.dependency_overrides[identity] = authenticated_identity
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        denied = await client.get('/overridden/public')
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        accepted = await client.get('/overridden/public', headers={'Authorization': 'Bearer alice'})
    assert accepted.json() == {'available': True}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('root_path', ['', '/api'])
async def test_business_prefix_is_not_removed_as_a_deployment_prefix(
    auth_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, root_path: str
) -> None:
    monkeypatch.setattr(AppConfig, 'app_root_path', '/api')
    router = APIRouter(prefix='/api', dependencies=[PreAuthDependency([{'path': '/api/public'}, {'path': '/private'}])])

    @router.get('/public')
    @router.get('/private')
    async def endpoint() -> dict:
        return {'available': True}

    auth_app.app.include_router(router)
    transport = httpx.ASGITransport(app=auth_app.app, root_path=root_path)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        public = await client.get(f'{root_path}/api/public', headers={'Authorization': 'Bearer invalid'})
        assert public.json() == {'available': True}
        denied = await client.get(f'{root_path}/api/private')
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        accepted = await client.get(f'{root_path}/api/private', headers={'Authorization': 'Bearer bob'})
    assert accepted.json() == {'available': True}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('root_path', ['', '/api'])
async def test_deployment_prefix_requires_a_path_segment_boundary(
    auth_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, root_path: str
) -> None:
    monkeypatch.setattr(AppConfig, 'app_root_path', '/api')

    @auth_app.app.get('/api-extra/public', dependencies=[PreAuthDependency([{'path': '/api-extra/public'}])])
    async def public() -> dict:
        return {'available': True}

    transport = httpx.ASGITransport(app=auth_app.app, root_path=root_path)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        response = await client.get('/api-extra/public', headers={'Authorization': 'Bearer invalid'})
    assert response.json() == {'available': True}
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('root_path', ['', '/api'])
@pytest.mark.parametrize('permission', ['interface', 'role', 'data_scope'])
async def test_permission_dependencies_use_the_same_excluded_application_path(
    auth_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, root_path: str, permission: str
) -> None:
    monkeypatch.setattr(AppConfig, 'app_root_path', '/api')
    permissions = {
        'interface': UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read'),
        'role': RoleInterfaceAuthDependency('reader'),
        'data_scope': DataScopeDependency(SysUser),
    }
    router = APIRouter(
        prefix='/api',
        dependencies=[
            PreAuthDependency([{'path': '/api/public-scope'}, {'path': '/private-scope'}]),
            permissions[permission],
        ],
    )

    @router.get('/public-scope')
    @router.get('/private-scope')
    async def endpoint() -> dict:
        return {'available': True}

    auth_app.app.include_router(router)
    transport = httpx.ASGITransport(app=auth_app.app, root_path=root_path)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        excluded = await client.get(f'{root_path}/api/public-scope')
        assert excluded.json()['code'] == status.HTTP_403_FORBIDDEN
        assert '当前路由不在认证规则内' in excluded.json()['msg']
        auth_app.resolver.assert_not_awaited()
        protected = await client.get(f'{root_path}/api/private-scope', headers={'Authorization': 'Bearer bob'})
    assert protected.json() == {'available': True}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('root_path', ['', '/gateway'])
@pytest.mark.parametrize(
    'encoded,decoded',
    [('%23private', '#private'), ('%3Fprivate', '?private'), ('%0A', '\n'), ('%0D', '\r'), ('%09', '\t')],
)
@pytest.mark.parametrize('ignore_path', [False, True])
async def test_encoded_path_separators_cannot_expand_public_routes(
    auth_app: SimpleNamespace, root_path: str, encoded: str, decoded: str, ignore_path: bool
) -> None:
    protected_path = f'/encoded/public{decoded}'
    rule = {'path': '/encoded/{name}', 'ignore_paths': [protected_path]} if ignore_path else {'path': '/encoded/public'}

    @auth_app.app.get('/encoded/{name}', dependencies=[PreAuthDependency([rule])])
    async def endpoint(name: str) -> dict:
        return {'name': name}

    transport = httpx.ASGITransport(app=auth_app.app, root_path=root_path)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        public = await client.get(f'{root_path}/encoded/public')
        assert public.json() == {'name': 'public'}
        denied = await client.get(f'{root_path}/encoded/public{encoded}')
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        auth_app.resolver.assert_not_awaited()
        accepted = await client.get(f'{root_path}/encoded/public{encoded}', headers={'Authorization': 'Bearer bob'})
    assert accepted.json() == {'name': f'public{decoded}'}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('root_path', ['', '/gateway'])
@pytest.mark.parametrize(
    'encoded,decoded',
    [('%23private', '#private'), ('%3Fprivate', '?private'), ('%0A', '\n'), ('%0D', '\r'), ('%09', '\t')],
)
async def test_permission_check_uses_the_full_decoded_path(
    auth_app: SimpleNamespace, root_path: str, encoded: str, decoded: str
) -> None:
    @auth_app.app.get(
        '/encoded-permission/{name}',
        dependencies=[
            PreAuthDependency([{'path': '/encoded-permission/public'}]),
            UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read'),
        ],
    )
    async def endpoint(name: str) -> dict:
        return {'name': name}

    transport = httpx.ASGITransport(app=auth_app.app, root_path=root_path)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        denied = await client.get(
            f'{root_path}/encoded-permission/public{encoded}', headers={'Authorization': 'Bearer alice'}
        )
        assert denied.json()['code'] == status.HTTP_403_FORBIDDEN
        assert denied.json()['msg'] == '该用户无此接口权限'
        accepted = await client.get(
            f'{root_path}/encoded-permission/public{encoded}', headers={'Authorization': 'Bearer bob'}
        )
    assert accepted.json() == {'name': f'public{decoded}'}
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_mounted_application_uses_its_asgi_root_path(
    auth_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(AppConfig, 'app_root_path', '/api')
    app = FastAPI()
    app.mount('/gateway', auth_app.app)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        public = await client.get('/gateway/public/free', headers={'Authorization': 'Bearer invalid'})
        assert public.json() == {'name': 'free'}
        denied = await client.get('/gateway/public/private')
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
    auth_app.resolver.assert_not_awaited()


@pytest.mark.parametrize('path,expected', [('/api/public', '/public'), ('/api-extra/public', '/api-extra/public')])
@pytest.mark.parametrize('with_scope', [True, False])
def test_direct_dependency_path_keeps_configured_prefix_fallback(
    monkeypatch: pytest.MonkeyPatch, path: str, expected: str, with_scope: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_root_path', '/api')
    request = (
        Request({'type': 'http', 'path': path, 'headers': []})
        if with_scope
        else SimpleNamespace(url=SimpleNamespace(path=path))
    )
    assert DependencyUtil.get_request_path(request) == expected
