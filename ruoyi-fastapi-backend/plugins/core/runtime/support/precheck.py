from dataclasses import dataclass
from typing import Self, TypeAlias

from pydantic import Field

from plugins.core.validation.dependencies import DependencyCheckResult
from plugins.core.validation.manifest import PluginManifestCheckResult
from plugins.core.validation.menus import PluginMenuConflictResult
from plugins.core.validation.plugin_deps import PluginDependencyCheckResult
from plugins.core.validation.structure import PluginStructureCheckResult

from .payload import PluginPayloadBuilder
from .payload.base import PluginPayloadModel

PrecheckOperationPayloadDict: TypeAlias = dict[str, object]
PrecheckCheckPayloadDict: TypeAlias = dict[str, object]


class PluginPrecheckOperationPayload(PluginPayloadModel):
    """插件预检操作片段 payload。"""

    manifest_ok: bool = Field(alias='manifestOk', description='插件清单是否通过校验')
    dependency_ok: bool = Field(alias='dependencyOk', description='软件包依赖是否满足要求')
    plugin_dependency_ok: bool = Field(alias='pluginDependencyOk', description='依赖的其他插件是否满足要求')
    structure_ok: bool = Field(alias='structureOk', description='插件文件结构是否通过校验')
    menu_conflict_ok: bool = Field(alias='menuConflictOk', description='插件是否通过菜单冲突检查')
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


class PluginPrecheckCheckPayload(PluginPrecheckOperationPayload):
    """插件预检检查片段 payload。"""

    structure: list[dict[str, object]] = Field(description='插件目录结构检查结果')
    missing_dependencies: list[str] = Field(alias='missingDependencies', description='尚未安装的依赖')
    unsatisfied_dependencies: list[str] = Field(
        alias='unsatisfiedDependencies', description='已安装但不满足版本要求的依赖'
    )


