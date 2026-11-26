from datetime import UTC, datetime

from plugins.core.management.dao.dao import PluginDao
from plugins.core.management.entity.do.models import SysPluginMigration
from plugins.core.management.entity.vo.schemas import PluginMigrationModel, PluginModel


def test_plugin_persistence_payload_ignores_client_audit_times() -> None:
    """插件持久化数据忽略客户端提交的审计时间。"""
    now = datetime(2026, 8, 21, 12, 0, 0, tzinfo=UTC)
    payload = PluginDao.dump_plugin_persistence_payload(
        PluginModel(
            plugin_id='demo',
            plugin_name='Demo',
            version='1.0.0',
            create_time=now,
            update_time=now,
        )
    )

    assert 'create_time' not in payload
    assert 'update_time' not in payload


def test_existing_migration_update_uses_onupdate_not_external_time() -> None:
    """迁移更新通过 onupdate 生成时间。"""
    now = datetime(2026, 8, 21, 12, 0, 0, tzinfo=UTC)
    payload = PluginMigrationModel(
        plugin_id='demo',
        migration_path='migrations/001.sql',
        migration_checksum='checksum',
        update_time=datetime(2000, 1, 1, tzinfo=UTC),
    ).model_dump(exclude_unset=True)

    PluginDao._apply_migration_observability_payload(payload, SysPluginMigration(), now)

    assert 'update_time' not in payload
