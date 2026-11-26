from collections.abc import Awaitable, Callable
from copy import deepcopy
from unittest.mock import AsyncMock

import pytest
from pydantic import BaseModel, ValidationError
from pydantic_validation_decorator import FieldValidationError
from sqlalchemy import select
from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.engine import Dialect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from common.context import LocaleContext, RequestContext
from config.database import Base
from i18n.message import I18nMessage
from i18n.translation import TranslationUtil
from i18n.translator import I18nUtil
from module_admin.dao.dict_dao import DictDataDao, DictTypeDao
from module_admin.dao.menu_dao import MenuDao
from module_admin.dao.user_dao import UserDao
from module_admin.entity.do.dict_do import SysDictData, SysDictType
from module_admin.entity.do.menu_do import SysMenu
from module_admin.entity.vo.dict_vo import DictDataModel, DictDataPageQueryModel, DictTypeModel, DictTypePageQueryModel
from module_admin.entity.vo.menu_vo import MenuModel, MenuQueryModel
from module_admin.service.login_service import LoginService
from module_admin.service.menu_service import MenuService
from plugins.core.management.dao.dao import PluginDao
from plugins.core.management.service.router_metadata import PluginRouterMetadataService
from tests.module_admin.service.helpers import make_query_db


@pytest.mark.parametrize(
    ('model', 'field', 'limit'),
    [(MenuModel, 'menuNameI18n', 50), (DictTypeModel, 'dictNameI18n', 100), (DictDataModel, 'dictLabelI18n', 100)],
)
def test_translation_patch_accepts_future_locales_and_normalizes_null(
    model: type[BaseModel], field: str, limit: int
) -> None:
    """验证译文补丁允许未来语言，并区分空映射与删除单项。"""
    assert model(**{field: None}).model_dump(by_alias=True)[field] == {}
    assert model(**{field: {'ja_jp': '日本語', 'fr-FR': None}}).model_dump(by_alias=True)[field] == {
        'ja-JP': '日本語',
        'fr-FR': None,
    }
    for value in ({'zh-CN': '重复'}, {'auto': 'Invalid'}, {'en-US': ''}, {'en-US': 'x' * (limit + 1)}, []):
        with pytest.raises(ValidationError):
            model(**{field: value})
    with pytest.raises(ValidationError):
        model(**{field: {'en-US': 'One', 'en_us': 'Two'}})


