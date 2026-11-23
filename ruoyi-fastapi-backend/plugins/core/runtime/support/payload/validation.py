from collections.abc import Mapping
from typing import Protocol, TypeAlias

from pydantic import Field

from plugins.core.validation.dependencies import DependencyCheckItem, DependencyCheckResult
from plugins.core.validation.menus import PluginMenuConflictItem
from plugins.core.validation.plugin_deps import PluginDependencyCheckItem
from plugins.core.validation.result import PluginValidationIssue, PluginValidationLevelResolver, ValidationLevel
from plugins.core.validation.structure import PluginStructureCheckItem

from .base import PluginPayloadModel


class DependencyItemPayload(PluginPayloadModel):
    """Python/npm 依赖检查项 payload。"""

    kind: str = Field(description='依赖使用的软件包管理方式')
    requirement: str = Field(description='软件包依赖声明')
    name: str = Field(description='软件包名称')
    installed: bool = Field(description='是否已经安装')
    version_satisfied: bool = Field(alias='versionSatisfied', description='已安装版本是否满足约束')
    installed_version: str | None = Field(alias='installedVersion', description='已安装的版本')
    declared_version: str | None = Field(default=None, alias='declaredVersion', description='依赖声明中的版本')
    required_version: str | None = Field(alias='requiredVersion', description='所需的版本约束')
    ok: bool = Field(description='本次操作是否成功')
    status: str = Field(description='当前状态')
    level: ValidationLevel = Field(description='问题严重程度')
    message: str = Field(description='面向调用方的结果说明')


class PluginDependencyItemPayload(PluginPayloadModel):
    """插件间依赖检查项 payload。"""

    plugin_id: str = Field(alias='pluginId', description='插件标识')
    dependency_id: str = Field(alias='dependencyId', description='被依赖的插件标识')
    required_version: str | None = Field(alias='requiredVersion', description='所需的版本约束')
    installed_version: str | None = Field(alias='installedVersion', description='已安装的版本')
    status: str = Field(description='当前状态')
    ok: bool = Field(description='本次操作是否成功')
    level: ValidationLevel = Field(description='问题严重程度')
    message: str = Field(description='面向调用方的结果说明')


class ValidationIssuePayload(PluginPayloadModel):
    """manifest 校验问题项 payload。"""

    level: ValidationLevel = Field(description='问题严重程度')
    category: str = Field(description='校验问题的分类')
    kind: str = Field(description='项目类别')
    path: str = Field(description='文件或资源路径')
    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    suggestion: str = Field(description='建议的后续处理方式')


class StructureItemPayload(PluginPayloadModel):
    """插件结构检查项 payload。"""

    kind: str = Field(description='项目类别')
    path: str = Field(description='文件或资源路径')
    ok: bool = Field(description='本次操作是否成功')
    level: ValidationLevel = Field(description='问题严重程度')
    message: str = Field(description='面向调用方的结果说明')
    suggestion: str = Field(description='建议的后续处理方式')


class MenuConflictItemPayload(PluginPayloadModel):
    """菜单冲突检查项 payload。"""

    kind: str = Field(description='项目类别')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    conflict_plugin_id: str | None = Field(alias='conflictPluginId', description='与当前插件冲突的插件标识')
    value: str = Field(description='引发冲突的实际值')
    ok: bool = Field(description='本次操作是否成功')
    level: ValidationLevel = Field(description='问题严重程度')
    message: str = Field(description='面向调用方的结果说明')


