from collections.abc import AsyncIterator
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import delete, event, update
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from config.database import Base
from module_admin.dao.user_dao import UserDao
from module_admin.entity.do.dept_do import SysDept
from module_admin.entity.do.menu_do import SysMenu
from module_admin.entity.do.post_do import SysPost
from module_admin.entity.do.role_do import SysRole, SysRoleMenu
from module_admin.entity.do.user_do import SysUser, SysUserPost, SysUserRole

USER_ID = 20
ADMIN_ID = 10
ROLE_ID = 20
SECOND_ROLE_ID = 21
DISABLED_ROLE_ID = 22
DELETED_ROLE_ID = 23
DEPT_ID = 20
POST_ID = 20
DISABLED_POST_ID = 21
MENU_ID = 20
SECOND_MENU_ID = 21
DISABLED_MENU_ID = 22
UNAUTHORIZED_MENU_ID = 23
UNASSIGNED_MENU_ID = 24
EMPTY_PERMISSION_MENU_ID = 25
USER_QUERY_COUNT = 4
ADMIN_QUERY_COUNT = 3


@compiles(TINYINT, 'sqlite')
def _compile_tinyint(_type: TINYINT, _compiler: object, **kwargs: object) -> str:
    return 'SMALLINT'


@pytest_asyncio.fixture
async def user_query_env() -> AsyncIterator[SimpleNamespace]:
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    tables = [SysUser, SysDept, SysRole, SysPost, SysMenu, SysUserRole, SysUserPost, SysRoleMenu]
    sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda conn: Base.metadata.create_all(conn, tables=[model.__table__ for model in tables])
        )
    async with sessions.begin() as db:
        db.add_all(
            [
                SysUser(user_id=USER_ID, user_name='reader', nick_name='Reader', dept_id=DEPT_ID, time_zone='UTC'),
                SysUser(user_id=ADMIN_ID, user_name='admin', nick_name='Admin', dept_id=DEPT_ID),
                SysDept(dept_id=DEPT_ID, dept_name='Engineering', ancestors='0,1'),
                SysRole(role_id=1, role_name='Admin', role_key='admin', role_sort=0, status='0'),
                SysRole(
                    role_id=ROLE_ID, role_name='Reader', role_key='reader', role_sort=1, status='0', data_scope='3'
                ),
                SysRole(role_id=SECOND_ROLE_ID, role_name='Other', role_key='other', role_sort=2, status='0'),
                SysRole(role_id=DISABLED_ROLE_ID, role_name='Disabled', role_key='disabled', role_sort=3, status='1'),
                SysRole(
                    role_id=DELETED_ROLE_ID,
                    role_name='Deleted',
                    role_key='deleted',
                    role_sort=4,
                    status='0',
                    del_flag='2',
                ),
                SysPost(post_id=POST_ID, post_name='Developer', post_code='dev', post_sort=1, status='0'),
                SysPost(post_id=DISABLED_POST_ID, post_name='Disabled', post_code='disabled', post_sort=2, status='1'),
                SysMenu(
                    menu_id=MENU_ID,
                    menu_name='Read',
                    perms='demo:read',
                    order_num=2,
                    path='demo',
                    component='demo/index',
                    route_name='Demo',
                    menu_type='C',
                    icon='list',
                ),
                SysMenu(menu_id=SECOND_MENU_ID, menu_name='Read again', perms='demo:read', order_num=1),
                SysMenu(menu_id=DISABLED_MENU_ID, menu_name='Disabled', perms='demo:disabled', status='1'),
                SysMenu(menu_id=UNAUTHORIZED_MENU_ID, menu_name='Unauthorized', perms='demo:unauthorized'),
                SysMenu(menu_id=UNASSIGNED_MENU_ID, menu_name='Unassigned', perms='demo:unassigned'),
                SysMenu(menu_id=EMPTY_PERMISSION_MENU_ID, menu_name='Directory', perms=None, order_num=3),
                SysUserRole(user_id=ADMIN_ID, role_id=1),
                *(
                    SysUserRole(user_id=USER_ID, role_id=role_id)
                    for role_id in [ROLE_ID, SECOND_ROLE_ID, DISABLED_ROLE_ID, DELETED_ROLE_ID]
                ),
                SysUserPost(user_id=USER_ID, post_id=POST_ID),
                SysUserPost(user_id=USER_ID, post_id=DISABLED_POST_ID),
                SysRoleMenu(role_id=ROLE_ID, menu_id=MENU_ID),
                SysRoleMenu(role_id=SECOND_ROLE_ID, menu_id=MENU_ID),
                SysRoleMenu(role_id=ROLE_ID, menu_id=SECOND_MENU_ID),
                SysRoleMenu(role_id=ROLE_ID, menu_id=DISABLED_MENU_ID),
                SysRoleMenu(role_id=ROLE_ID, menu_id=EMPTY_PERMISSION_MENU_ID),
                SysRoleMenu(role_id=DISABLED_ROLE_ID, menu_id=UNAUTHORIZED_MENU_ID),
                SysRoleMenu(role_id=DELETED_ROLE_ID, menu_id=UNAUTHORIZED_MENU_ID),
            ]
        )
    statements = []

    @event.listens_for(engine.sync_engine, 'before_cursor_execute')
    def record_query(
        connection: object, cursor: object, statement: str, parameters: object, context: object, executemany: bool
    ) -> None:
        if statement.lstrip().upper().startswith('SELECT'):
            statements.append(statement)

    try:
        yield SimpleNamespace(sessions=sessions, statements=statements)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_user_auth_preserves_profile_roles_posts_and_permissions(user_query_env: SimpleNamespace) -> None:
    async with user_query_env.sessions() as db:
        result = await UserDao.get_user_by_id(db, USER_ID, for_auth=True)
    assert len(user_query_env.statements) == USER_QUERY_COUNT
    assert result['user_basic_info'].user_name == 'reader'
    assert result['user_basic_info'].time_zone == 'UTC'
    assert result['user_dept_info'].dept_name == 'Engineering'
    assert result['user_dept_info'].ancestors == '0,1'
    assert {role.role_id for role in result['user_role_info']} == {ROLE_ID, SECOND_ROLE_ID}
    assert next(role for role in result['user_role_info'] if role.role_id == ROLE_ID).data_scope == '3'
    assert [post.post_id for post in result['user_post_info']] == [POST_ID]
    assert [menu.menu_id for menu in result['user_menu_info']] == [SECOND_MENU_ID, MENU_ID, EMPTY_PERMISSION_MENU_ID]
    assert [menu.perms for menu in result['user_menu_info']] == ['demo:read', 'demo:read', None]
    assert set(result['user_menu_info'][0]._mapping) == {'menu_id', 'perms', 'order_num'}