def test_query_models_do_not_expose_translation_objects_as_query_parameters() -> None:
    """验证菜单和字典列表查询不接受译文映射作为查询参数。"""
    for model, field in [
        (MenuQueryModel, 'menu_name_i18n'),
        (DictTypePageQueryModel, 'dict_name_i18n'),
        (DictDataPageQueryModel, 'dict_label_i18n'),
    ]:
        assert field not in model.model_fields


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('model', 'dao', 'primary_key', 'field', 'attributes'),
    [
        (SysMenu, MenuDao.edit_menu_dao, 'menu_id', 'menu_name_i18n', {'menu_name': '用户管理'}),
        (SysMenu, PluginDao.update_sys_menu, 'menu_id', 'menu_name_i18n', {'menu_name': '插件菜单'}),
        (SysDictType, DictTypeDao.edit_dict_type_dao, 'dict_id', 'dict_name_i18n', {'dict_name': '性别'}),
        (SysDictData, DictDataDao.edit_dict_data_dao, 'dict_code', 'dict_label_i18n', {'dict_label': '未知'}),
    ],
)
async def test_updates_merge_languages_and_preserve_maps_from_old_clients(
    model: type[Base],
    dao: Callable[[AsyncSession, dict], Awaitable[None]],
    primary_key: str,
    field: str,
    attributes: dict[str, str],
) -> None:
    """验证增量补丁只更新提交的语言，部分字段更新时保留已有译文。"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all, tables=[model.get_table()])
        async with sessions() as session:
            session.add(model(**{primary_key: 1, field: {'en-US': 'Original', 'ja-JP': '日本語'}, **attributes}))
            await session.commit()
        for patch in ({primary_key: 1, **attributes}, {primary_key: 1, field: {}}):
            async with sessions() as session:
                await dao(session, patch)
                await session.commit()
                assert await session.scalar(select(getattr(model, field))) == {'en-US': 'Original', 'ja-JP': '日本語'}
        for patch in ({'en-US': 'Updated'}, {'fr-FR': 'Français'}, {'ja-JP': None}):
            async with sessions() as session:
                await dao(session, {primary_key: 1, field: patch})
                await session.commit()
        async with sessions() as session:
            assert await session.scalar(select(getattr(model, field))) == {'en-US': 'Updated', 'fr-FR': 'Français'}
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('dialect', [mysql.dialect(), postgresql.dialect()])
async def test_translation_update_locks_latest_database_value(dialect: Dialect) -> None:
    """验证合并译文前会读取并锁定数据库中的最新记录。"""
    db = make_query_db()
    db.scalar.return_value = {'ja-JP': '日本語'}
    await MenuDao.edit_menu_dao(db, {'menu_id': 1, 'menu_name_i18n': {'en-US': 'Users'}})
    statement = db.scalar.call_args.args[0]
    assert str(statement.compile(dialect=dialect)).endswith(' FOR UPDATE')
    assert db.execute.call_args.args[1][0]['menu_name_i18n'] == {'ja-JP': '日本語', 'en-US': 'Users'}


@pytest.mark.asyncio
@pytest.mark.parametrize('kind', ['directory', 'page', 'root_page', 'inner_link'])
async def test_router_and_permission_tree_keep_raw_titles_and_translation_maps(
    kind: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """验证路由与授权菜单树同时保留原始标题和译文。"""
    menu = SysMenu(
        menu_id=1,
        menu_name='用户管理',
        menu_name_i18n={'en-US': 'Users', 'ja-JP': '利用者'},
        parent_id=0 if kind != 'page' else 10,
        path='https://example.com' if kind == 'inner_link' else 'users',
        component='system/user/index',
        menu_type='M' if kind == 'directory' else 'C',
        is_frame=1,
        is_cache=0,
    )
    menu.order_num = 1
    user_menus = [menu]
    if kind == 'page':
        user_menus.insert(
            0, SysMenu(menu_id=10, menu_name='父目录', menu_type='M', parent_id=0, path='system', order_num=0)
        )
    monkeypatch.setattr(UserDao, 'get_user_by_id', AsyncMock(return_value={'user_menu_info': user_menus}))
    monkeypatch.setattr(PluginRouterMetadataService, 'get_menu_plugin_ids', AsyncMock(return_value={}))
    routes = await LoginService.get_current_user_routers(1, make_query_db())
    route = routes[0]['children'][0] if routes[0].get('children') else routes[0]
    assert route['meta']['title'] == '用户管理'
    assert route['meta']['titleI18n'] == {'en-US': 'Users', 'ja-JP': '利用者'}
    tree = MenuService.list_to_tree([menu])[0].model_dump(by_alias=True)
    assert tree['label'] == '用户管理'
    assert tree['labelI18n'] == {'en-US': 'Users', 'ja-JP': '利用者'}


def test_translation_resolution_uses_request_locale_and_source_fallback() -> None:
    """验证动态名称遵循请求语言和基准语言回退规则。"""
    for context, expected in [(LocaleContext('zh-CN'), '用户管理'), (LocaleContext('en-US'), 'Users')]:
        token = RequestContext.set_current_locale(context)
        try:
            assert TranslationUtil.resolve('用户管理', {'en-US': 'Users'}) == expected
            assert TranslationUtil.resolve('用户管理', {}, locale='en-US') == '用户管理'
        finally:
            RequestContext.reset_current_locale(token)


@pytest.mark.parametrize(
    ('context', 'expected'),
    [(LocaleContext('zh-CN'), '菜单名称不能为空'), (LocaleContext('en-US'), 'Menu name is required')],
)
def test_declarative_validation_translates_at_response_time(context: LocaleContext, expected: str) -> None:
    """验证声明式校验在生成响应时使用当前语言。"""
    with pytest.raises(FieldValidationError) as exc_info:
        MenuModel().get_menu_name()
    message = exc_info.value.message
    assert message == '菜单名称不能为空'
    token = RequestContext.set_current_locale(context)
    try:
        fields = I18nUtil.message_fields(message)
        assert fields['msg'] == expected
        assert fields['msgKey'] == 'validation.menuNameRequired'
    finally:
        RequestContext.reset_current_locale(token)


def test_business_messages_interpolate_public_parameters() -> None:
    """验证业务消息在两种语言中均保留公开插值参数。"""
    original = '新增菜单自定义菜单失败，菜单名称已存在'
    for locale, expected in [
        ('zh-CN', original),
        ('en-US', 'Unable to add menu 自定义菜单: the menu name already exists'),
    ]:
        token = RequestContext.set_current_locale(LocaleContext(locale))
        try:
            fields = I18nUtil.message_fields(
                original, msg_key='menu.addDuplicateName', msg_params={'menu_name': '自定义菜单'}
            )
            assert fields['msg'] == expected
            assert fields['msgParams'] == {'menu_name': '自定义菜单'}
        finally:
            RequestContext.reset_current_locale(token)


def test_message_copy_preserves_deferred_translation_metadata() -> None:
    """验证复制消息时保留响应阶段所需的翻译信息。"""
    message = I18nMessage('已有原文', msg_key='common.success', msg_params={'count': 1})
    cloned = deepcopy(message)
    assert cloned == message
    assert cloned.msg_key == message.msg_key
    assert cloned.msg_params == message.msg_params
    assert cloned.msg_params is not message.msg_params


def test_legacy_plural_state_preserves_string_count() -> None:
    """恢复旧消息时，复数数量与字符串的计数方法都可用。"""
    quantity = 5
    message = I18nMessage('条目，条目', msg_key='item', count=quantity, plural_key='items')
    message.__setstate__({'count': quantity})
    cloned = deepcopy(message)
    assert cloned.plural_count == message.plural_count == quantity
    assert cloned.count('条目') == message.count('条目') == str(message).count('条目')
