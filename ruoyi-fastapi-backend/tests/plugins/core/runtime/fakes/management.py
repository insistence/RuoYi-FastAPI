from pathlib import Path
from types import SimpleNamespace

from plugins.core.lifecycle.purge import PluginPurgePlanner


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
    update_enabled_called_with: tuple[str, bool, object | None] | None = None
    detail_plugin: SimpleNamespace | None = None
    upsert_plugin: SimpleNamespace | None = None
    installed_menu_conflicts: list[SimpleNamespace] = []
    migration_checksums: dict[tuple[str, str], str] = {}
    migration_records: list[object] = []
    operation_logs: list[object] = []
    plugin_list: list[SimpleNamespace] = []
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
    async def get_plugin_list_services(cls, query_db: object) -> list[SimpleNamespace]:
        """
        读取测试用插件列表。

        :param query_db: 当前操作使用的异步数据库会话
        :return: 测试用插件列表
        """
        return cls.plugin_list

    @classmethod
    async def plugin_detail_services(cls, query_db: object, plugin_id: str) -> SimpleNamespace | None:
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
        discovered_plugin: object,
        backend_root: Path,
        frontend_root: Path,
    ) -> SimpleNamespace:
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
        return SimpleNamespace(
            plugin_id=discovered_plugin.manifest.id,
            installed_version=discovered_plugin.manifest.version,
            enabled='0',
            status='installed',
            model_dump=lambda by_alias=True: {'pluginId': discovered_plugin.manifest.id},
        )

    @classmethod
    async def check_installed_menu_conflict_services(
        cls,
        query_db: object,
        discovered_plugin: object,
    ) -> list[SimpleNamespace]:
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
    ) -> SimpleNamespace | None:
        """
        读取测试用插件 migration 执行历史。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param migration_path: migration 相对路径
        :return: 测试用插件 migration 执行历史
        """
        for migration in reversed(cls.migration_records):
            if (
                getattr(migration, 'plugin_id', None) == plugin_id
                and getattr(migration, 'migration_path', None) == migration_path
            ):
                return migration

        checksum = cls.migration_checksums.get((plugin_id, migration_path))
        if not checksum:
            return None

        return SimpleNamespace(migration_checksum=checksum)

    @classmethod
    async def get_plugin_migration_list_services(
        cls,
        query_db: object,
        plugin_id: str,
        status: str | None = None,
    ) -> list[SimpleNamespace]:
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
            if getattr(migration, 'plugin_id', None) == plugin_id
            and (not status or getattr(migration, 'status', None) == status)
        ]

    @classmethod
    async def add_plugin_migration_services(
        cls,
        query_db: object,
        plugin_migration: object,
    ) -> object:
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
    ) -> object | None:
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
            if (
                getattr(migration, 'plugin_id', None) == plugin_id
                and getattr(migration, 'migration_path', None) == migration_path
            ):
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
    ) -> SimpleNamespace:
        """
        记录测试用插件批量操作审计日志。

        :param query_db: 当前操作使用的异步数据库会话
        :param payload: 随调用传入或返回的结构化数据
        :param dry_run: 是否只预览操作结果
        :param continue_on_error: 单项操作失败后是否继续执行
        :return: 供调用方使用的 ``operation_log``
        """
        operation_log = SimpleNamespace(
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
        query_object: object,
    ) -> list[SimpleNamespace]:
        """
        读取测试用插件操作审计导出列表。

        :param query_db: 当前操作使用的异步数据库会话
        :param query_object: 用于过滤记录的查询模型
        :return: 测试用插件操作审计导出列表
        """
        return [
            SimpleNamespace(
                operation_id=index + 1,
                operation=getattr(operation_log, 'payload', {}).get('operation', 'unknown'),
                plugin_ids=[getattr(operation_log, 'payload', {}).get('pluginId', '-')],
                dry_run=getattr(operation_log, 'dry_run', False),
                continue_on_error=getattr(operation_log, 'continue_on_error', False),
                status='success' if getattr(operation_log, 'payload', {}).get('ok', False) else 'failed',
                summary=getattr(operation_log, 'payload', {}).get('summary', {}),
                create_time=None,
                remark=getattr(operation_log, 'payload', {}).get('message'),
            )
            for index, operation_log in enumerate(cls.operation_logs)
        ]

    @classmethod
    async def install_plugin_menu_services(
        cls,
        query_db: object,
        discovered_plugin: object,
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
        discovered_plugin: object,
    ) -> list[SimpleNamespace]:
        """
        记录插件默认配置安装调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: 供调用方使用的 ``configs``
        """
        cls.install_config_called = True
        configs = []
        for item in discovered_plugin.manifest.config.items:
            payload = {
                'pluginId': discovered_plugin.manifest.id,
                'configKey': item.key,
            }
            configs.append(SimpleNamespace(model_dump=lambda by_alias=True, payload=payload: payload))

        return configs

    @classmethod
    async def install_plugin_job_services(
        cls,
        query_db: object,
        discovered_plugin: object,
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
    async def get_plugin_config_services(
        cls,
        query_db: object,
        discovered_plugin: object,
        *,
        reveal_secret: bool = False,
    ) -> list[SimpleNamespace]:
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
            default = '******' if item.secret and not reveal_secret else item.default
            payload = {
                'key': item.key,
                'value': value,
                'default': default,
                'secret': item.secret,
                'group': item.group,
                'order': item.order,
                'placeholder': item.placeholder,
                'min': item.min_value,
                'max': item.max_value,
                'pattern': item.pattern,
            }
            configs.append(SimpleNamespace(model_dump=lambda by_alias=True, payload=payload: payload))

        return configs

    @classmethod
    async def update_plugin_config_services(
        cls,
        query_db: object,
        discovered_plugin: object,
        update_model: object,
    ) -> list[SimpleNamespace]:
        """
        更新测试用插件配置。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :param update_model: 包含待更新字段的模型
        :return: 供调用方使用的 ``configs``
        """
        configs = []
        for key, value in update_model.values.items():
            payload = {
                'key': key,
                'value': value,
                'secret': False,
            }
            configs.append(SimpleNamespace(model_dump=lambda by_alias=True, payload=payload: payload))

        return configs

    @classmethod
    async def mark_plugin_installed_services(
        cls,
        query_db: object,
        discovered_plugin: object,
    ) -> SimpleNamespace:
        """
        记录插件安装完成标记调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: ``SimpleNamespace`` 实例
        """
        cls.mark_installed_called = True
        cls.plugin_list = [
            plugin for plugin in cls.plugin_list if getattr(plugin, 'plugin_id', None) != discovered_plugin.manifest.id
        ]
        cls.plugin_list.append(
            SimpleNamespace(
                plugin_id=discovered_plugin.manifest.id,
                installed_version=discovered_plugin.manifest.version,
                enabled='0',
                status='installed',
            )
        )
        return SimpleNamespace(
            model_dump=lambda by_alias=True: {
                'pluginId': discovered_plugin.manifest.id,
                'installedVersion': discovered_plugin.manifest.version,
                'status': 'installed',
            }
        )

    @classmethod
    async def update_plugin_enabled_services(
        cls,
        query_db: object,
        plugin_id: str,
        enabled: bool,
        discovered_plugin: object | None = None,
    ) -> SimpleNamespace:
        """
        记录插件启停调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param enabled: 是否启用该项功能
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: ``SimpleNamespace`` 实例
        """
        cls.update_enabled_called_with = (plugin_id, enabled, discovered_plugin)
        return SimpleNamespace(is_success=True, message='启用成功' if enabled else '停用成功')

    @classmethod
    async def mark_plugin_uninstalled_services(cls, query_db: object, plugin_id: str) -> SimpleNamespace:
        """
        记录插件卸载标记调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :return: ``SimpleNamespace`` 实例
        """
        cls.mark_uninstalled_called_with = plugin_id
        return SimpleNamespace(is_success=True, message='卸载成功')

    @classmethod
    async def mark_plugin_error_services(
        cls,
        query_db: object,
        plugin_id: str,
        error_message: str,
    ) -> SimpleNamespace:
        """
        记录插件错误状态标记调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :param error_message: 记录到结果或审计日志中的错误详情
        :return: ``SimpleNamespace`` 实例
        """
        cls.marked_errors.append((plugin_id, error_message))

        return SimpleNamespace(is_success=True, message='插件状态已标记为异常')

    @classmethod
    async def build_plugin_purge_plan_services(cls, query_db: object, discovered_plugin: object) -> object:
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
    async def purge_plugin_services(cls, query_db: object, discovered_plugin: object) -> object:
        """
        记录插件物理清理调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param discovered_plugin: 扫描插件目录后得到的插件描述
        :return: 供断言比对的插件清理计划
        """
        cls.purge_called = True
        return await cls.build_plugin_purge_plan_services(query_db, discovered_plugin)

    @classmethod
    async def build_plugin_purge_plan_by_id_services(cls, query_db: object, plugin_id: str) -> object:
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
    async def purge_plugin_metadata_by_id_services(cls, query_db: object, plugin_id: str) -> object:
        """
        记录按插件 ID 清理孤儿元数据调用。

        :param query_db: 当前操作使用的异步数据库会话
        :param plugin_id: 插件清单中的唯一标识
        :return: 供断言比对的孤立元数据清理计划
        """
        cls.purge_by_id_called_with = plugin_id
        return await cls.build_plugin_purge_plan_by_id_services(query_db, plugin_id)
