import json
from collections.abc import AsyncIterator, Iterator
from copy import deepcopy
from types import SimpleNamespace
from typing import Annotated
from unittest.mock import AsyncMock
from uuid import UUID

import httpx
import pytest
from fastapi import APIRouter, Depends, FastAPI, Request, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer

from common.aspect.db_session import get_db_session_provider
from common.aspect.pre_auth import CurrentUserDependency, PreAuthDependency
from common.context import RequestContext
from config.env import AppConfig
from exceptions.exception import AuthException
from exceptions.handle import handle_exception
from middlewares.context_middleware import add_context_cleanup_middleware
from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel
from module_admin.service.login_service import LoginService, oauth2_scheme
from utils.server_util import APIDocsUtil

LOGIN_SECURITY = {'OAuth2PasswordBearer': []}
AUTHORIZATION = {'Authorization': 'Bearer valid'}


@pytest.fixture
def docs_app(monkeypatch: pytest.MonkeyPatch) -> Iterator[SimpleNamespace]:
    monkeypatch.setattr(AppConfig, 'app_disable_swagger', False)
    monkeypatch.setattr(AppConfig, 'app_disable_redoc', False)
    monkeypatch.setattr(AppConfig, 'app_root_path', '')
    app = FastAPI(
        openapi_url=APIDocsUtil.proxy_openapi_url(),
        servers=[{'url': 'https://api.example.test'}],
    )
    APIDocsUtil.custom_api_docs_router(app)
    handle_exception(app)
    add_context_cleanup_middleware(app)

    async def database() -> AsyncIterator[object]:
        yield object()

    async def authenticate(request: Request, token: str, db: object, *, refresh_session: bool) -> CurrentUserModel:
        assert refresh_session
        if token != 'valid':
            raise AuthException(message='用户token已失效，请重新登录')
        current_user = CurrentUserModel(
            permissions=['demo:read'],
            roles=['reader'],
            user=UserInfoModel(userId=2, userName='reader'),
        )
        RequestContext.set_current_user(current_user)
        return current_user

    resolver = AsyncMock(side_effect=authenticate)
    monkeypatch.setattr(LoginService, '_resolve_current_user', resolver)
    app.dependency_overrides[get_db_session_provider(None)] = database

    @app.get('/public', dependencies=[PreAuthDependency([{'path': '/public'}])])
    async def public() -> dict:
        return {'public': True}

    @app.get('/protected', dependencies=[PreAuthDependency()])
    async def protected() -> dict:
        return {'userId': RequestContext.get_current_user().user.user_id}

    @app.api_route(
        '/method',
        methods=['GET', 'POST'],
        dependencies=[PreAuthDependency([{'path': '/method', 'methods': ['GET']}])],
    )
    async def method() -> dict:
        return {'ok': True}

    @app.get('/items/{name}', dependencies=[PreAuthDependency([{'path': '/items/{name}'}])])
    async def items(name: str) -> dict:
        return {'name': name}

    @app.get(
        '/mixed/{name}',
        dependencies=[PreAuthDependency([{'path': '/mixed/{name}', 'ignore_paths': ['/mixed/private']}])],
    )
    async def mixed(name: str) -> dict:
        return {'name': name}

    @app.get('/partial/{name}', dependencies=[PreAuthDependency([{'path': '/partial/free'}])])
    async def partial(name: str) -> dict:
        return {'name': name}

    try:
        yield SimpleNamespace(app=app, resolver=resolver)
    finally:
        RequestContext.clear_all()


def _security(app: FastAPI, path: str, method: str = 'get') -> list[dict]:
    return app.openapi()['paths'][path][method].get('security', [])


