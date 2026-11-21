from uuid import uuid4

import pytest
from playwright.async_api import expect

from common.browser_harness import BrowserHarness
from system.page import SystemPage

pytestmark = pytest.mark.e2e


async def add_menu_button(view: SystemPage, parent_name: str, expected: dict) -> dict:
    """在真实父菜单下创建按钮，并校验其原文、译文与权限的保存结果。"""
    resource = '/system/menu'
    await view.button(view.row(parent_name), '新增').click()
    dialog = view.dialog
    await view.radio(dialog, '菜单类型', '按钮')
    await view.fill(dialog, '菜单名称', expected['menuName'])
    translation = await view.open_translation_input(dialog, '菜单名称')
    await translation.fill(expected['menuNameI18n']['en-US'])
    await view.fill(dialog, '显示排序', '1')
    await view.fill(dialog, '权限字符', expected['perms'])
    await view.save(resource, 'POST')
    found = await view.search({'菜单名称': expected['menuName']})
    leaf = view.record(found, 'menuName', expected['menuName'])
    await view.persisted(resource, leaf['menuId'], expected)
    return leaf


@pytest.mark.asyncio
async def test_menu_management_page(browser_harness: BrowserHarness) -> None:
    """三级菜单的真实 CRUD，同时核对原文和英文译文独立保存及回填。"""
    view = SystemPage()
    await view.setup(browser_harness)
    resource = '/system/menu'
    suffix = uuid4().hex[:8]
    directory, menu, button = f'测试目录_{suffix}', f'测试菜单_{suffix}', f'测试按钮_{suffix}'
    directory_english, menu_english, button_english = f'Directory {suffix}', f'Menu {suffix}', f'Button {suffix}'
    updated_menu_english = f'Updated menu {suffix}'
    await view.open('/system/menu', f'{resource}/list')
    try:
        dialog = await view.add()
        await view.radio(dialog, '菜单类型', '目录')
        await view.fill(dialog, '菜单名称', directory)
        translation = await view.open_translation_input(dialog, '菜单名称')
        await translation.fill(directory_english)
        await view.fill(dialog, '显示排序', '10')
        await view.fill(dialog, '路由地址', f'e2e_dir_{suffix}')
        await view.save(resource, 'POST')
        found = await view.search({'菜单名称': directory})
        parent = view.record(found, 'menuName', directory)
        await view.persisted(
            resource,
            parent['menuId'],
            {
                'menuName': directory,
                'menuNameI18n': {'en-US': directory_english},
                'menuType': 'M',
                'path': f'e2e_dir_{suffix}',
            },
        )
        await view.button(view.row(directory), '新增').click()
        dialog = view.dialog
        await view.radio(dialog, '菜单类型', '菜单')
        for label, value in {
            '菜单名称': menu,
            '显示排序': '1',
            '路由地址': f'e2e_menu_{suffix}',
            '组件路径': 'system/post/index',
            '权限字符': f'e2e:{suffix}:list',
        }.items():
            await view.fill(dialog, label, value)
        translation = await view.open_translation_input(dialog, '菜单名称')
        await translation.fill(menu_english)
        await view.save(resource, 'POST')
        found = await view.search({'菜单名称': menu})
        child = view.record(found, 'menuName', menu)
        await view.persisted(
            resource,
            child['menuId'],
            {'menuName': menu, 'menuNameI18n': {'en-US': menu_english}, 'parentId': parent['menuId'], 'menuType': 'C'},
        )
        dialog = await view.edit(menu, resource, child['menuId'])
        await expect(view.input(dialog, '菜单名称')).to_have_value(menu)
        translation = await view.open_translation_input(dialog, '菜单名称')
        await expect(translation).to_have_value(menu_english)
        await translation.fill(updated_menu_english)
        await view.fill(dialog, '路由地址', f'e2e_menu_updated_{suffix}')
        await view.save(resource, 'PUT')
        await view.persisted(
            resource,
            child['menuId'],
            {'menuName': menu, 'menuNameI18n': {'en-US': updated_menu_english}, 'path': f'e2e_menu_updated_{suffix}'},
        )
        leaf = await add_menu_button(
            view,
            menu,
            {
                'menuName': button,
                'menuNameI18n': {'en-US': button_english},
                'parentId': child['menuId'],
                'menuType': 'F',
                'perms': f'e2e:{suffix}:add',
            },
        )
        for name, item in [(button, leaf), (menu, child), (directory, parent)]:
            await view.search({'菜单名称': name})
            await expect(view.row(name)).to_have_count(1)
            deleted = await view.delete(name, resource, item['menuId'])
            assert view.records(deleted) == []
        await view.reset()
        await expect(view.input(view.form, '菜单名称')).to_have_value('')
    finally:
        await view.cleanup(resource, 'menuName', [button, menu, directory], 'menuId')