@pytest.mark.asyncio
async def test_admin_auth_skips_menus_but_keeps_roles_and_profile(user_query_env: SimpleNamespace) -> None:
    async with user_query_env.sessions() as db:
        result = await UserDao.get_user_by_id(db, ADMIN_ID, for_auth=True)
    assert len(user_query_env.statements) == ADMIN_QUERY_COUNT
    assert result['user_basic_info'].user_name == 'admin'
    assert [role.role_id for role in result['user_role_info']] == [1]
    assert result['user_dept_info'].dept_id == DEPT_ID
    assert result['user_menu_info'] == []
    assert not any('sys_menu' in statement for statement in user_query_env.statements)


@pytest.mark.asyncio
@pytest.mark.parametrize('for_auth', [True, False])
@pytest.mark.parametrize('condition', ['disabled', 'deleted', 'missing'])
async def test_invalid_user_returns_after_one_query(
    user_query_env: SimpleNamespace, for_auth: bool, condition: str
) -> None:
    async with user_query_env.sessions.begin() as db:
        if condition == 'missing':
            await db.execute(delete(SysUser).where(SysUser.user_id == USER_ID))
        else:
            values = {'status': '1'} if condition == 'disabled' else {'del_flag': '2'}
            await db.execute(update(SysUser).where(SysUser.user_id == USER_ID).values(**values))
    async with user_query_env.sessions() as db:
        result = await UserDao.get_user_by_id(db, USER_ID, for_auth=for_auth)
    assert len(user_query_env.statements) == 1
    assert result == {
        'user_basic_info': None,
        'user_dept_info': None,
        'user_role_info': [],
        'user_post_info': [],
        'user_menu_info': [],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize('condition', ['disabled', 'deleted', 'missing', 'unassigned'])
async def test_invalid_department_does_not_hide_valid_user(user_query_env: SimpleNamespace, condition: str) -> None:
    async with user_query_env.sessions.begin() as db:
        if condition == 'unassigned':
            await db.execute(update(SysUser).where(SysUser.user_id == USER_ID).values(dept_id=None))
        elif condition == 'missing':
            await db.execute(delete(SysDept).where(SysDept.dept_id == DEPT_ID))
        else:
            values = {'status': '1'} if condition == 'disabled' else {'del_flag': '2'}
            await db.execute(update(SysDept).where(SysDept.dept_id == DEPT_ID).values(**values))
    async with user_query_env.sessions() as db:
        result = await UserDao.get_user_by_id(db, USER_ID, for_auth=True)
    assert len(user_query_env.statements) == USER_QUERY_COUNT
    assert result['user_basic_info'].user_id == USER_ID
    assert result['user_dept_info'] is None
    assert [menu.perms for menu in result['user_menu_info']] == ['demo:read', 'demo:read', None]


@pytest.mark.asyncio
@pytest.mark.parametrize('user_id', [USER_ID, ADMIN_ID])
async def test_route_query_keeps_complete_menu_models(user_query_env: SimpleNamespace, user_id: int) -> None:
    async with user_query_env.sessions() as db:
        result = await UserDao.get_user_by_id(db, user_id)
    assert len(user_query_env.statements) == USER_QUERY_COUNT
    menus = result['user_menu_info']
    assert all(isinstance(menu, SysMenu) for menu in menus)
    route = next(menu for menu in menus if menu.menu_id == MENU_ID)
    assert route.path == 'demo'
    assert route.component == 'demo/index'
    assert route.route_name == 'Demo'
    assert route.menu_type == 'C'
    assert route.icon == 'list'
    assert DISABLED_MENU_ID not in {menu.menu_id for menu in menus}
    if user_id == ADMIN_ID:
        assert UNASSIGNED_MENU_ID in {menu.menu_id for menu in menus}
    else:
        assert [menu.menu_id for menu in menus] == [SECOND_MENU_ID, MENU_ID, EMPTY_PERMISSION_MENU_ID]


@pytest.mark.asyncio
async def test_new_request_observes_committed_permission_changes(user_query_env: SimpleNamespace) -> None:
    async with user_query_env.sessions() as db:
        before = await UserDao.get_user_by_id(db, USER_ID, for_auth=True)
    async with user_query_env.sessions.begin() as db:
        await db.execute(update(SysRole).where(SysRole.role_id == ROLE_ID).values(status='1'))
        await db.execute(update(SysMenu).where(SysMenu.menu_id == MENU_ID).values(perms='demo:changed'))
    async with user_query_env.sessions() as db:
        after = await UserDao.get_user_by_id(db, USER_ID, for_auth=True)
    assert [menu.perms for menu in before['user_menu_info']] == ['demo:read', 'demo:read', None]
    assert [menu.perms for menu in after['user_menu_info']] == ['demo:changed']
    assert [role.role_id for role in after['user_role_info']] == [SECOND_ROLE_ID]
