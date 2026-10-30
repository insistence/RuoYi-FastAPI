from typing import Any

from pydantic import BaseModel, ConfigDict, ValidatorFunctionWrapHandler, field_validator

from i18n.message import I18nMessage


class PluginPayloadModel(BaseModel):
    """
    插件运行时 payload 模型基类。
    """

    model_config = ConfigDict(populate_by_name=True, extra='forbid')

    @field_validator('message', mode='wrap', check_fields=False)
    @classmethod
    def preserve_message_metadata(cls, value: Any, handler: ValidatorFunctionWrapHandler) -> Any:
        """
        校验消息文本并保留响应序列化所需的语义信息。

        :param value: 原始消息文本
        :param handler: 字段校验处理器
        :return: 校验后的消息
        """
        validated = handler(value)
        return value if isinstance(value, I18nMessage) else validated

    def to_payload(self, *, exclude_none: bool = False) -> dict[str, Any]:
        """
        序列化为现有运行时 dict payload 契约。

        :param exclude_none: 是否排除 None 字段
        :return: payload 字典
        """
        return self.model_dump(by_alias=True, exclude_none=exclude_none)


__all__ = ['PluginPayloadModel']
