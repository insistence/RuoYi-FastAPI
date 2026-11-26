from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from module_admin.entity.vo.menu_vo import MenuModel
from plugins.core.management.entity.vo.schemas import PluginMenuModel
from plugins.core.management.service import menus as menu_service
from plugins.core.management.service.menus import PluginMenuInstaller
from plugins.core.manifest.menu_key import PluginMenuKeyBuilder
from plugins.core.manifest.schema import PluginManifest, PluginMenuManifest, PluginPermissionManifest

ROOT_MENU_ID = 0
PARENT_MENU_ID = 100
CHILD_MENU_ID = 101
EXISTING_MENU_ID = 200


class FakePluginDao:
    """
    测试用插件 DAO。

    :cvar plugin_menus: 测试中由插件注册的菜单
    :cvar menus: 测试仓储中保存的菜单
    :cvar next_menu_id: 分配给下一条测试菜单的标识
    """

    plugin_menus: dict[tuple[str, str], SimpleNamespace] = {}
    menus: dict[int, SimpleNamespace] = {}
    next_menu_id: int = 100

    @classmethod
    def reset(cls) -> None:
        """重置测试数据。"""
        cls.plugin_menus = {}
        cls.menus = {}
        cls.next_menu_id = 100

    @classmethod
    async def get_plugin_menu_by_key(
        cls,
        db: object,
        plugin_id: str,
        menu_key: str,
    ) -> SimpleNamespace | None:
        """
        根据插件菜单自然键查询关联。

        :param db: 当前操作使用的数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param menu_key: 插件内菜单自然键
        :return: 与插件和菜单键匹配的归属记录
        """
        return cls.plugin_menus.get((plugin_id, menu_key))

    @classmethod
    async def get_plugin_menu_list(cls, db: object, plugin_id: str) -> list[SimpleNamespace]:
        """
        查询插件菜单关联列表。

        :param db: 当前操作使用的数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :return: 插件菜单关联列表
        """
        return [plugin_menu for key, plugin_menu in cls.plugin_menus.items() if key[0] == plugin_id]

    @classmethod
    async def get_plugin_menu_by_menu_id(cls, db: object, menu_id: int) -> SimpleNamespace | None:
        """
        根据菜单 ID 查询插件 ownership。

        :param db: 当前操作使用的数据库会话
        :param menu_id: 菜单ID
        :return: 给定菜单标识对应的插件归属记录
        """
        return next(
            (plugin_menu for plugin_menu in cls.plugin_menus.values() if plugin_menu.menu_id == menu_id),
            None,
        )

    @classmethod
    async def get_sys_menu_by_id(cls, db: object, menu_id: int) -> SimpleNamespace | None:
        """
        根据菜单 ID 查询系统菜单。

        :param db: 当前操作使用的数据库会话
        :param menu_id: 菜单ID
        :return: 对应的系统菜单，未命中时为空值
        """
        return cls.menus.get(menu_id)

    @classmethod
    async def get_sys_menu_by_perms(cls, db: object, perms: str) -> SimpleNamespace | None:
        """
        根据权限标识查询系统菜单。

        :param db: 当前操作使用的数据库会话
        :param perms: 调用主体所拥有的权限集合
        :return: 当前要安装或操作的菜单项
        """
        for menu in cls.menus.values():
            if menu.perms == perms:
                return menu
        return None

    @classmethod
    async def get_sys_menu_by_route(
        cls,
        db: object,
        parent_id: int,
        path: str,
        component: str,
    ) -> SimpleNamespace | None:
        """
        根据路由自然键查询系统菜单。

        :param db: 当前操作使用的数据库会话
        :param parent_id: 父菜单ID
        :param path: 要读取或处理的路径
        :param component: 当前检查或渲染的组件
        :return: 当前要安装或操作的菜单项
        """
        for menu in cls.menus.values():
            if menu.parent_id == parent_id and menu.path == path and menu.component == component:
                return menu
        return None

    @classmethod
    async def get_sys_menu_by_name_path(
        cls,
        db: object,
        parent_id: int,
        menu_name: str,
        path: str,
    ) -> SimpleNamespace | None:
        """
        根据菜单名称和路径查询系统菜单。

        :param db: 当前操作使用的数据库会话
        :param parent_id: 父菜单ID
        :param menu_name: 菜单名称
        :param path: 要读取或处理的路径
        :return: 当前要安装或操作的菜单项
        """
        for menu in cls.menus.values():
            if menu.parent_id == parent_id and menu.menu_name == menu_name and menu.path == path:
                return menu
        return None

    @classmethod
    async def add_sys_menu(cls, db: object, menu: MenuModel) -> SimpleNamespace:
        """
        新增系统菜单。

        :param db: 当前操作使用的数据库会话
        :param menu: 当前要安装或操作的菜单项
        :return: 供调用方使用的 ``sys_menu``
        """
        menu_data = menu.model_dump(exclude_unset=True)
        menu_id = cls.next_menu_id
        cls.next_menu_id += 1
        menu_data['menu_id'] = menu_id
        sys_menu = SimpleNamespace(**menu_data)
        cls.menus[menu_id] = sys_menu

        return sys_menu

    @classmethod
    async def update_sys_menu(cls, db: object, menu: dict) -> None:
        """
        更新系统菜单。

        :param db: 当前操作使用的数据库会话
        :param menu: 当前要安装或操作的菜单项
        """
        sys_menu = cls.menus[menu['menu_id']]
        for key, value in menu.items():
            setattr(sys_menu, key, value)

    @classmethod
    async def update_sys_menu_status_by_ids(cls, db: object, menu_ids: list[int], status: str) -> None:
        """
        批量更新系统菜单状态。

        :param db: 当前操作使用的数据库会话
        :param menu_ids: 菜单ID列表
        :param status: 操作或记录所处的状态
        """
        for menu_id in menu_ids:
            cls.menus[menu_id].status = status

    @classmethod
    async def add_plugin_menu(cls, db: object, plugin_menu: PluginMenuModel) -> SimpleNamespace:
        """
        新增插件菜单关联。

        :param db: 当前操作使用的数据库会话
        :param plugin_menu: 插件菜单关联对象
        :return: 供调用方使用的 ``plugin_menu_model``
        """
        plugin_menu_data = plugin_menu.model_dump(exclude_unset=True)
        plugin_menu_model = SimpleNamespace(**plugin_menu_data)
        cls.plugin_menus[(plugin_menu_model.plugin_id, plugin_menu_model.menu_key)] = plugin_menu_model

        return plugin_menu_model

    @classmethod
    async def update_plugin_menu_by_key(cls, db: object, plugin_menu: PluginMenuModel) -> None:
        """
        根据插件菜单自然键更新插件菜单关联。

        :param db: 当前操作使用的数据库会话
        :param plugin_menu: 插件菜单关联对象
        """
        plugin_menu_data = plugin_menu.model_dump(exclude_unset=True)
        cls.plugin_menus[(plugin_menu_data['plugin_id'], plugin_menu_data['menu_key'])].menu_id = plugin_menu_data[
            'menu_id'
        ]

    @classmethod
    async def update_plugin_menu_key_by_menu_id(cls, db: object, plugin_menu: PluginMenuModel) -> None:
        """
        根据菜单 ID 更新插件菜单自然键。

        :param db: 当前操作使用的数据库会话
        :param plugin_menu: 插件菜单关联对象
        """
        plugin_menu_data = plugin_menu.model_dump(exclude_unset=True)
        old_key = next(
            key
            for key, value in cls.plugin_menus.items()
            if key[0] == plugin_menu_data['plugin_id'] and value.menu_id == plugin_menu_data['menu_id']
        )
        plugin_menu_model = cls.plugin_menus.pop(old_key)
        plugin_menu_model.menu_key = plugin_menu_data['menu_key']
        cls.plugin_menus[(plugin_menu_data['plugin_id'], plugin_menu_data['menu_key'])] = plugin_menu_model

    @classmethod
    async def delete_plugin_menus_by_ids(cls, db: object, plugin_id: str, menu_ids: list[int]) -> None:
        """
        删除指定插件菜单 ownership。

        :param db: 当前操作使用的数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param menu_ids: 菜单ID列表
        """
        cls.plugin_menus = {
            key: plugin_menu
            for key, plugin_menu in cls.plugin_menus.items()
            if key[0] != plugin_id or plugin_menu.menu_id not in menu_ids
        }

    @classmethod
    async def delete_sys_menus_by_ids(cls, db: object, menu_ids: list[int]) -> None:
        """
        删除系统菜单。

        :param db: 当前操作使用的数据库会话
        :param menu_ids: 菜单ID列表
        """
        for menu_id in menu_ids:
            cls.menus.pop(menu_id, None)


