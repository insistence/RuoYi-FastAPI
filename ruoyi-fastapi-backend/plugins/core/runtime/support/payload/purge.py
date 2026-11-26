from typing import TypeAlias

from pydantic import Field

from i18n.message import I18nMessage
from plugins.core.lifecycle.purge import PluginPurgePlan

from . import PluginPayloadBuilder
from .base import PluginPayloadModel


class PluginPurgeStatePayload(PluginPayloadModel):
    """插件物理清理状态 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    operation: str = Field(description='执行的操作类型')
    dry_run: bool = Field(alias='dryRun', description='是否仅预演本次操作')
    safe_mode: bool = Field(alias='safeMode', description='是否使用安全操作模式')
    removes_source: bool = Field(alias='removesSource', description='本次操作是否移除插件源码')
    plan: dict[str, object] = Field(description='预定执行的操作计划')
    hooks: list[dict[str, object]] | None = Field(default=None, description='插件生命周期钩子的执行信息')


PluginPurgeStatePayloadDict: TypeAlias = dict[str, object]


class PluginPurgePayloadBuilder:
    """
    插件物理清理负载构建器。

    使用 Builder 模式集中 purge dry-run 和执行成功负载。
    """

    @staticmethod
    def build_dry_run_payload(plugin_id: str, plan: PluginPurgePlan) -> PluginPurgeStatePayloadDict:
        """
        构建插件物理清理预演负载。

        :param plugin_id: 插件ID
        :param plan: 插件物理清理计划
        :return: 插件物理清理预演负载
        """
        return PluginPurgePayloadBuilder._build_state_payload(
            plugin_id=plugin_id,
            plan=plan,
            dry_run=True,
            message=I18nMessage(
                '插件物理清理演练完成，未执行实际删除', msg_key='plugin.runtime.purge.previewCompleted'
            ),
        )

    @staticmethod
    def build_success_payload(
        plugin_id: str,
        plan: PluginPurgePlan,
        hook_result: object | None,
    ) -> PluginPurgeStatePayloadDict:
        """
        构建插件物理清理成功负载。

        :param plugin_id: 插件ID
        :param plan: 插件物理清理计划
        :param hook_result: 清理钩子执行结果
        :return: 插件物理清理成功负载
        """
        return PluginPurgePayloadBuilder._build_state_payload(
            plugin_id=plugin_id,
            plan=plan,
            dry_run=False,
            message=I18nMessage('插件物理清理完成', msg_key='plugin.runtime.purge.completed'),
            hook_result=hook_result,
        )

    @staticmethod
    def _build_state_payload(
        *,
        plugin_id: str,
        plan: PluginPurgePlan,
        dry_run: bool,
        message: str,
        hook_result: object | None = None,
    ) -> PluginPurgeStatePayloadDict:
        """
        构建插件物理清理状态负载。

        :param plugin_id: 插件ID
        :param plan: 插件物理清理计划
        :param dry_run: 是否预演
        :param message: 响应消息
        :param hook_result: 清理钩子执行结果
        :return: 插件物理清理状态负载
        """
        payload: PluginPurgeStatePayloadDict = {
            'ok': True,
            'message': message,
            'pluginId': plugin_id,
            'operation': 'purge',
            'dryRun': dry_run,
            'safeMode': False,
            'removesSource': plan.removes_source,
            'plan': PluginPayloadBuilder.build_purge_plan(plan),
        }
        if not dry_run:
            payload['hooks'] = [vars(hook_result)] if hook_result else []
        return PluginPurgeStatePayload.model_validate(payload).to_payload(exclude_none=True)
