from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from common.constant import CommonConstant
from config.database import Base
from exceptions.exception import ServiceException
from module_admin.dao.menu_dao import MenuDao
from module_admin.entity.do.menu_do import SysMenu
from module_admin.entity.vo.menu_vo import MenuModel, MenuSortModel
from module_admin.service.menu_service import MenuService
from tests.module_admin.service.helpers import make_query_db


def test_menu_tree_keeps_root_with_null_parent_id() -> None:
    """父编号为空的菜单应作为根节点并保留其子菜单。"""
    root = SysMenu(menu_id=10, menu_name='系统', parent_id=None)
    child = SysMenu(menu_id=11, menu_name='用户', parent_id=10)
    (tree,) = MenuService.list_to_tree([child, root])
    assert (tree.id, tree.label, tree.parent_id) == (10, '系统', 0)
    assert tree.children is not None
    assert [node.id for node in tree.children] == [11]


def _menu(
    *,
    menu_id: int,
    parent_id: int,
    path: str,
    route_name: str | None,
    menu_name: str = '已有菜单',
) -> SimpleNamespace:
    """
    创建测试使用的 ``SimpleNamespace`` 实例。

    :param menu_id: 菜单ID
    :param parent_id: 父菜单ID
    :param path: 要读取或处理的路径
    :param route_name: 路由名称
    :param menu_name: 菜单名称
    :return: 测试使用的 ``SimpleNamespace`` 实例
    """
    return SimpleNamespace(
        menu_id=menu_id,
        parent_id=parent_id,
        path=path,
        route_name=route_name,
        menu_name=menu_name,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('page_object', 'existing_menu'),
    [
        (
            MenuModel(menu_id=2, parent_id=1, path='system/user', route_name='SystemUser'),
            _menu(menu_id=1, parent_id=1, path='SYSTEM/USER', route_name='OtherRoute'),
        ),
        (
            MenuModel(menu_id=2, parent_id=0, path='system/user', route_name='SystemUser'),
            _menu(menu_id=1, parent_id=9, path='SYSTEM/USER', route_name='OtherRoute'),
        ),
        (
            MenuModel(menu_id=2, parent_id=2, path='different/path', route_name='SystemUser'),
            _menu(menu_id=1, parent_id=1, path='system/user', route_name='systemuser'),
        ),
    ],
)
async def test_check_route_config_unique_rejects_route_conflicts(
    page_object: MenuModel, existing_menu: SimpleNamespace
) -> None:
    """路由配置唯一性检查拒绝冲突。"""
    with patch.object(
        MenuDao,
        'get_menus_by_path_or_route_name',
        new=AsyncMock(return_value=[existing_menu]),
    ):
        result = await MenuService.check_route_config_unique_services(make_query_db(), page_object)

    assert result == CommonConstant.NOT_UNIQUE


@pytest.mark.asyncio
async def test_check_route_config_unique_allows_same_path_under_different_parent_with_distinct_route_name() -> None:
    """不同上级下的同路径可使用不同路由名。"""
    page_object = MenuModel(menu_id=2, parent_id=2, path='system/user', route_name='SecondSystemUser')
    existing_menu = _menu(menu_id=1, parent_id=1, path='system/user', route_name='FirstSystemUser')
    with patch.object(
        MenuDao,
        'get_menus_by_path_or_route_name',
        new=AsyncMock(return_value=[existing_menu]),
    ):
        result = await MenuService.check_route_config_unique_services(make_query_db(), page_object)

    assert result == CommonConstant.UNIQUE


@pytest.mark.asyncio
async def test_check_route_config_unique_ignores_current_menu() -> None:
    """校验路由唯一性时排除当前菜单。"""
    page_object = MenuModel(menu_id=1, parent_id=1, path='system/user', route_name='SystemUser')
    current_menu = _menu(menu_id=1, parent_id=1, path='system/user', route_name='SystemUser')
    with patch.object(
        MenuDao,
        'get_menus_by_path_or_route_name',
        new=AsyncMock(return_value=[current_menu]),
    ):
        result = await MenuService.check_route_config_unique_services(make_query_db(), page_object)

    assert result == CommonConstant.UNIQUE


