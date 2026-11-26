import asyncio
from collections.abc import AsyncIterator, Iterator
from types import SimpleNamespace
from typing import TYPE_CHECKING, Annotated
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from fastapi import APIRouter, Depends, FastAPI, Request, status
from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession

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
from tests.auth_helpers import AuthTestApp
from utils.dependency_util import DependencyUtil

if TYPE_CHECKING:
    from common.auth_policy import ExcludeRoute

USER_IDS = {'alice': 1, 'bob': 2}
TWO_AUTH_CALLS = 2
THREE_AUTH_CALLS = 3


def _user(user_id: int) -> CurrentUserModel:
    """
    创建测试使用的 ``CurrentUserModel`` 实例。

    :param user_id: 用户的唯一标识
    :return: 测试使用的 ``CurrentUserModel`` 实例
    """
    return CurrentUserModel(
        permissions=[f'user:{user_id}:read'],
        roles=['reader'],
        user=UserInfoModel(
            user_id=user_id,
            user_name=f'user-{user_id}',
            role=[RoleModel(role_id=2, role_key='reader', data_scope='5', status='0', del_flag='0')],
        ),
    )


@pytest.fixture
def auth_app(monkeypatch: pytest.MonkeyPatch) -> Iterator[AuthTestApp]:
    """
    构建带认证依赖和异常处理的测试应用。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    :yield: 带认证依赖和异常处理的测试应用
    """
    monkeypatch.setattr(AppConfig, 'app_root_path', '')
    app = FastAPI()
    handle_exception(app)
    add_context_cleanup_middleware(app)

    async def database() -> AsyncIterator[object]:
        """
        提供依赖注入使用的数据库替身。

        :yield: 依赖注入使用的数据库替身
        """
        yield object()

    async def authenticate(request: Request, token: str, db: object, *, refresh_session: bool) -> CurrentUserModel:
        """
        按测试场景提供请求认证结果。

        :param request: 当前 HTTP 请求
        :param token: 用于身份验证或授权的令牌
        :param db: 当前操作使用的数据库会话
        :param refresh_session: 是否续期宿主主登录会话
        :raises AuthException: 用户token已失效，请重新登录
        :return: 当前登录用户及其权限信息
        """
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

    @app.get(
        '/both',
        summary='比较预认证与当前用户',
        description='返回两种依赖解析出的用户标识及上下文状态。',
        dependencies=[PreAuthDependency()],
    )
    async def both(
        user: Annotated[CurrentUserModel, CurrentUserDependency()],
        same_user: Annotated[CurrentUserModel, CurrentUserDependency()],
    ) -> dict[str, object]:
        await asyncio.sleep(0)
        return {
            'userId': user.user.user_id,
            'contextUserId': RequestContext.get_current_user().user.user_id,
            'sameUser': user is same_user,
            'permissions': user.permissions,
        }

    @app.get('/current', summary='读取当前用户标识', description='通过当前用户依赖返回已登录用户的标识。')
    async def current(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> dict[str, object]:
        return {'userId': user.user.user_id}

    @app.get(
        '/direct',
        summary='比较直接认证结果',
        description='返回用户标识，并指出两条认证路径是否使用同一用户对象。',
        dependencies=[PreAuthDependency()],
    )
    async def direct(
        user: Annotated[CurrentUserModel, CurrentUserDependency()],
        direct_user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user)],
    ) -> dict[str, object]:
        return {'userId': user.user.user_id, 'sameUser': user is direct_user}

    @app.get(
        '/pre',
        summary='读取预认证上下文',
        description='从当前请求上下文返回已通过预认证的用户标识。',
        dependencies=[PreAuthDependency()],
    )
    async def pre() -> dict[str, object]:
        return {'userId': RequestContext.get_current_user().user.user_id}

    excluded = PreAuthDependency([{'path': '/public/{name}', 'methods': ['GET'], 'ignore_paths': ['/public/private']}])

    @app.api_route(
        '/public/{name}',
        summary='访问公开名称',
        description='按请求方法和路径应用排除规则，并回显路径中的名称。',
        methods=['GET', 'POST'],
        dependencies=[excluded],
    )
    async def public(name: str) -> dict[str, object]:
        return {'name': name}

    @app.get(
        '/excluded-current',
        summary='读取显式认证用户',
        description='即使路径命中预认证排除项，仍从显式依赖读取当前用户。',
        dependencies=[PreAuthDependency([{'path': '/excluded-current'}])],
    )
    async def excluded_current(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> dict[str, object]:
        return {'userId': user.user.user_id}

    try:
        yield AuthTestApp(app=app, resolver=resolver)
    finally:
        RequestContext.clear_all()


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['/both', '/current', '/pre', '/direct'])
async def test_request_authentication_runs_once(auth_app: AuthTestApp, path: str) -> None:
    """单个请求只认证一次。"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get(path, headers={'Authorization': 'Bearer alice'})
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['userId'] == USER_IDS['alice']
    auth_app.resolver.assert_awaited_once()
    if path == '/both':
        assert response.json()['sameUser']
        assert response.json()['contextUserId'] == USER_IDS['alice']


@pytest.mark.asyncio
async def test_new_requests_reauthenticate_even_with_the_same_token(auth_app: AuthTestApp) -> None:
    """同一令牌发起新请求仍需重新认证。"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        for _ in range(2):
            response = await client.get('/both', headers={'Authorization': 'Bearer alice'})
            assert response.status_code == status.HTTP_200_OK
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS
    first, second = auth_app.resolver.await_args_list
    assert first.args[0] is not second.args[0]


