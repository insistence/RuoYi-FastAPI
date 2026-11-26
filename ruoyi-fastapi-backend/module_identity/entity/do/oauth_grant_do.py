from datetime import datetime

from sqlalchemy import CHAR, JSON, BigInteger, ForeignKey, Index, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from common.types import DbUtcDateTime
from config.database import Base
from module_identity.entity.types import AccessStatus, AuthorizationStatus
from utils.time_util import TimezoneUtil


class SysOAuthAccessPolicy(Base):
    """用户与 OAuth Client 的访问控制表。"""

    __tablename__ = 'sys_oauth_access_policy'
    __table_args__ = ({'comment': 'OAuth 用户应用访问控制'},)

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_user.user_id', name='fk_oauth_access_user', ondelete='RESTRICT'),
        primary_key=True,
        nullable=False,
        comment='用户ID',
    )
    client_pk: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_oauth_client.client_pk', name='fk_oauth_access_client', ondelete='RESTRICT'),
        primary_key=True,
        nullable=False,
        comment='Client 主键',
    )
    access_status: Mapped[AccessStatus] = mapped_column(
        String(16), nullable=False, server_default='allowed', comment='allowed允许 blocked禁止'
    )
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True, comment='访问控制原因')
    update_by: Mapped[str] = mapped_column(String(64), nullable=False, comment='操作人')
    update_time: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='操作时间'
    )


class SysOAuthGrant(Base):
    """OAuth授权记录表。"""

    __tablename__ = 'sys_oauth_grant'
    __table_args__ = (
        Index('idx_oauth_grant_user', 'user_id', 'status'),
        Index('idx_oauth_grant_client', 'client_pk', 'status'),
        Index('idx_oauth_grant_user_client', 'user_id', 'client_pk', 'status'),
        {'comment': 'OAuth Grant'},
    )

    grant_id: Mapped[str] = mapped_column(String(36), primary_key=True, nullable=False, comment='授权记录标识')
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_user.user_id', name='fk_oauth_grant_user', ondelete='RESTRICT'),
        nullable=False,
        comment='用户ID',
    )
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False, comment='Subject 快照')
    client_pk: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_oauth_client.client_pk', name='fk_oauth_grant_client', ondelete='RESTRICT'),
        nullable=False,
        comment='Client 主键',
    )
    granted_scopes: Mapped[list[str]] = mapped_column(JSON, nullable=False, comment='已同意 Scope')
    granted_resources: Mapped[list[str]] = mapped_column(JSON, nullable=False, comment='已同意 Resource audience')
    remembered_scopes: Mapped[list[str] | None] = mapped_column(JSON, nullable=True, comment='后续可免确认的 Scope')
    remembered_resources: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, comment='后续可免确认的 Resource audience'
    )
    client_policy_version: Mapped[int] = mapped_column(BigInteger, nullable=False, comment='客户端策略版本')
    status: Mapped[AuthorizationStatus] = mapped_column(
        String(16), nullable=False, server_default='active', comment='Grant 状态'
    )
    consented_at: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='同意时间'
    )
    expires_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='过期时间')
    revoked_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='撤销时间')
    revoke_reason: Mapped[str | None] = mapped_column(String(200), nullable=True, comment='撤销原因')
    last_used_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='最近使用时间')


class SysSsoSession(Base):
    """OIDC单点登录会话表。"""

    __tablename__ = 'sys_sso_session'
    __table_args__ = (
        Index('idx_sso_session_user', 'user_id', 'status'),
        Index('idx_sso_session_idle', 'status', 'idle_expires_at'),
        Index('idx_sso_session_absolute', 'status', 'absolute_expires_at'),
        {'comment': 'OIDC SSO Session'},
    )

    sid: Mapped[str] = mapped_column(String(36), primary_key=True, nullable=False, comment='OIDC 会话标识')
    session_secret_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, comment='SSO Cookie 摘要')
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_user.user_id', name='fk_sso_session_user', ondelete='RESTRICT'),
        nullable=False,
        comment='用户ID',
    )
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False, comment='Subject 快照')
    auth_version: Mapped[int] = mapped_column(BigInteger, nullable=False, comment='认证安全版本')
    auth_time: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='认证时间'
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='最近活动时间'
    )
    idle_expires_at: Mapped[datetime] = mapped_column(DbUtcDateTime(), nullable=False, comment='闲置过期时间')
    absolute_expires_at: Mapped[datetime] = mapped_column(DbUtcDateTime(), nullable=False, comment='绝对过期时间')
    acr: Mapped[str] = mapped_column(String(100), nullable=False, comment='认证上下文')
    amr: Mapped[list[str]] = mapped_column(JSON, nullable=False, comment='认证方式')
    remember_me: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default='0', comment='是否长期会话')
    ip_address: Mapped[str | None] = mapped_column(String(128), nullable=True, comment='登录 IP')
    user_agent_hash: Mapped[str | None] = mapped_column(CHAR(64), nullable=True, comment='User-Agent 摘要')
    status: Mapped[AuthorizationStatus] = mapped_column(
        String(16), nullable=False, server_default='active', comment='Session 状态'
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='撤销时间')
    revoke_reason: Mapped[str | None] = mapped_column(String(200), nullable=True, comment='撤销原因')
    create_time: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='创建时间'
    )