@pytest.mark.asyncio
async def test_add_menu_rejects_duplicate_route_config() -> None:
    """新增菜单拒绝重复路由配置。"""
    page_object = MenuModel(menu_name='用户管理', parent_id=1, path='system/user', route_name='SystemUser', is_frame=1)
    with (
        patch.object(MenuService, 'check_menu_name_unique_services', new=AsyncMock(return_value=True)),
        patch.object(MenuService, 'check_route_config_unique_services', new=AsyncMock(return_value=False)),
        patch.object(MenuDao, 'add_menu_dao', new_callable=AsyncMock) as add_menu,
        pytest.raises(ServiceException) as exc_info,
    ):
        await MenuService.add_menu_services(make_query_db(), page_object)

    assert exc_info.value.message == '新增菜单用户管理失败，路由名称或地址已存在'
    add_menu.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_menus_by_path_or_route_name_is_case_insensitive_and_excludes_buttons() -> None:
    """按路径或路由名查询时忽略大小写并排除按钮。"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all, tables=[SysMenu.get_table()])

    try:
        async with session_maker() as session:
            session.add_all(
                [
                    SysMenu(
                        menu_id=1,
                        menu_name='路径匹配',
                        parent_id=1,
                        path='SYSTEM/USER',
                        route_name='ExistingUser',
                        menu_type='M',
                    ),
                    SysMenu(
                        menu_id=2,
                        menu_name='名称匹配',
                        parent_id=2,
                        path='different/path',
                        route_name='SYSTEMUSER',
                        menu_type='C',
                    ),
                    SysMenu(
                        menu_id=3,
                        menu_name='按钮',
                        parent_id=2,
                        path='system/user',
                        route_name='SystemUser',
                        menu_type='F',
                    ),
                ]
            )
            await session.flush()

            result = await MenuDao.get_menus_by_path_or_route_name(session, 'system/user', 'systemuser')

        assert {menu.menu_id for menu in result} == {1, 2}
    finally:
        await engine.dispose()


def test_parse_menu_sort_items_preserves_corresponding_order_values() -> None:
    """解析菜单排序时保留各菜单对应的顺序值。"""
    result = MenuService.parse_menu_sort_items(MenuSortModel(menu_ids='101, 102', order_nums='3, 1'))

    assert result == [
        {'menu_id': 101, 'order_num': 3},
        {'menu_id': 102, 'order_num': 1},
    ]


@pytest.mark.parametrize(
    ('menu_ids', 'order_nums'),
    [
        ('101,102', '1'),
        ('101,101', '1,2'),
        ('101,invalid', '1,2'),
        ('101,102', '1,-1'),
        ('', ''),
    ],
)
def test_parse_menu_sort_items_rejects_invalid_parameters(menu_ids: str, order_nums: str) -> None:
    """菜单排序拒绝无效参数。"""
    with pytest.raises(ServiceException) as exc_info:
        MenuService.parse_menu_sort_items(MenuSortModel(menu_ids=menu_ids, order_nums=order_nums))

    assert exc_info.value.message == '菜单排序参数不正确'


@pytest.mark.asyncio
async def test_update_menu_sort_updates_all_rows_in_one_transaction() -> None:
    """在同一事务中更新全部菜单排序。"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all, tables=[SysMenu.get_table()])

    try:
        async with session_maker() as session:
            session.add_all(
                [
                    SysMenu(menu_id=101, menu_name='用户管理', order_num=1),
                    SysMenu(menu_id=102, menu_name='角色管理', order_num=2),
                ]
            )
            await session.commit()

            result = await MenuService.update_menu_sort_services(
                session,
                MenuSortModel(menu_ids='101,102', order_nums='5,4'),
            )
            rows = (await session.execute(select(SysMenu.menu_id, SysMenu.order_num).order_by(SysMenu.menu_id))).all()

        assert result.is_success is True
        assert rows == [(101, 5), (102, 4)]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_update_menu_sort_rolls_back_and_wraps_database_error() -> None:
    """菜单排序遇到数据库错误时回滚并转换异常。"""
    query_db = make_query_db()

    with (
        patch.object(MenuDao, 'update_menu_sort_dao', AsyncMock(side_effect=RuntimeError('database error'))),
        pytest.raises(ServiceException) as exc_info,
    ):
        await MenuService.update_menu_sort_services(
            query_db,
            MenuSortModel(menu_ids='101', order_nums='2'),
        )

    assert exc_info.value.message == '保存排序异常，请联系管理员'
    query_db.commit.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


async def _create_menu_tree() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """
    在独立数据库中准备菜单树数据。

    :return: 依次为 ``engine``、``sessions`` 的元组
    """
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    sessions = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all, tables=[SysMenu.get_table()])
    async with sessions() as session:
        session.add_all(
            [
                SysMenu(menu_id=501, parent_id=0, menu_name='系统目录', menu_type='M', path='system'),
                SysMenu(menu_id=502, parent_id=501, menu_name='用户菜单', menu_type='C', path='user'),
                SysMenu(menu_id=503, parent_id=502, menu_name='新增按钮', menu_type='F'),
                SysMenu(menu_id=600, parent_id=0, menu_name='工具目录', menu_type='M', path='tools'),
                SysMenu(menu_id=701, parent_id=702, menu_name='异常目录一', menu_type='M'),
                SysMenu(menu_id=702, parent_id=701, menu_name='异常目录二', menu_type='M'),
                SysMenu(menu_id=800, parent_id=999, menu_name='孤立目录', menu_type='M'),
            ]
        )
        await session.commit()
    return engine, sessions


@pytest.mark.asyncio
@pytest.mark.parametrize('parent_id', [501, 502, 503, 701, 800, 999])
async def test_edit_menu_rejects_invalid_parent_chains_without_writing(parent_id: int) -> None:
    """编辑菜单时拒绝无效上级链且不写库。"""
    engine, sessions = await _create_menu_tree()
    try:
        async with sessions() as session:
            query = select(SysMenu.menu_id, SysMenu.parent_id).order_by(SysMenu.menu_id)
            before = (await session.execute(query)).all()
            with pytest.raises(ServiceException):
                await MenuService.edit_menu_services(
                    session,
                    MenuModel(menu_id=501, parent_id=parent_id, menu_name='系统目录', menu_type='M', path='system'),
                )
            assert (await session.execute(query)).all() == before
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('parent_id', [None, 0, 600])
async def test_edit_menu_preserves_root_or_moves_subtree_to_valid_parent(parent_id: int | None) -> None:
    """编辑菜单时可保留根节点或移动子树至有效上级。"""
    engine, sessions = await _create_menu_tree()
    try:
        async with sessions() as session:
            result = await MenuService.edit_menu_services(
                session,
                MenuModel(menu_id=501, parent_id=parent_id, menu_name='新系统目录', menu_type='M', path='system'),
            )
            rows = (
                await session.execute(
                    select(SysMenu.menu_id, SysMenu.parent_id)
                    .where(SysMenu.menu_id.in_([501, 502, 503]))
                    .order_by(SysMenu.menu_id)
                )
            ).all()
            assert result.is_success
            assert rows == [(501, parent_id or 0), (502, 501), (503, 502)]
    finally:
        await engine.dispose()
