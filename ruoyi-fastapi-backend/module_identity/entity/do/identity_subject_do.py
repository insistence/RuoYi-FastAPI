from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from common.types import DbUtcDateTime
from config.database import Base
from utils.time_util import TimezoneUtil


class SysIdentitySubject(Base):
    """统一认证主体关联表。"""

    __tablename__ = 'sys_identity_subject'
    __table_args__ = (
        UniqueConstraint('user_id', name='uk_identity_subject_user'),
        UniqueConstraint('subject_id', name='uk_identity_subject_subject'),
        Index('idx_identity_subject_auth_version', 'auth_version'),
        {'comment': '统一认证主体关联表'},
    )

    identity_id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, 'sqlite'),
        primary_key=True,
        nullable=False,
        autoincrement=True,
        comment='内部主键',
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_user.user_id', name='fk_identity_subject_user', ondelete='RESTRICT'),
        nullable=False,
        comment='本地用户ID',
    )
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False, comment='OIDC 主体标识')
    auth_version: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default='1', comment='认证安全版本')
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, comment='创建者')
    create_time: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='创建时间'
    )
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, comment='更新者')
    update_time: Mapped[datetime | None] = mapped_column(
        DbUtcDateTime(), nullable=True, onupdate=TimezoneUtil.utc_now, comment='更新时间'
    )
