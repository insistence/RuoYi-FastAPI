from sqlalchemy import CHAR, BigInteger, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin
from config.database import Base
from config.env import DataBaseConfig
from utils.common_util import SqlalchemyUtil


class AiModels(AuditTimeMixin, Base):
    """AI模型表。"""

    __tablename__ = 'ai_models'
    __table_args__ = {'comment': 'AI模型表'}

    model_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='模型主键'
    )
    model_code: Mapped[str] = mapped_column(String(100), nullable=False, comment='模型编码')
    model_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='模型名称',
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False, comment='提供商')
    model_sort: Mapped[int] = mapped_column(Integer, nullable=False, comment='显示顺序')
    api_key: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='接口访问密钥',
    )
    base_url: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='服务基础地址',
    )
    model_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='模型类型',
    )
    max_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True, comment='最大输出token')
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True, comment='默认温度')
    support_reasoning: Mapped[str | None] = mapped_column(CHAR(1), server_default='N', comment='是否支持推理')
    support_images: Mapped[str | None] = mapped_column(CHAR(1), server_default='N', comment='是否支持图片')
    status: Mapped[str | None] = mapped_column(CHAR(1), server_default='0', comment='模型状态')
    user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment='用户ID')
    dept_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment='部门ID')
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
    remark: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='备注',
    )