def build_manifest() -> PluginManifest:
    """
    构造测试插件清单。

    :return: 测试插件清单
    """
    return PluginManifest.model_validate(
        {
            'id': 'demo',
            'name': '演示插件',
            'version': '1.0.0',
            'backend': {'module': 'plugins.demo'},
            'frontend': {
                'menus': [
                    {
                        'name': '演示目录',
                        'path': 'demo',
                        'component': 'Layout',
                        'type': 'M',
                        'children': [
                            {
                                'name': '演示页面',
                                'path': 'page',
                                'component': 'plugin/demo/page/index',
                                'perms': 'demo:page:list',
                                'type': 'C',
                                'routeName': 'DemoPage',
                                'query': '{"tab":"list"}',
                                'isFrame': 1,
                                'isCache': 1,
                            }
                        ],
                    }
                ]
            },
            'permissions': ['demo:page:list'],
        }
    )


def test_plugin_menu_key_builder_builds_stable_keys() -> None:
    """校验插件菜单自然键生成规则。"""
    page_menu = PluginMenuManifest(name='页面', path='page', component='plugin/demo/page', perms='demo:list')
    route_menu = PluginMenuManifest(name='目录', path='demo', component='Layout', type='M')
    button_menu = PluginMenuManifest(name='新增', path='add', component='', perms='demo:add', type='F')

    assert PluginMenuKeyBuilder.build(page_menu, 'demo') == 'perm:demo:list'
    assert PluginMenuKeyBuilder.build(route_menu, 'demo') == 'route:demo/demo#Layout'
    assert PluginMenuKeyBuilder.build(button_menu, 'perm:demo:list') == 'button:perm:demo:list/新增#demo:add'


