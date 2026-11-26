from datetime import datetime

from sqlalchemy import CHAR, BigInteger, CheckConstraint, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin, CreateTimeMixin
from common.types import DbUtcDateTime
from config.database import Base
from config.env import DataBaseConfig
from utils.common_util import SqlalchemyUtil


class SysPlugin(AuditTimeMixin, Base):
    """
    插件信息表。

    字段说明通过 SQLAlchemy Column 的 comment 声明。
    """

    __tablename__ = 'sys_plugin'
    __table_args__ = (
        CheckConstraint("enabled in ('0', '1')", name='ck_sys_plugin_enabled'),
        CheckConstraint(
            "status in ('discovered', 'installed', 'pending_upgrade', 'error')",
            name='ck_sys_plugin_status',
        ),
        {'comment': '插件信息表'},
    )

    plugin_id: Mapped[str] = mapped_column(String(64), primary_key=True, nullable=False, comment='插件ID')
    plugin_name: Mapped[str] = mapped_column(String(128), nullable=False, comment='插件名称')
    version: Mapped[str] = mapped_column(String(32), nullable=False, comment='当前源码版本')
    installed_version: Mapped[str | None] = mapped_column(String(32), nullable=True, comment='已安装版本')
    enabled: Mapped[str] = mapped_column(CHAR(1), nullable=False, server_default='0', comment='是否启用（0启用 1停用）')
    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default='discovered', comment='插件状态')
    source: Mapped[str] = mapped_column(String(32), nullable=False, server_default='local', comment='插件来源')
    backend_path: Mapped[str | None] = mapped_column(String(255), nullable=True, comment='后端插件相对路径')
    frontend_path: Mapped[str | None] = mapped_column(String(255), nullable=True, comment='前端插件相对路径')
    last_error: Mapped[str | None] = mapped_column(String(1000), nullable=True, comment='最近一次错误信息')
    description: Mapped[str | None] = mapped_column(String(500), nullable=True, comment='插件说明')
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
    remark: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='备注',
    )


class SysPluginMenu(CreateTimeMixin, Base):
    """
    插件和菜单关联表。

    字段说明通过 SQLAlchemy Column 的 comment 声明。
    """

    __tablename__ = 'sys_plugin_menu'
    __table_args__ = (
        UniqueConstraint('plugin_id', 'menu_key', name='uk_sys_plugin_menu_key'),
        {'comment': '插件和菜单关联表'},
    )

    plugin_id: Mapped[str] = mapped_column(String(64), primary_key=True, nullable=False, comment='插件ID')
    menu_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, nullable=False, comment='菜单ID')
    menu_key: Mapped[str] = mapped_column(String(255), nullable=False, comment='插件内菜单自然键')


class SysPluginMigration(AuditTimeMixin, Base):
    """
    插件 migration 执行历史表。

    字段说明通过 SQLAlchemy Column 的 comment 声明。
    """

    __tablename__ = 'sys_plugin_migration'
    __create_time_comment__ = '执行时间'
    __update_time_insert_default__ = False
    __table_args__ = {'comment': '插件 migration 执行历史表'}

    plugin_id: Mapped[str] = mapped_column(String(64), primary_key=True, nullable=False, comment='插件ID')
    migration_path: Mapped[str] = mapped_column(
        String(255), primary_key=True, nullable=False, comment='migration 相对路径'
    )
    migration_checksum: Mapped[str] = mapped_column(String(64), nullable=False, comment='migration 内容校验值')
    version: Mapped[str | None] = mapped_column(String(32), nullable=True, comment='执行时插件版本')
    statement_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment='SQL 语句数量')
    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default='success', comment='执行状态')
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True, comment='失败错误信息')
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, comment='尝试次数')
    started_time: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='最近开始时间')
    finished_time: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='最近结束时间')


class SysPluginConfig(AuditTimeMixin, Base):
    """
    插件配置表。

    字段说明通过 SQLAlchemy Column 的 comment 声明。
    """

    __tablename__ = 'sys_plugin_config'
    __table_args__ = {'comment': '插件配置表'}

    plugin_id: Mapped[str] = mapped_column(String(64), primary_key=True, nullable=False, comment='插件ID')
    config_key: Mapped[str] = mapped_column(String(128), primary_key=True, nullable=False, comment='配置键名')
    config_label: Mapped[str | None] = mapped_column(String(128), nullable=True, comment='配置展示名称')
    config_type: Mapped[str] = mapped_column(String(32), nullable=False, server_default='string', comment='配置值类型')
    config_value: Mapped[str | None] = mapped_column(Text, nullable=True, comment='配置值')
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True, comment='默认配置值')
    required: Mapped[str] = mapped_column(CHAR(1), nullable=False, server_default='1', comment='是否必填（0是 1否）')
    secret: Mapped[str] = mapped_column(CHAR(1), nullable=False, server_default='1', comment='是否敏感（0是 1否）')
    options: Mapped[str | None] = mapped_column(Text, nullable=True, comment='配置选项JSON')
    description: Mapped[str | None] = mapped_column(String(500), nullable=True, comment='配置说明')


class SysPluginOperationLog(CreateTimeMixin, Base):
    """
    插件批量操作审计日志表。

    字段说明通过 SQLAlchemy Column 的 comment 声明。
    """

    __tablename__ = 'sys_plugin_operation_log'
    __table_args__ = {'comment': '插件批量操作审计日志表'}

    operation_id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, 'sqlite'),
        primary_key=True,
        autoincrement=True,
        nullable=False,
        comment='操作日志ID',
    )
    operation: Mapped[str] = mapped_column(String(32), nullable=False, comment='操作类型')
    plugin_ids: Mapped[str | None] = mapped_column(Text, nullable=True, comment='目标插件ID JSON')
    dry_run: Mapped[str] = mapped_column(CHAR(1), nullable=False, server_default='1', comment='是否预演（0是 1否）')
    continue_on_error: Mapped[str] = mapped_column(
        CHAR(1), nullable=False, server_default='1', comment='失败后是否继续（0是 1否）'
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, comment='执行状态')
    summary: Mapped[str | None] = mapped_column(Text, nullable=True, comment='执行汇总JSON')
    result: Mapped[str | None] = mapped_column(Text, nullable=True, comment='完整执行结果JSON')
    remark: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='备注',
    )
