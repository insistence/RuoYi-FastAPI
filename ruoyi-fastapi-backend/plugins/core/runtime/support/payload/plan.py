from subprocess import CompletedProcess
from typing import TYPE_CHECKING, Protocol, TypeAlias, cast

from pydantic import Field

from i18n.message import I18nMessage
from plugins.core.discovery.scanner import DiscoveredPlugin
from plugins.core.lifecycle.purge import PluginPurgePlan, PluginPurgePlanItem
from plugins.core.manifest.menu_tree import PluginMenuTree
from plugins.core.validation.dependencies import DependencyCheckResult, DependencyInstallPlanItem
from plugins.core.validation.plugin_deps import (
    PluginDependencyCheckResult,
    PluginDependencyPlan,
    PluginDependencyPlanBlocker,
    PluginDependencyPlanItem,
)
from plugins.core.validation.versioning import PluginVersionComparator

from .base import PluginPayloadModel

if TYPE_CHECKING:
    from plugins.core.validation.structure import PluginStructureCheckResult


class SupportsOk(Protocol):
    """
    支持 ok 属性的检查结果协议。

    :ivar ok: 操作或检查是否成功
    """

    ok: bool


class PluginPlanBlockerPayload(PluginPayloadModel):
    """插件批量操作计划阻塞项 payload。"""

    plugin_id: str = Field(alias='pluginId', description='插件标识')
    dependency_id: str = Field(alias='dependencyId', description='被依赖的插件标识')
    status: str = Field(description='当前状态')
    message: str = Field(description='面向调用方的结果说明')


class PluginPlanItemPayload(PluginPayloadModel):
    """插件批量操作计划项 payload。"""

    plugin_id: str = Field(alias='pluginId', description='插件标识')
    name: str = Field(description='插件名称')
    version: str = Field(description='插件版本')
    operation: str = Field(description='执行的操作类型')
    order: int = Field(description='排列顺序')
    requested: bool = Field(description='是否由本次请求显式指定')
    dependencies: list[str] = Field(description='当前插件依赖的插件标识')
    installed_version: str | None = Field(alias='installedVersion', description='已安装的版本')
    enabled: str | None = Field(description='是否启用')
    status: str | None = Field(description='当前状态')
    ready: bool = Field(description='执行该计划项的前置条件是否已满足')
    blockers: list[dict[str, object]] = Field(description='阻止执行计划的原因')


class PluginPlanPayload(PluginPayloadModel):
    """插件批量操作拓扑计划 payload。"""

    operation: str = Field(description='执行的操作类型')
    ok: bool = Field(description='本次操作是否成功')
    requested_plugin_ids: list[str] = Field(alias='requestedPluginIds', description='调用方指定的插件标识列表')
    ordered_plugin_ids: list[str] = Field(alias='orderedPluginIds', description='按执行顺序排列的插件标识列表')
    items: list[dict[str, object]] = Field(description='结果条目列表')
    blockers: list[dict[str, object]] = Field(description='阻止执行计划的原因')
    blocker_count: int = Field(alias='blockerCount', description='阻止执行计划的问题数')


