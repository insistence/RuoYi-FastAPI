import asyncio
from collections.abc import AsyncIterator
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Annotated
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import APIRouter, Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import NoPermissionError, RedisError
from redis.exceptions import TimeoutError as RedisTimeoutError
from sqlalchemy import delete, event, null, update
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from common.aspect.db_session import DBSessionDependency, get_db_session_provider
from common.aspect.interface_auth import UserInterfaceAuthDependency
from common.aspect.pre_auth import CurrentUserDependency, PreAuthDependency
from common.constant import HttpStatusConstant
from common.context import RequestContext
from config.database import Base
from config.env import AppConfig
from exceptions.handle import handle_exception
from middlewares.context_middleware import ContextCleanupMiddleware
from module_admin.entity.do.dept_do import SysDept
from module_admin.entity.do.menu_do import SysMenu
from module_admin.entity.do.post_do import SysPost
from module_admin.entity.do.role_do import SysRole, SysRoleMenu
from module_admin.entity.do.user_do import SysUser, SysUserPost, SysUserRole
from module_admin.entity.vo.user_vo import CurrentUserModel
from module_admin.service.login_service import LoginService
from tests.module_admin.service.test_login_session_renewal import SessionRedis
from utils.jwt_util import JwtUtil
from utils.time_util import TimezoneUtil

ADMIN_ID = 1
USER_ID = 2
REGULAR_QUERY_COUNT = 4
ADMIN_QUERY_COUNT = 3
TWO_REQUESTS = 2
TWO_AUTHENTICATIONS = 2


@compiles(TINYINT, 'sqlite')
def _compile_tinyint(_type: TINYINT, _compiler: object, **kwargs: object) -> str:
    """
    返回固定值 ``SMALLINT``。

    :param _type: 传递给编译器的类型对象
    :param _compiler: 编译数据库表达式的对象
    :param kwargs: 传给被调用对象的关键字参数
    :return: 此分支的固定值 ``'SMALLINT'``
    """
    return 'SMALLINT'


class AuthenticationRedis(SessionRedis):
    """仅允许原有登录会话和系统配置访问，禁止新增用户快照缓存。"""

    async def get(self, key: str) -> str | None:
        """
        读取测试存储中的指定键。

        :param key: 查找数据时使用的键
        :return: 测试存储中的指定键
        """
        assert key.startswith(('access_token:', 'sys_config:'))
        return await super().get(key)

    async def set(self, key: str, value: str, *, ex: int) -> None:
        """
        写入测试缓存键并设置过期时间。

        :param key: 查找数据时使用的键
        :param value: 待处理的输入值
        :param ex: 捕获到的异常实例
        """
        assert key.startswith('access_token:')
        await super().set(key, value, ex=ex)