@pytest.mark.asyncio
async def test_parallel_requests_keep_user_and_context_separate(auth_app: AuthTestApp) -> None:
    """并发请求隔离用户及上下文。"""
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
async def test_excluded_route_keeps_path_method_and_ignore_rules(auth_app: AuthTestApp) -> None:
    """排除路由时同时考虑路径、方法和忽略规则。"""
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
async def test_missing_token_preserves_existing_auth_response(auth_app: AuthTestApp, path: str) -> None:
    """缺少令牌时返回约定的认证响应。"""
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
    auth_app: AuthTestApp, authorization: str, path: str
) -> None:
    """无效令牌或请求头无法复用认证结果。"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        valid = await client.get('/both', headers={'Authorization': 'Bearer alice'})
        assert valid.json()['userId'] == USER_IDS['alice']
        denied = await client.get(path, headers={'Authorization': authorization})
    assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED


def test_current_user_dependency_keeps_original_oauth_token_url(auth_app: AuthTestApp) -> None:
    """当前用户依赖保留原 OAuth 令牌地址。"""
    security = auth_app.app.openapi()['components']['securitySchemes']['OAuth2PasswordBearer']
    assert security['flows']['password']['tokenUrl'] == 'login'


@pytest.mark.asyncio
async def test_direct_calls_authenticate_each_time(monkeypatch: pytest.MonkeyPatch) -> None:
    """每次直接调用均执行认证。"""
    request = Request({'type': 'http', 'headers': []})
    database = AsyncSession()
    resolver = AsyncMock(side_effect=[_user(USER_IDS['alice']), _user(USER_IDS['alice'])])
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    first = await LoginService.get_current_user(request, 'alice', database)
    second = await LoginService.get_current_user(request, 'alice', database)
    assert second is not first
    assert resolver.await_count == TWO_AUTH_CALLS
    assert not hasattr(request.state, '_current_user_auth')


@pytest.mark.asyncio
async def test_failed_authentication_is_not_saved(monkeypatch: pytest.MonkeyPatch) -> None:
    """认证失败时不缓存结果。"""
    request = Request({'type': 'http', 'headers': []})
    database = AsyncSession()
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
    """取消认证时不缓存结果。"""
    request = Request({'type': 'http', 'headers': []})
    database = AsyncSession()
    entered = asyncio.Event()

    async def blocked(*args: object, **kwargs: object) -> CurrentUserModel:
        """
        将调用保持在等待状态以验证取消行为。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises AssertionError: 已取消的请求意外恢复了执行
        """
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
    auth_app: AuthTestApp, monkeypatch: pytest.MonkeyPatch
) -> None:
    """排除规则能匹配配置的根路径。"""
    monkeypatch.setattr(AppConfig, 'app_root_path', '/dev-api')
    transport = httpx.ASGITransport(app=auth_app.app, root_path='/dev-api')
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        response = await client.get('/dev-api/public/free', headers={'Authorization': 'Bearer invalid'})
        assert response.json() == {'name': 'free'}
        response = await client.get('/dev-api/public/private')
        assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_original_dependency_override_applies_to_both_declarations(auth_app: AuthTestApp) -> None:
    """原依赖覆盖对两处声明同时生效。"""
    user = _user(USER_IDS['bob'])
    override_calls = []

    async def override() -> CurrentUserModel:
        """
        记录覆盖依赖的调用并传递测试用户。

        :return: 当前操作对应的用户
        """
        override_calls.append(user)
        return user

    @auth_app.app.get(
        '/overridden',
        summary='检查认证依赖覆盖',
        description='返回覆盖依赖解析的用户标识，并与请求上下文进行比对。',
        dependencies=[PreAuthDependency(), UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read')],
    )
    async def overridden(
        current_user: Annotated[CurrentUserModel, CurrentUserDependency()],
        direct_user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user)],
    ) -> dict[str, object]:
        """
        返回含 ``userId``, ``contextUserId``, ``sameUser`` 的测试数据。

        :param current_user: 当前登录用户及其权限信息
        :param direct_user: 当前已认证用户及其权限信息
        :return: 含 ``userId``, ``contextUserId``, ``sameUser`` 的测试数据
        """
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
    """没有请求状态时每次调用均执行认证。"""
    request = Mock(spec_set=[])
    database = AsyncSession()
    resolver = AsyncMock(return_value=_user(USER_IDS['alice']))
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    await LoginService.get_current_user(request, 'alice', database)
    await LoginService.get_current_user(request, 'alice', database)
    assert resolver.await_count == TWO_AUTH_CALLS
    assert not hasattr(request, 'state')


@pytest.mark.asyncio
async def test_plugin_session_validation_never_reuses_main_request_result(monkeypatch: pytest.MonkeyPatch) -> None:
    """插件会话校验独立于主请求的认证结果。"""
    request = Request({'type': 'http', 'headers': []})
    database = AsyncSession()
    resolver = AsyncMock(return_value=_user(USER_IDS['alice']))
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    await LoginService.get_current_user(request, 'alice', database)
    await LoginService.get_current_user_for_plugin_session(request, 'alice', database)
    await LoginService.get_current_user_for_plugin_session(request, 'alice', database)
    assert resolver.await_count == THREE_AUTH_CALLS
    assert [call.kwargs['refresh_session'] for call in resolver.await_args_list] == [True, False, False]


@pytest.mark.asyncio
async def test_non_string_token_keeps_auth_exception_conversion() -> None:
    """非字符串令牌仍按约定转换认证异常。"""
    app = FastAPI()
    requests: list[Request] = []

    def invalid_token(request: Request) -> bytes:
        """
        模拟自定义依赖返回未经解码的令牌。

        :param request: 参与本次鉴权的请求
        :return: 无效的二进制令牌
        """
        requests.append(request)
        return b'invalid'

    app.dependency_overrides[oauth2_scheme] = invalid_token

    @app.get('/', summary='校验令牌', description='通过当前用户依赖验证令牌。', dependencies=[CurrentUserDependency()])
    async def protected() -> None:
        pass

    async with (
        AsyncSession() as db,
        httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client,
    ):
        app.dependency_overrides[get_db_session_provider(None)] = lambda: db
        with pytest.raises(AuthException) as exc_info:
            await client.get('/')
    assert exc_info.value.message == '用户token已失效，请重新登录'
    (request,) = requests
    assert not hasattr(request.state, '_current_user_auth')


@pytest.mark.asyncio
async def test_use_cache_false_reauthenticates_after_pre_auth(auth_app: AuthTestApp) -> None:
    """禁用缓存后在预认证完成时重新认证。"""

    @auth_app.app.get(
        '/fresh',
        summary='重新认证当前用户',
        description='在一次请求中重新验证凭证并比较前后两次的用户结果。',
        dependencies=[PreAuthDependency()],
    )
    async def fresh(
        first: Annotated[CurrentUserModel, CurrentUserDependency()],
        current: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
    ) -> dict[str, object]:
        """
        返回含 ``sameUser``, ``userId``, ``currentContext`` 的测试数据。

        :param first: 当前已认证用户及其权限信息
        :param current: 当前已认证用户及其权限信息
        :return: 含 ``sameUser``, ``userId``, ``currentContext`` 的测试数据
        """
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
async def test_use_cache_false_does_not_fall_back_to_previous_success(auth_app: AuthTestApp) -> None:
    """禁用缓存后无法沿用上次成功结果。"""

    @auth_app.app.get(
        '/fresh-denied',
        summary='验证重新认证失败',
        description='第二次认证失败时应拒绝请求，用于检查旧缓存的处理。',
        dependencies=[PreAuthDependency()],
    )
    async def fresh_denied(
        current: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
    ) -> dict[str, object]:
        """
        模拟此操作抛出 AssertionError 的情形。

        :param current: 当前已认证用户及其权限信息
        :raises AssertionError: 认证失败后仍然执行了端点
        """
        raise AssertionError('failed authentication was ignored')

    auth_app.resolver.side_effect = [_user(USER_IDS['alice']), AuthException(message='令牌已撤销')]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/fresh-denied', headers={'Authorization': 'Bearer alice'})
    assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert response.json()['msg'] == '令牌已撤销'
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_later_pre_auth_cannot_restore_permissions_before_forced_authentication(
    auth_app: AuthTestApp,
) -> None:
    """后续预认证无法在强制认证前恢复权限。"""
    initial_user = _user(USER_IDS['bob'])
    refreshed_user = _user(USER_IDS['bob'])
    refreshed_user.permissions = []
    users = iter([initial_user, refreshed_user])
    observed_users = []

    async def authenticate(request: Request, token: str, db: object, *, refresh_session: bool) -> CurrentUserModel:
        """
        按测试场景提供请求认证结果。

        :param request: 当前 HTTP 请求
        :param token: 用于身份验证或授权的令牌
        :param db: 当前操作使用的数据库会话
        :param refresh_session: 是否续期宿主主登录会话
        :return: 当前操作对应的用户
        """
        user = next(users)
        RequestContext.set_current_user(user)
        return user

    async def observe_context() -> None:
        """捕获当前请求上下文中的用户。"""
        observed_users.append(RequestContext.get_current_user())

    auth_app.resolver.side_effect = authenticate

    @auth_app.app.get(
        '/revoked-permissions',
        summary='验证撤销权限后的访问',
        description='在强制重新认证后检查权限，验证撤销操作立即生效。',
        dependencies=[PreAuthDependency()],
    )
    async def revoked_permissions(
        fresh: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
        another: Annotated[CurrentUserModel, PreAuthDependency()],
        observed: Annotated[None, Depends(observe_context)],
        permitted: Annotated[bool, UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read')],
    ) -> dict[str, object]:
        """
        模拟此操作抛出 AssertionError 的情形。

        :param fresh: 当前已认证用户及其权限信息
        :param another: 当前已认证用户及其权限信息
        :param observed: 供断言检查的实际观测记录
        :param permitted: 该请求是否拥有所需权限
        :raises AssertionError: 依赖缓存错误地恢复已撤销的权限
        """
        raise AssertionError('revoked permission was restored from the dependency cache')

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/revoked-permissions', headers={'Authorization': 'Bearer bob'})
    assert response.json()['code'] == status.HTTP_403_FORBIDDEN
    assert observed_users == [refreshed_user]
    assert observed_users[0] is refreshed_user
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
@pytest.mark.parametrize('authorization', [None, 'Bearer alice', 'Bearer invalid', 'Basic invalid'])
async def test_public_route_never_authenticates(auth_app: AuthTestApp, authorization: str | None) -> None:
    """公开路由无需认证。"""
    headers = {'Authorization': authorization} if authorization is not None else {}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/public/free', headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {'name': 'free'}
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_explicit_current_user_still_authenticates_on_excluded_route(auth_app: AuthTestApp) -> None:
    """排除路由中显式请求当前用户仍触发认证。"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/excluded-current', headers={'Authorization': 'Bearer bob'})
        assert response.json() == {'userId': USER_IDS['bob']}
        denied = await client.get('/excluded-current', headers={'Authorization': 'Bearer invalid'})
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert auth_app.resolver.await_count == TWO_AUTH_CALLS


