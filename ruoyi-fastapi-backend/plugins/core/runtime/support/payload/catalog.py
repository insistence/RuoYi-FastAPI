from typing import TypeAlias

from pydantic import Field

from plugins.core.discovery.registry import RegisteredPlugin
from plugins.core.discovery.scanner import DiscoveredPlugin
from plugins.core.manifest.menu_tree import PluginMenuTree
from plugins.core.manifest.schema import (
    PluginConfigItemManifest,
    PluginMenuManifest,
    PluginPermissionManifest,
)
from plugins.core.manifest.v2 import VersionedPluginJobManifest
from plugins.core.types import PluginStateRecord, SupportsToPayload
from plugins.core.validation.dependencies import DependencyCheckItem

from .base import PluginPayloadModel
from .validation import PluginValidationPayloadMixin


class PluginCatalogSummaryPayload(PluginPayloadModel):
    """插件目录摘要 payload。"""

    plugin_id: str = Field(alias='pluginId', description='插件标识')
    name: str = Field(description='插件名称')
    version: str = Field(description='插件版本')
    enabled: bool = Field(description='是否启用')
    status: str = Field(description='当前状态')
    description: str = Field(description='插件功能说明')
    backend_path: str = Field(alias='backendPath', description='插件后端所在路径')
    menu_count: int = Field(alias='menuCount', description='插件菜单数')
    permission_count: int = Field(alias='permissionCount', description='插件权限数')
    capability: dict[str, object] | None = Field(description='当前环境对该操作的支持情况')


class PluginCatalogDatabaseStatePayload(PluginPayloadModel):
    """插件目录数据库状态 payload。"""

    available: bool = Field(description='数据是否可用')
    installed: bool = Field(description='是否已经安装')
    error: str | None = Field(default=None, description='失败原因')
    installed_version: str | None = Field(default=None, alias='installedVersion', description='已安装的版本')
    enabled: str | None = Field(description='是否启用')
    status: str | None = Field(description='当前状态')
    last_error: str | None = Field(default=None, alias='lastError', description='最近一次错误的信息')


class PluginManifestConfigItemPayload(PluginPayloadModel):
    """manifest 配置声明 payload。"""

    key: str = Field(description='配置项的键')
    label: str | None = Field(description='面向用户的显示名称')
    type: str = Field(description='配置项的数据类型')
    default: object = Field(description='配置项的默认值')
    required: bool = Field(description='是否为必填配置')
    secret: bool = Field(description='是否包含敏感值')
    group: str = Field(description='配置项所属分组')
    order: int = Field(description='排列顺序')
    placeholder: str = Field(description='输入配置值时显示的提示')
    min_value: float | None = Field(alias='min', description='允许的最小数值')
    max_value: float | None = Field(alias='max', description='允许的最大数值')
    pattern: str | None = Field(description='配置值必须匹配的正则表达式')
    description: str = Field(description='配置项的用途说明')
    options: list[dict[str, object]] = Field(description='可供选择的配置值及标签')


class PluginManifestPermissionItemPayload(PluginPayloadModel):
    """manifest 权限声明 payload。"""

    code: str = Field(description='权限标识')
    name: str | None = Field(description='权限名称')
    description: str = Field(description='权限允许执行的操作')


class PluginMenuDiagnosticPlanItemPayload(PluginPayloadModel):
    """菜单诊断计划项 payload。"""

    name: str = Field(description='菜单名称')
    path: str = Field(description='菜单路由路径')
    component: str = Field(description='菜单对应的前端组件')
    perms: str = Field(description='访问菜单所需的权限码')
    type: str = Field(description='菜单类型')
    query: str | None = Field(description='菜单路由的查询参数')
    route_name: str | None = Field(alias='routeName', description='前端路由名称')
    is_frame: int = Field(alias='isFrame', description='菜单的外链标志')
    is_cache: int = Field(alias='isCache', description='页面缓存标志')
    visible: str = Field(description='菜单显示状态')
    status: str = Field(description='当前状态')
    children: int = Field(description='直接子菜单的数量')


