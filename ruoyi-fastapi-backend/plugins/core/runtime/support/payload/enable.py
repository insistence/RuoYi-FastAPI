from collections.abc import Mapping
from typing import TypeAlias

from pydantic import Field

from i18n.message import I18nMessage
from plugins.core.validation.plugin_deps import PluginDependencyCheckResult

from . import PluginPayloadBuilder
from .base import PluginPayloadModel


class PluginEnableDependencyPayload(PluginPayloadModel):
    """插件启停依赖检查 payload。"""

    plugin_dependency_ok: bool = Field(alias='pluginDependencyOk', description='依赖的其他插件是否满足要求')
    plugin_dependency_errors: list[dict[str, object]] = Field(
        alias='pluginDependencyErrors', description='插件之间的依赖检查错误'
    )
    plugin_dependencies: list[dict[str, object]] = Field(
        alias='pluginDependencies', description='插件之间的依赖及其状态'
    )


class PluginEnableStatePayload(PluginPayloadModel):
    """插件启停状态 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: object = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    operation: str = Field(description='执行的操作类型')
    enabled: bool = Field(description='是否启用')
    dry_run: bool = Field(alias='dryRun', description='是否仅预演本次操作')
    actions: list[dict[str, object]] = Field(description='待执行或已执行的操作明细')
    plugin_dependency_ok: object | None = Field(
        default=None, alias='pluginDependencyOk', description='依赖的其他插件是否满足要求'
    )
    plugin_dependency_errors: object | None = Field(
        default=None, alias='pluginDependencyErrors', description='插件之间的依赖检查错误'
    )
    plugin_dependencies: object | None = Field(
        default=None, alias='pluginDependencies', description='插件之间的依赖及其状态'
    )


class PluginEnableUpdateFailurePayload(PluginPayloadModel):
    """插件启停写入失败 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    operation: str = Field(description='执行的操作类型')
    enabled: bool = Field(description='是否启用')
    dry_run: bool = Field(alias='dryRun', description='是否仅预演本次操作')


class PluginSafeUninstallPayload(PluginPayloadModel):
    """插件安全卸载 payload。"""

    ok: object | None = Field(default=None, description='本次操作是否成功')
    message: object | None = Field(default=None, description='面向调用方的结果说明')
    plugin_id: object | None = Field(default=None, alias='pluginId', description='插件标识')
    operation: str = Field(description='执行的操作类型')
    enabled: bool | None = Field(default=None, description='是否启用')
    dry_run: bool | None = Field(default=None, alias='dryRun', description='是否仅预演本次操作')
    safe_mode: bool = Field(alias='safeMode', description='是否使用安全操作模式')
    removes_source: bool = Field(alias='removesSource', description='本次操作是否移除插件源码')
    removes_menus: bool = Field(alias='removesMenus', description='本次操作是否移除插件菜单')
    actions: list[dict[str, object]] | None = Field(default=None, description='待执行或已执行的操作明细')
    precheck: dict[str, object] | None = Field(default=None, description='操作开始前的检查结果')
    manifest_ok: object | None = Field(default=None, alias='manifestOk', description='插件清单是否通过校验')
    dependency_ok: object | None = Field(default=None, alias='dependencyOk', description='软件包依赖是否满足要求')
    plugin_dependency_ok: object | None = Field(
        default=None, alias='pluginDependencyOk', description='依赖的其他插件是否满足要求'
    )
    structure_ok: object | None = Field(default=None, alias='structureOk', description='插件文件结构是否通过校验')
    menu_conflict_ok: object | None = Field(
        default=None, alias='menuConflictOk', description='插件是否通过菜单冲突检查'
    )
    manifest_issues: object | None = Field(default=None, alias='manifestIssues', description='插件清单中的错误')
    manifest_warnings: object | None = Field(default=None, alias='manifestWarnings', description='插件清单中的警告')
    plugin_dependency_errors: object | None = Field(
        default=None, alias='pluginDependencyErrors', description='插件之间的依赖检查错误'
    )
    structure_errors: object | None = Field(
        default=None, alias='structureErrors', description='插件目录或文件结构检查错误'
    )
    menu_conflicts: object | None = Field(default=None, alias='menuConflicts', description='检测到的菜单冲突')
    dependencies: object | None = Field(default=None, description='软件包依赖及其检查结果')
    plugin_dependencies: object | None = Field(
        default=None, alias='pluginDependencies', description='插件之间的依赖及其状态'
    )
    error: object | None = Field(default=None, description='失败原因')
    failed_step: str | None = Field(default=None, alias='failedStep', description='发生错误的操作步骤')
    capability: dict[str, object] | None = Field(default=None, description='当前环境对该操作的支持情况')


PluginEnableDependencyPayloadDict: TypeAlias = dict[str, object]
PluginEnableStatePayloadDict: TypeAlias = dict[str, object]
PluginEnableUpdateFailurePayloadDict: TypeAlias = dict[str, object]
PluginSafeUninstallPayloadDict: TypeAlias = dict[str, object]