@pytest.mark.asyncio
@pytest.mark.parametrize('server_urls', [[], ['https://api.example.test'], ['/gateway']])
async def test_proxy_schema_does_not_add_deployment_prefix_to_direct_schema(
    docs_app: SimpleNamespace, server_urls: list[str]
) -> None:
    servers = [{'url': url} for url in server_urls]
    docs_app.app.servers = deepcopy(servers)
    transport = httpx.ASGITransport(app=docs_app.app, root_path='/gateway')
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        proxy = await client.get('/gateway/proxy-openapi.json')
        direct = await client.get('/gateway/openapi.json')
    assert proxy.status_code == direct.status_code == status.HTTP_200_OK
    expected_proxy_servers = servers if '/gateway' in server_urls else [{'url': '/gateway'}, *servers]
    assert proxy.json().get('servers', []) == expected_proxy_servers
    assert direct.json().get('servers', []) == servers
    assert proxy.json()['paths'] == direct.json()['paths']
    assert docs_app.app.servers == servers
    assert docs_app.app.openapi_schema.get('servers', []) == servers


@pytest.mark.asyncio
@pytest.mark.parametrize('path', ['/public', '/items/{name}'])
async def test_fully_excluded_route_has_no_login_security(docs_app: SimpleNamespace, path: str) -> None:
    assert _security(docs_app.app, path) == []
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        response = await client.get(path.replace('{name}', 'free'), headers={'Authorization': 'Bearer invalid'})
    assert response.status_code == status.HTTP_200_OK
    assert response.json().get('code') != status.HTTP_401_UNAUTHORIZED
    docs_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_protected_route_keeps_login_security(docs_app: SimpleNamespace) -> None:
    assert _security(docs_app.app, '/protected') == [LOGIN_SECURITY]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        denied = await client.get('/protected')
        allowed = await client.get('/protected', headers=AUTHORIZATION)
    assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert allowed.json() == {'userId': 2}
    docs_app.resolver.assert_awaited_once()


@pytest.mark.asyncio
async def test_security_is_classified_per_http_method(docs_app: SimpleNamespace) -> None:
    assert _security(docs_app.app, '/method', 'get') == []
    assert _security(docs_app.app, '/method', 'post') == [LOGIN_SECURITY]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        public = await client.get('/method')
        protected = await client.post('/method')
    assert public.json() == {'ok': True}
    assert protected.json()['code'] == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('path', 'public_path', 'protected_path', 'documented_rule'),
    [
        ('/mixed/{name}', '/mixed/free', '/mixed/private', '/mixed/private'),
        ('/partial/{name}', '/partial/free', '/partial/private', '/partial/free'),
    ],
)
async def test_parameter_dependent_authentication_is_documented_as_conditional(
    docs_app: SimpleNamespace, path: str, public_path: str, protected_path: str, documented_rule: str
) -> None:
    operation = docs_app.app.openapi()['paths'][path]['get']
    assert LOGIN_SECURITY in operation['security']
    assert {} in operation['security']
    assert operation['x-login-auth']['mode'] == 'conditional'
    assert documented_rule in json.dumps(operation['x-login-auth'])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        public = await client.get(public_path)
        protected = await client.get(protected_path)
    assert public.status_code == status.HTTP_200_OK
    assert public.json().get('code') != status.HTTP_401_UNAUTHORIZED
    assert protected.json()['code'] == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
