from sqlalchemy import CHAR, BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin
from config.database import Base
from config.env import DataBaseConfig
from utils.common_util import SqlalchemyUtil


class SysPost(AuditTimeMixin, Base):
    """岗位信息表。"""

    __tablename__ = 'sys_post'
    __table_args__ = {'comment': '岗位信息表'}

    post_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='岗位ID'
    )
    post_code: Mapped[str] = mapped_column(String(64), nullable=False, comment='岗位编码')
    post_name: Mapped[str] = mapped_column(String(50), nullable=False, comment='岗位名称')
    post_sort: Mapped[int] = mapped_column(Integer, nullable=False, comment='显示顺序')
    status: Mapped[str] = mapped_column(CHAR(1), nullable=False, comment='状态（0正常 1停用）')
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
    remark: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='备注',
    )
