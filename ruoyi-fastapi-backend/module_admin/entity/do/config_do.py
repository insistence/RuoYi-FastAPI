from sqlalchemy import CHAR, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin
from config.database import Base
from config.env import DataBaseConfig
from utils.common_util import SqlalchemyUtil


class SysConfig(AuditTimeMixin, Base):
    """参数配置表。"""

    __tablename__ = 'sys_config'
    __table_args__ = {'comment': '参数配置表'}

    config_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, nullable=False, autoincrement=True, comment='参数主键'
    )
    config_name: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='参数名称')
    config_key: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='参数键名')
    config_value: Mapped[str | None] = mapped_column(
        String(500), nullable=True, server_default="''", comment='参数键值'
    )
    config_type: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='N', comment='系统内置（Y是 N否）'
    )
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
    remark: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='备注',
    )
