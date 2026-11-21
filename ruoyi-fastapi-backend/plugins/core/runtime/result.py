from collections.abc import Mapping
from dataclasses import dataclass

from typing_extensions import Self

from i18n.message import I18nMessage


@dataclass(frozen=True)
class PluginOperationResult:
    """
    插件操作结果视图。
    """

    payload: Mapping[str, object]
    ok: bool
    message: str

    @classmethod
    def from_payload(
        cls,
        payload: Mapping[str, object],
        *,
        default_message: str = I18nMessage('插件操作完成', msg_key='plugin.runtime.completed'),
    ) -> Self:
        """
        从插件运行时 payload 构建结果视图。

        :param payload: 插件运行时负载
        :param default_message: 默认消息
        :return: 插件操作结果视图
        """
        message = payload.get('message') or default_message
        return cls(
            payload=payload,
            ok=bool(payload.get('ok', False)),
            message=message if isinstance(message, str) else str(message),
        )
