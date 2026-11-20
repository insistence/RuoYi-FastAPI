from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, create_model, model_validator
from pydantic.alias_generators import to_camel
from typing_extensions import Self

from common.constant import HttpStatusConstant
from common.types import ApiUtcDateTime
from i18n.message import I18nMessage
from utils.time_util import TimezoneUtil

T = TypeVar('T')


class CrudResponseModel(BaseModel):
    """
    操作响应模型
    """

    is_success: bool = Field(description='操作是否成功')
    message: str = Field(description='响应信息')
    result: Any | None = Field(default=None, description='响应结果')
    msg_key: str | None = Field(default=None, description='国际化消息标识')
    msg_params: dict | None = Field(default=None, description='国际化消息插值参数')
    domain: str = Field(default='core', description='已注册的国际化词库域')
    count: int | None = Field(default=None, description='复数消息数量')
    plural_key: str | None = Field(default=None, description='复数消息标识')

    @model_validator(mode='after')
    def preserve_message_metadata(self) -> Self:
        """
        通过现有消息字段保留词库域和复数消息元数据

        :return: 保留消息元数据的操作响应模型
        """
        if self.msg_key is not None:
            self.message = I18nMessage(
                self.message,
                msg_key=self.msg_key,
                msg_params=self.msg_params,
                domain=self.domain,
                count=self.count,
                plural_key=self.plural_key,
            )
        return self


class ResponseBaseModel(BaseModel):
    """
    响应模型
    """

    code: int = Field(default=HttpStatusConstant.SUCCESS, description='响应码')
    msg: str = Field(default='操作成功', description='响应信息')
    msg_key: str | None = Field(default=None, alias='msgKey', description='国际化消息标识')
    msg_params: dict | None = Field(default=None, alias='msgParams', description='国际化消息插值参数')
    msg_domain: str | None = Field(default=None, alias='msgDomain', description='国际化插件词库域')
    msg_count: int | None = Field(default=None, alias='msgCount', description='复数消息数量')
    msg_plural_key: str | None = Field(default=None, alias='msgPluralKey', description='复数消息标识')
    success: bool = Field(default=True, description='响应是否成功')
    time: ApiUtcDateTime = Field(default_factory=TimezoneUtil.utc_now, description='响应时间')


class DynamicResponseModel(ResponseBaseModel, Generic[T]):
    """
    动态响应模型
    """

    model_config = ConfigDict(alias_generator=to_camel)

    def __class_getitem__(cls, item: Any) -> Any | Self:
        """
        当使用 DynamicResponseModel[Item] 语法时，动态创建一个包含所有字段的新模型
        """
        # 检查是否已经为该类型创建了模型
        if not hasattr(cls, '_cached_models'):
            cls._cached_models = {}

        if item in cls._cached_models:
            return cls._cached_models[item]

        # 检查item是否为Pydantic模型
        if not hasattr(item, 'model_fields'):
            raise TypeError(f'{item} 不是一个Pydantic模型，请使用Pydantic模型作为泛型参数')

        # 获取ResponseBaseModel的字段
        base_fields = {}
        for field_name, field in cls.model_fields.items():
            base_fields[field_name] = (field.annotation, field)

        # 获取泛型类型的字段
        item_fields = {}
        for field_name, field in item.model_fields.items():
            item_fields[field_name] = (field.annotation, field)

        # 合并所有字段
        all_fields = {**base_fields, **item_fields}

        # 动态创建新模型
        new_model = create_model(
            f'DynamicResponseModel[{item.__name__}]', __base__=cls, __config__=cls.model_config, **all_fields
        )

        # 缓存模型
        cls._cached_models[item] = new_model

        return new_model


class PageModel(BaseModel, Generic[T]):
    """
    分页模型
    """

    model_config = ConfigDict(alias_generator=to_camel)

    rows: list[T] = Field(description='记录列表')
    page_num: int = Field(description='当前页码')
    page_size: int = Field(description='每页记录数')
    total: int = Field(description='总记录数')
    has_next: bool = Field(description='是否有下一页')


class PageResponseModel(PageModel, ResponseBaseModel, Generic[T]):
    """
    分页响应模型
    """


class DataResponseModel(ResponseBaseModel, Generic[T]):
    """
    数据响应模型
    """

    data: T = Field(description='响应数据')