@pytest_asyncio.fixture
async def resolution_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[SimpleNamespace]:
    """
    为当前用户解析测试准备隔离环境。

    :param tmp_path: pytest 为当前用例创建的临时目录
    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    :yield: ``SimpleNamespace`` 实例
    """
    monkeypatch.setattr(AppConfig, 'app_same_time_login', True)
    monkeypatch.setattr(AppConfig, 'app_current_user_cache_enabled', False)
    redis = AuthenticationRedis()
    engine = create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "user-resolution.db"}')
    sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    tables = [SysUser, SysDept, SysRole, SysPost, SysMenu, SysUserRole, SysUserPost, SysRoleMenu]
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda conn: Base.metadata.create_all(conn, tables=[model.get_table() for model in tables])
        )
    async with sessions.begin() as db:
        db.add_all(
            [
                SysUser(user_id=ADMIN_ID, user_name='admin', nick_name='Admin', dept_id=USER_ID),
                SysUser(
                    user_id=USER_ID,
                    user_name='reader',
                    nick_name='Reader',
                    dept_id=USER_ID,
                    password='private-password-hash',
                ),
                SysDept(dept_id=USER_ID, dept_name='Engineering', ancestors='0,1'),
                SysRole(role_id=ADMIN_ID, role_name='Admin', role_key='admin', role_sort=0, status='0'),
                SysRole(
                    role_id=USER_ID, role_name='Reader', role_key='reader', role_sort=1, status='0', data_scope='4'
                ),
                SysPost(post_id=USER_ID, post_name='Developer', post_code='dev', post_sort=1, status='0'),
                SysMenu(menu_id=USER_ID, menu_name='Read', perms='demo:read', status='0'),
                SysMenu(menu_id=USER_ID + 1, menu_name='Disabled', perms='demo:disabled', status='1'),
                SysMenu(menu_id=USER_ID + 2, menu_name='Directory', perms=null(), status='0'),
                SysUserRole(user_id=ADMIN_ID, role_id=ADMIN_ID),
                SysUserRole(user_id=USER_ID, role_id=USER_ID),
                SysUserPost(user_id=ADMIN_ID, post_id=USER_ID),
                SysUserPost(user_id=USER_ID, post_id=USER_ID),
                SysRoleMenu(role_id=USER_ID, menu_id=USER_ID),
                SysRoleMenu(role_id=USER_ID, menu_id=USER_ID + 1),
                SysRoleMenu(role_id=USER_ID, menu_id=USER_ID + 2),
            ]
        )
    statements = []

    @event.listens_for(engine.sync_engine, 'before_cursor_execute')
    def record_select(connection: object, cursor: object, statement: str, *args: object) -> None:
        """
        记录数据库执行的查询语句。

        :param connection: 当前操作使用的连接
        :param cursor: 执行当前 SQL 的数据库游标
        :param statement: 即将执行的数据库语句
        :param args: 传给被调用对象的位置参数
        """
        if statement.lstrip().upper().startswith('SELECT'):
            statements.append(statement)

    async def session_dependency() -> AsyncIterator[AsyncSession]:
        """
        为当前请求提供测试数据库会话。

        :yield: 当前操作使用的数据库会话
        """
        async with sessions() as db:
            yield db

    app = FastAPI()
    app.state.redis = redis
    app.dependency_overrides[get_db_session_provider(None)] = session_dependency
    handle_exception(app)
    router = APIRouter(dependencies=[PreAuthDependency()])

    @router.get('/profile', summary='读取当前用户资料', description='通过认证依赖返回当前用户的资料和权限。')
    @router.get(
        '/permitted',
        summary='读取权限保护的用户资料',
        description='校验访问权限后返回当前用户资料。',
        dependencies=[UserInterfaceAuthDependency('demo:read')],
    )
    async def profile(current_user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> CurrentUserModel:
        return current_user

    app.include_router(router)
    headers = {}
    for user_id in (ADMIN_ID, USER_ID):
        token = JwtUtil.encode(
            {
                'user_id': str(user_id),
                'session_id': f'session-{user_id}',
                'exp': int(TimezoneUtil.utc_now().timestamp()) + 3600,
            }
        )
        await redis.set(f'access_token:session-{user_id}', token, ex=3600)
        headers[user_id] = {'Authorization': f'Bearer {token}'}

    RequestContext.clear_all()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
            yield SimpleNamespace(
                app=app, client=client, redis=redis, sessions=sessions, headers=headers, statements=statements
            )
    finally:
        RequestContext.clear_all()
        await engine.dispose()


@pytest.mark.asyncio
async def test_double_auth_declaration_queries_and_renews_once_per_request(resolution_env: SimpleNamespace) -> None:
    """重复声明认证时单个请求只查询和续期一次。"""
    first = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert first.status_code == HttpStatusConstant.SUCCESS
    assert len(resolution_env.statements) == REGULAR_QUERY_COUNT
    assert len(resolution_env.redis.renew_calls) == 1
    payload = first.json()
    assert payload['permissions'] == ['demo:read']
    assert payload['roles'] == ['reader']
    assert payload['user']['postIds'] == str(USER_ID)
    assert payload['user']['roleIds'] == str(USER_ID)
    assert payload['user']['dept']['deptName'] == 'Engineering'
    assert payload['user']['dept']['ancestors'] == '0,1'
    assert payload['user']['role'][0]['dataScope'] == '4'
    assert payload['user']['password'] is None
    assert 'private-password-hash' not in first.text

    second = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert second.json() == payload
    assert len(resolution_env.statements) == REGULAR_QUERY_COUNT * TWO_REQUESTS
    assert len(resolution_env.redis.renew_calls) == TWO_REQUESTS


@pytest.mark.asyncio
async def test_admin_does_not_load_menus_for_authentication(resolution_env: SimpleNamespace) -> None:
    """管理员认证不加载菜单。"""
    response = await resolution_env.client.get('/permitted', headers=resolution_env.headers[ADMIN_ID])
    assert response.json()['permissions'] == ['*:*:*']
    assert response.json()['roles'] == ['admin']
    assert response.json()['user']['admin'] is True
    assert len(resolution_env.statements) == ADMIN_QUERY_COUNT
    assert not any('sys_menu' in statement for statement in resolution_env.statements)
    assert len(resolution_env.redis.renew_calls) == 1


@pytest.mark.asyncio
async def test_use_cache_false_queries_and_renews_again_in_the_same_request(resolution_env: SimpleNamespace) -> None:
    """禁用依赖缓存后同一请求再次查询并续期。"""

    @resolution_env.app.get(
        '/revalidate',
        summary='检查请求内重新认证',
        description='重新查询当前用户，返回权限和请求上下文的比较结果。',
        dependencies=[PreAuthDependency()],
    )
    async def revalidate(
        first: Annotated[CurrentUserModel, CurrentUserDependency()],
        second: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
    ) -> dict[str, object]:
        """
        返回含 ``sameUser``, ``permissions``, ``contextIsFresh`` 的测试数据。

        :param first: 当前已认证用户及其权限信息
        :param second: 当前已认证用户及其权限信息
        :return: 含 ``sameUser``, ``permissions``, ``contextIsFresh`` 的测试数据
        """
        return {
            'sameUser': first is second,
            'permissions': second.permissions,
            'contextIsFresh': RequestContext.get_current_user() is second,
        }

    response = await resolution_env.client.get('/revalidate', headers=resolution_env.headers[USER_ID])

    assert response.status_code == HttpStatusConstant.SUCCESS
    assert response.json() == {'sameUser': False, 'permissions': ['demo:read'], 'contextIsFresh': True}
    assert len(resolution_env.statements) == REGULAR_QUERY_COUNT * TWO_AUTHENTICATIONS
    assert len(resolution_env.redis.renew_calls) == TWO_AUTHENTICATIONS


@pytest.mark.asyncio
async def test_use_cache_false_rejects_a_session_revoked_in_the_same_request(resolution_env: SimpleNamespace) -> None:
    """禁用依赖缓存后拒绝在同一请求中撤销的会话。"""

    async def revoke_session(current_user: Annotated[CurrentUserModel, CurrentUserDependency()]) -> None:
        """
        移除当前用户的会话记录。

        :param current_user: 当前登录用户及其权限信息
        """
        assert current_user.user.user_id == USER_ID
        await resolution_env.redis.delete(f'access_token:session-{USER_ID}')

    @resolution_env.app.get(
        '/revoke-session',
        summary='检查请求内会话撤销',
        description='在同一请求内撤销会话后重新认证，验证撤销生效。',
        dependencies=[PreAuthDependency(), Depends(revoke_session)],
    )
    async def revalidate(
        current_user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
    ) -> CurrentUserModel:
        """
        在调用时报告预期的测试失败：已撤销的会话不应进入接口。

        :param current_user: 当前登录用户及其权限信息
        """
        pytest.fail('已撤销的会话不应进入接口')

    response = await resolution_env.client.get('/revoke-session', headers=resolution_env.headers[USER_ID])

    assert response.json()['code'] == HttpStatusConstant.UNAUTHORIZED
    assert len(resolution_env.statements) == REGULAR_QUERY_COUNT
    assert len(resolution_env.redis.renew_calls) == 1
    assert await resolution_env.redis.get(f'access_token:session-{USER_ID}') is None


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['remove_menu', 'disable_role'])
async def test_use_cache_false_applies_permission_changes_in_the_same_request(
    resolution_env: SimpleNamespace, change: str
) -> None:
    """禁用依赖缓存后同一请求可读取权限变更。"""

    async def revoke_permission(
        current_user: Annotated[CurrentUserModel, CurrentUserDependency()],
        query_db: Annotated[AsyncSession, DBSessionDependency()],
    ) -> None:
        """
        在用户已解析后提交权限变更。

        :param current_user: 当前登录用户及其权限信息
        :param query_db: 当前操作使用的异步数据库会话
        """
        assert current_user.permissions == ['demo:read']
        if change == 'remove_menu':
            await query_db.execute(delete(SysRoleMenu).where(SysRoleMenu.role_id == USER_ID))
        else:
            await query_db.execute(update(SysRole).where(SysRole.role_id == USER_ID).values(status='1'))
        await query_db.commit()

    @resolution_env.app.get(
        '/revoke-permission',
        summary='检查请求内权限变更',
        description='在同一请求内调整用户权限，再次验证访问资格。',
        dependencies=[
            PreAuthDependency(),
            Depends(revoke_permission),
        ],
    )
    async def revalidate(
        current_user: Annotated[CurrentUserModel, Depends(LoginService.get_current_user, use_cache=False)],
        permitted: Annotated[bool, UserInterfaceAuthDependency('demo:read')],
    ) -> None:
        """
        在调用时报告预期的测试失败：权限撤销后不应进入接口。

        :param current_user: 当前登录用户及其权限信息
        :param permitted: 该请求是否拥有所需权限
        """
        pytest.fail('权限撤销后不应进入接口')

    response = await resolution_env.client.get('/revoke-permission', headers=resolution_env.headers[USER_ID])

    assert response.json()['code'] == HttpStatusConstant.FORBIDDEN
    assert len(resolution_env.statements) == REGULAR_QUERY_COUNT * TWO_AUTHENTICATIONS
    assert len(resolution_env.redis.renew_calls) == TWO_AUTHENTICATIONS