@pytest.mark.parametrize('declaration', ['current', 'nested', 'token', 'plugin', 'included'])
async def test_explicit_authentication_cannot_be_removed_from_public_route_schema(
    docs_app: SimpleNamespace, declaration: str
) -> None:
    path = f'/explicit-{declaration}'
    dependencies = [PreAuthDependency([{'path': path}])]

    async def identity(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> int:
        return user.user.user_id

    if declaration == 'current':

        @docs_app.app.get(path, dependencies=dependencies)
        async def current(user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> dict:
            return {'userId': user.user.user_id}

    elif declaration == 'nested':

        @docs_app.app.get(path, dependencies=dependencies)
        async def nested(user_id: Annotated[int, Depends(identity)]) -> dict:
            return {'userId': user_id}

    elif declaration == 'token':

        @docs_app.app.get(path, dependencies=dependencies)
        async def token(value: Annotated[str, Depends(oauth2_scheme)]) -> dict:
            return {'token': value}

    else:
        router = APIRouter(dependencies=dependencies)

        @router.get(path)
        async def plugin() -> dict:
            return {'ok': True}

        dependency = identity if declaration == 'plugin' else LoginService.get_current_user
        docs_app.app.include_router(router, dependencies=[Depends(dependency)])

    assert _security(docs_app.app, path) == [LOGIN_SECURITY]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        denied = await client.get(path)
        allowed = await client.get(path, headers=AUTHORIZATION)
    assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert allowed.status_code == status.HTTP_200_OK
    assert allowed.json().get('code') != status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
@pytest.mark.parametrize('required', [False, True])
async def test_all_pre_auth_dependencies_must_exclude_the_route(docs_app: SimpleNamespace, required: bool) -> None:
    path = '/multiple'
    dependencies = [
        PreAuthDependency([{'path': path}]),
        PreAuthDependency([] if required else [{'path': path}]),
    ]

    @docs_app.app.get(path, dependencies=dependencies)
    async def multiple() -> dict:
        return {'ok': True}

    assert _security(docs_app.app, path) == ([LOGIN_SECURITY] if required else [])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        response = await client.get(path)
    if required:
        assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    else:
        assert response.json() == {'ok': True}


@pytest.mark.asyncio
async def test_disjoint_exclusions_do_not_make_a_parameterized_route_public(docs_app: SimpleNamespace) -> None:
    @docs_app.app.get(
        '/disjoint/{name}',
        dependencies=[
            PreAuthDependency([{'path': '/disjoint/first'}]),
            PreAuthDependency([{'path': '/disjoint/second'}]),
        ],
    )
    async def disjoint(name: str) -> dict:
        return {'name': name}

    assert _security(docs_app.app, '/disjoint/{name}') == [LOGIN_SECURITY]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        for name in ['first', 'second', 'other']:
            response = await client.get(f'/disjoint/{name}')
            assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize('name', ['public', 'private'])
def test_fixed_route_honors_wildcard_exclusion_and_ignore_paths(docs_app: SimpleNamespace, name: str) -> None:
    path = f'/fixed/{name}'

    @docs_app.app.get(
        path,
        dependencies=[PreAuthDependency([{'path': '/fixed/{name}', 'ignore_paths': ['/fixed/private']}])],
    )
    async def fixed() -> dict:
        return {'ok': True}

    assert _security(docs_app.app, path) == ([LOGIN_SECURITY] if name == 'private' else [])


@pytest.mark.parametrize('ignore_path', ['/elsewhere/private', '/reallowed/private'])
def test_irrelevant_or_reallowed_exceptions_do_not_make_fully_public_routes_conditional(
    docs_app: SimpleNamespace, ignore_path: str
) -> None:
    @docs_app.app.get(
        '/reallowed/{name}',
        dependencies=[
            PreAuthDependency(
                [
                    {'path': '/reallowed/{name}', 'ignore_paths': [ignore_path]},
                    {'path': '/reallowed/private'},
                ]
            )
        ],
    )
    async def reallowed(name: str) -> dict:
        return {'name': name}

    assert _security(docs_app.app, '/reallowed/{name}') == []


@pytest.mark.asyncio
@pytest.mark.parametrize('conditional', [False, True])
async def test_public_login_exclusion_preserves_other_required_security(
    docs_app: SimpleNamespace, conditional: bool
) -> None:
    path = '/key/{name}' if conditional else '/key'
    rule = {'path': '/key/free' if conditional else path}
    api_key = APIKeyHeader(name='X-API-Key', scheme_name='ServiceKey')

    @docs_app.app.get(path, dependencies=[PreAuthDependency([rule])])
    async def key(value: Annotated[str, Depends(api_key)]) -> dict:
        return {'key': value}

    security = _security(docs_app.app, path)
    assert security
    assert all('ServiceKey' in requirement for requirement in security)
    if not conditional:
        assert security == [{'ServiceKey': []}]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        public_path = '/key/free' if conditional else path
        denied = await client.get(public_path)
        allowed = await client.get(public_path, headers={'X-API-Key': 'service-secret'})
    assert denied.status_code == status.HTTP_401_UNAUTHORIZED
    assert allowed.json() == {'key': 'service-secret'}
    docs_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_independent_oauth_scheme_with_the_same_name_remains_required(docs_app: SimpleNamespace) -> None:
    independent = OAuth2PasswordBearer(tokenUrl='independent-login', scheme_name='OAuth2PasswordBearer')

    @docs_app.app.get('/independent', dependencies=[PreAuthDependency([{'path': '/independent'}])])
    async def independent_token(token: Annotated[str, Depends(independent)]) -> dict:
        return {'token': token}

    assert _security(docs_app.app, '/independent') == [LOGIN_SECURITY]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        denied = await client.get('/independent')
        allowed = await client.get('/independent', headers=AUTHORIZATION)
    assert denied.status_code == status.HTTP_401_UNAUTHORIZED
    assert allowed.json() == {'token': 'valid'}


@pytest.mark.asyncio
@pytest.mark.parametrize('root_path', ['/gateway', '/api'])
async def test_nested_router_prefix_and_root_path_match_runtime_rules(
    docs_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, root_path: str
) -> None:
    monkeypatch.setattr(AppConfig, 'app_root_path', root_path)
    docs_app.app.root_path = root_path
    child = APIRouter(prefix='/child', dependencies=[PreAuthDependency([{'path': '/api/child/public'}])])

    @child.get('/public')
    async def public() -> dict:
        return {'ok': True}

    parent = APIRouter(prefix='/api')
    parent.include_router(child)
    docs_app.app.include_router(parent)
    assert _security(docs_app.app, '/api/child/public') == []
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        response = await client.get(f'{root_path}/api/child/public')
    assert response.json() == {'ok': True}
    docs_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_schema_urls_and_direct_schema_share_security_and_servers(docs_app: SimpleNamespace) -> None:
    direct = docs_app.app.openapi()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        custom = await client.get('/openapi.json')
        proxy = await client.get('/proxy-openapi.json')
    assert custom.status_code == proxy.status_code == status.HTTP_200_OK
    assert custom.json() == proxy.json() == direct
    assert direct['servers'] == [{'url': 'https://api.example.test'}]
    assert direct['paths']['/public']['get'].get('security', []) == []
    assert direct['paths']['/protected']['get']['security'] == [LOGIN_SECURITY]
    docs_app.resolver.assert_not_awaited()


def test_schema_adjustment_is_idempotent_and_tracks_late_router_registration(docs_app: SimpleNamespace) -> None:
    initial = deepcopy(docs_app.app.openapi())
    assert docs_app.app.openapi() == initial
    router = APIRouter(prefix='/late', dependencies=[PreAuthDependency([{'path': '/late/public'}])])

    @router.get('/public')
    async def public() -> dict:
        return {'ok': True}

    @router.get('/protected')
    async def protected() -> dict:
        return {'ok': True}

    docs_app.app.include_router(router)
    updated = deepcopy(docs_app.app.openapi())
    assert '/late/public' not in initial['paths']
    assert updated['paths']['/late/public']['get'].get('security', []) == []
    assert updated['paths']['/late/protected']['get']['security'] == [LOGIN_SECURITY]
    assert docs_app.app.openapi() == updated
    docs_app.app.openapi_schema = None
    assert docs_app.app.openapi() == updated
    docs_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('public_first', [False, True])
@pytest.mark.parametrize('include_first', [False, True])
async def test_duplicate_route_preserves_native_security(
    docs_app: SimpleNamespace, public_first: bool, include_first: bool
) -> None:
    path = '/duplicate'

    @docs_app.app.get(
        path,
        dependencies=[PreAuthDependency([{'path': path}] if public_first else [])],
        include_in_schema=include_first,
    )
    async def first() -> dict:
        return {'route': 'first'}

    @docs_app.app.get(path, dependencies=[PreAuthDependency([] if public_first else [{'path': path}])])
    async def second() -> dict:
        return {'route': 'second'}

    operation = docs_app.app.openapi()['paths'][path]['get']
    assert operation == docs_app.app.openapi_schema['paths'][path]['get']
    assert operation['security'] == [LOGIN_SECURITY]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        anonymous = await client.get(path)
        authenticated = await client.get(path, headers=AUTHORIZATION)
    if public_first:
        assert anonymous.json() == {'route': 'first'}
    else:
        assert anonymous.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert authenticated.json() == {'route': 'first'}


@pytest.mark.asyncio
@pytest.mark.parametrize('public_first', [False, True])
@pytest.mark.parametrize('include_first', [False, True])
async def test_duplicate_path_with_different_convertors_preserves_native_security(
    docs_app: SimpleNamespace, public_first: bool, include_first: bool
) -> None:
    rule = {'path': '/duplicate-convertor/{value}'}

    @docs_app.app.get(
        '/duplicate-convertor/{value:int}',
        dependencies=[PreAuthDependency([rule] if public_first else [])],
        include_in_schema=include_first,
    )
    async def integer(value: int) -> dict:
        return {'route': 'integer', 'value': value}

    @docs_app.app.get('/duplicate-convertor/{value}', dependencies=[PreAuthDependency([] if public_first else [rule])])
    async def string(value: str) -> dict:
        return {'route': 'string', 'value': value}

    path = '/duplicate-convertor/{value}'
    operation = docs_app.app.openapi()['paths'][path]['get']
    # 相同OpenAPI路径可对应不同的实际匹配范围，不能将其中一条的排除规则用于整条声明。
    assert operation['security'] == docs_app.app.openapi_schema['paths'][path]['get']['security'] == [LOGIN_SECURITY]
    assert 'x-login-auth' not in operation
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        numeric = await client.get('/duplicate-convertor/1')
        text = await client.get('/duplicate-convertor/free')
    public, protected = (numeric, text) if public_first else (text, numeric)
    assert public.json() == ({'route': 'integer', 'value': 1} if public_first else {'route': 'string', 'value': 'free'})
    assert protected.json()['code'] == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('first_auth', 'second_auth'),
    [
        ('protected', 'plain'),
        ('plain', 'protected'),
        ('public', 'plain'),
        ('plain', 'public'),
        ('public', 'key'),
        ('key', 'public'),
        ('protected', 'key'),
        ('key', 'protected'),
        ('public_key', 'protected'),
        ('protected', 'public_key'),
    ],
)
async def test_duplicate_route_with_other_authentication_preserves_native_security(
    docs_app: SimpleNamespace, first_auth: str, second_auth: str
) -> None:
    path = '/duplicate-security'
    api_key = APIKeyHeader(name='X-API-Key', scheme_name='DuplicateKey')
    dependencies = {
        'protected': [PreAuthDependency()],
        'public': [PreAuthDependency([{'path': path}])],
        'plain': [],
        'key': [Depends(api_key)],
        'public_key': [PreAuthDependency([{'path': path}]), Depends(api_key)],
    }

    @docs_app.app.get(path, dependencies=dependencies[first_auth])
    async def first() -> dict:
        return {'route': 'first'}

    @docs_app.app.get(path, dependencies=dependencies[second_auth])
    async def second() -> dict:
        return {'route': 'second'}

    operation = docs_app.app.openapi()['paths'][path]['get']
    assert operation == docs_app.app.openapi_schema['paths'][path]['get']
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        anonymous = await client.get(path)
        authenticated = await client.get(path, headers={**AUTHORIZATION, 'X-API-Key': 'service-secret'})
    if first_auth == 'protected':
        assert anonymous.json()['code'] == status.HTTP_401_UNAUTHORIZED
    elif first_auth in ('key', 'public_key'):
        assert anonymous.status_code == status.HTTP_401_UNAUTHORIZED
    else:
        assert anonymous.json() == {'route': 'first'}
    assert authenticated.json() == {'route': 'first'}


def test_unrelated_schema_details_and_security_schemes_are_preserved(docs_app: SimpleNamespace) -> None:
    api_key = APIKeyHeader(name='X-External-Key', scheme_name='ExternalKey')

    @docs_app.app.get(
        '/external',
        summary='外部认证接口',
        description='保留已有接口描述。',
        tags=['外部接口'],
        openapi_extra={'x-external': {'enabled': True}},
    )
    async def external(key: Annotated[str, Depends(api_key)]) -> dict:
        return {'key': key}

    @docs_app.app.get('/plain-public')
    async def plain_public() -> dict:
        return {'ok': True}

    schema = docs_app.app.openapi()
    operation = schema['paths']['/external']['get']
    assert operation['security'] == [{'ExternalKey': []}]
    assert operation['summary'] == '外部认证接口'
    assert operation['description'] == '保留已有接口描述。'
    assert operation['tags'] == ['外部接口']
    assert operation['x-external'] == {'enabled': True}
    assert 'x-login-auth' not in operation
    assert schema['paths']['/plain-public']['get'].get('security', []) == []
    assert schema['components']['securitySchemes']['ExternalKey']['name'] == 'X-External-Key'
    assert schema['components']['securitySchemes']['OAuth2PasswordBearer']['flows']['password']['tokenUrl'] == 'login'


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('converter', 'first_value', 'second_value', 'excluded_value'),
    [
        ('int', '1', '2', '1'),
        ('int', '1', '2', 'free'),
        (
            'uuid',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000001',
        ),
        (
            'uuid',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            'free',
        ),
    ],
)
async def test_parameter_convertors_exclude_impossible_public_values(
    docs_app: SimpleNamespace, converter: str, first_value: str, second_value: str, excluded_value: str
) -> None:
    @docs_app.app.get(
        f'/converted/{{value:{converter}}}',
        dependencies=[PreAuthDependency([{'path': f'/converted/{excluded_value}'}])],
    )
    async def converted(value: int | UUID) -> dict:
        return {'value': str(value)}

    security = _security(docs_app.app, '/converted/{value}')
    has_public_value = first_value == excluded_value
    assert LOGIN_SECURITY in security
    assert ({} in security) is has_public_value
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        first = await client.get(f'/converted/{first_value}')
        second = await client.get(f'/converted/{second_value}')
    if has_public_value:
        assert first.json() == {'value': first_value}
    else:
        assert first.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert second.json()['code'] == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
