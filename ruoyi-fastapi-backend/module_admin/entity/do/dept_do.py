from sqlalchemy import CHAR, BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin
from config.database import Base
from config.env import DataBaseConfig
from utils.common_util import SqlalchemyUtil


class SysDept(AuditTimeMixin, Base):
    """部门表。"""

    __tablename__ = 'sys_dept'
    __table_args__ = {'comment': '部门表'}

    dept_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True, comment='部门id')
    parent_id: Mapped[int | None] = mapped_column(BigInteger, server_default='0', comment='父部门id')
    ancestors: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='祖级列表')
    dept_name: Mapped[str | None] = mapped_column(String(30), nullable=True, server_default="''", comment='部门名称')
    order_num: Mapped[int | None] = mapped_column(Integer, server_default='0', comment='显示顺序')
    leader: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='负责人',
    )
    phone: Mapped[str | None] = mapped_column(
        String(11),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='联系电话',
    )
    email: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='邮箱',
    )
    status: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='部门状态（0正常 1停用）'
    )
    del_flag: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='删除标志（0代表存在 2代表删除）'
    )
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
