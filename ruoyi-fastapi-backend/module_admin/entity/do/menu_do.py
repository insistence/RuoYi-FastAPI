from sqlalchemy import CHAR, JSON, BigInteger, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin
from config.database import Base
from config.env import DataBaseConfig
from utils.common_util import SqlalchemyUtil


class SysMenu(AuditTimeMixin, Base):
    """菜单权限表。"""

    __tablename__ = 'sys_menu'
    __table_args__ = {'comment': '菜单权限表'}

    menu_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='菜单ID'
    )
    menu_name: Mapped[str] = mapped_column(String(50), nullable=False, comment='菜单名称')
    menu_name_i18n: Mapped[dict[str, str] | None] = mapped_column(
        JSON().with_variant(JSONB(), 'postgresql'), nullable=True, comment='多语言译文'
    )
    parent_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, server_default='0', comment='父菜单ID')
    order_num: Mapped[int | None] = mapped_column(Integer, server_default='0', comment='显示顺序')
    path: Mapped[str | None] = mapped_column(String(200), nullable=True, server_default="''", comment='路由地址')
    component: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='组件路径',
    )
    query: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='路由参数',
    )
    route_name: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='路由名称')
    is_frame: Mapped[int | None] = mapped_column(
        Integer, nullable=True, server_default='1', comment='是否为外链（0是 1否）'
    )
    is_cache: Mapped[int | None] = mapped_column(
        Integer, nullable=True, server_default='0', comment='是否缓存（0缓存 1不缓存）'
    )
    menu_type: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default="''", comment='菜单类型（M目录 C菜单 F按钮）'
    )
    visible: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='菜单状态（0显示 1隐藏）'
    )
    status: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='菜单状态（0正常 1停用）'
    )
    perms: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='权限标识',
    )
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default='#', comment='菜单图标')
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
    remark: Mapped[str | None] = mapped_column(String(500), nullable=True, server_default="''", comment='备注')
