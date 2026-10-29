import ast
import builtins
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
    """在独立进程中验证导入边界，避免已加载的模块掩盖循环依赖。"""
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
        token = inspect.signature(LoginService.get_current_user).parameters['token'].default
        assert token.dependency is oauth2_scheme
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
    monkeypatch.setattr(AppConfig, 'app_root_path', '')
    app = FastAPI()
    handle_exception(app)
    add_context_cleanup_middleware(app)

    async def database() -> AsyncIterator[object]:
        yield object()

    user = CurrentUserModel(
        permissions=['demo:read'], roles=['reader'], user=UserInfoModel(userId=2, userName='reader')
    )
    resolver = AsyncMock(return_value=user)
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    app.dependency_overrides[get_db_session_provider(None)] = database

    @app.get('/public', dependencies=[PreAuthDependency([{'path': '/public'}])])
    async def public() -> dict:
        return {'public': True}

    @app.get('/protected', dependencies=[PreAuthDependency()])
    async def protected(current_user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> dict:
        return {'userId': current_user.user.user_id}

    original_import = builtins.__import__

    def import_without_pre_auth(name: str, *args: object, **kwargs: object) -> object:
        if name == 'common.aspect.pre_auth':
            raise AssertionError('登录服务不应在执行时反向导入前置依赖')
        return original_import(name, *args, **kwargs)

    try:
        with monkeypatch.context() as import_patch:
            import_patch.setattr(builtins, '__import__', import_without_pre_auth)
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
    calls = []

    async def authenticate(request: Request) -> str | None:
        mode = AuthPolicy.get_auth_mode(request, (authenticate,))
        calls.append(mode)
        if mode == 'excluded':
            return None
        if request.headers.get('Authorization') != 'Bearer independent':
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        return 'independent'

    class IndependentPreAuth(AuthRule):
        async def __call__(self, user: Annotated[str | None, Depends(authenticate)]) -> str | None:
            return user

    app = FastAPI()
    rule = IndependentPreAuth([{'path': '/plain/public'}, {'path': '/required/public'}])
    router = APIRouter(dependencies=[Depends(rule)])

    @router.get('/public')
    async def public() -> dict:
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
    app = FastAPI()
    handle_exception(app)
    add_context_cleanup_middleware(app)
    app.dependency_overrides[get_db_session_provider(None)] = object
    user = CurrentUserModel(permissions=[], roles=[], user=UserInfoModel(userId=2, userName='reader'))
    resolver = AsyncMock(return_value=user)
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    events = []

    async def original() -> str:
        return 'original'

    async def resource() -> AsyncIterator[str]:
        events.append('open')
        try:
            yield 'resource'
        finally:
            events.append('close')

    async def replacement(value: Annotated[str, Depends(resource, scope='function')]) -> AsyncIterator[str]:
        try:
            yield value
        finally:
            events.append('release')

    @app.get('/scope', dependencies=[PreAuthDependency([{'path': '/scope'}] if public else [])])
    async def endpoint(value: Annotated[str, Depends(original, scope='function')]) -> dict:
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
