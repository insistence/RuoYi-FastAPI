from typing import Literal

from i18n.message import I18nMessage
from plugins.core.runtime.support import PluginRuntimePayloadBuilder

from .dependency_container import PluginRuntimeDependencies

MigrationRecoveryStatus = Literal['success', 'failed']
MIGRATION_MANUAL_TRANSITIONS: dict[MigrationRecoveryStatus, set[str]] = {
    'success': {'running', 'failed', 'unknown'},
    'failed': {'running', 'unknown'},
}


class PluginMigrationUseCase:
    """
    插件 migration 历史查询和人工恢复 use case。
    """

    def __init__(self, dependencies: PluginRuntimeDependencies) -> None:
        """
        初始化插件 migration use case。

        :param dependencies: 插件运行时依赖容器
        """
        self.dependencies = dependencies

    async def list_plugin_migrations(self, plugin_id: str, status: str | None = None) -> dict[str, object]:
        """
        查询插件 migration 历史。

        :param plugin_id: 插件ID
        :param status: 执行状态
        :return: 插件 migration 历史负载
        """
        try:
            migrations = await self.dependencies.migration_history_gateway.list_plugin_migrations(plugin_id, status)

            return {
                'ok': True,
                'message': I18nMessage('插件 migration 历史查询完成', msg_key='plugin.runtime.migration.historyLoaded'),
                'pluginId': plugin_id,
                'status': status,
                'count': len(migrations),
                'migrations': [self._dump_migration_model(migration) for migration in migrations],
            }
        except Exception as exc:
            return PluginRuntimePayloadBuilder.build_exception_payload(
                I18nMessage('查询插件 migration 历史失败', msg_key='plugin.runtime.migration.historyFailed'),
                exc,
                plugin_id=plugin_id,
            )

    async def mark_plugin_migration_status(
        self,
        plugin_id: str,
        migration_path: str,
        status: MigrationRecoveryStatus,
        *,
        note: str | None = None,
    ) -> dict[str, object]:
        """
        人工标记插件 migration 状态。

        :param plugin_id: 插件ID
        :param migration_path: migration 相对路径
        :param status: 目标状态
        :param note: 人工恢复备注
        :return: 插件 migration 状态标记负载
        """
        try:
            error_message = None if status == 'success' else note or '人工标记为失败'
            existing_migration = await self.dependencies.migration_history_gateway.get_plugin_migration(
                plugin_id,
                migration_path,
            )
            if not existing_migration:
                return PluginRuntimePayloadBuilder.build_invalid_operation_payload(
                    plugin_id,
                    f'migration_mark_{status}',
                    message=I18nMessage('插件 migration 历史不存在', msg_key='plugin.runtime.migration.notFound'),
                )
            current_status = getattr(existing_migration, 'status', 'success') or 'success'
            if current_status not in MIGRATION_MANUAL_TRANSITIONS[status]:
                label = (
                    I18nMessage('成功', msg_key='plugin.runtime.migration.successStatus')
                    if status == 'success'
                    else I18nMessage('失败', msg_key='plugin.runtime.migration.failedStatus')
                )
                return PluginRuntimePayloadBuilder.build_invalid_operation_payload(
                    plugin_id,
                    f'migration_mark_{status}',
                    message=I18nMessage(
                        f'插件 migration 当前状态为 {current_status}，不能人工标记为{label}',
                        msg_key='plugin.runtime.migration.transitionBlocked',
                        msg_params={'current_status': str(current_status), 'label': label},
                    ),
                )
            migration = await self.dependencies.migration_history_gateway.mark_plugin_migration_status(
                plugin_id,
                migration_path,
                status,
                error_message,
            )
            if not migration:
                return PluginRuntimePayloadBuilder.build_invalid_operation_payload(
                    plugin_id,
                    f'migration_mark_{status}',
                    message=I18nMessage('插件 migration 历史不存在', msg_key='plugin.runtime.migration.notFound'),
                )

            label = (
                I18nMessage('成功', msg_key='plugin.runtime.migration.successStatus')
                if status == 'success'
                else I18nMessage('失败', msg_key='plugin.runtime.migration.failedStatus')
            )
            payload = {
                'ok': True,
                'message': I18nMessage(
                    f'插件 migration 已人工标记为{label}',
                    msg_key='plugin.runtime.migration.marked',
                    msg_params={'label': label},
                ),
                'operation': f'migration_mark_{status}',
                'pluginId': plugin_id,
                'migrationPath': migration_path,
                'status': status,
                'migration': self._dump_migration_model(migration),
            }
            if note:
                payload['note'] = note
            return payload
        except Exception as exc:
            return PluginRuntimePayloadBuilder.build_exception_payload(
                I18nMessage('人工标记插件 migration 状态失败', msg_key='plugin.runtime.migration.markFailed'),
                exc,
                plugin_id=plugin_id,
            )

    @staticmethod
    def _dump_migration_model(migration: object) -> dict[str, object]:
        """
        序列化 migration 历史模型。

        :param migration: migration 历史模型
        :return: migration 历史字典
        """
        model_dump = getattr(migration, 'model_dump', None)
        if callable(model_dump):
            return model_dump(by_alias=True)

        return {
            'pluginId': getattr(migration, 'plugin_id', None),
            'migrationPath': getattr(migration, 'migration_path', None),
            'migrationChecksum': getattr(migration, 'migration_checksum', None),
            'version': getattr(migration, 'version', None),
            'statementCount': getattr(migration, 'statement_count', 0),
            'status': getattr(migration, 'status', None),
            'errorMessage': getattr(migration, 'error_message', None),
            'attemptCount': getattr(migration, 'attempt_count', 0),
            'startedTime': getattr(migration, 'started_time', None),
            'finishedTime': getattr(migration, 'finished_time', None),
            'createTime': getattr(migration, 'create_time', None),
            'updateTime': getattr(migration, 'update_time', None),
        }