@pytest.mark.asyncio
@pytest.mark.parametrize('change', [{'status': '1'}, {'del_flag': '2'}])
async def test_disabled_or_deleted_user_is_rejected_on_next_request(
    resolution_env: SimpleNamespace, change: dict[str, str]
) -> None:
    """后续请求拒绝已禁用或删除的用户。"""
    first = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert first.json()['user']['userId'] == USER_ID
    async with resolution_env.sessions.begin() as db:
        await db.execute(update(SysUser).where(SysUser.user_id == USER_ID).values(**change))

    second = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert second.json()['code'] == HttpStatusConstant.UNAUTHORIZED
    assert len(resolution_env.statements) == REGULAR_QUERY_COUNT + 1
    assert len(resolution_env.redis.renew_calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('change', ['remove', 'disable', 'delete'])
async def test_role_revocation_applies_to_next_request(resolution_env: SimpleNamespace, change: str) -> None:
    """后续请求应用角色撤销结果。"""
    first = await resolution_env.client.get('/permitted', headers=resolution_env.headers[USER_ID])
    assert first.json()['permissions'] == ['demo:read']
    async with resolution_env.sessions.begin() as db:
        if change == 'remove':
            await db.execute(delete(SysUserRole).where(SysUserRole.user_id == USER_ID))
        else:
            values = {'status': '1'} if change == 'disable' else {'del_flag': '2'}
            await db.execute(update(SysRole).where(SysRole.role_id == USER_ID).values(**values))

    second = await resolution_env.client.get('/permitted', headers=resolution_env.headers[USER_ID])
    assert second.json()['code'] == HttpStatusConstant.FORBIDDEN
    assert len(resolution_env.statements) == REGULAR_QUERY_COUNT * TWO_REQUESTS
    assert len(resolution_env.redis.renew_calls) == TWO_REQUESTS
    profile = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert profile.json()['roles'] == []
    assert profile.json()['permissions'] == []


@pytest.mark.asyncio
async def test_password_policy_changes_are_recomputed_on_next_request(
    resolution_env: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    """后续请求重新计算已变更的密码策略。"""
    first = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert first.json()['pwdChrtype'] == '0'
    assert not first.json()['isDefaultModifyPwd']
    assert not first.json()['isPasswordExpired']
    resolution_env.redis.values.update(
        {
            'sys_config:sys.account.chrtype': '4',
            'sys_config:sys.account.initPasswordModify': '1',
            'sys_config:sys.account.passwordValidateDays': '1',
        }
    )
    monkeypatch.setattr(AppConfig, 'app_timezone', 'UTC')

    second = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert second.json()['pwdChrtype'] == '4'
    assert second.json()['isDefaultModifyPwd']
    assert second.json()['isPasswordExpired']
    assert second.json()['appTimezone'] == 'UTC'
    assert len(resolution_env.statements) == REGULAR_QUERY_COUNT * TWO_REQUESTS
    assert len(resolution_env.redis.renew_calls) == TWO_REQUESTS


@pytest.mark.asyncio
async def test_password_expiry_advances_between_requests(
    resolution_env: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    """两次请求之间按时间推进密码有效期。"""
    now = TimezoneUtil.utc_now()
    async with resolution_env.sessions.begin() as db:
        await db.execute(update(SysUser).where(SysUser.user_id == USER_ID).values(pwd_update_date=now))
    resolution_env.redis.values['sys_config:sys.account.passwordValidateDays'] = '1'
    first = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert not first.json()['isPasswordExpired']
    monkeypatch.setattr(TimezoneUtil, 'utc_now', staticmethod(lambda: now + timedelta(days=2)))

    second = await resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID])
    assert second.json()['isPasswordExpired']


@pytest.mark.asyncio
async def test_concurrent_requests_keep_user_identity_and_permissions_separate(resolution_env: SimpleNamespace) -> None:
    """并发请求隔离用户身份和权限。"""
    admin, reader = await asyncio.gather(
        resolution_env.client.get('/profile', headers=resolution_env.headers[ADMIN_ID]),
        resolution_env.client.get('/profile', headers=resolution_env.headers[USER_ID]),
    )
    assert admin.json()['user']['userId'] == ADMIN_ID
    assert admin.json()['permissions'] == ['*:*:*']
    assert reader.json()['user']['userId'] == USER_ID
    assert reader.json()['permissions'] == ['demo:read']
    assert len(resolution_env.statements) == ADMIN_QUERY_COUNT + REGULAR_QUERY_COUNT
    assert len(resolution_env.redis.renew_calls) == TWO_REQUESTS


@pytest.mark.asyncio
@pytest.mark.parametrize('operation', ['get', 'eval'])
@pytest.mark.parametrize('failure', [RedisConnectionError, RedisTimeoutError, NoPermissionError])
async def test_redis_failure_rejects_protected_requests_and_recovers_without_relogin(
    resolution_env: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
    failure: type[RedisError],
) -> None:
    """Redis 故障时拒绝受保护请求并可在恢复后免重新登录。"""
    resolution_env.app.add_middleware(ContextCleanupMiddleware)

    @resolution_env.app.get(
        '/public-health',
        summary='读取公开健康状态',
        description='返回服务健康状态，用于检查缓存服务故障时的公开访问。',
        dependencies=[PreAuthDependency([{'path': '/public-health'}])],
    )
    async def public_health() -> dict[str, object]:
        """
        返回含 ``status`` 的测试数据。

        :return: 含 ``status`` 的测试数据
        """
        return {'status': 'ok'}

    original = getattr(resolution_env.redis, operation)
    unavailable = AsyncMock(side_effect=failure('cache unavailable'))
    monkeypatch.setattr(resolution_env.redis, operation, unavailable)
    key = f'access_token:session-{USER_ID}'
    token = resolution_env.redis.values[key]
    deadline = resolution_env.redis.deadlines[key]
    transport = ASGITransport(app=resolution_env.app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url='http://test') as client:
        public = await client.get('/public-health')
        assert public.json() == {'status': 'ok'}
        unavailable.assert_not_awaited()

        failed = await client.get('/permitted', headers=resolution_env.headers[USER_ID])
        # 基础设施故障保留服务错误语义，不能误报令牌失效或放行受保护接口。
        assert failed.json()['code'] == HttpStatusConstant.ERROR
        assert 'permissions' not in failed.json()
        assert resolution_env.redis.values[key] == token
        assert resolution_env.redis.deadlines[key] == deadline
        assert resolution_env.redis.renew_calls == []

        monkeypatch.setattr(resolution_env.redis, operation, original)
        recovered = await client.get('/permitted', headers=resolution_env.headers[USER_ID])

    assert recovered.json()['user']['userId'] == USER_ID
    assert recovered.json()['permissions'] == ['demo:read']
    assert len(resolution_env.redis.renew_calls) == 1
    expected_queries = REGULAR_QUERY_COUNT * (TWO_REQUESTS if operation == 'eval' else 1)
    assert len(resolution_env.statements) == expected_queries