class PluginPlanResponsePayload(PluginPayloadModel):
    """插件批量操作计划响应 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    operation: str = Field(description='执行的操作类型')
    database_available: bool = Field(alias='databaseAvailable', description='数据库是否可用')
    database_error: str | None = Field(alias='databaseError', description='数据库访问失败的原因')
    plan: dict[str, object] = Field(description='预定执行的操作计划')


class DependencyInstallPlanItemPayload(PluginPayloadModel):
    """依赖安装计划项 payload。"""

    kind: str = Field(description='依赖使用的软件包管理方式')
    requirement: str = Field(description='软件包依赖声明')
    name: str = Field(description='待安装的软件包名称')
    command: list[str] = Field(description='用于执行命令的参数列表')
    command_text: str = Field(alias='commandText', description='供展示的命令文本')
    workdir: str = Field(description='执行命令的工作目录')
    reason: str = Field(description='安排该操作的原因')
    status: str = Field(description='当前状态')


class DependencyInstallResultPayload(PluginPayloadModel):
    """依赖安装执行结果 payload。"""

    kind: str = Field(description='依赖使用的软件包管理方式')
    requirement: str = Field(description='软件包依赖声明')
    name: str = Field(description='执行安装的软件包名称')
    command: list[str] = Field(description='用于执行命令的参数列表')
    command_text: str = Field(alias='commandText', description='供展示的命令文本')
    workdir: str = Field(description='执行命令的工作目录')
    return_code: int = Field(alias='returnCode', description='子进程退出码')
    stdout: str = Field(description='命令的标准输出')
    stderr: str = Field(description='命令的标准错误输出')


class CommandResultPayload(PluginPayloadModel):
    """系统命令执行结果 payload。"""

    return_code: int = Field(alias='returnCode', description='子进程退出码')
    stdout: str = Field(description='命令的标准输出')
    stderr: str = Field(description='命令的标准错误输出')


class PurgePlanItemPayload(PluginPayloadModel):
    """插件物理清理计划项 payload。"""

    name: str = Field(description='清理操作名称')
    label: str = Field(description='面向用户的显示名称')
    enabled: bool = Field(description='是否启用')
    destructive: bool = Field(description='是否会删除已有数据或资源')
    count: int | None = Field(description='结果条数')
    target: str | None = Field(description='本项操作的目标')


class PurgePlanPayload(PluginPayloadModel):
    """插件物理清理计划 payload。"""

    plugin_id: str = Field(alias='pluginId', description='插件标识')
    removes_source: bool = Field(alias='removesSource', description='本次操作是否移除插件源码')
    requires_hook: bool = Field(alias='requiresHook', description='是否需要运行清理钩子')
    destructive_count: int = Field(alias='destructiveCount', description='涉及删除已有数据或资源的操作数')
    items: list[dict[str, object]] = Field(description='结果条目列表')


class ActionPayload(PluginPayloadModel):
    """插件操作动作项 payload。"""

    name: str | None = Field(default=None, description='操作名称')
    label: str | None = Field(default=None, description='面向用户的显示名称')
    enabled: bool | None = Field(default=None, description='是否启用')
    count: int | None = Field(default=None, description='结果条数')
    ok: bool | None = Field(default=None, description='本次操作是否成功')
    hook: str | None = Field(default=None, description='本项操作调用的生命周期钩子')
    target_enabled: bool | None = Field(default=None, alias='targetEnabled', description='操作后期望的启用状态')
    target_status: str | None = Field(default=None, alias='targetStatus', description='操作后期望达到的状态')


class VersionStatePayload(PluginPayloadModel):
    """插件升级版本状态 payload。"""

    installed: bool = Field(description='是否已经安装')
    installed_version: str | None = Field(alias='installedVersion', description='已安装的版本')
    current_version: str = Field(alias='currentVersion', description='当前发现的插件版本')
    needs_upgrade: bool = Field(alias='needsUpgrade', description='是否需要升级已安装版本')


UpgradeDryRunPayloadContext: TypeAlias = dict[str, object]


class UpgradeDryRunPayload(PluginPayloadModel):
    """插件升级 dry-run payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    dry_run: bool = Field(alias='dryRun', description='是否仅预演本次操作')
    installed: bool = Field(description='是否已经安装')
    installed_version: str | None = Field(alias='installedVersion', description='已安装的版本')
    current_version: str = Field(alias='currentVersion', description='当前发现的插件版本')
    needs_upgrade: bool = Field(alias='needsUpgrade', description='是否需要升级已安装版本')
    database_available: bool = Field(alias='databaseAvailable', description='数据库是否可用')
    database_error: str | None = Field(alias='databaseError', description='数据库访问失败的原因')
    dependency_ok: bool = Field(alias='dependencyOk', description='软件包依赖是否满足要求')
    manifest_ok: bool = Field(alias='manifestOk', description='插件清单是否通过校验')
    plugin_dependency_ok: bool = Field(alias='pluginDependencyOk', description='依赖的其他插件是否满足要求')
    structure_ok: bool = Field(alias='structureOk', description='插件文件结构是否通过校验')
    menu_conflict_ok: bool = Field(alias='menuConflictOk', description='插件是否通过菜单冲突检查')
    actions: list[dict[str, object]] = Field(description='待执行或已执行的操作明细')
    manifest_issues: list[dict[str, object]] = Field(alias='manifestIssues', description='插件清单中的错误')
    manifest_warnings: list[dict[str, object]] = Field(alias='manifestWarnings', description='插件清单中的警告')
    plugin_dependency_errors: list[dict[str, object]] = Field(
        alias='pluginDependencyErrors', description='插件之间的依赖检查错误'
    )
    structure_errors: list[dict[str, object]] = Field(alias='structureErrors', description='插件目录或文件结构检查错误')
    menu_conflicts: list[dict[str, object]] = Field(alias='menuConflicts', description='检测到的菜单冲突')
    dependencies: list[dict[str, object]] = Field(description='软件包依赖及其检查结果')
    plugin_dependencies: list[dict[str, object]] = Field(
        alias='pluginDependencies', description='插件之间的依赖及其状态'
    )


