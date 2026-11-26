from typing import Any, Protocol, TypeAlias

from pydantic import JsonValue as PydanticJsonValue

JSONScalar: TypeAlias = str | int | float | bool | None
JSONValue: TypeAlias = PydanticJsonValue
JSONObject: TypeAlias = dict[str, JSONValue]
Payload: TypeAlias = dict[str, JSONValue]
PluginConfigValue: TypeAlias = JSONValue


class SupportsModelDump(Protocol):
    """支持 Pydantic 风格序列化的对象协议。"""

    def model_dump(self, *, by_alias: bool = False) -> dict[str, Any]:
        """
        序列化模型。

        :param by_alias: 是否使用字段别名
        :return: 序列化后的字典
        """
        ...


class SupportsToPayload(Protocol):
    """支持运行时 payload 序列化的对象协议。"""

    def to_payload(self) -> dict[str, object]:
        """
        序列化为 payload 字典。

        :return: payload 字典
        """
        ...


class PluginStateRecord(Protocol):
    """运行时查询使用的插件持久化状态。"""

    @property
    def plugin_id(self) -> str:
        """
        获取插件标识。

        :return: 插件标识
        """
        ...

    @property
    def installed_version(self) -> str | None:
        """
        获取已安装版本。

        :return: 已安装版本
        """
        ...

    @property
    def enabled(self) -> str | None:
        """
        获取启停状态。

        :return: 启停状态
        """
        ...

    @property
    def status(self) -> str | None:
        """
        获取生命周期状态。

        :return: 生命周期状态
        """
        ...

    @property
    def last_error(self) -> str | None:
        """
        获取最近一次错误信息。

        :return: 最近一次错误信息
        """
        ...

    @property
    def source(self) -> str | None:
        """
        获取插件来源。

        :return: 插件来源
        """
        ...

    @property
    def backend_path(self) -> str | None:
        """
        获取后端插件相对路径。

        :return: 后端插件相对路径
        """
        ...

    @property
    def frontend_path(self) -> str | None:
        """
        获取前端插件相对路径。

        :return: 前端插件相对路径
        """
        ...