@pytest.mark.asyncio
async def test_plugin_menu_installer_inserts_manifest_menu_tree(monkeypatch: pytest.MonkeyPatch) -> None:
    """校验插件菜单安装器可以写入菜单树和关联记录。"""
    FakePluginDao.reset()
    monkeypatch.setattr(menu_service, 'PluginDao', FakePluginDao)

    installed_menus = await PluginMenuInstaller(AsyncSession()).install_manifest_menus(build_manifest())

    assert [menu.menu_key for menu in installed_menus] == ['route:demo/demo#Layout', 'perm:demo:page:list']
    assert FakePluginDao.menus[PARENT_MENU_ID].menu_name == '演示目录'
    assert FakePluginDao.menus[CHILD_MENU_ID].parent_id == PARENT_MENU_ID
    assert FakePluginDao.menus[CHILD_MENU_ID].route_name == 'DemoPage'
    assert FakePluginDao.menus[CHILD_MENU_ID].query == '{"tab":"list"}'
    assert FakePluginDao.menus[CHILD_MENU_ID].is_frame == 1
    assert FakePluginDao.menus[CHILD_MENU_ID].is_cache == 1
    assert FakePluginDao.plugin_menus[('demo', 'perm:demo:page:list')].menu_id == CHILD_MENU_ID