@pytest.mark.parametrize('reallow', [False, True])
async def test_overlapping_public_values_respect_each_pre_auth_exception(
    docs_app: SimpleNamespace, reallow: bool
) -> None:
    rules = [{'path': '/overlap/{name}', 'ignore_paths': ['/overlap/free']}]
    if reallow:
        rules.append({'path': '/overlap/free'})

    @docs_app.app.get(
        '/overlap/{name}',
        dependencies=[PreAuthDependency(rules), PreAuthDependency([{'path': '/overlap/free'}])],
    )
    async def overlap(name: str) -> dict:
        return {'name': name}

    security = _security(docs_app.app, '/overlap/{name}')
    assert LOGIN_SECURITY in security
    assert ({} in security) is reallow
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        first = await client.get('/overlap/free')
        second = await client.get('/overlap/private')
    if reallow:
        assert first.json() == {'name': 'free'}
    else:
        assert first.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert second.json()['code'] == status.HTTP_401_UNAUTHORIZED


def test_adjusted_schema_never_mutates_the_native_cache(docs_app: SimpleNamespace) -> None:
    adjusted = docs_app.app.openapi()
    native = docs_app.app.openapi_schema
    assert native is not adjusted
    assert native['paths']['/public']['get']['security'] == [LOGIN_SECURITY]
    assert native['paths']['/mixed/{name}']['get']['security'] == [LOGIN_SECURITY]
    assert 'x-login-auth' not in native['paths']['/mixed/{name}']['get']
    snapshot = deepcopy(native)
    adjusted['paths']['/public']['get']['security'] = [{'Unrelated': []}]
    adjusted['paths']['/mixed/{name}']['get']['description'] = '由调用者修改的文档'
    assert docs_app.app.openapi_schema == snapshot
    regenerated = docs_app.app.openapi()
    assert regenerated['paths']['/public']['get']['security'] == []
    assert '由调用者修改的文档' not in regenerated['paths']['/mixed/{name}']['get']['description']


