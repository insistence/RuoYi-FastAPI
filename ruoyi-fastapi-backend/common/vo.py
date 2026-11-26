from functools import cache
from typing import Any, Generic, Self, TypeVar

from pydantic import BaseModel, ConfigDict, Field, create_model, model_validator
from pydantic.alias_generators import to_camel

from common.constant import HttpStatusConstant
from common.types import ApiUtcDateTime
from i18n.message import I18nMessage
from utils.time_util import TimezoneUtil

T = TypeVar('T')


class CamelModel(BaseModel):
    """支持蛇形字段名和驼峰别名输入的 API 模型。"""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, validate_by_alias=True)


class CrudResponseModel(BaseModel):
    """操作响应模型。"""

    is_success: bool = Field(description='操作是否成功')
    message: str = Field(description='响应信息')
    result: Any | None = Field(default=None, description='响应结果')
    msg_key: str | None = Field(default=None, description='国际化消息标识')
    msg_params: dict[str, object] | None = Field(default=None, description='国际化消息插值参数')
    domain: str = Field(default='core', description='已注册的国际化词库域')
    count: int | None = Field(default=None, description='复数消息数量')
    plural_key: str | None = Field(default=None, description='复数消息标识')

    @model_validator(mode='after')
    def preserve_message_metadata(self) -> Self:
        """
        通过现有消息字段保留词库域和复数消息元数据。

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


class ResponseBaseModel(CamelModel):
    """响应模型。"""

    code: int = Field(default=HttpStatusConstant.SUCCESS, description='响应码')
    msg: str = Field(default='操作成功', description='响应信息')
    msg_key: str | None = Field(default=None, description='国际化消息标识')
    msg_params: dict[str, object] | None = Field(default=None, description='国际化消息插值参数')
    msg_domain: str | None = Field(default=None, description='国际化插件词库域')
    msg_count: int | None = Field(default=None, description='复数消息数量')
    msg_plural_key: str | None = Field(default=None, description='复数消息标识')
    success: bool = Field(default=True, description='响应是否成功')
    time: ApiUtcDateTime = Field(default_factory=TimezoneUtil.utc_now, description='响应时间')


class DynamicResponseModel(ResponseBaseModel, Generic[T]):
    """动态响应模型。"""

    @classmethod
    @cache
    def __class_getitem__(cls, typevar_values: object) -> type[BaseModel]:
        """
        将业务模型的字段合并到响应模型，并复用同一模型生成的结果。

        :param typevar_values: 提供业务字段的 Pydantic 模型类
        :return: 继承响应字段和序列化配置的模型类
        :raises TypeError: 泛型参数不是 Pydantic 模型类
        """
        if not isinstance(typevar_values, type) or not issubclass(typevar_values, BaseModel):
            raise TypeError(f'{typevar_values} 不是一个Pydantic模型，请使用Pydantic模型作为泛型参数')
        fields: dict[str, Any] = {
            name: (field.annotation, field) for name, field in typevar_values.model_fields.items()
        }
        return create_model(
            f'DynamicResponseModel[{typevar_values.__name__}]',
            __base__=cls,
            __module__=__name__,
            **fields,
        )


class PageModel(CamelModel, Generic[T]):
    """分页模型。"""

    rows: list[T] = Field(description='记录列表')
    page_num: int = Field(description='当前页码')
    page_size: int = Field(description='每页记录数')
    total: int = Field(description='总记录数')
    has_next: bool = Field(description='是否有下一页')


class PageResponseModel(PageModel[T], ResponseBaseModel, Generic[T]):
    """分页响应模型。"""


class DataResponseModel(ResponseBaseModel, Generic[T]):
    """数据响应模型。"""

    data: T = Field(description='响应数据')