class PluginMenuDiagnosticPlanPayload(PluginPayloadModel):
    """菜单诊断计划 payload。"""

    total: int = Field(description='条目总数')
    permission_count: int = Field(alias='permissionCount', description='插件权限数')
    enabled_count: int = Field(alias='enabledCount', description='已启用的条目数')
    visible_count: int = Field(alias='visibleCount', description='可见条目数')
    items: list[dict[str, object]] = Field(description='结果条目列表')


class PluginManifestJobItemPayload(PluginPayloadModel):
    """manifest 定时任务声明 payload。"""

    id: str = Field(description='调度任务标识')
    name: str | None = Field(description='调度任务名称')
    callable: str = Field(description='调度任务调用的函数路径')
    trigger: str = Field(description='调度触发器类型')
    cron_expression: str = Field(alias='cronExpression', description='调度使用的 Cron 表达式')
    time_zone: str = Field(alias='timeZone', description='解析调度时间的时区')
    args: list[object] = Field(description='传给任务的位置参数')
    kwargs: dict[str, object] = Field(description='传给任务的关键字参数')
    enabled: bool = Field(description='是否启用')
    description: str = Field(description='调度任务的用途说明')
    misfire_grace_time: int | None = Field(alias='misfireGraceTime', description='错过计划时间后仍允许执行的宽限秒数')
    coalesce: bool = Field(description='是否合并积压的任务执行')
    max_instances: int = Field(alias='maxInstances', description='同一任务允许同时运行的最大实例数')
    job_store: str = Field(alias='jobStore', description='保存任务定义的调度存储')
    executor: str = Field(description='调度任务使用的执行器')


PluginCatalogSummaryPayloadDict: TypeAlias = dict[str, object]
PluginCatalogDatabaseStatePayloadDict: TypeAlias = dict[str, object]


