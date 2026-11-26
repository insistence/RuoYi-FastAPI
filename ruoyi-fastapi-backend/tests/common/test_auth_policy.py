import ast
import subprocess
import sys
from collections.abc import AsyncIterator
from pathlib import Path
from textwrap import dedent
from typing import Annotated
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status

from common.aspect.db_session import get_db_session_provider
from common.aspect.pre_auth import CurrentUserDependency, PreAuthDependency
from common.auth_policy import AuthPolicy, AuthRule
from common.context import RequestContext
from config.env import AppConfig
from exceptions.handle import handle_exception
from middlewares.context_middleware import add_context_cleanup_middleware
from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel
from module_admin.service.login_service import LoginService

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _run_cold_import(script: str, *arguments: str) -> None:
    """
    在独立进程中验证导入边界，避免已加载的模块掩盖循环依赖。

    :param script: 需要运行的脚本
    :param arguments: 调用方传入的其余位置参数
    """
    result = subprocess.run(
        [sys.executable, '-c', dedent(script), *arguments],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_auth_policy_import_does_not_load_authentication_consumers() -> None:
    """导入认证策略时无需加载认证调用方。"""
    _run_cold_import(
        """
        import importlib.abc
        import sys

        forbidden = ('common.aspect.pre_auth', 'module_admin.service.login_service')

        class RejectConsumers(importlib.abc.MetaPathFinder):
            def find_spec(self, fullname, path=None, target=None):
                if any(fullname == name or fullname.startswith(name + '.') for name in forbidden):
                    raise AssertionError('public policy imported consumer: ' + fullname)
                return None

        sys.meta_path.insert(0, RejectConsumers())
        from common.auth_policy import AuthPolicy, AuthRule, ExcludeRoute

        rule = AuthRule([{'path': '/public/{name}', 'ignore_paths': ['/public/private']}])
        assert rule.is_excluded_path('/public/free', 'GET')
        assert not rule.is_excluded_path('/public/private', 'GET')
        assert not set(forbidden).intersection(sys.modules)
        """
    )


def test_login_service_runs_without_loading_pre_auth() -> None:
    """登录服务可在未加载预认证模块时运行。"""
    _run_cold_import(
        """
        import asyncio
        import importlib.abc
        import sys

        class RejectPreAuth(importlib.abc.MetaPathFinder):
            def find_spec(self, fullname, path=None, target=None):
                if fullname == 'common.aspect.pre_auth':
                    raise AssertionError('login service imported pre_auth')
                return None

        sys.meta_path.insert(0, RejectPreAuth())
        from fastapi import Request
        from exceptions.exception import AuthException
        from module_admin.service.login_service import LoginService, oauth2_scheme

        async def check_authentication():
            request = Request({'type': 'http', 'headers': [(b'authorization', b'Bearer independent')]})
            assert await oauth2_scheme(request) == 'independent'
            try:
                await LoginService.get_current_user(request, token=None, query_db=object())
            except AuthException as exc:
                assert exc.message == '用户未登录，请先完成登录'
            else:
                raise AssertionError('missing token was accepted')

        asyncio.run(check_authentication())
        assert 'common.aspect.pre_auth' not in sys.modules
        """
    )


@pytest.mark.parametrize(
    'modules',
    [
        ('common.aspect.pre_auth', 'module_admin.service.login_service'),
        ('module_admin.service.login_service', 'common.aspect.pre_auth'),
    ],
)
def test_authentication_import_order_preserves_dependency_identity(modules: tuple[str, str]) -> None:
    """不同认证导入顺序得到同一依赖对象。"""
    _run_cold_import(
        """
        import importlib
        import inspect
        import sys

        for index, name in enumerate(sys.argv[1:]):
            importlib.import_module(name)
            if index == 0 and name == 'module_admin.service.login_service':
                assert 'common.aspect.pre_auth' not in sys.modules

        from common.aspect.pre_auth import CurrentUserDependency, ExcludeRoute, PreAuth
        from common.auth_policy import AuthRule, ExcludeRoute as PublicExcludeRoute
        from module_admin.service.login_service import LoginService, oauth2_scheme

        assert issubclass(PreAuth, AuthRule)
        assert ExcludeRoute is PublicExcludeRoute
        assert CurrentUserDependency().dependency == LoginService.get_current_user
        dependency = inspect.signature(PreAuth.__call__).parameters['current_user'].default
        assert dependency.dependency == LoginService.get_current_user
        from fastapi.dependencies.utils import get_dependant

        dependencies = get_dependant(path='/private', call=LoginService.get_current_user).dependencies
        assert next(item.call for item in dependencies if item.name == 'token') is oauth2_scheme
        """,
        *modules,
    )


@pytest.mark.parametrize(
    'relative_path,forbidden',
    [
        ('common/auth_policy.py', {'common.aspect.pre_auth', 'module_admin.service.login_service'}),
        ('module_admin/service/login_service.py', {'common.aspect.pre_auth'}),
    ],
)
def test_authentication_import_direction_has_no_local_back_imports(relative_path: str, forbidden: set[str]) -> None:
    """认证模块之间没有反向局部导入。"""
    tree = ast.parse((BACKEND_ROOT / relative_path).read_text(encoding='utf-8'))
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)
            imported.update(f'{node.module}.{alias.name}' for alias in node.names)
    assert not imported.intersection(forbidden)


