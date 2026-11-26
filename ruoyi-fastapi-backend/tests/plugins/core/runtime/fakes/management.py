from dataclasses import dataclass
from pathlib import Path

from common.vo import CrudResponseModel
from plugins.core.discovery.scanner import DiscoveredPlugin
from plugins.core.lifecycle.purge import PluginPurgePlan, PluginPurgePlanner
from plugins.core.management.entity.vo.schemas import (
    PluginConfigModel,
    PluginConfigUpdateModel,
    PluginConfigValueModel,
    PluginMigrationModel,
    PluginModel,
    PluginOperationLogDetailModel,
    PluginOperationLogExportQueryModel,
)
from plugins.core.validation.menus import PluginMenuConflictItem


@dataclass
class RecordedPluginOperation:
    """
    内存审计记录，保留测试中提交的原始操作结果。

    :ivar payload: 提交给审计服务的操作结果
    :ivar dry_run: 操作是否为预演
    :ivar continue_on_error: 单项失败后是否继续执行
    """

    payload: dict[str, object]
    dry_run: bool
    continue_on_error: bool


class FakePluginService:
    """
    测试用插件服务。

    :cvar upsert_called: 记录 ``upsert`` 的调用情况
    :cvar upsert_backend_root: 最近一次更新插件时记录的后端目录
    :cvar upsert_frontend_root: 最近一次更新插件时记录的前端目录
    :cvar install_plugin_menu_called_with: 调用 ``install_plugin_menu`` 时记录的参数
    :cvar install_plugin_job_called_with: 调用 ``install_plugin_job`` 时记录的参数
    :cvar install_config_called: 记录 ``install_config`` 的调用情况
    :cvar mark_installed_called: 记录 ``mark_installed`` 的调用情况
    :cvar mark_uninstalled_called_with: 调用 ``mark_uninstalled`` 时记录的参数
    :cvar purge_called: 记录 ``purge`` 的调用情况
    :cvar purge_by_id_called_with: 调用 ``purge_by_id`` 时记录的参数
    :cvar update_enabled_called_with: 调用 ``update_enabled`` 时记录的参数
    :cvar detail_plugin: 查询详情时返回的测试插件
    :cvar upsert_plugin: 最近一次插入或更新的插件
    :cvar installed_menu_conflicts: 已安装菜单冲突列表
    :cvar migration_checksums: 按迁移名称记录的校验和
    :cvar migration_records: 测试中保存的迁移执行记录
    :cvar operation_logs: 审计记录列表
    :cvar plugin_list: 测试仓储返回的插件列表
    :cvar marked_errors: 已标记为失败的记录及原因
    """

    upsert_called = False
    upsert_backend_root: Path | None = None
    upsert_frontend_root: Path | None = None
    install_plugin_menu_called_with: tuple[str, bool] | None = None
    install_plugin_job_called_with: tuple[str, bool] | None = None
    install_config_called = False
    mark_installed_called = False
    mark_uninstalled_called_with: str | None = None
    purge_called = False
    purge_by_id_called_with: str | None = None
    update_enabled_called_with: tuple[str, bool, DiscoveredPlugin | None] | None = None
    detail_plugin: PluginModel | None = None
    upsert_plugin: PluginModel | None = None
    installed_menu_conflicts: list[PluginMenuConflictItem] = []
    migration_checksums: dict[tuple[str, str], str] = {}
    migration_records: list[PluginMigrationModel] = []
    operation_logs: list[RecordedPluginOperation] = []
    plugin_list: list[PluginModel] = []
    marked_errors: list[tuple[str, str]] = []

    @classmethod
    def reset(cls) -> None:
        """重置调用记录。"""
        cls.upsert_called = False
        cls.upsert_backend_root = None
        cls.upsert_frontend_root = None
        cls.install_plugin_menu_called_with = None
        cls.install_plugin_job_called_with = None
        cls.install_config_called = False
        cls.mark_installed_called = False
        cls.mark_uninstalled_called_with = None
        cls.purge_called = False
        cls.purge_by_id_called_with = None
        cls.update_enabled_called_with = None
        cls.detail_plugin = None
        cls.upsert_plugin = None
        cls.installed_menu_conflicts = []
        cls.migration_checksums = {}
        cls.migration_records = []
        cls.operation_logs = []
        cls.plugin_list = []
        cls.marked_errors = []

    @classmethod
    async def get_plugin_list_services(cls, query_db: object) -> list[PluginModel]:
        """
        读取测试用插件列表。

        :param query_db: 当前操作使用的异步数据库会话
        :return: 测试用插件列表
        """
        return cls.plugin_list

    @classmethod
    async def plugin_detail_services(cls, query_db: object, plugin_id: str) -> PluginModel | None:
        """
        读取测试插件详情。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :return: 测试插件详情
        """
        return cls.detail_plugin

    @classmethod
    async def upsert_discovered_plugin_services(
        cls,
        query_db: object,
        discovered_plugin: DiscoveredPlugin,
        backend_root: Path,
        frontend_root: Path | None = None,
    ) -> PluginModel:
        """
        记录插件写入调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :param backend_root: 后端项目的根目录
        :param frontend_root: 前端项目的根目录
        :return: 测试服务记录的插件写入结果
        """
        cls.upsert_called = True
        cls.upsert_backend_root = backend_root
        cls.upsert_frontend_root = frontend_root
        if cls.upsert_plugin:
            return cls.upsert_plugin
        return PluginModel(
            plugin_id=discovered_plugin.manifest.id,
            installed_version=discovered_plugin.manifest.version,
            enabled='0',
            status='installed',
        )

    @classmethod
    async def check_installed_menu_conflict_services(
        cls,
        query_db: object,
        discovered_plugin: DiscoveredPlugin,
    ) -> list[PluginMenuConflictItem]:
        """
        读取测试用已安装菜单冲突。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: 测试用已安装菜单冲突
        """
        return cls.installed_menu_conflicts

    @classmethod
    async def get_plugin_migration_services(
        cls,
        query_db: object,
        plugin_id: str,
        migration_path: str,
    ) -> PluginMigrationModel | None:
        """
        读取测试用插件 migration 执行历史。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param migration_path: migration 相对路径
        :return: 测试用插件 migration 执行历史
        """
        for migration in reversed(cls.migration_records):
            if migration.plugin_id == plugin_id and migration.migration_path == migration_path:
                return migration

        checksum = cls.migration_checksums.get((plugin_id, migration_path))
        if not checksum:
            return None

        return PluginMigrationModel(plugin_id=plugin_id, migration_path=migration_path, migration_checksum=checksum)

    @classmethod
    async def get_plugin_migration_list_services(
        cls,
        query_db: object,
        plugin_id: str,
        status: str | None = None,
    ) -> list[PluginMigrationModel]:
        """
        读取测试用插件 migration 执行历史列表。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param status: 操作或记录所处的状态
        :return: 测试用插件 migration 执行历史列表
        """
        return [
            migration
            for migration in cls.migration_records
            if migration.plugin_id == plugin_id and (not status or migration.status == status)
        ]

    @classmethod
    async def add_plugin_migration_services(
        cls,
        query_db: object,
        plugin_migration: PluginMigrationModel,
    ) -> PluginMigrationModel:
        """
        记录插件 migration 执行历史。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_migration: 插件清单中的迁移声明
        :return: 插件清单中的迁移声明
        """
        cls.migration_records.append(plugin_migration)
        return plugin_migration

    @classmethod
    async def mark_plugin_migration_status_services(
        cls,
        query_db: object,
        plugin_id: str,
        migration_path: str,
        status: str,
        error_message: str | None = None,
    ) -> PluginMigrationModel | None:
        """
        人工标记测试用插件 migration 执行历史状态。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param migration_path: migration 相对路径
        :param status: 操作或记录所处的状态
        :param error_message: 记录到结果或审计日志中的错误详情
        :return: 插件的数据迁移配置
        """
        for migration in reversed(cls.migration_records):
            if migration.plugin_id == plugin_id and migration.migration_path == migration_path:
                migration.status = status
                migration.error_message = error_message
                return migration

        return None

    @classmethod
    async def add_plugin_operation_log_services(
        cls,
        query_db: object,
        payload: dict[str, object],
        *,
        dry_run: bool,
        continue_on_error: bool,
    ) -> RecordedPluginOperation:
        """
        记录测试用插件批量操作审计日志。

        :param query_db: 当前操作使用的异步数据库会话
        :param payload: 随调用传入或返回的结构化数据
        :param dry_run: 是否只预览操作结果
        :param continue_on_error: 单项操作失败后是否继续执行
        :return: 供调用方使用的 ``operation_log``
        """
        operation_log = RecordedPluginOperation(
            payload=payload,
            dry_run=dry_run,
            continue_on_error=continue_on_error,
        )
        cls.operation_logs.append(operation_log)

        return operation_log

    @classmethod
    async def get_plugin_operation_log_export_list_services(
        cls,
        query_db: object,
        query_object: PluginOperationLogExportQueryModel,
    ) -> list[PluginOperationLogDetailModel]:
        """
        读取测试用插件操作审计导出列表。

        :param query_db: 当前操作使用的异步数据库会话
        :param query_object: 用于过滤记录的查询模型
        :return: 测试用插件操作审计导出列表
        """
        return [
            PluginOperationLogDetailModel.model_validate(
                {
                    'operation_id': index + 1,
                    'operation': operation_log.payload.get('operation', 'unknown'),
                    'plugin_ids': [operation_log.payload.get('pluginId', '-')],
                    'dry_run': operation_log.dry_run,
                    'continue_on_error': operation_log.continue_on_error,
                    'status': 'success' if operation_log.payload.get('ok') else 'failed',
                    'summary': operation_log.payload.get('summary', {}),
                    'remark': operation_log.payload.get('message'),
                }
            )
            for index, operation_log in enumerate(cls.operation_logs)
        ]

    @classmethod
    async def install_plugin_menu_services(
        cls,
        query_db: object,
        discovered_plugin: DiscoveredPlugin,
        *,
        enabled: bool,
    ) -> None:
        """
        记录指定插件菜单安装调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :param enabled: 是否启用该项功能
        """
        cls.install_plugin_menu_called_with = (discovered_plugin.manifest.id, enabled)

    @classmethod
    async def install_plugin_default_config_services(
        cls,
        query_db: object,
        discovered_plugin: DiscoveredPlugin,
    ) -> list[PluginConfigModel]:
        """
        记录插件默认配置安装调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: 供调用方使用的 ``configs``
        """
        cls.install_config_called = True
        return [
            PluginConfigModel(plugin_id=discovered_plugin.manifest.id, config_key=item.key)
            for item in discovered_plugin.manifest.config.items
        ]

    @classmethod
    async def install_plugin_job_services(
        cls,
        query_db: object,
        discovered_plugin: DiscoveredPlugin,
        *,
        enabled: bool,
    ) -> None:
        """
        记录插件任务同步调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :param enabled: 是否启用该项功能
        """
        cls.install_plugin_job_called_with = (discovered_plugin.manifest.id, enabled)

    @classmethod
    async def is_plugin_installed_services(cls, query_db: object, plugin_id: str) -> bool:
        """
        根据内存中的安装记录判断插件是否已安装。

        :param query_db: 当前操作使用的测试会话
        :param plugin_id: 插件标识
        :return: 是否存在带有安装版本的匹配记录
        """
        return any(plugin.plugin_id == plugin_id and plugin.installed_version for plugin in cls.plugin_list)

    @classmethod
    async def get_plugin_config_services(
        cls,
        query_db: object,
        discovered_plugin: DiscoveredPlugin,
        *,
        reveal_secret: bool = False,
    ) -> list[PluginConfigValueModel]:
        """
        读取测试用插件配置。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :param reveal_secret: 是否在返回结果中显示敏感值
        :return: 测试用插件配置
        """
        configs = []
        for item in discovered_plugin.manifest.config.items:
            value = '******' if item.secret and not reveal_secret else item.default
            configs.append(
                PluginConfigValueModel(
                    key=item.key,
                    value=value,
                    default=value,
                    secret=item.secret,
                    group=item.group,
                    order=item.order,
                    placeholder=item.placeholder,
                    min=item.min_value,
                    max=item.max_value,
                    pattern=item.pattern,
                )
            )

        return configs

    @classmethod
    async def update_plugin_config_services(
        cls,
        query_db: object,
        discovered_plugin: DiscoveredPlugin,
        update_model: PluginConfigUpdateModel,
    ) -> list[PluginConfigValueModel]:
        """
        更新测试用插件配置。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :param update_model: 包含待更新字段的模型
        :return: 供调用方使用的 ``configs``
        """
        return [PluginConfigValueModel(key=key, value=value) for key, value in update_model.values.items()]

    @classmethod
    async def mark_plugin_installed_services(
        cls,
        query_db: object,
        discovered_plugin: DiscoveredPlugin,
    ) -> PluginModel:
        """
        记录插件安装完成标记调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: 操作完成后记录的结果
        """
        cls.mark_installed_called = True
        cls.plugin_list = [
            plugin for plugin in cls.plugin_list if getattr(plugin, 'plugin_id', None) != discovered_plugin.manifest.id
        ]
        installed = PluginModel(
            plugin_id=discovered_plugin.manifest.id,
            installed_version=discovered_plugin.manifest.version,
            enabled='0',
            status='installed',
        )
        cls.plugin_list.append(installed)
        return installed

    @classmethod
    async def update_plugin_enabled_services(
        cls,
        query_db: object,
        plugin_id: str,
        enabled: bool,
        discovered_plugin: DiscoveredPlugin | None = None,
    ) -> CrudResponseModel:
        """
        记录插件启停调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param enabled: 是否启用该项功能
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: 操作完成后记录的结果
        """
        cls.update_enabled_called_with = (plugin_id, enabled, discovered_plugin)
        return CrudResponseModel(is_success=True, message='启用成功' if enabled else '停用成功')

    @classmethod
    async def mark_plugin_uninstalled_services(cls, query_db: object, plugin_id: str) -> CrudResponseModel:
        """
        记录插件卸载标记调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :return: 操作完成后记录的结果
        """
        cls.mark_uninstalled_called_with = plugin_id
        return CrudResponseModel(is_success=True, message='卸载成功')

    @classmethod
    async def mark_plugin_error_services(
        cls,
        query_db: object,
        plugin_id: str,
        error_message: str,
    ) -> CrudResponseModel:
        """
        记录插件错误状态标记调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param error_message: 记录到结果或审计日志中的错误详情
        :return: 操作完成后记录的结果
        """
        cls.marked_errors.append((plugin_id, error_message))

        return CrudResponseModel(is_success=True, message='插件状态已标记为异常')

    @classmethod
    async def build_plugin_purge_plan_services(
        cls, query_db: object, discovered_plugin: DiscoveredPlugin
    ) -> PluginPurgePlan:
        """
        构建测试用插件物理清理计划。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: 测试用插件物理清理计划
        """
        return PluginPurgePlanner.build_plan(
            discovered_plugin,
            menu_count=1,
            config_count=2,
            migration_count=3,
            job_count=4,
        )

    @classmethod
    async def purge_plugin_services(cls, query_db: object, discovered_plugin: DiscoveredPlugin) -> PluginPurgePlan:
        """
        记录插件物理清理调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: 供断言比对的插件清理计划
        """
        cls.purge_called = True
        return await cls.build_plugin_purge_plan_services(query_db, discovered_plugin)

    @classmethod
    async def build_plugin_purge_plan_by_id_services(cls, query_db: object, plugin_id: str) -> PluginPurgePlan:
        """
        构建测试用孤儿插件元数据清理计划。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :return: 测试用孤儿插件元数据清理计划
        """
        return PluginPurgePlanner.build_metadata_plan(
            plugin_id,
            state_count=1,
            menu_count=1,
            config_count=2,
            migration_count=3,
            job_count=4,
        )

    @classmethod
    async def purge_plugin_metadata_by_id_services(cls, query_db: object, plugin_id: str) -> PluginPurgePlan:
        """
        记录按插件 ID 清理孤儿元数据调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :return: 供断言比对的孤立元数据清理计划
        """
        cls.purge_by_id_called_with = plugin_id
        return await cls.build_plugin_purge_plan_by_id_services(query_db, plugin_id)