class PluginDependencyCheckPayload(PluginPayloadModel):
    """插件依赖检查 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    dependency_ok: bool = Field(alias='dependencyOk', description='软件包依赖是否满足要求')
    dependencies: list[dict[str, object]] = Field(description='软件包依赖及其检查结果')
    missing_dependencies: list[str] = Field(alias='missingDependencies', description='尚未安装的依赖')
    unsatisfied_dependencies: list[str] = Field(
        alias='unsatisfiedDependencies', description='已安装但不满足版本要求的依赖'
    )


class PluginCheckItemPayload(PluginPayloadModel):
    """插件检查单项 payload。"""

    plugin_id: str = Field(alias='pluginId', description='插件标识')
    ok: bool = Field(description='本次操作是否成功')
    manifest_ok: bool | None = Field(default=None, alias='manifestOk', description='插件清单是否通过校验')
    dependency_ok: bool | None = Field(default=None, alias='dependencyOk', description='软件包依赖是否满足要求')
    plugin_dependency_ok: bool | None = Field(
        default=None, alias='pluginDependencyOk', description='依赖的其他插件是否满足要求'
    )
    structure_ok: bool | None = Field(default=None, alias='structureOk', description='插件文件结构是否通过校验')
    menu_conflict_ok: bool | None = Field(default=None, alias='menuConflictOk', description='插件是否通过菜单冲突检查')
    dependencies: list[dict[str, object]] | None = Field(default=None, description='软件包依赖及其检查结果')
    plugin_dependencies: list[dict[str, object]] | None = Field(
        default=None, alias='pluginDependencies', description='插件之间的依赖及其状态'
    )
    plugin_dependency_errors: list[dict[str, object]] | None = Field(
        default=None, alias='pluginDependencyErrors', description='插件之间的依赖检查错误'
    )
    manifest_issues: list[dict[str, object]] | None = Field(
        default=None, alias='manifestIssues', description='插件清单中的错误'
    )
    manifest_warnings: list[dict[str, object]] | None = Field(
        default=None, alias='manifestWarnings', description='插件清单中的警告'
    )
    structure: list[dict[str, object]] | None = Field(default=None, description='插件目录结构检查结果')
    missing_dependencies: list[str] | None = Field(
        default=None, alias='missingDependencies', description='尚未安装的依赖'
    )
    unsatisfied_dependencies: list[str] | None = Field(
        default=None, alias='unsatisfiedDependencies', description='已安装但不满足版本要求的依赖'
    )
    structure_errors: list[dict[str, object]] | None = Field(
        default=None, alias='structureErrors', description='插件目录或文件结构检查错误'
    )
    menu_conflicts: list[dict[str, object]] | None = Field(
        default=None, alias='menuConflicts', description='检测到的菜单冲突'
    )


class PluginCheckPayload(PluginPayloadModel):
    """插件检查聚合 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    count: int = Field(description='结果条数')
    database_available: bool = Field(alias='databaseAvailable', description='数据库是否可用')
    database_error: str | None = Field(alias='databaseError', description='数据库访问失败的原因')
    checks: list[dict[str, object]] = Field(description='各插件的检查结果')


DependencyItemPayloadDict: TypeAlias = dict[str, object]
PluginDependencyItemPayloadDict: TypeAlias = dict[str, object]
ValidationIssuePayloadDict: TypeAlias = dict[str, object]
StructureItemPayloadDict: TypeAlias = dict[str, object]
MenuConflictItemPayloadDict: TypeAlias = dict[str, object]
PluginDependencyCheckPayloadDict: TypeAlias = dict[str, object]
PluginCheckItemPayloadDict: TypeAlias = dict[str, object]
PluginCheckPayloadDict: TypeAlias = dict[str, object]


class PluginValidationPayloadBuilderProtocol(Protocol):
    """插件校验 payload builder 协议。"""

    @staticmethod
    def build_dependency_item(item: DependencyCheckItem) -> DependencyItemPayloadDict:
        """
        构建依赖检查项负载。

        :param item: 依赖检查项
        :return: 依赖检查项负载
        """
        ...

    @staticmethod
    def build_plugin_dependency_item(item: PluginDependencyCheckItem) -> PluginDependencyItemPayloadDict:
        """
        构建插件间依赖检查项负载。

        :param item: 插件间依赖检查项
        :return: 插件间依赖检查项负载
        """
        ...

    @staticmethod
    def build_validation_issue(item: PluginValidationIssue) -> ValidationIssuePayloadDict:
        """
        构建统一校验问题项负载。

        :param item: 统一校验问题项
        :return: 统一校验问题项负载
        """
        ...

    @staticmethod
    def build_structure_item(item: PluginStructureCheckItem) -> StructureItemPayloadDict:
        """
        构建结构检查项负载。

        :param item: 结构检查项
        :return: 结构检查项负载
        """
        ...

    @staticmethod
    def build_menu_conflict_item(item: PluginMenuConflictItem) -> MenuConflictItemPayloadDict:
        """
        构建菜单冲突检查项负载。

        :param item: 菜单冲突检查项
        :return: 菜单冲突检查项负载
        """
        ...


class PluginCheckPrecheckProtocol(Protocol):
    """
    插件检查单项所需的预检上下文协议。

    :ivar ok: 操作或检查是否成功
    """

    ok: bool

    @property
    def check_payload(self) -> Mapping[str, object]:
        """
        获取插件检查命令通用负载片段。

        :return: 插件检查命令通用负载片段
        """
        ...