def test_registering_docs_again_does_not_duplicate_conditional_authentication_notes(docs_app: SimpleNamespace) -> None:
    before = deepcopy(docs_app.app.openapi())
    APIDocsUtil.custom_api_docs_router(docs_app.app)
    assert docs_app.app.openapi() == before


@pytest.mark.asyncio
async def test_changed_exclusion_rules_restore_native_security_and_description(docs_app: SimpleNamespace) -> None:
    pre_auth = PreAuthDependency([{'path': '/mutable/free'}])
    description = '原有接口描述必须保留。'

    @docs_app.app.get('/mutable/{name}', dependencies=[pre_auth], description=description)
    async def mutable(name: str) -> dict:
        return {'name': name}

    before = docs_app.app.openapi()['paths']['/mutable/{name}']['get']
    assert {} in before['security']
    assert before['description'].startswith(description)
    assert before['x-login-auth']['mode'] == 'conditional'
    original_cache = docs_app.app.openapi_schema
    pre_auth.dependency.exclude_patterns.clear()
    after = docs_app.app.openapi()['paths']['/mutable/{name}']['get']
    assert docs_app.app.openapi_schema is original_cache
    assert after['security'] == [LOGIN_SECURITY]
    assert after['description'] == description
    assert 'x-login-auth' not in after
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        denied = await client.get('/mutable/free')
    assert denied.json()['code'] == status.HTTP_401_UNAUTHORIZED