@pytest.mark.asyncio
async def test_plugin_menu_installer_uses_permission_name_for_auto_button(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """校验未显式声明菜单的对象权限会使用权限展示名生成按钮菜单。"""
    FakePluginDao.reset()
    monkeypatch.setattr(menu_service, 'PluginDao', FakePluginDao)
    manifest = build_manifest()
    manifest.permissions.append(
        PluginPermissionManifest.model_validate(
            {
                'code': 'demo:page:export',
                'name': '导出数据',
            }
        )
    )

    installed_menus = await PluginMenuInstaller(AsyncSession()).install_manifest_menus(manifest)
    button_menu = FakePluginDao.menus[CHILD_MENU_ID + 1]

    assert [menu.menu_key for menu in installed_menus] == [
        'route:demo/demo#Layout',
        'perm:demo:page:list',
        'button:perm:demo:page:list/导出数据#demo:page:export',
    ]
    assert button_menu.menu_name == '导出数据'
    assert button_menu.parent_id == CHILD_MENU_ID
    assert button_menu.perms == 'demo:page:export'


@pytest.mark.asyncio
async def test_plugin_menu_installer_reuses_existing_plugin_menu(monkeypatch: pytest.MonkeyPatch) -> None:
    """校验插件菜单安装器会复用已有关联菜单并更新菜单内容。"""
    FakePluginDao.reset()
    FakePluginDao.next_menu_id = CHILD_MENU_ID
    FakePluginDao.menus[EXISTING_MENU_ID] = SimpleNamespace(
        menu_id=EXISTING_MENU_ID,
        menu_name='旧名称',
        parent_id=ROOT_MENU_ID,
        path='demo',
        component='Layout',
        perms=None,
        remark='旧备注',
    )
    FakePluginDao.plugin_menus[('demo', 'route:demo/demo#Layout')] = SimpleNamespace(
        plugin_id='demo',
        menu_id=EXISTING_MENU_ID,
        menu_key='route:demo/demo#Layout',
    )
    monkeypatch.setattr(menu_service, 'PluginDao', FakePluginDao)

    await PluginMenuInstaller(AsyncSession()).install_manifest_menus(build_manifest())

    assert FakePluginDao.menus[EXISTING_MENU_ID].menu_name == '演示目录'
    assert FakePluginDao.menus[EXISTING_MENU_ID].remark == '旧备注 | plugin:demo'


@pytest.mark.asyncio
async def test_plugin_menu_installer_does_not_reuse_unowned_existing_menu(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """校验插件菜单安装器不会复用未与当前插件关联的已有系统菜单。"""
    FakePluginDao.reset()
    FakePluginDao.next_menu_id = CHILD_MENU_ID
    FakePluginDao.menus[EXISTING_MENU_ID] = SimpleNamespace(
        menu_id=EXISTING_MENU_ID,
        menu_name='平台菜单',
        parent_id=ROOT_MENU_ID,
        path='demo',
        component='Layout',
        perms='demo:page:list',
        remark='core menu',
    )
    monkeypatch.setattr(menu_service, 'PluginDao', FakePluginDao)

    await PluginMenuInstaller(AsyncSession()).install_manifest_menus(build_manifest())

    assert FakePluginDao.menus[EXISTING_MENU_ID].menu_name == '平台菜单'
    assert FakePluginDao.menus[EXISTING_MENU_ID].remark == 'core menu'
    assert FakePluginDao.menus[CHILD_MENU_ID].menu_name == '演示目录'
    assert FakePluginDao.plugin_menus[('demo', 'route:demo/demo#Layout')].menu_id == CHILD_MENU_ID


@pytest.mark.asyncio
async def test_plugin_menu_installer_updates_plugin_menu_status(monkeypatch: pytest.MonkeyPatch) -> None:
    """校验插件菜单安装器可以批量更新插件菜单状态。"""
    FakePluginDao.reset()
    FakePluginDao.menus[PARENT_MENU_ID] = SimpleNamespace(menu_id=PARENT_MENU_ID, status='0')
    FakePluginDao.plugin_menus[('demo', 'route:demo/demo#Layout')] = SimpleNamespace(
        plugin_id='demo',
        menu_id=PARENT_MENU_ID,
        menu_key='route:demo/demo#Layout',
    )
    monkeypatch.setattr(menu_service, 'PluginDao', FakePluginDao)

    await PluginMenuInstaller(AsyncSession()).set_plugin_menu_status('demo', '1')

    assert FakePluginDao.menus[PARENT_MENU_ID].status == '1'


@pytest.mark.asyncio
async def test_plugin_menu_installer_removes_menus_deleted_from_manifest(monkeypatch: pytest.MonkeyPatch) -> None:
    """校验升级时从 manifest 删除的菜单不会继续残留。"""
    FakePluginDao.reset()
    monkeypatch.setattr(menu_service, 'PluginDao', FakePluginDao)
    installer = PluginMenuInstaller(AsyncSession())
    await installer.install_manifest_menus(build_manifest())
    empty_manifest = PluginManifest.model_validate(
        {
            'id': 'demo',
            'name': '演示插件',
            'version': '1.1.0',
            'backend': {'module': 'plugins.demo'},
        }
    )

    await installer.install_manifest_menus(empty_manifest)

    assert FakePluginDao.plugin_menus == {}
    assert FakePluginDao.menus == {}


def test_plugin_translation_maps_keep_menu_identity_and_support_future_locales() -> None:
    """验证插件菜单保留原有身份字段，并允许声明未来语言的译名。"""
    menu = PluginMenuManifest(
        name='新增', name_i18n={'en-US': 'Add', 'ja-JP': '追加'}, path='add', component='', perms='demo:add', type='F'
    )
    assert PluginMenuKeyBuilder.build(menu, 'perm:demo:list') == 'button:perm:demo:list/新增#demo:add'
    model = PluginMenuInstaller._build_menu_model('demo', menu, PARENT_MENU_ID)
    assert model.menu_name == '新增'
    assert model.menu_name_i18n == {'en-US': 'Add', 'ja-JP': '追加'}
    permission = PluginPermissionManifest(code='demo:edit', name='修改', name_i18n={'en-US': 'Edit'})
    button = PluginMenuInstaller._build_permission_button_menu(permission, 1)
    assert button.name_i18n == {'en-US': 'Edit'}


def test_manifest_serializes_optional_menu_and_permission_translations() -> None:
    """验证菜单、子菜单和权限均可直接声明译名，未填译名时使用空映射。"""
    payload = {
        'id': 'demo',
        'name': '演示',
        'version': '1.0.0',
        'backend': {'module': 'plugins.demo'},
        'frontend': {
            'menus': [
                {
                    'name': '演示',
                    'nameI18n': {'en-US': 'Demo'},
                    'path': 'demo',
                    'children': [{'name': '列表', 'path': 'list', 'nameI18n': {}}],
                }
            ]
        },
        'permissions': [{'name': '查询', 'code': 'demo:list'}],
    }
    manifest = PluginManifest.model_validate(payload)
    serialized = manifest.model_dump(by_alias=True)
    menu = serialized['frontend']['menus'][0]
    assert menu['nameI18n'] == {'en-US': 'Demo'}
    assert menu['children'][0]['nameI18n'] == {}
    assert serialized['permissions'][0]['nameI18n'] == {}
    assert PluginManifest.model_validate(serialized) == manifest