PluginPlanPayloadDict: TypeAlias = dict[str, object]
UpgradeDryRunPayloadDict: TypeAlias = dict[str, object]


class PluginPlanPayloadMixin:
    """插件依赖拓扑、执行动作和物理清理计划负载构建能力。"""

    @staticmethod
    def build_plugin_plan_blocker(item: PluginDependencyPlanBlocker) -> PluginPlanBlockerPayload:
        """
        构建插件批量操作计划阻塞项负载。

        :param item: 插件批量操作计划阻塞项
        :return: 插件批量操作计划阻塞项负载
        """
        return PluginPlanBlockerPayload(
            plugin_id=item.plugin_id,
            dependency_id=item.dependency_id,
            status=item.status,
            message=item.message,
        ).to_payload()

    @classmethod
    def build_plugin_plan_item(cls, item: PluginDependencyPlanItem) -> PluginPlanItemPayload:
        """
        构建插件批量操作计划项负载。

        :param item: 插件批量操作计划项
        :return: 插件批量操作计划项负载
        """
        return PluginPlanItemPayload(
            plugin_id=item.plugin_id,
            name=item.name,
            version=item.version,
            operation=item.operation,
            order=item.order,
            requested=item.requested,
            dependencies=item.dependencies,
            installed_version=item.installed_version,
            enabled=item.enabled,
            status=item.status,
            ready=item.ready,
            blockers=[cls.build_plugin_plan_blocker(blocker) for blocker in item.blockers],
        ).to_payload()

    @classmethod
    def build_plugin_plan(cls, plan: PluginDependencyPlan) -> PluginPlanPayloadDict:
        """
        构建插件批量操作拓扑计划负载。

        :param plan: 插件批量操作拓扑计划
        :return: 插件批量操作拓扑计划负载
        """
        return PluginPlanPayload(
            operation=plan.operation,
            ok=plan.ok,
            requested_plugin_ids=plan.requested_plugin_ids,
            ordered_plugin_ids=plan.ordered_plugin_ids,
            items=[cls.build_plugin_plan_item(item) for item in plan.items],
            blockers=[cls.build_plugin_plan_blocker(blocker) for blocker in plan.blockers],
            blocker_count=len(plan.blockers),
        ).to_payload()

    @classmethod
    def build_plan_payload(
        cls,
        plan: PluginDependencyPlan,
        database_error: str | None = None,
    ) -> PluginPlanResponsePayload:
        """
        构建插件批量操作计划响应负载。

        :param plan: 插件批量操作拓扑计划
        :param database_error: 数据库状态读取错误
        :return: 插件批量操作计划响应负载
        """
        return PluginPlanResponsePayload(
            ok=plan.ok,
            message=I18nMessage('插件批量操作计划生成完成', msg_key='plugin.runtime.batch.planCompleted')
            if plan.ok
            else '插件批量操作计划存在阻塞项',
            operation=plan.operation,
            database_available=database_error is None,
            database_error=database_error,
            plan=cls.build_plugin_plan(plan),
        ).to_payload()

    @staticmethod
    def build_dependency_install_plan_item(item: DependencyInstallPlanItem) -> DependencyInstallPlanItemPayload:
        """
        构建依赖安装计划项负载。

        :param item: 依赖安装计划项
        :return: 依赖安装计划项负载
        """
        return DependencyInstallPlanItemPayload(
            kind=item.kind,
            requirement=item.requirement,
            name=item.name,
            command=item.command,
            command_text=' '.join(item.command),
            workdir=item.workdir,
            reason=item.reason,
            status='planned',
        ).to_payload()

    @staticmethod
    def build_dependency_install_result(
        item: DependencyInstallPlanItem,
        completed: CompletedProcess[str],
    ) -> DependencyInstallResultPayload:
        """
        构建依赖安装执行结果负载。

        :param item: 依赖安装计划项
        :param completed: 命令执行结果
        :return: 依赖安装执行结果
        """
        return DependencyInstallResultPayload(
            kind=item.kind,
            requirement=item.requirement,
            name=item.name,
            command=item.command,
            command_text=' '.join(item.command),
            workdir=item.workdir,
            return_code=completed.returncode,
            stdout=completed.stdout[-2000:],
            stderr=completed.stderr[-2000:],
        ).to_payload()

    @staticmethod
    def build_command_result(completed: CompletedProcess[str]) -> CommandResultPayload:
        """
        构建通用系统命令执行结果负载。

        :param completed: 命令执行结果
        :return: 系统命令执行结果负载
        """
        return CommandResultPayload(
            return_code=completed.returncode,
            stdout=completed.stdout[-4000:] if completed.stdout else '',
            stderr=completed.stderr[-4000:] if completed.stderr else '',
        ).to_payload()

    @staticmethod
    def build_purge_plan_item(item: PluginPurgePlanItem) -> PurgePlanItemPayload:
        """
        构建插件物理清理计划项负载。

        :param item: 插件物理清理计划项
        :return: 插件物理清理计划项负载
        """
        return PurgePlanItemPayload(
            name=item.name,
            label=item.label,
            enabled=item.enabled,
            destructive=item.destructive,
            count=item.count,
            target=item.target,
        ).to_payload()

    @classmethod
    def build_purge_plan(cls, plan: PluginPurgePlan) -> PurgePlanPayload:
        """
        构建插件物理清理计划负载。

        :param plan: 插件物理清理计划
        :return: 插件物理清理计划负载
        """
        return PurgePlanPayload(
            plugin_id=plan.plugin_id,
            removes_source=plan.removes_source,
            requires_hook=plan.requires_hook,
            destructive_count=plan.destructive_count,
            items=[cls.build_purge_plan_item(item) for item in plan.items],
        ).to_payload()

    @classmethod
    def build_install_actions(
        cls,
        discovered_plugin: DiscoveredPlugin,
        dependency_ok: bool,
        plugin_dependency_ok: bool,
        structure_ok: bool,
        menu_conflict_ok: bool,
    ) -> list[ActionPayload]:
        """
        构建插件安装动作计划。

        :param discovered_plugin: 已发现插件
        :param dependency_ok: 依赖检查是否通过
        :param plugin_dependency_ok: 插件间依赖检查是否通过
        :param structure_ok: 结构检查是否通过
        :param menu_conflict_ok: 菜单冲突检查是否通过
        :return: 安装动作计划
        """
        manifest = discovered_plugin.manifest
        return [
            {'name': 'upsert_plugin', 'label': '写入或更新插件状态', 'enabled': True},
            {
                'name': 'install_menus',
                'label': '幂等写入菜单和权限',
                'enabled': bool(manifest.frontend.menus),
                'count': PluginMenuTree.count(manifest.frontend.menus),
            },
            {
                'name': 'install_configs',
                'label': '写入默认插件配置',
                'enabled': bool(manifest.config.items),
                'count': len(manifest.config.items),
            },
            {'name': 'check_dependencies', 'label': '检查依赖声明', 'enabled': True, 'ok': dependency_ok},
            {
                'name': 'check_plugin_dependencies',
                'label': '检查插件间依赖',
                'enabled': bool(manifest.dependencies.plugins),
                'ok': plugin_dependency_ok,
                'count': len(manifest.dependencies.plugins),
            },
            {'name': 'check_structure', 'label': '检查插件结构', 'enabled': True, 'ok': structure_ok},
            {
                'name': 'check_menu_conflicts',
                'label': '检查菜单和权限冲突',
                'enabled': bool(manifest.frontend.menus),
                'ok': menu_conflict_ok,
            },
            {
                'name': 'run_migrations',
                'label': '执行 migration 脚本',
                'enabled': bool(manifest.backend.migrations),
                'count': len(manifest.backend.migrations),
            },
            {
                'name': 'run_seeds',
                'label': '执行 seed 脚本',
                'enabled': bool(manifest.backend.seeds),
                'count': len(manifest.backend.seeds),
            },
            {
                'name': 'run_install_hook',
                'label': '执行安装生命周期钩子',
                'enabled': bool(manifest.backend.hooks.on_install),
                'hook': manifest.backend.hooks.on_install,
            },
        ]

    @classmethod
    def build_upgrade_actions(
        cls,
        discovered_plugin: DiscoveredPlugin,
        dependency_ok: bool,
        plugin_dependency_ok: bool,
        structure_ok: bool,
        menu_conflict_ok: bool,
    ) -> list[ActionPayload]:
        """
        构建插件升级动作计划。

        :param discovered_plugin: 已发现插件
        :param dependency_ok: 依赖检查是否通过
        :param plugin_dependency_ok: 插件间依赖检查是否通过
        :param structure_ok: 结构检查是否通过
        :param menu_conflict_ok: 菜单冲突检查是否通过
        :return: 升级动作计划
        """
        manifest = discovered_plugin.manifest
        return [
            {'name': 'check_installed_version', 'label': '检查已安装版本', 'enabled': True},
            {'name': 'upsert_plugin', 'label': '刷新插件元数据', 'enabled': True},
            {
                'name': 'install_menus',
                'label': '幂等更新菜单和权限',
                'enabled': bool(manifest.frontend.menus),
                'count': PluginMenuTree.count(manifest.frontend.menus),
            },
            {
                'name': 'install_configs',
                'label': '刷新默认插件配置',
                'enabled': bool(manifest.config.items),
                'count': len(manifest.config.items),
            },
            {'name': 'check_dependencies', 'label': '检查依赖声明', 'enabled': True, 'ok': dependency_ok},
            {
                'name': 'check_plugin_dependencies',
                'label': '检查插件间依赖',
                'enabled': bool(manifest.dependencies.plugins),
                'ok': plugin_dependency_ok,
                'count': len(manifest.dependencies.plugins),
            },
            {'name': 'check_structure', 'label': '检查插件结构', 'enabled': True, 'ok': structure_ok},
            {
                'name': 'check_menu_conflicts',
                'label': '检查菜单和权限冲突',
                'enabled': bool(manifest.frontend.menus),
                'ok': menu_conflict_ok,
            },
            {
                'name': 'run_migrations',
                'label': '执行 migration 脚本',
                'enabled': bool(manifest.backend.migrations),
                'count': len(manifest.backend.migrations),
            },
            {
                'name': 'run_seeds',
                'label': '执行 seed 脚本',
                'enabled': bool(manifest.backend.seeds),
                'count': len(manifest.backend.seeds),
            },
            {
                'name': 'run_upgrade_hook',
                'label': '执行升级生命周期钩子',
                'enabled': bool(manifest.backend.hooks.on_upgrade),
                'hook': manifest.backend.hooks.on_upgrade,
            },
            {'name': 'mark_installed', 'label': '更新已安装版本', 'enabled': True},
        ]

    @staticmethod
    def build_upgrade_version_state(
        discovered_plugin: DiscoveredPlugin,
        database_plugin: object | None,
    ) -> VersionStatePayload:
        """
        构建插件升级版本状态。

        :param discovered_plugin: 已发现插件
        :param database_plugin: 数据库插件状态
        :return: 升级版本状态
        """
        installed_version = getattr(database_plugin, 'installed_version', None)
        current_version = discovered_plugin.manifest.version
        return VersionStatePayload(
            installed=database_plugin is not None and bool(installed_version),
            installed_version=installed_version,
            current_version=current_version,
            needs_upgrade=PluginVersionComparator.is_upgrade_available(installed_version, current_version),
        ).to_payload()

    @classmethod
    def build_upgrade_dry_run_payload(
        cls,
        plugin_id: str,
        payload_context: UpgradeDryRunPayloadContext,
        database_error: str | None = None,
    ) -> UpgradeDryRunPayloadDict:
        """
        构建插件升级 dry-run 负载。

        :param plugin_id: 插件ID
        :param payload_context: dry-run 负载上下文
        :param database_error: 数据库状态读取错误
        :return: 插件升级 dry-run 负载
        """
        version_state = payload_context['versionState']
        dependency_result = cast('DependencyCheckResult', payload_context['dependencyResult'])
        plugin_dependency_result = cast('PluginDependencyCheckResult', payload_context['pluginDependencyResult'])
        structure_result = cast('PluginStructureCheckResult', payload_context['structureResult'])
        menu_conflict_result = cast('SupportsOk', payload_context['menuConflictResult'])
        return UpgradeDryRunPayload.model_validate(
            {
                'ok': True,
                'message': I18nMessage(
                    '插件升级演练完成，未执行实际写入', msg_key='plugin.runtime.upgrade.previewCompleted'
                ),
                'pluginId': plugin_id,
                'dryRun': True,
                **version_state,
                'databaseAvailable': database_error is None,
                'databaseError': database_error,
                'dependencyOk': dependency_result.ok,
                'manifestOk': payload_context['manifestOk'],
                'pluginDependencyOk': plugin_dependency_result.ok,
                'structureOk': structure_result.ok,
                'menuConflictOk': menu_conflict_result.ok,
                'actions': payload_context['actions'],
                'manifestIssues': payload_context['manifestIssues'],
                'manifestWarnings': payload_context['manifestWarnings'],
                'pluginDependencyErrors': payload_context['pluginDependencyErrors'],
                'structureErrors': payload_context['structureErrors'],
                'menuConflicts': payload_context['menuConflicts'],
                'dependencies': [cls.build_dependency_item(item) for item in dependency_result.items],
                'pluginDependencies': [
                    cls.build_plugin_dependency_item(item) for item in plugin_dependency_result.items
                ],
            }
        ).to_payload()

    @staticmethod
    def build_enabled_actions(enabled: bool, plugin_dependency_ok: bool = True) -> list[ActionPayload]:
        """
        构建插件启停动作计划。

        :param enabled: 是否启用
        :param plugin_dependency_ok: 插件间依赖检查是否通过
        :return: 插件启停动作计划
        """
        actions = [
            {
                'name': 'update_plugin_enabled',
                'label': '更新插件启停状态',
                'enabled': True,
                'targetEnabled': enabled,
            },
            {
                'name': 'update_plugin_menu_status',
                'label': '更新插件菜单状态',
                'enabled': True,
                'targetStatus': '0' if enabled else '1',
            },
        ]
        if enabled:
            actions.insert(
                0,
                {
                    'name': 'check_plugin_dependencies',
                    'label': '检查插件间依赖',
                    'enabled': True,
                    'ok': plugin_dependency_ok,
                },
            )
        elif not plugin_dependency_ok:
            actions.insert(
                0,
                {
                    'name': 'check_plugin_dependents',
                    'label': '检查被依赖关系',
                    'enabled': True,
                    'ok': False,
                },
            )

        return actions
