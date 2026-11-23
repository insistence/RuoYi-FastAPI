from typing import TypeAlias

from pydantic import Field

from i18n.message import I18nMessage

from .base import PluginPayloadModel


class PluginNotFoundPayload(PluginPayloadModel):
    """插件不存在 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    operation: str | None = Field(default=None, description='执行的操作类型')
    dry_run: bool | None = Field(default=None, alias='dryRun', description='是否仅预演本次操作')
    enabled: bool | None = Field(default=None, description='是否启用')


PluginNotFoundPayloadDict: TypeAlias = dict[str, object]


class PluginCommonPayloadMixin:
    """插件运行时通用 payload 构建能力。"""

    @staticmethod
    def build_plugin_not_found_payload(
        plugin_id: str,
        *,
        operation: str | None = None,
        dry_run: bool | None = None,
        enabled: bool | None = None,
    ) -> PluginNotFoundPayloadDict:
        """
        构建插件不存在负载。

        :param plugin_id: 插件ID
        :param operation: 操作类型
        :param dry_run: 是否预演
        :param enabled: 是否启用
        :return: 插件不存在负载
        """
        return PluginNotFoundPayload(
            ok=False,
            message=I18nMessage(
                f'插件不存在：{plugin_id}',
                msg_key='plugin.runtime.notFoundNamed',
                msg_params={'plugin_id': str(plugin_id)},
            ),
            plugin_id=plugin_id,
            operation=operation,
            dry_run=dry_run,
            enabled=enabled,
        ).to_payload(exclude_none=True)


__all__ = [
    'PluginCommonPayloadMixin',
    'PluginNotFoundPayload',
    'PluginNotFoundPayloadDict',
]