class PluginEnablePayloadBuilder:
    """
    插件启停负载构建器。

    使用 Builder 模式集中启用、停用和安全卸载的负载拼装。
    """

    @classmethod
    def build_dependency_payload(
        cls, plugin_dependency_result: PluginDependencyCheckResult
    ) -> PluginEnableDependencyPayloadDict:
        """
        构建插件启用依赖检查负载。

        :param plugin_dependency_result: 插件间依赖检查结果
        :return: 插件启用依赖检查负载
        """
        return PluginEnableDependencyPayload(
            plugin_dependency_ok=plugin_dependency_result.ok,
            plugin_dependency_errors=[
                PluginPayloadBuilder.build_plugin_dependency_item(item)
                for item in plugin_dependency_result.failed_items
            ],
            plugin_dependencies=[
                PluginPayloadBuilder.build_plugin_dependency_item(item) for item in plugin_dependency_result.items
            ],
        ).to_payload()

    @staticmethod
    def build_dependency_blocker_payload(
        plugin_id: str,
        *,
        operation: str,
        enabled: bool,
        dependency_payload: Mapping[str, object],
        message: str | None = None,
    ) -> PluginEnableStatePayloadDict:
        """
        构建插件启用依赖阻断负载。

        :param plugin_id: 插件ID
        :param operation: 操作类型
        :param enabled: 是否启用
        :param dependency_payload: 插件依赖检查负载
        :param message: 自定义阻断提示
        :return: 插件启用依赖阻断负载
        """
        plugin_dependency_ok = bool(dependency_payload.get('pluginDependencyOk', True))
        resolved_message = message or (
            '插件仍被已启用插件依赖，操作已中止'
            if operation in ('disable', 'uninstall')
            else '插件间依赖检查失败，启用已中止'
        )
        return PluginEnableStatePayload.model_validate(
            {
                'ok': False,
                'message': resolved_message,
                'pluginId': plugin_id,
                'operation': operation,
                'enabled': enabled,
                'dryRun': False,
                'actions': PluginPayloadBuilder.build_enabled_actions(enabled, plugin_dependency_ok),
                **dependency_payload,
            }
        ).to_payload(exclude_none=True)

    @staticmethod
    def build_dry_run_payload(
        plugin_id: str,
        *,
        operation: str,
        enabled: bool,
        dependency_payload: Mapping[str, object],
    ) -> PluginEnableStatePayloadDict:
        """
        构建插件启停预演负载。

        :param plugin_id: 插件ID
        :param operation: 操作类型
        :param enabled: 是否启用
        :param dependency_payload: 插件依赖检查负载
        :return: 插件启停预演负载
        """
        return PluginEnablePayloadBuilder._build_state_payload(
            plugin_id=plugin_id,
            operation=operation,
            enabled=enabled,
            dry_run=True,
            ok=True,
            message=I18nMessage('插件启停演练完成，未执行实际写入', msg_key='plugin.runtime.enable.previewCompleted'),
            dependency_payload=dependency_payload,
        )

    @staticmethod
    def build_update_failure_payload(
        plugin_id: str,
        *,
        operation: str,
        enabled: bool,
        message: str,
    ) -> PluginEnableUpdateFailurePayloadDict:
        """
        构建插件启停写入失败负载。

        :param plugin_id: 插件ID
        :param operation: 操作类型
        :param enabled: 是否启用
        :param message: 失败提示
        :return: 插件启停写入失败负载
        """
        return PluginEnableUpdateFailurePayload(
            ok=False,
            message=message,
            plugin_id=plugin_id,
            operation=operation,
            enabled=enabled,
            dry_run=False,
        ).to_payload()

    @staticmethod
    def build_success_payload(
        plugin_id: str,
        *,
        operation: str,
        enabled: bool,
        message: str,
        dependency_payload: Mapping[str, object],
    ) -> PluginEnableStatePayloadDict:
        """
        构建插件启停成功负载。

        :param plugin_id: 插件ID
        :param operation: 操作类型
        :param enabled: 是否启用
        :param message: 成功提示
        :param dependency_payload: 插件依赖检查负载
        :return: 插件启停成功负载
        """
        return PluginEnablePayloadBuilder._build_state_payload(
            plugin_id=plugin_id,
            operation=operation,
            enabled=enabled,
            dry_run=False,
            ok=True,
            message=message,
            dependency_payload=dependency_payload,
        )

    @staticmethod
    def build_uninstall_payload(result: Mapping[str, object], *, dry_run: bool) -> PluginSafeUninstallPayloadDict:
        """
        构建插件安全卸载负载。

        :param result: 插件停用结果负载
        :param dry_run: 是否预演
        :return: 插件安全卸载负载
        """
        uninstall_payload = dict(result)
        uninstall_payload.update(
            {
                'operation': 'uninstall',
                'message': I18nMessage(
                    '插件卸载演练完成，未执行实际写入', msg_key='plugin.runtime.uninstall.previewCompleted'
                )
                if dry_run
                else result.get('message', '插件卸载完成'),
                'safeMode': True,
                'removesSource': False,
                'removesMenus': True,
            }
        )
        return PluginSafeUninstallPayload.model_validate(uninstall_payload).to_payload(exclude_none=True)

    @staticmethod
    def _build_state_payload(
        *,
        plugin_id: str,
        operation: str,
        enabled: bool,
        dry_run: bool,
        ok: bool,
        message: str,
        dependency_payload: Mapping[str, object],
    ) -> PluginEnableStatePayloadDict:
        """
        构建插件启停状态负载。

        :param plugin_id: 插件ID
        :param operation: 操作类型
        :param enabled: 是否启用
        :param dry_run: 是否预演
        :param ok: 操作是否成功
        :param message: 响应消息
        :param dependency_payload: 插件依赖检查负载
        :return: 插件启停状态负载
        """
        plugin_dependency_ok = bool(dependency_payload.get('pluginDependencyOk', True))
        return PluginEnableStatePayload.model_validate(
            {
                'ok': ok,
                'message': message,
                'pluginId': plugin_id,
                'operation': operation,
                'enabled': enabled,
                'dryRun': dry_run,
                'actions': PluginPayloadBuilder.build_enabled_actions(enabled, plugin_dependency_ok),
                **dependency_payload,
            }
        ).to_payload(exclude_none=True)
