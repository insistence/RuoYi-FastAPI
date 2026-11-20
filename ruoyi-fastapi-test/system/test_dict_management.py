from uuid import uuid4

import pytest
from playwright.async_api import expect

from common.browser_harness import BrowserHarness
from common.config import Config
from system.page import SystemPage

pytestmark = pytest.mark.e2e


async def verify_dictionary_data(view: SystemPage, resource: str, kind: str) -> None:
    """创建两条数据，修改英文译文，并逐条核对原文、业务值及回显样式。"""
    label_field, value_field = ('标签', '键值') if Config.frontend_framework == 'vue2' else ('数据标签', '数据键值')
    entries = []
    for label, english_label, value, style, style_value in [
        ('正常', 'Normal', '1', '主要(primary)', 'primary'),
        ('异常', 'Abnormal', '2', '危险(danger)', 'danger'),
    ]:
        dialog = await view.add()
        for field, content in {label_field: label, value_field: value, '显示排序': value}.items():
            await view.fill(dialog, field, content)
        await view.translation_input(dialog, label_field).fill(english_label)
        await view.choose(dialog, '回显样式', style.split('(')[0] if view.is_react else style)
        saved = await view.save(resource, 'POST')
        entry = view.record(saved, 'dictLabel', label)
        entries.append(entry)
        await expect(view.row(label)).to_have_count(1)
        await view.persisted(
            resource,
            entry['dictCode'],
            {
                'dictLabel': label,
                'dictLabelI18n': {'en-US': english_label},
                'dictValue': value,
                'dictSort': int(value),
                'listClass': style_value,
                'dictType': kind,
            },
        )
    dialog = await view.edit('异常', resource, entries[1]['dictCode'])
    await expect(view.input(dialog, label_field)).to_have_value('异常')
    await expect(view.translation_input(dialog, label_field)).to_have_value('Abnormal')
    await view.translation_input(dialog, label_field).fill('Exception')
    await view.fill(dialog, '备注', '字典数据修改备注')
    await view.save(resource, 'PUT')
    await view.persisted(
        resource,
        entries[1]['dictCode'],
        {'dictLabel': '异常', 'dictLabelI18n': {'en-US': 'Exception'}, 'remark': '字典数据修改备注'},
    )
    for entry in reversed(entries):
        await view.delete(entry['dictLabel'], resource, entry['dictCode'])


@pytest.mark.asyncio
async def test_dict_management_page(browser_harness: BrowserHarness) -> None:
    """字典类型和数据的真实 CRUD，核对原文、英文译文与回显样式的持久化。"""
    view = SystemPage()
    await view.setup(browser_harness)
    resource, data_resource = '/system/dict/type', '/system/dict/data'
    suffix = uuid4().hex[:8]
    name, kind = f'测试字典_{suffix}', f'e2e_dict_{suffix}'
    english_name = f'Test dictionary {suffix}'
    updated_english_name = f'Updated dictionary {suffix}'
    await view.open('/system/dict', f'{resource}/list')
    try:
        dialog = await view.add()
        await view.fill(dialog, '字典名称', name)
        await view.translation_input(dialog, '字典名称').fill(english_name)
        await view.fill(dialog, '字典类型', kind)
        await view.save(resource, 'POST')
        found = await view.search({'字典名称': name, '字典类型': kind})
        assert found['total'] == 1
        record = view.record(found, 'dictType', kind)
        await view.persisted(resource, record['dictId'], {'dictName': name, 'dictNameI18n': {'en-US': english_name}})
        dialog = await view.edit(name, resource, record['dictId'])
        await expect(view.input(dialog, '字典名称')).to_have_value(name)
        await expect(view.translation_input(dialog, '字典名称')).to_have_value(english_name)
        await view.translation_input(dialog, '字典名称').fill(updated_english_name)
        await view.fill(dialog, '备注', '字典类型修改备注')
        await view.save(resource, 'PUT')
        await view.persisted(
            resource,
            record['dictId'],
            {'dictName': name, 'dictNameI18n': {'en-US': updated_english_name}, 'remark': '字典类型修改备注'},
        )
        await view.action(view.button(view.row(name), '列表').click, f'{data_resource}/list')
        view.list_path = f'{data_resource}/list'
        await view.rendered()
        await verify_dictionary_data(view, data_resource, kind)
        await view.button(view.page, '关闭').click()
        view.list_path = f'{resource}/list'
        await view.rendered()
        await view.search({'字典名称': name})
        deleted = await view.delete(name, resource, record['dictId'])
        assert deleted['total'] == 0
        await view.reset()
        await view.action(view.button(view.page, '刷新缓存').click, f'{resource}/refreshCache', 'DELETE')
    finally:
        await view.cleanup(data_resource, 'dictType', [kind], 'dictCode')
        await view.cleanup(resource, 'dictType', [kind], 'dictId')