class PluginValidationPayloadMixin:
    """插件依赖、结构、manifest 和菜单冲突检查结果负载构建能力。"""

    @staticmethod
    def build_dependency_item(item: DependencyCheckItem) -> DependencyItemPayloadDict:
        """
        构建依赖检查项负载。

        :param item: 依赖检查项
        :return: 依赖检查项负载
        """
        return DependencyItemPayload(
            kind=item.kind,
            requirement=item.requirement,
            name=item.name,
            installed=item.installed,
            version_satisfied=item.version_satisfied,
            installed_version=item.installed_version,
            declared_version=item.declared_version,
            required_version=item.required_version,
            ok=item.ok,
            status=item.status,
            level=PluginValidationLevelResolver.from_ok(item.ok),
            message=item.message,
        ).to_payload()

    @staticmethod
    def build_plugin_dependency_item(item: PluginDependencyCheckItem) -> PluginDependencyItemPayloadDict:
        """
        构建插件间依赖检查项负载。

        :param item: 插件间依赖检查项
        :return: 插件间依赖检查项负载
        """
        return PluginDependencyItemPayload(
            plugin_id=item.plugin_id,
            dependency_id=item.dependency_id,
            required_version=item.required_version,
            installed_version=item.installed_version,
            status=item.status,
            ok=item.ok,
            level=PluginValidationLevelResolver.from_ok(item.ok),
            message=item.message,
        ).to_payload()

    @staticmethod
    def build_validation_issue(item: PluginValidationIssue) -> ValidationIssuePayloadDict:
        """
        构建统一校验问题项负载。

        :param item: 统一校验问题项
        :return: 统一校验问题项负载
        """
        return ValidationIssuePayload(
            level=item.level,
            category=item.category,
            kind=item.kind,
            path=item.path,
            ok=item.ok,
            message=item.message,
            suggestion=item.suggestion,
        ).to_payload()

    @staticmethod
    def build_structure_item(item: PluginStructureCheckItem) -> StructureItemPayloadDict:
        """
        构建结构检查项负载。

        :param item: 结构检查项
        :return: 结构检查项负载
        """
        return StructureItemPayload(
            kind=item.kind,
            path=item.path,
            ok=item.ok,
            level=item.level,
            message=item.message,
            suggestion=item.suggestion,
        ).to_payload()

    @staticmethod
    def build_menu_conflict_item(item: PluginMenuConflictItem) -> MenuConflictItemPayloadDict:
        """
        构建菜单冲突检查项负载。

        :param item: 菜单冲突检查项
        :return: 菜单冲突检查项负载
        """
        return MenuConflictItemPayload(
            kind=item.kind,
            plugin_id=item.plugin_id,
            conflict_plugin_id=item.conflict_plugin_id,
            value=item.value,
            ok=False,
            level='error',
            message=item.message,
        ).to_payload()

    @classmethod
    def build_dependency_check_payload(
        cls,
        plugin_id: str,
        dependency_result: DependencyCheckResult,
    ) -> PluginDependencyCheckPayloadDict:
        """
        构建插件依赖检查负载。

        :param plugin_id: 插件ID
        :param dependency_result: 依赖检查结果
        :return: 插件依赖检查负载
        """
        return PluginDependencyCheckPayload(
            ok=dependency_result.ok,
            message='插件依赖已满足' if dependency_result.ok else '插件依赖存在问题',
            plugin_id=plugin_id,
            dependency_ok=dependency_result.ok,
            dependencies=[cls.build_dependency_item(item) for item in dependency_result.items],
            missing_dependencies=[item.name for item in dependency_result.missing_items],
            unsatisfied_dependencies=[item.name for item in dependency_result.unsatisfied_items],
        ).to_payload()

    @staticmethod
    def build_check_item(plugin_id: str, precheck: PluginCheckPrecheckProtocol) -> PluginCheckItemPayloadDict:
        """
        构建插件检查单项负载。

        :param plugin_id: 插件ID
        :param precheck: 插件操作预检上下文
        :return: 插件检查单项负载
        """
        return PluginCheckItemPayload.model_validate(
            {
                'pluginId': plugin_id,
                'ok': precheck.ok,
                **precheck.check_payload,
            }
        ).to_payload(exclude_none=True)

    @staticmethod
    def build_check_payload(
        checks: list[PluginCheckItemPayloadDict],
        database_error: str | None = None,
    ) -> PluginCheckPayloadDict:
        """
        构建插件检查聚合负载。

        :param checks: 插件检查单项负载列表
        :param database_error: 数据库状态读取错误
        :return: 插件检查聚合负载
        """
        ok = all(check['ok'] for check in checks)
        return PluginCheckPayload(
            ok=ok,
            message='插件检查通过' if ok else '插件检查存在问题',
            count=len(checks),
            database_available=database_error is None,
            database_error=database_error,
            checks=checks,
        ).to_payload()