class SysSsoSessionClient(Base):
    """SSO 会话与参与应用关联表。"""

    __tablename__ = 'sys_sso_session_client'
    __table_args__ = (Index('idx_sso_session_client_client', 'client_pk'), {'comment': 'SSO 会话参与应用'})

    sid: Mapped[str] = mapped_column(
        String(36),
        ForeignKey('sys_sso_session.sid', name='fk_sso_session_client_sid', ondelete='RESTRICT'),
        primary_key=True,
        nullable=False,
        comment='单点登录会话标识',
    )
    client_pk: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_oauth_client.client_pk', name='fk_sso_session_client_client', ondelete='RESTRICT'),
        primary_key=True,
        nullable=False,
        comment='Client 主键',
    )
    create_time: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='首次授权时间'
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='最近授权时间'
    )


class SysOAuthRefreshToken(Base):
    """OAuth刷新令牌表，仅保存令牌摘要。"""

    __tablename__ = 'sys_oauth_refresh_token'
    __table_args__ = (
        UniqueConstraint('token_hash', name='uk_oauth_refresh_token_hash'),
        Index('idx_oauth_refresh_family', 'family_id', 'status'),
        Index('idx_oauth_refresh_user', 'user_id', 'status'),
        Index('idx_oauth_refresh_client', 'client_pk', 'status'),
        Index('idx_oauth_refresh_sid', 'sid', 'status'),
        Index('idx_oauth_refresh_expire', 'status', 'absolute_expires_at'),
        {'comment': 'OAuth Refresh Token'},
    )

    token_id: Mapped[str] = mapped_column(String(36), primary_key=True, nullable=False, comment='令牌标识')
    token_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, comment='Token HMAC 摘要')
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, comment='令牌族标识')
    parent_token_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey('sys_oauth_refresh_token.token_id', name='fk_oauth_refresh_parent', ondelete='RESTRICT'),
        nullable=True,
        comment='父 Token ID',
    )
    replaced_by_token_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey('sys_oauth_refresh_token.token_id', name='fk_oauth_refresh_replaced_by', ondelete='RESTRICT'),
        nullable=True,
        comment='替代 Token ID',
    )
    grant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey('sys_oauth_grant.grant_id', name='fk_oauth_refresh_grant', ondelete='RESTRICT'),
        nullable=False,
        comment='授权记录标识',
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_user.user_id', name='fk_oauth_refresh_user', ondelete='RESTRICT'),
        nullable=False,
        comment='用户ID',
    )
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False, comment='Subject 快照')
    auth_version: Mapped[int] = mapped_column(BigInteger, nullable=False, comment='认证安全版本')
    client_pk: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey('sys_oauth_client.client_pk', name='fk_oauth_refresh_client', ondelete='RESTRICT'),
        nullable=False,
        comment='Client 主键',
    )
    sid: Mapped[str] = mapped_column(
        String(36),
        ForeignKey('sys_sso_session.sid', name='fk_oauth_refresh_sid', ondelete='RESTRICT'),
        nullable=False,
        comment='单点登录会话标识',
    )
    scopes: Mapped[list[str]] = mapped_column(JSON, nullable=False, comment='绑定 Scope')
    resources: Mapped[list[str]] = mapped_column(JSON, nullable=False, comment='绑定 Resource audience')
    status: Mapped[str] = mapped_column(String(24), nullable=False, server_default='active', comment='Token 状态')
    issued_at: Mapped[datetime] = mapped_column(
        DbUtcDateTime(), nullable=False, default=TimezoneUtil.utc_now, comment='签发时间'
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='最近使用时间')
    idle_expires_at: Mapped[datetime] = mapped_column(DbUtcDateTime(), nullable=False, comment='闲置过期时间')
    absolute_expires_at: Mapped[datetime] = mapped_column(DbUtcDateTime(), nullable=False, comment='绝对过期时间')
    revoked_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='撤销时间')
    revoke_reason: Mapped[str | None] = mapped_column(String(200), nullable=True, comment='撤销原因')
    reuse_detected_at: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='重放检测时间')