@pytest.mark.asyncio
async def test_registered_authentication_runs_without_importing_pre_auth_again(monkeypatch: pytest.MonkeyPatch) -> None:
    """运行已注册的认证无需再次导入预认证模块。"""
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

    user = CurrentUserModel(
        permissions=['demo:read'], roles=['reader'], user=UserInfoModel(user_id=2, user_name='reader')
    )
    resolver = AsyncMock(return_value=user)
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    app.dependency_overrides[get_db_session_provider(None)] = database

    @app.get(
        '/public',
        summary='访问公开资源',
        description='允许匿名访问并返回公开状态。',
        dependencies=[PreAuthDependency([{'path': '/public'}])],
    )
    async def public() -> dict[str, bool]:
        return {'public': True}

    @app.get(
        '/protected',
        summary='读取受保护用户标识',
        description='认证成功后返回当前用户的标识。',
        dependencies=[PreAuthDependency()],
    )
    async def protected(current_user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> dict[str, object]:
        return {'userId': current_user.user.user_id}

    try:
        with monkeypatch.context() as import_patch:
            import_patch.setitem(sys.modules, 'common.aspect.pre_auth', None)
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                public_response = await client.get('/public', headers={'Authorization': 'Bearer invalid'})
                assert public_response.json() == {'public': True}
                resolver.assert_not_awaited()
                denied = await client.get('/protected')
                assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
                accepted = await client.get('/protected', headers={'Authorization': 'Bearer valid'})
        assert accepted.json() == {'userId': 2}
        resolver.assert_awaited_once()
    finally:
        RequestContext.clear_all()


@pytest.mark.asyncio
async def test_auth_policy_accepts_independent_authentication_dependencies() -> None:
    """认证策略接受独立的认证依赖。"""
    calls = []

    async def authenticate(request: Request) -> str | None:
        """
        按测试场景提供请求认证结果。

        :param request: 当前 HTTP 请求
        :raises HTTPException: 模拟认证失败并返回未授权状态
        :return: 此分支的固定值 ``'independent'``
        """
        mode = AuthPolicy.get_auth_mode(request, (authenticate,))
        calls.append(mode)
        if mode == 'excluded':
            return None
        if request.headers.get('Authorization') != 'Bearer independent':
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        return 'independent'

    class IndependentPreAuth(AuthRule):
        """将认证结果作为独立的预认证依赖提供。"""

        async def __call__(self, user: Annotated[str | None, Depends(authenticate)]) -> str | None:
            """
            向调用方返回 ``user``。

            :param user: 当前操作对应的用户
            :return: 当前操作对应的用户
            """
            return user

    app = FastAPI()
    rule = IndependentPreAuth([{'path': '/plain/public'}, {'path': '/required/public'}])
    router = APIRouter(dependencies=[Depends(rule)])

    @router.get(
        '/public', summary='访问独立认证示例', description='返回公开状态，用于验证单独注册的依赖所采用的认证策略。'
    )
    async def public() -> dict[str, bool]:
        return {'public': True}

    app.include_router(router, prefix='/plain')
    app.include_router(router, prefix='/required', dependencies=[Depends(authenticate)])

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        public_response = await client.get('/plain/public')
        denied = await client.get('/required/public')
        accepted = await client.get('/required/public', headers={'Authorization': 'Bearer independent'})
    assert public_response.json() == accepted.json() == {'public': True}
    assert denied.status_code == status.HTTP_401_UNAUTHORIZED
    assert calls == ['excluded', 'current_user', 'current_user']


@pytest.mark.asyncio
@pytest.mark.parametrize('public', [False, True])
async def test_dependency_override_preserves_function_scope(public: bool, monkeypatch: pytest.MonkeyPatch) -> None:
    """覆盖依赖时保留函数作用域。"""
    app = FastAPI()
    handle_exception(app)
    add_context_cleanup_middleware(app)
    app.dependency_overrides[get_db_session_provider(None)] = object
    user = CurrentUserModel(permissions=[], roles=[], user=UserInfoModel(user_id=2, user_name='reader'))
    resolver = AsyncMock(return_value=user)
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    events = []

    async def original() -> str:
        """
        返回固定值 ``original``。

        :return: 此分支的固定值 ``'original'``
        """
        return 'original'

    async def resource() -> AsyncIterator[str]:
        """
        跟踪请求依赖资源的打开和释放。

        :yield: 此分支的固定值 ``'resource'``
        """
        events.append('open')
        try:
            yield 'resource'
        finally:
            events.append('close')

    async def replacement(value: Annotated[str, Depends(resource, scope='function')]) -> AsyncIterator[str]:
        """
        提供用于检验认证规则的替代依赖。

        :param value: 待处理的输入值
        :yield: 待处理的输入值
        """
        try:
            yield value
        finally:
            events.append('release')

    @app.get(
        '/scope',
        summary='读取函数作用域依赖',
        description='返回依赖提供的值，用于检查覆盖依赖后的生命周期。',
        dependencies=[PreAuthDependency([{'path': '/scope'}] if public else [])],
    )
    async def endpoint(value: Annotated[str, Depends(original, scope='function')]) -> dict[str, object]:
        events.append('endpoint')
        return {'value': value}

    app.dependency_overrides[original] = replacement
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        if not public:
            denied = await client.get('/scope')
            assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
            assert events == []
        response = await client.get('/scope', headers={} if public else {'Authorization': 'Bearer valid'})

    assert response.json() == {'value': 'resource'}
    assert events == ['open', 'endpoint', 'release', 'close']
    assert resolver.await_count == (0 if public else 1)