@pytest.mark.asyncio
async def test_nested_current_user_dependency_requires_login_on_excluded_route(auth_app: AuthTestApp) -> None:
    """排除路由中嵌套的当前用户依赖仍要求登录。"""

    async def identity(user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user)]) -> int:
        """
        返回认证依赖解析出的用户标识。

        :param user: 当前已认证用户及其权限信息
        :return: 认证依赖解析出的用户标识
        """
        return user.user.user_id

    @auth_app.app.get(
        '/nested',
        summary='读取嵌套依赖的用户',
        description='从嵌套的当前用户依赖返回用户标识。',
        dependencies=[PreAuthDependency([{'path': '/nested'}])],
    )
    async def nested(user_id: Annotated[int, Depends(identity)]) -> dict[str, object]:
        """
        返回含 ``userId`` 的测试数据。

        :param user_id: 用户的唯一标识
        :return: 含 ``userId`` 的测试数据
        """
        return {'userId': user_id}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        denied = await client.get('/nested')
        assert denied.status_code == status.HTTP_401_UNAUTHORIZED
        accepted = await client.get('/nested', headers={'Authorization': 'Bearer bob'})
    assert accepted.json() == {'userId': USER_IDS['bob']}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_override_cannot_add_authentication_to_an_excluded_dependency_without_login(
    auth_app: AuthTestApp,
) -> None:
    """覆盖排除的依赖时不能绕开登录而追加认证。"""

    async def identity() -> int:
        """
        返回固定值 ``0``。

        :return: 此分支的固定值 ``0``
        """
        return 0

    async def authenticated_identity(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> int:
        """
        返回认证依赖解析出的用户标识。

        :param user: 当前已认证用户及其权限信息
        :return: 认证依赖解析出的用户标识
        """
        return user.user.user_id

    @auth_app.app.get(
        '/override-nested',
        summary='检查被覆盖的嵌套依赖',
        description='从覆盖后的依赖读取用户，验证额外认证要求生效。',
        dependencies=[PreAuthDependency([{'path': '/override-nested'}])],
    )
    async def nested(user_id: Annotated[int, Depends(identity)]) -> dict[str, object]:
        """
        返回含 ``userId`` 的测试数据。

        :param user_id: 用户的唯一标识
        :return: 含 ``userId`` 的测试数据
        """
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
    """直接调用时缺少令牌必须登录。"""
    request = Request({'type': 'http', 'headers': []})
    with pytest.raises(AuthException) as exc_info:
        await LoginService.get_current_user(request, None, AsyncSession())
    assert exc_info.value.message == '用户未登录，请先完成登录'


@pytest.mark.asyncio
@pytest.mark.parametrize('excluded_first', [True, False])
async def test_excluded_pre_auth_cannot_cancel_another_auth_requirement(
    auth_app: AuthTestApp, excluded_first: bool
) -> None:
    """排除一处预认证不能取消其他认证要求。"""
    dependencies = [PreAuthDependency([{'path': '/mixed'}]), PreAuthDependency()]
    if not excluded_first:
        dependencies.reverse()

    @auth_app.app.get(
        '/mixed',
        summary='检查多重预认证',
        description='返回当前用户标识，用于验证多个依赖中仍生效的认证要求。',
        dependencies=dependencies,
    )
    async def mixed() -> dict[str, object]:
        """
        返回含 ``userId`` 的测试数据。

        :return: 含 ``userId`` 的测试数据
        """
        return {'userId': RequestContext.get_current_user().user.user_id}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        denied = await client.get('/mixed')
        assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        assert denied.json()['msg'] == '用户未登录，请先完成登录'
        accepted = await client.get('/mixed', headers={'Authorization': 'Bearer bob'})
    assert accepted.json() == {'userId': USER_IDS['bob']}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_multiple_excluded_pre_auth_dependencies_do_not_require_login(auth_app: AuthTestApp) -> None:
    """多个被排除的预认证依赖不要求登录。"""

    @auth_app.app.get(
        '/all-public',
        summary='访问全部依赖均放行的资源',
        description='当所有预认证依赖都排除此路径时返回公开状态。',
        dependencies=[
            PreAuthDependency([{'path': '/all-public'}]),
            PreAuthDependency([{'path': '/all-public', 'methods': ['GET']}]),
        ],
    )
    async def public() -> dict[str, bool]:
        """
        返回含 ``public`` 的测试数据。

        :return: 含 ``public`` 的测试数据
        """
        return {'public': True}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/all-public', headers={'Authorization': 'Bearer invalid'})
    assert response.json() == {'public': True}
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('pre_auth_first', [True, False])
async def test_first_required_dependency_keeps_missing_token_response(
    auth_app: AuthTestApp, pre_auth_first: bool
) -> None:
    """由首个强制认证依赖决定缺少令牌的响应。"""
    dependencies = [PreAuthDependency(), CurrentUserDependency()]
    if not pre_auth_first:
        dependencies.reverse()

    @auth_app.app.get(
        '/ordered',
        summary='检查认证依赖顺序',
        description='按注册顺序执行认证依赖，用于验证缺少令牌时的响应。',
        dependencies=dependencies,
    )
    async def ordered() -> dict[str, bool]:
        """
        返回含 ``ok`` 的测试数据。

        :return: 含 ``ok`` 的测试数据
        """
        return {'ok': True}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get('/ordered')
    expected_status = status.HTTP_200_OK if pre_auth_first else status.HTTP_401_UNAUTHORIZED
    assert response.status_code == expected_status
    assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_failed_request_does_not_reuse_a_previous_authentication(auth_app: AuthTestApp) -> None:
    """失败请求无法复用先前认证。"""
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
async def test_cancelled_request_does_not_affect_following_authentication(auth_app: AuthTestApp) -> None:
    """取消请求后不影响后续认证。"""
    authenticate = auth_app.resolver.side_effect
    entered = asyncio.Event()

    async def blocked(*args: object, **kwargs: object) -> CurrentUserModel:
        """
        将调用保持在等待状态以验证取消行为。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises AssertionError: 已取消的请求意外恢复了执行
        """
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
async def test_interface_role_and_data_permissions_are_still_checked(auth_app: AuthTestApp) -> None:
    """接口权限、角色和数据权限均被检查。"""

    @auth_app.app.get(
        '/scope',
        summary='查询用户数据范围',
        description='返回当前用户标识和根据角色权限计算的数据范围条件。',
        dependencies=[
            PreAuthDependency(),
            UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read'),
            RoleInterfaceAuthDependency('reader'),
        ],
    )
    async def scope(
        user: Annotated[CurrentUserModel, CurrentUserDependency()],
        data_scope: Annotated[ColumnElement[bool], DataScopeDependency(SysUser)],
    ) -> dict[str, object]:
        """
        返回含 ``userId``, ``scope`` 的测试数据。

        :param user: 当前已认证用户及其权限信息
        :param data_scope: 数据范围（1：全部数据权限 2：自定数据权限 3：本部门数据权限 4：本部门及以下数据权限 5：仅本人数据权限）
        :return: 含 ``userId``, ``scope`` 的测试数据
        """
        return {'userId': user.user.user_id, 'scope': str(data_scope.compile(compile_kwargs={'literal_binds': True}))}

    @auth_app.app.get(
        '/forbidden-permission',
        summary='验证接口权限限制',
        description='尝试访问需要指定权限的资源，用于检查拒绝响应。',
        dependencies=[PreAuthDependency(), UserInterfaceAuthDependency('system:user:delete')],
    )
    @auth_app.app.get(
        '/forbidden-role',
        summary='验证角色访问限制',
        description='尝试访问需要指定角色的资源，用于检查拒绝响应。',
        dependencies=[PreAuthDependency(), RoleInterfaceAuthDependency('administrator')],
    )
    async def forbidden() -> dict[str, object]:
        """
        模拟此操作抛出 AssertionError 的情形。

        :raises AssertionError: 请求绕过了必需的权限检查
        """
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
    auth_app: AuthTestApp, path: str, scheme: str
) -> None:
    """Bearer 认证方案忽略大小写。"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get(path, headers={'Authorization': f'{scheme} alice'})
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['userId'] == USER_IDS['alice']
    auth_app.resolver.assert_awaited_once()
    assert auth_app.resolver.await_args is not None
    assert auth_app.resolver.await_args.args[1] == 'alice'


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['/pre', '/both', '/current'])
@pytest.mark.parametrize('authorization', ['alice', 'Basic alice'])
async def test_authentication_rejects_non_bearer_authorization(
    auth_app: AuthTestApp, path: str, authorization: str
) -> None:
    """认证拒绝非 Bearer 授权头。"""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        response = await client.get(path, headers={'Authorization': authorization})
    assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    expected_status = status.HTTP_401_UNAUTHORIZED if path == '/current' else status.HTTP_200_OK
    assert response.status_code == expected_status
    auth_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('excluded', [False, True])
async def test_explicit_oauth_dependency_returns_bare_token_and_still_requires_login(
    auth_app: AuthTestApp, excluded: bool
) -> None:
    """显式 OAuth 依赖返回纯令牌并要求登录。"""
    exclude_routes: list[ExcludeRoute] | None = [{'path': '/token'}] if excluded else None

    @auth_app.app.get(
        '/token',
        summary='读取 OAuth 凭证',
        description='从显式 OAuth 依赖读取并返回请求携带的令牌。',
        dependencies=[PreAuthDependency(exclude_routes)],
    )
    async def token_endpoint(token: Annotated[str, Depends(oauth2_scheme)]) -> dict[str, object]:
        """
        返回含 ``token`` 的测试数据。

        :param token: 用于身份验证或授权的令牌
        :return: 含 ``token`` 的测试数据
        """
        return {'token': token}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=auth_app.app), base_url='http://test') as client:
        for headers in [{}, {'Authorization': 'alice'}, {'Authorization': 'Basic alice'}]:
            denied = await client.get('/token', headers=headers)
            assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
        accepted = await client.get('/token', headers={'Authorization': 'Bearer alice'})
    assert accepted.json() == {'token': 'alice'}
    auth_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_unrelated_override_keeps_an_excluded_route_public(auth_app: AuthTestApp) -> None:
    """无关依赖覆盖后排除路由仍可公开访问。"""

    async def language() -> str:
        """
        返回固定值 ``en``。

        :return: 此分支的固定值 ``'en'``
        """
        return 'en'

    async def translated_language() -> str:
        """
        返回固定值 ``zh``。

        :return: 此分支的固定值 ``'zh'``
        """
        return 'zh'

    router = APIRouter(dependencies=[PreAuthDependency([{'path': '/translated/public'}])])

    @router.get(
        '/public', summary='读取公开语言配置', description='返回语言依赖提供的值，用于检查无关依赖覆盖后的公开访问。'
    )
    async def public(locale: Annotated[str, Depends(language)]) -> dict[str, object]:
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
    auth_app: AuthTestApp, nested: bool, requirement: str
) -> None:
    """子路由无法排除父路由的认证要求。"""
    users = []

    async def require_user(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> None:
        """
        记录受保护路由解析到的用户。

        :param user: 当前已认证用户及其权限信息
        """
        users.append(user)

    requirements = {
        'current_user': Depends(require_user),
        'pre_auth': PreAuthDependency(),
        'oauth': Depends(oauth2_scheme),
    }
    path = '/parent/child/profile' if nested else '/parent/profile'
    router = APIRouter(dependencies=[PreAuthDependency([{'path': path}])])

    @router.get('/profile', summary='访问父路由保护的资料', description='验证子路由挂载后仍执行父路由的认证依赖。')
    async def profile() -> dict[str, bool]:
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
async def test_router_inclusions_keep_their_own_authentication_requirements(auth_app: AuthTestApp) -> None:
    """分别挂载的路由保留各自的认证要求。"""

    async def require_user(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> None:
        """
        记录受保护路由解析到的用户。

        :param user: 当前已认证用户及其权限信息
        """
        assert user.user.user_id == USER_IDS['alice']

    router = APIRouter(dependencies=[PreAuthDependency([{'path': '/open/info'}, {'path': '/secured/info'}])])

    @router.get(
        '/info', summary='查询挂载路由状态', description='返回可用状态，用于比对同一路由在不同挂载位置的认证要求。'
    )
    async def info() -> dict[str, bool]:
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
async def test_parent_override_added_authentication_is_required(auth_app: AuthTestApp) -> None:
    """父级依赖覆盖增加的认证必须执行。"""

    async def identity() -> None:
        """完成无需返回值的回调。"""
        return

    async def authenticated_identity(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> None:
        """
        返回认证依赖解析出的用户标识。

        :param user: 当前已认证用户及其权限信息
        """
        assert user.user.user_id == USER_IDS['alice']

    router = APIRouter(dependencies=[PreAuthDependency([{'path': '/overridden/public'}])])

    @router.get('/public', summary='验证父级依赖覆盖', description='访问子路由以检查父级新增的认证要求。')
    async def public() -> dict[str, bool]:
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
    auth_app: AuthTestApp, monkeypatch: pytest.MonkeyPatch, root_path: str
) -> None:
    """识别部署路径时保留业务前缀。"""
    monkeypatch.setattr(AppConfig, 'app_root_path', '/api')
    router = APIRouter(prefix='/api', dependencies=[PreAuthDependency([{'path': '/api/public'}, {'path': '/private'}])])

    @router.get('/public', summary='访问带业务前缀的公开资源', description='按带前缀的公开路径检查匿名访问。')
    @router.get('/private', summary='访问带业务前缀的受保护资源', description='按带前缀的受保护路径检查登录要求。')
    async def endpoint() -> dict[str, bool]:
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
    auth_app: AuthTestApp, monkeypatch: pytest.MonkeyPatch, root_path: str
) -> None:
    """部署前缀必须匹配完整路径段。"""
    monkeypatch.setattr(AppConfig, 'app_root_path', '/api')

    @auth_app.app.get(
        '/api-extra/public',
        summary='验证部署前缀边界',
        description='访问与部署前缀相近的业务路径，确认按完整路径段匹配。',
        dependencies=[PreAuthDependency([{'path': '/api-extra/public'}])],
    )
    async def public() -> dict[str, bool]:
        """
        返回含 ``available`` 的测试数据。

        :return: 含 ``available`` 的测试数据
        """
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
    auth_app: AuthTestApp, monkeypatch: pytest.MonkeyPatch, root_path: str, permission: str
) -> None:
    """权限依赖使用相同的应用内排除路径。"""
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

    @router.get(
        '/public-scope',
        summary='检查公开路径的数据范围',
        description='在公开路径上运行业务权限依赖，核对排除规则使用的路径。',
    )
    @router.get('/private-scope', summary='检查受限路径的数据范围', description='在受保护路径上执行业务权限检查。')
    async def endpoint() -> dict[str, bool]:
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
    auth_app: AuthTestApp, root_path: str, encoded: str, decoded: str, ignore_path: bool
) -> None:
    """编码后的分隔符无法扩大公开路由范围。"""
    protected_path = f'/encoded/public{decoded}'
    rule: ExcludeRoute = (
        {'path': '/encoded/{name}', 'ignore_paths': [protected_path]} if ignore_path else {'path': '/encoded/public'}
    )

    @auth_app.app.get(
        '/encoded/{name}',
        summary='回显编码后的名称',
        description='回显已匹配的路径参数，用于验证编码分隔符的访问边界。',
        dependencies=[PreAuthDependency([rule])],
    )
    async def endpoint(name: str) -> dict[str, object]:
        """
        返回含 ``name`` 的测试数据。

        :param name: 用于查找或标识当前对象的名称
        :return: 含 ``name`` 的测试数据
        """
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
    auth_app: AuthTestApp, root_path: str, encoded: str, decoded: str
) -> None:
    """权限校验使用完整解码路径。"""

    @auth_app.app.get(
        '/encoded-permission/{name}',
        summary='校验编码路径权限',
        description='根据完整的解码路径验证权限后返回名称。',
        dependencies=[
            PreAuthDependency([{'path': '/encoded-permission/public'}]),
            UserInterfaceAuthDependency(f'user:{USER_IDS["bob"]}:read'),
        ],
    )
    async def endpoint(name: str) -> dict[str, object]:
        """
        返回含 ``name`` 的测试数据。

        :param name: 用于查找或标识当前对象的名称
        :return: 含 ``name`` 的测试数据
        """
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
    auth_app: AuthTestApp, monkeypatch: pytest.MonkeyPatch
) -> None:
    """挂载的应用使用自身 ASGI 根路径。"""
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
    """直接调用依赖时回退到配置的前缀。"""
    monkeypatch.setattr(AppConfig, 'app_root_path', '/api')
    request = (
        Request({'type': 'http', 'path': path, 'headers': []})
        if with_scope
        else Mock(spec_set=['url'], url=SimpleNamespace(path=path))
    )
    assert DependencyUtil.get_request_path(request) == expected