class PluginCatalogPayloadMixin:
    """插件目录、详情和 manifest 基础信息负载构建能力。"""

    @classmethod
    def build_plugin_list_payload(cls, plugins: list[RegisteredPlugin]) -> dict[str, object]:
        """
        构建插件列表负载。

        :param plugins: 已注册插件列表
        :return: 插件列表负载
        """
        plugin_items = [
            cls.build_plugin_summary(plugin.discovered_plugin, plugin.enabled, plugin.status) for plugin in plugins
        ]
        return {'ok': True, 'count': len(plugin_items), 'plugins': plugin_items}

    @classmethod
    def build_plugin_info_payload(
        cls,
        plugin: RegisteredPlugin | DiscoveredPlugin,
        dependency_items: list[DependencyCheckItem],
        *,
        database_error: str | None = None,
        capability: SupportsToPayload | None = None,
    ) -> dict[str, object]:
        """
        构建插件详情响应负载。

        :param capability: 插件运行时管理能力及操作限制
        :param plugin: 已注册插件运行时快照或已发现插件
        :param dependency_items: 依赖检查项列表
        :param database_error: 数据库状态读取错误信息
        :return: 插件详情响应负载
        """
        return {
            'ok': True,
            'plugin': cls.build_plugin_detail(
                plugin,
                dependency_items,
                database_error=database_error,
                capability=capability,
            ),
        }

    @classmethod
    def build_plugin_summary(
        cls,
        plugin: DiscoveredPlugin,
        enabled: bool,
        status: str,
        capability: SupportsToPayload | None = None,
    ) -> PluginCatalogSummaryPayloadDict:
        """
        构建插件摘要负载。

        :param capability: 插件运行时管理能力及操作限制
        :param plugin: 已发现插件
        :param enabled: 是否启用
        :param status: 插件状态
        :return: 插件摘要负载
        """
        manifest = plugin.manifest
        return PluginCatalogSummaryPayload(
            plugin_id=manifest.id,
            name=manifest.name,
            version=manifest.version,
            enabled=enabled,
            status=status,
            description=manifest.description,
            backend_path=str(plugin.backend_path),
            menu_count=PluginMenuTree.count(manifest.frontend.menus),
            permission_count=len(manifest.permissions),
            capability=capability.to_payload() if capability else None,
        ).to_payload()

    @classmethod
    def build_plugin_detail(
        cls,
        plugin: RegisteredPlugin | DiscoveredPlugin,
        dependency_items: list[DependencyCheckItem],
        *,
        database_error: str | None = None,
        capability: SupportsToPayload | None = None,
    ) -> dict[str, object]:
        """
        构建插件详情负载。

        :param plugin: 已注册插件运行时快照或已发现插件
        :param dependency_items: 依赖检查项列表
        :param database_error: 数据库状态读取错误信息
        :param capability: 插件运行时管理能力及操作限制
        :return: 插件详情负载
        """
        discovered_plugin = plugin.discovered_plugin if isinstance(plugin, RegisteredPlugin) else plugin
        database_plugin = plugin.database_plugin if isinstance(plugin, RegisteredPlugin) else None
        enabled = plugin.enabled if isinstance(plugin, RegisteredPlugin) else False
        status = plugin.status if isinstance(plugin, RegisteredPlugin) else 'discovered'
        manifest = discovered_plugin.manifest
        installed_version = getattr(database_plugin, 'installed_version', None)
        last_error = getattr(database_plugin, 'last_error', None)
        source = getattr(database_plugin, 'source', None) or 'local'
        frontend_path = getattr(database_plugin, 'frontend_path', None)

        return {
            **cls.build_plugin_summary(discovered_plugin, enabled, status, capability=capability),
            'installedVersion': installed_version,
            'source': source,
            'lastError': last_error,
            'frontendPath': frontend_path,
            'database': cls.build_database_state(database_plugin, database_error),
            'backend': {
                'module': manifest.backend.module,
                'manifestVersion': manifest.manifest_version,
                'runtime': manifest.runtime_kind,
                'integration': manifest.integration_kind,
                'entrypoint': getattr(manifest.backend, 'entrypoint', None),
                'mountPath': getattr(getattr(manifest.backend, 'asgi', None), 'mount_path', None),
                'autoScanRouters': manifest.backend.routers.auto_scan,
                'migrations': manifest.backend.migrations,
                'seeds': manifest.backend.seeds,
                'jobs': [cls.build_manifest_job_item(job) for job in manifest.backend.jobs],
            },
            'frontend': {
                'pluginId': manifest.frontend.plugin_id,
                'basePath': manifest.frontend.base_path,
                'viewsPath': manifest.frontend.views_path,
                'apiPath': manifest.frontend.api_path,
                'delivery': {
                    'type': manifest.frontend.delivery.type,
                    'buildRequired': manifest.frontend.delivery.build_required,
                },
            },
            'permissions': cls.build_manifest_permission_items(manifest.permissions),
            'config': cls.build_manifest_config_items(manifest.config.items),
            'pluginDependencies': [
                {
                    'id': dependency.id,
                    'version': dependency.version,
                    'description': dependency.description,
                }
                for dependency in manifest.dependencies.plugins
            ],
            'dependencies': [PluginValidationPayloadMixin.build_dependency_item(item) for item in dependency_items],
        }

    @staticmethod
    def build_manifest_permission_items(
        permissions: list[PluginPermissionManifest],
    ) -> list[dict[str, object]]:
        """
        构建 manifest 权限声明 payload。

        :param permissions: 权限声明列表
        :return: 权限声明 payload 列表
        """
        return [
            PluginManifestPermissionItemPayload(
                code=permission.code,
                name=permission.name,
                description=permission.description,
            ).to_payload()
            for permission in permissions
        ]

    @staticmethod
    def build_manifest_config_items(
        config_items: list[PluginConfigItemManifest],
    ) -> list[dict[str, object]]:
        """
        构建 manifest 配置声明负载。

        :param config_items: manifest 配置项声明列表
        :return: 配置声明负载列表
        """
        return [
            PluginManifestConfigItemPayload(
                key=item.key,
                label=item.label,
                type=item.type,
                default=item.default,
                required=item.required,
                secret=item.secret,
                group=item.group,
                order=item.order,
                placeholder=item.placeholder,
                min_value=item.min_value,
                max_value=item.max_value,
                pattern=item.pattern,
                description=item.description,
                options=[option.model_dump() for option in item.options],
            ).to_payload()
            for item in config_items
        ]

    @classmethod
    def build_menu_diagnostic_plan(cls, discovered_plugin: DiscoveredPlugin) -> dict[str, object]:
        """
        构建插件菜单诊断计划。

        :param discovered_plugin: 已发现插件
        :return: 菜单诊断计划负载
        """
        menus = PluginMenuTree.flatten(discovered_plugin.manifest.frontend.menus)
        permission_menus = [menu for menu in menus if menu.perms]
        enabled_menus = [menu for menu in menus if menu.status == '0']
        visible_menus = [menu for menu in menus if menu.visible == '0']

        return PluginMenuDiagnosticPlanPayload(
            total=len(menus),
            permission_count=len(permission_menus),
            enabled_count=len(enabled_menus),
            visible_count=len(visible_menus),
            items=[cls._build_menu_plan_item(menu) for menu in menus],
        ).to_payload()

    @classmethod
    def _build_menu_plan_item(cls, menu: PluginMenuManifest) -> dict[str, object]:
        """
        构建菜单诊断计划项。

        :param menu: 插件菜单声明
        :return: 菜单诊断计划项
        """
        return PluginMenuDiagnosticPlanItemPayload(
            name=menu.name,
            path=menu.path,
            component=menu.component,
            perms=menu.perms,
            type=menu.type,
            query=menu.query,
            route_name=menu.route_name,
            is_frame=menu.is_frame,
            is_cache=menu.is_cache,
            visible=menu.visible,
            status=menu.status,
            children=len(menu.children),
        ).to_payload()

    @staticmethod
    def build_manifest_job_item(job: VersionedPluginJobManifest) -> dict[str, object]:
        """
        构建 manifest 定时任务声明负载。

        :param job: manifest 定时任务声明
        :return: 定时任务声明负载
        """
        return PluginManifestJobItemPayload(
            id=job.id,
            name=job.name,
            callable=job.callable,
            trigger=job.trigger,
            cron_expression=job.cron_expression,
            time_zone=job.time_zone,
            args=job.args,
            kwargs=job.kwargs,
            enabled=job.enabled,
            description=job.description,
            misfire_grace_time=job.misfire_grace_time,
            coalesce=job.coalesce,
            max_instances=job.max_instances,
            job_store=job.job_store,
            executor=job.executor,
        ).to_payload()

    @staticmethod
    def build_database_state(
        database_plugin: PluginStateRecord | None,
        database_error: str | None = None,
    ) -> PluginCatalogDatabaseStatePayloadDict:
        """
        构建插件数据库状态负载。

        :param database_plugin: 数据库插件状态对象
        :param database_error: 数据库状态读取错误信息
        :return: 数据库状态负载
        """
        if database_error:
            return PluginCatalogDatabaseStatePayload(
                available=False,
                installed=False,
                error=database_error,
                enabled=None,
                status=None,
            ).to_payload(exclude_none=True)

        return PluginCatalogDatabaseStatePayload(
            available=True,
            installed=database_plugin is not None,
            installed_version=database_plugin.installed_version if database_plugin else None,
            enabled=database_plugin.enabled if database_plugin else None,
            status=database_plugin.status if database_plugin else None,
            last_error=database_plugin.last_error if database_plugin else None,
        ).to_payload()
