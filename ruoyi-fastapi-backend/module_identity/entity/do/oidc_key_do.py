from datetime import datetime

from sqlalchemy import JSON, BigInteger, CheckConstraint, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from common.types import DbUtcDateTime
from config.database import Base
from utils.time_util import TimezoneUtil


class SysOidcSigningKey(Base):
    """OIDC签名密钥表。"""

    __tablename__ = 'sys_oidc_signing_key'
    __table_args__ = (
        UniqueConstraint('kid', name='uk_oidc_signing_key_kid'),
        CheckConstraint(
            '((CASE WHEN private_key_ref IS NULL THEN 0 ELSE 1 END) + '
            '(CASE WHEN private_key_ciphertext IS NULL THEN 0 ELSE 1 END)) = 1',
            name='ck_oidc_signing_key_private_material',
        ),
        Index('idx_oidc_signing_key_status_publish', 'status', 'publish_at'),
        Index('idx_oidc_signing_key_jwks_remove', 'status', 'remove_from_jwks_at'),
        {'comment': 'OIDC Signing Key'},
    )

    key_pk: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, 'sqlite'),
        primary_key=True,
        nullable=False,
        autoincrement=True,
        comment='内部主键',
    )
    kid: Mapped[str] = mapped_column(String(100), nullable=False, comment='JWKS 密钥标识')
    key_use: Mapped[str] = mapped_column(String(16), nullable=False, server_default='sig', comment='JWK 用途')
    alg: Mapped[str] = mapped_column(String(16), nullable=False, server_default='RS256', comment='签名算法')
    public_jwk: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False, comment='公开 JWK')
    private_key_ref: Mapped[str | None] = mapped_column(String(1000), nullable=True, comment='KMS/HSM/文件引用')
    private_key_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True, comment='加密私钥材料')
    status: Mapped[str] = mapped_column(String(16), nullable=False, comment='密钥状态')
    publish_at: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='发布时间'
    )
    signing_start_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='开始签名时间')
    signing_stop_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='停止签名时间')
    remove_from_jwks_at: Mapped[datetime | None] = mapped_column(
        DbUtcDateTime(), nullable=True, comment='移出 JWKS 时间'
    )
    create_by: Mapped[str] = mapped_column(String(64), nullable=False, comment='创建者')
    create_time: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='创建时间'
    )
    remark: Mapped[str | None] = mapped_column(String(500), nullable=True, comment='备注')