@pytest.mark.parametrize('conditional', [False, True])
def test_compound_security_from_openapi_extra_is_preserved(docs_app: SimpleNamespace, conditional: bool) -> None:
    gateway = APIKeyHeader(name='X-Gateway-Key', scheme_name='GatewayKey')
    audit = APIKeyHeader(name='X-Audit-Key', scheme_name='AuditKey')

    @docs_app.app.get('/security-definitions')
    async def security_definitions(
        gateway_key: Annotated[str, Depends(gateway)], audit_key: Annotated[str, Depends(audit)]
    ) -> dict:
        return {'gateway': gateway_key, 'audit': audit_key}

    path = '/compound/{name}' if conditional else '/compound'
    description = '此接口还受网关凭证校验。'
    additional_security = {'GatewayKey': [], 'AuditKey': []}

    @docs_app.app.get(
        path,
        dependencies=[PreAuthDependency([{'path': '/compound/free' if conditional else path}])],
        description=description,
        openapi_extra={'security': [{**LOGIN_SECURITY, **additional_security}], 'x-gateway': {'required': True}},
    )
    async def compound() -> dict:
        return {'ok': True}

    operation = docs_app.app.openapi()['paths'][path]['get']
    assert additional_security in operation['security']
    assert all('GatewayKey' in requirement and 'AuditKey' in requirement for requirement in operation['security'])
    assert operation['description'].startswith(description)
    assert operation['x-gateway'] == {'required': True}
    if conditional:
        assert {**LOGIN_SECURITY, **additional_security} in operation['security']
    else:
        assert operation['security'] == [additional_security]
        assert operation['description'] == description


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('path', 'public_path', 'private_path', 'unmatched_ignore'),
    [
        ('/files/{name}.json', '/files/free.json', '/files/private.json', '/files/private.txt'),
        ('/v1.0/items/{name}', '/v1.0/items/free', '/v1.0/items/private', '/v1X0/items/private'),
    ],
)
@pytest.mark.parametrize('ignore', ['none', 'matching', 'unrelated'])
async def test_embedded_parameters_and_literal_dots_preserve_full_exclusion(
    docs_app: SimpleNamespace, path: str, public_path: str, private_path: str, unmatched_ignore: str, ignore: str
) -> None:
    ignored_paths = [] if ignore == 'none' else [private_path if ignore == 'matching' else unmatched_ignore]

    @docs_app.app.get(path, dependencies=[PreAuthDependency([{'path': path, 'ignore_paths': ignored_paths}])])
    async def embedded(name: str) -> dict:
        return {'name': name}

    security = _security(docs_app.app, path)
    if ignore == 'matching':
        assert LOGIN_SECURITY in security
        assert {} in security
    else:
        assert security == []
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        public = await client.get(public_path)
        private = await client.get(private_path)
    assert public.json() == {'name': 'free'}
    if ignore == 'matching':
        assert private.json()['code'] == status.HTTP_401_UNAUTHORIZED
    else:
        assert private.json() == {'name': 'private'}


