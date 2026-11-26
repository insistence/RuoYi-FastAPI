from sqlalchemy import CHAR, JSON, BigInteger, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin
from config.database import Base
from config.env import DataBaseConfig
from utils.common_util import SqlalchemyUtil


class SysDictType(AuditTimeMixin, Base):
    """字典类型表。"""

    __tablename__ = 'sys_dict_type'
    __table_args__ = {'comment': '字典类型表'}

    dict_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='字典主键'
    )
    dict_name: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='字典名称')
    dict_name_i18n: Mapped[dict[str, str] | None] = mapped_column(
        JSON().with_variant(JSONB(), 'postgresql'), nullable=True, comment='多语言译文'
    )
    dict_type: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True, server_default="''", comment='字典类型'
    )
    status: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='状态（0正常 1停用）'
    )
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
    remark: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='备注',
    )


class SysDictData(AuditTimeMixin, Base):
    """字典数据表。"""

    __tablename__ = 'sys_dict_data'
    __table_args__ = {'comment': '字典数据表'}

    dict_code: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='字典编码'
    )
    dict_sort: Mapped[int | None] = mapped_column(Integer, nullable=True, server_default='0', comment='字典排序')
    dict_label: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='字典标签')
    dict_label_i18n: Mapped[dict[str, str] | None] = mapped_column(
        JSON().with_variant(JSONB(), 'postgresql'), nullable=True, comment='多语言译文'
    )
    dict_value: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='字典键值')
    dict_type: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='字典类型')
    css_class: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='样式属性（其他样式扩展）',
    )
    list_class: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='表格回显样式',
    )
    is_default: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='N', comment='是否默认（Y是 N否）'
    )
    status: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='状态（0正常 1停用）'
    )
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
    remark: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='备注',
    )
