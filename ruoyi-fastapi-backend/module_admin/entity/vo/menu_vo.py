from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from pydantic_validation_decorator import NotBlank, Size

from common.mixin import DateRangeQueryMixin
from common.types import ApiUtcDateTime
from i18n.message import I18nMessage
from i18n.translation import TranslationUtil


class MenuBaseModel(BaseModel):
    """
    菜单表对应pydantic模型
    """

    model_config = ConfigDict(alias_generator=to_camel, from_attributes=True)

    menu_id: int | None = Field(default=None, description='菜单ID')
    menu_name: str | None = Field(default=None, description='菜单名称')
    parent_id: int | None = Field(default=None, description='父菜单ID')
    order_num: int | None = Field(default=None, description='显示顺序')
    path: str | None = Field(default=None, description='路由地址')
    component: str | None = Field(default=None, description='组件路径')
    query: str | None = Field(default=None, description='路由参数')
    route_name: str | None = Field(default=None, description='路由名称')
    is_frame: Literal[0, 1] | None = Field(default=None, description='是否为外链（0是 1否）')
    is_cache: Literal[0, 1] | None = Field(default=None, description='是否缓存（0缓存 1不缓存）')
    menu_type: Literal['M', 'C', 'F'] | None = Field(default=None, description='菜单类型（M目录 C菜单 F按钮）')
    visible: Literal['0', '1'] | None = Field(default=None, description='菜单状态（0显示 1隐藏）')
    status: Literal['0', '1'] | None = Field(default=None, description='菜单状态（0正常 1停用）')
    perms: str | None = Field(default=None, description='权限标识')
    icon: str | None = Field(default=None, description='菜单图标')
    create_by: str | None = Field(default=None, description='创建者')
    create_time: ApiUtcDateTime | None = Field(default=None, description='创建时间')
    update_by: str | None = Field(default=None, description='更新者')
    update_time: ApiUtcDateTime | None = Field(default=None, description='更新时间')
    remark: str | None = Field(default=None, description='备注')

    @NotBlank(field_name='menu_name', message=I18nMessage('菜单名称不能为空', msg_key='validation.menuNameRequired'))
    @Size(
        field_name='menu_name',
        min_length=0,
        max_length=50,
        message=I18nMessage('菜单名称长度不能超过50个字符', msg_key='validation.menuNameLength'),
    )
    def get_menu_name(self) -> str | None:
        return self.menu_name

    @NotBlank(field_name='order_num', message=I18nMessage('显示顺序不能为空', msg_key='validation.orderRequired'))
    def get_order_num(self) -> int | None:
        return self.order_num

    @Size(
        field_name='path',
        min_length=0,
        max_length=200,
        message=I18nMessage('路由地址长度不能超过200个字符', msg_key='validation.routePathLength'),
    )
    def get_path(self) -> str | None:
        return self.path

    @Size(
        field_name='component',
        min_length=0,
        max_length=255,
        message=I18nMessage('组件路径长度不能超过255个字符', msg_key='validation.componentPathLength'),
    )
    def get_component(self) -> str | None:
        return self.component

    @NotBlank(field_name='menu_type', message=I18nMessage('菜单类型不能为空', msg_key='validation.menuTypeRequired'))
    def get_menu_type(self) -> Literal['M', 'C', 'F'] | None:
        return self.menu_type

    @Size(
        field_name='perms',
        min_length=0,
        max_length=100,
        message=I18nMessage('权限标识长度不能超过100个字符', msg_key='validation.permissionLength'),
    )
    def get_perms(self) -> str | None:
        return self.perms

    def validate_fields(self) -> None:
        self.get_menu_name()
        self.get_order_num()
        self.get_path()
        self.get_component()
        self.get_menu_type()
        self.get_perms()


class MenuModel(MenuBaseModel):
    """
    包含多语言译文的菜单模型
    """

    menu_name_i18n: dict[str, str | None] = Field(default_factory=dict, alias='menuNameI18n', description='多语言译文')

    @field_validator('menu_name_i18n', mode='before')
    @classmethod
    def validate_menu_name_i18n(cls, value: object) -> dict[str, str | None]:
        """
        校验多语言译文
        """
        return TranslationUtil.validate(value, 50)


class MenuQueryModel(DateRangeQueryMixin, MenuBaseModel):
    """
    菜单管理不分页查询模型
    """

    begin_time: str | None = Field(default=None, description='开始时间')
    end_time: str | None = Field(default=None, description='结束时间')


class MenuTreeModel(BaseModel):
    """
    菜单树模型
    """

    model_config = ConfigDict(alias_generator=to_camel)

    id: int = Field(description='菜单id')
    label: str = Field(description='菜单名称')
    label_i18n: dict[str, str] = Field(default_factory=dict, alias='labelI18n', description='菜单名称译文')
    parent_id: int = Field(description='父菜单id')
    children: list['MenuTreeModel'] | None = Field(default=None, description='子菜单树')


class DeleteMenuModel(BaseModel):
    """
    删除菜单模型
    """

    model_config = ConfigDict(alias_generator=to_camel)

    menu_ids: str = Field(description='需要删除的菜单ID')


class MenuSortModel(BaseModel):
    """
    菜单排序批量保存模型
    """

    model_config = ConfigDict(alias_generator=to_camel)

    menu_ids: str = Field(description='需要更新排序的菜单ID')
    order_nums: str = Field(description='菜单显示顺序')