@pytest.mark.asyncio
async def test_modifying_documented_rules_cannot_change_runtime_authentication(docs_app: SimpleNamespace) -> None:
    @docs_app.app.api_route(
        '/documented/{name}',
        methods=['GET', 'POST'],
        dependencies=[
            PreAuthDependency(
                [{'path': '/documented/{name}', 'methods': ['GET'], 'ignore_paths': ['/documented/private']}]
            )
        ],
    )
    async def documented(name: str) -> dict:
        return {'name': name}

    schema = docs_app.app.openapi()
    rule = schema['paths']['/documented/{name}']['get']['x-login-auth']['exclude_groups'][0][0]
    rule['methods'].append('POST')
    rule['ignore_paths'].clear()
    fresh = docs_app.app.openapi()['paths']['/documented/{name}']['get']['x-login-auth']['exclude_groups'][0][0]
    assert fresh['methods'] == ['GET']
    assert fresh['ignore_paths'] == ['/documented/private']
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        ignored = await client.get('/documented/private')
        protected_method = await client.post('/documented/free')
        public = await client.get('/documented/free')
    assert ignored.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert protected_method.json()['code'] == status.HTTP_401_UNAUTHORIZED
    assert public.json() == {'name': 'free'}


@pytest.mark.asyncio
async def test_explicit_anonymous_security_for_optional_api_key_is_preserved(docs_app: SimpleNamespace) -> None:
    optional_key = APIKeyHeader(name='X-Optional-Key', scheme_name='OptionalKey', auto_error=False)

    @docs_app.app.get(
        '/optional-key',
        dependencies=[PreAuthDependency([{'path': '/optional-key'}])],
        openapi_extra={'security': [{}]},
    )
    async def optional(key: Annotated[str | None, Depends(optional_key)]) -> dict:
        return {'key': key}

    security = _security(docs_app.app, '/optional-key')
    assert {} in security
    assert all('OAuth2PasswordBearer' not in requirement for requirement in security)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        response = await client.get('/optional-key')
    assert response.json() == {'key': None}
    docs_app.resolver.assert_not_awaited()


