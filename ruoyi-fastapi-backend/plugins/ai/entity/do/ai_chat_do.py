from sqlalchemy import CHAR, BigInteger, Float, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin
from config.database import Base


class AiChatConfig(AuditTimeMixin, Base):
    """AI对话配置表。"""

    __tablename__ = 'ai_chat_config'
    __table_args__ = {'comment': 'AI对话配置表'}

    chat_config_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='配置主键'
    )
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True, comment='用户ID')
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True, comment='默认温度')
    add_history_to_context: Mapped[str | None] = mapped_column(
        CHAR(1), server_default='0', comment='是否添加历史记录(0是, 1否)'
    )
    num_history_runs: Mapped[int | None] = mapped_column(Integer, nullable=True, comment='历史记录条数')
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True, comment='系统提示词')
    metrics_default_visible: Mapped[str | None] = mapped_column(
        CHAR(1), server_default='0', comment='默认显示指标(0是, 1否)'
    )
    vision_enabled: Mapped[str | None] = mapped_column(CHAR(1), server_default='1', comment='是否开启视觉(0是, 1否)')
    image_max_size_mb: Mapped[int | None] = mapped_column(Integer, nullable=True, comment='图片最大大小(MB)')
