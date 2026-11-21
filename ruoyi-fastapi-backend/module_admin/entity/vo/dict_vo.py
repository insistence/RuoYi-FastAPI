from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from pydantic_validation_decorator import NotBlank, Pattern, Size

from common.mixin import DateRangeQueryMixin
from common.types import ApiUtcDateTime
from i18n.message import I18nMessage
from i18n.translation import TranslationUtil


class DictTypeBaseModel(BaseModel):
    """
    字典类型表对应pydantic模型
    """

    model_config = ConfigDict(alias_generator=to_camel, from_attributes=True)

    dict_id: int | None = Field(default=None, description='字典主键')
    dict_name: str | None = Field(default=None, description='字典名称')
    dict_type: str | None = Field(default=None, description='字典类型')
    status: Literal['0', '1'] | None = Field(default=None, description='状态（0正常 1停用）')
    create_by: str | None = Field(default=None, description='创建者')
    create_time: ApiUtcDateTime | None = Field(default=None, description='创建时间')
    update_by: str | None = Field(default=None, description='更新者')
    update_time: ApiUtcDateTime | None = Field(default=None, description='更新时间')
    remark: str | None = Field(default=None, description='备注')

    @NotBlank(field_name='dict_name', message=I18nMessage('字典名称不能为空', msg_key='validation.dictNameRequired'))
    @Size(
        field_name='dict_name',
        min_length=0,
        max_length=100,
        message=I18nMessage('字典类型名称长度不能超过100个字符', msg_key='validation.dictNameLength'),
    )
    def get_dict_name(self) -> str | None:
        return self.dict_name

    @NotBlank(field_name='dict_type', message=I18nMessage('字典类型不能为空', msg_key='validation.dictTypeRequired'))
    @Size(
        field_name='dict_type',
        min_length=0,
        max_length=100,
        message=I18nMessage('字典类型类型长度不能超过100个字符', msg_key='validation.dictTypeNameLength'),
    )
    @Pattern(
        field_name='dict_type',
        regexp='^[a-z][a-z0-9_]*$',
        message=I18nMessage(
            '字典类型必须以字母开头，且只能为（小写字母，数字，下滑线）', msg_key='validation.dictTypeFormat'
        ),
    )
    def get_dict_type(self) -> str | None:
        return self.dict_type

    def validate_fields(self) -> None:
        self.get_dict_name()
        self.get_dict_type()


class DictTypeModel(DictTypeBaseModel):
    """
    包含多语言译文的字典类型模型
    """

    dict_name_i18n: dict[str, str | None] = Field(default_factory=dict, alias='dictNameI18n', description='多语言译文')

    @field_validator('dict_name_i18n', mode='before')
    @classmethod
    def validate_dict_name_i18n(cls, value: object) -> dict[str, str | None]:
        """
        校验多语言译文
        """
        return TranslationUtil.validate(value, 100)


class DictDataBaseModel(BaseModel):
    """
    字典数据表对应pydantic模型
    """

    model_config = ConfigDict(alias_generator=to_camel, from_attributes=True)

    dict_code: int | None = Field(default=None, description='字典编码')
    dict_sort: int | None = Field(default=None, description='字典排序')
    dict_label: str | None = Field(default=None, description='字典标签')
    dict_value: str | None = Field(default=None, description='字典键值')
    dict_type: str | None = Field(default=None, description='字典类型')
    css_class: str | None = Field(default=None, description='样式属性（其他样式扩展）')
    list_class: str | None = Field(default=None, description='表格回显样式')
    is_default: Literal['Y', 'N'] | None = Field(default=None, description='是否默认（Y是 N否）')
    status: Literal['0', '1'] | None = Field(default=None, description='状态（0正常 1停用）')
    create_by: str | None = Field(default=None, description='创建者')
    create_time: ApiUtcDateTime | None = Field(default=None, description='创建时间')
    update_by: str | None = Field(default=None, description='更新者')
    update_time: ApiUtcDateTime | None = Field(default=None, description='更新时间')
    remark: str | None = Field(default=None, description='备注')

    @NotBlank(field_name='dict_label', message=I18nMessage('字典标签不能为空', msg_key='validation.dictLabelRequired'))
    @Size(
        field_name='dict_label',
        min_length=0,
        max_length=100,
        message=I18nMessage('字典标签长度不能超过100个字符', msg_key='validation.dictLabelLength'),
    )
    def get_dict_label(self) -> str | None:
        return self.dict_label

    @NotBlank(field_name='dict_value', message=I18nMessage('字典键值不能为空', msg_key='validation.dictValueRequired'))
    @Size(
        field_name='dict_value',
        min_length=0,
        max_length=100,
        message=I18nMessage('字典键值长度不能超过100个字符', msg_key='validation.dictValueLength'),
    )
    def get_dict_value(self) -> str | None:
        return self.dict_value

    @NotBlank(field_name='dict_type', message=I18nMessage('字典类型不能为空', msg_key='validation.dictTypeRequired'))
    @Size(
        field_name='dict_type',
        min_length=0,
        max_length=100,
        message=I18nMessage('字典类型长度不能超过100个字符', msg_key='validation.dictTypeLength'),
    )
    def get_dict_type(self) -> str | None:
        return self.dict_type

    @Size(
        field_name='css_class',
        min_length=0,
        max_length=100,
        message=I18nMessage('样式属性长度不能超过100个字符', msg_key='validation.cssClassLength'),
    )
    def get_css_class(self) -> str | None:
        return self.css_class

    def validate_fields(self) -> None:
        self.get_dict_label()
        self.get_dict_value()
        self.get_dict_type()
        self.get_css_class()


class DictDataModel(DictDataBaseModel):
    """
    包含多语言译文的字典数据模型
    """

    dict_label_i18n: dict[str, str | None] = Field(
        default_factory=dict, alias='dictLabelI18n', description='多语言译文'
    )

    @field_validator('dict_label_i18n', mode='before')
    @classmethod
    def validate_dict_label_i18n(cls, value: object) -> dict[str, str | None]:
        """
        校验多语言译文
        """
        return TranslationUtil.validate(value, 100)


class DictTypeQueryModel(DateRangeQueryMixin, DictTypeBaseModel):
    """
    字典类型管理不分页查询模型
    """

    begin_time: str | None = Field(default=None, description='开始时间')
    end_time: str | None = Field(default=None, description='结束时间')


class DictTypePageQueryModel(DictTypeQueryModel):
    """
    字典类型管理分页查询模型
    """

    page_num: int = Field(default=1, description='当前页码')
    page_size: int = Field(default=10, description='每页记录数')


class DeleteDictTypeModel(BaseModel):
    """
    删除字典类型模型
    """

    model_config = ConfigDict(alias_generator=to_camel)

    dict_ids: str = Field(description='需要删除的字典主键')


class DictDataQueryModel(DateRangeQueryMixin, DictDataBaseModel):
    """
    字典数据管理不分页查询模型
    """

    begin_time: str | None = Field(default=None, description='开始时间')
    end_time: str | None = Field(default=None, description='结束时间')


class DictDataPageQueryModel(DictDataQueryModel):
    """
    字典数据管理分页查询模型
    """

    page_num: int = Field(default=1, description='当前页码')
    page_size: int = Field(default=10, description='每页记录数')


class DeleteDictDataModel(BaseModel):
    """
    删除字典数据模型
    """

    model_config = ConfigDict(alias_generator=to_camel)

    dict_codes: str = Field(description='需要删除的字典编码')