@pytest.mark.asyncio
async def test_complex_rule_cannot_override_a_proven_empty_public_intersection(docs_app: SimpleNamespace) -> None:
    @docs_app.app.get(
        '/complex/{name}',
        dependencies=[
            PreAuthDependency([{'path': '/complex/(a|b)'}]),
            PreAuthDependency([{'path': '/complex/c'}]),
        ],
    )
    async def complex_rule(name: str) -> dict:
        return {'name': name}

    assert _security(docs_app.app, '/complex/{name}') == [LOGIN_SECURITY]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        for name in ['a', 'b', 'c', 'other']:
            response = await client.get(f'/complex/{name}')
            assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_unresolved_complex_rules_do_not_add_an_unproven_anonymous_alternative(docs_app: SimpleNamespace) -> None:
    @docs_app.app.get('/unresolved/{name}', dependencies=[PreAuthDependency([{'path': '/unresolved/(a|b)'}])])
    async def unresolved(name: str) -> dict:
        return {'name': name}

    operation = docs_app.app.openapi()['paths']['/unresolved/{name}']['get']
    assert operation['security'] == [LOGIN_SECURITY]
    assert operation['x-login-auth']['mode'] == 'conditional'
    assert operation['x-login-auth']['static_analysis'] == 'unresolved'
    assert '/unresolved/(a|b)' in json.dumps(operation['x-login-auth'])
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=docs_app.app), base_url='http://test') as client:
        public = await client.get('/unresolved/a')
        protected = await client.get('/unresolved/private')
    assert public.json() == {'name': 'a'}
    assert protected.json()['code'] == status.HTTP_401_UNAUTHORIZED