@dataclass(frozen=True)
class PluginPrecheckContext:
    """
    插件操作预检上下文。

    使用 Context Object 模式聚合依赖、manifest、插件间依赖、结构和菜单冲突检查结果，
    避免插件运行时在安装、升级和检查流程中重复拼装 payload。

    :ivar dependency_result: Python/npm 依赖检查结果
    :ivar manifest_result: manifest 非阻断检查结果
    :ivar plugin_dependency_result: 插件间依赖检查结果
    :ivar structure_result: 插件结构检查结果
    :ivar menu_conflict_result: 菜单冲突检查结果
    :ivar manifest_issues: manifest error 负载
    :ivar manifest_warnings: manifest warning 负载
    :ivar plugin_dependency_errors: 插件依赖错误负载
    :ivar structure_errors: 结构错误负载
    :ivar menu_conflicts: 菜单冲突负载
    :ivar dependencies: Python/npm 依赖检查负载
    :ivar plugin_dependencies: 插件依赖检查负载
    :ivar structure: 结构检查完整负载
    :ivar missing_dependencies: 缺失依赖名称列表
    :ivar unsatisfied_dependencies: 版本不满足依赖名称列表
    """

    dependency_result: DependencyCheckResult
    manifest_result: PluginManifestCheckResult
    plugin_dependency_result: PluginDependencyCheckResult
    structure_result: PluginStructureCheckResult
    menu_conflict_result: PluginMenuConflictResult
    manifest_issues: list[dict[str, object]]
    manifest_warnings: list[dict[str, object]]
    plugin_dependency_errors: list[dict[str, object]]
    structure_errors: list[dict[str, object]]
    menu_conflicts: list[dict[str, object]]
    dependencies: list[dict[str, object]]
    plugin_dependencies: list[dict[str, object]]
    structure: list[dict[str, object]]
    missing_dependencies: list[str]
    unsatisfied_dependencies: list[str]

    @classmethod
    def build(
        cls,
        dependency_result: DependencyCheckResult,
        manifest_result: PluginManifestCheckResult,
        plugin_dependency_result: PluginDependencyCheckResult,
        structure_result: PluginStructureCheckResult,
        menu_conflict_result: PluginMenuConflictResult,
    ) -> Self:
        """
        从各类检查结果构建预检上下文。

        :param dependency_result: Python/npm 依赖检查结果
        :param manifest_result: manifest 非阻断检查结果
        :param plugin_dependency_result: 插件间依赖检查结果
        :param structure_result: 插件结构检查结果
        :param menu_conflict_result: 菜单冲突检查结果
        :return: 插件操作预检上下文
        """
        return cls(
            dependency_result=dependency_result,
            manifest_result=manifest_result,
            plugin_dependency_result=plugin_dependency_result,
            structure_result=structure_result,
            menu_conflict_result=menu_conflict_result,
            manifest_issues=[PluginPayloadBuilder.build_validation_issue(item) for item in manifest_result.issues],
            manifest_warnings=[
                PluginPayloadBuilder.build_validation_issue(item) for item in manifest_result.warning_issues
            ],
            plugin_dependency_errors=[
                PluginPayloadBuilder.build_plugin_dependency_item(item)
                for item in plugin_dependency_result.failed_items
            ],
            structure_errors=[
                PluginPayloadBuilder.build_structure_item(item) for item in structure_result.failed_items
            ],
            menu_conflicts=[PluginPayloadBuilder.build_menu_conflict_item(item) for item in menu_conflict_result.items],
            dependencies=[PluginPayloadBuilder.build_dependency_item(item) for item in dependency_result.items],
            plugin_dependencies=[
                PluginPayloadBuilder.build_plugin_dependency_item(item) for item in plugin_dependency_result.items
            ],
            structure=[PluginPayloadBuilder.build_structure_item(item) for item in structure_result.items],
            missing_dependencies=[item.name for item in dependency_result.missing_items],
            unsatisfied_dependencies=[item.name for item in dependency_result.unsatisfied_items],
        )

    @property
    def ok(self) -> bool:
        """
        判断阻断性预检是否全部通过。

        :return: 阻断性预检是否全部通过
        """
        return (
            self.dependency_result.ok
            and self.manifest_result.ok
            and self.plugin_dependency_result.ok
            and self.structure_result.ok
            and self.menu_conflict_result.ok
        )

    @property
    def operation_payload(self) -> PrecheckOperationPayloadDict:
        """
        构建安装和升级操作通用负载片段。

        :return: 安装和升级操作通用负载片段
        """
        return PluginPrecheckOperationPayload(
            manifest_ok=self.manifest_result.ok,
            dependency_ok=self.dependency_result.ok,
            plugin_dependency_ok=self.plugin_dependency_result.ok,
            structure_ok=self.structure_result.ok,
            menu_conflict_ok=self.menu_conflict_result.ok,
            manifest_issues=self.manifest_issues,
            manifest_warnings=self.manifest_warnings,
            plugin_dependency_errors=self.plugin_dependency_errors,
            structure_errors=self.structure_errors,
            menu_conflicts=self.menu_conflicts,
            dependencies=self.dependencies,
            plugin_dependencies=self.plugin_dependencies,
        ).to_payload()

    @property
    def check_payload(self) -> PrecheckCheckPayloadDict:
        """
        构建插件检查命令通用负载片段。

        :return: 插件检查命令通用负载片段
        """
        return PluginPrecheckCheckPayload(
            manifest_ok=self.manifest_result.ok,
            dependency_ok=self.dependency_result.ok,
            plugin_dependency_ok=self.plugin_dependency_result.ok,
            structure_ok=self.structure_result.ok,
            menu_conflict_ok=self.menu_conflict_result.ok,
            dependencies=self.dependencies,
            plugin_dependencies=self.plugin_dependencies,
            plugin_dependency_errors=self.plugin_dependency_errors,
            manifest_issues=self.manifest_issues,
            manifest_warnings=self.manifest_warnings,
            structure=self.structure,
            missing_dependencies=self.missing_dependencies,
            unsatisfied_dependencies=self.unsatisfied_dependencies,
            structure_errors=self.structure_errors,
            menu_conflicts=self.menu_conflicts,
        ).to_payload()
