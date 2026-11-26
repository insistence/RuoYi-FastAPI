from collections.abc import Iterable, Sequence
from datetime import datetime
from typing import TypedDict, Unpack

from sqlalchemy import ColumnElement, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from module_identity.entity.do.oauth_audit_do import SysOAuthAuditArchive, SysOAuthAuditLog


class AuditFilters(TypedDict, total=False):
    """
    管理端审计查询的可选筛选条件。

    :ivar client_id: Client 公开标识
    :ivar user_id: 用户编号
    :ivar event_type: 审计事件类型
    :ivar result: 审计结果
    :ivar risk_level: 审计风险级别
    :ivar start_time: 查询开始时间
    :ivar end_time: 查询结束时间
    """

    client_id: str | None
    user_id: int | None
    event_type: str | None
    result: str | None
    risk_level: str | None
    start_time: datetime | None
    end_time: datetime | None


class OAuthAuditDao:
    """OAuth Audit 数据库操作层。"""

    @classmethod
    async def append(cls, db: AsyncSession, event: SysOAuthAuditLog) -> SysOAuthAuditLog:
        """
        新增 OAuth Audit 日志并刷新主键。

        :param db: orm对象
        :param event: OAuth Audit 日志对象
        :return: 已写入的 OAuth Audit 日志对象
        """
        db.add(event)
        await db.flush()

        return event

    @classmethod
    async def bulk_append(cls, db: AsyncSession, events: Iterable[SysOAuthAuditLog]) -> None:
        """
        批量新增 OAuth Audit 日志。

        :param db: orm对象
        :param events: OAuth Audit 日志对象序列
        """
        rows = list(events)
        if rows:
            db.add_all(rows)
            await db.flush()

    @classmethod
    async def list_page(
        cls,
        db: AsyncSession,
        offset: int = 0,
        limit: int = 50,
        client_id: str | None = None,
        user_id: int | None = None,
        event_type: str | None = None,
        result: str | None = None,
        before: datetime | None = None,
    ) -> Sequence[SysOAuthAuditLog]:
        """
        分页查询 OAuth Audit 日志。

        :param db: orm对象
        :param offset: 分页偏移量
        :param limit: 分页大小
        :param client_id: Client 公开标识
        :param user_id: 用户编号
        :param event_type: 审计事件类型
        :param result: 审计结果
        :param before: 归档截止时间
        :return: OAuth Audit 日志序列
        """
        conditions = []
        if client_id:
            conditions.append(SysOAuthAuditLog.client_id == client_id)
        if user_id is not None:
            conditions.append(SysOAuthAuditLog.user_id == user_id)
        if event_type:
            conditions.append(SysOAuthAuditLog.event_type == event_type)
        if result:
            conditions.append(SysOAuthAuditLog.result == result)
        if before is not None:
            conditions.append(SysOAuthAuditLog.create_time < before)
        query = select(SysOAuthAuditLog).where(*conditions).order_by(SysOAuthAuditLog.event_id.desc())
        query = query.offset(max(offset, 0)).limit(min(max(limit, 1), 500))
        rows = await db.execute(query)

        return rows.scalars().all()

    @classmethod
    def _conditions(
        cls,
        *,
        client_id: str | None = None,
        user_id: int | None = None,
        event_type: str | None = None,
        result: str | None = None,
        risk_level: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[ColumnElement[bool]]:
        """
        构造 OAuth Audit 查询条件。

        :param client_id: Client 公开标识
        :param user_id: 用户编号
        :param event_type: 审计事件类型
        :param result: 审计结果
        :param risk_level: 审计风险级别
        :param start_time: 查询开始时间
        :param end_time: 查询结束时间
        :return: SQLAlchemy 条件列表
        """
        conditions = []
        if client_id:
            conditions.append(SysOAuthAuditLog.client_id == client_id)
        if user_id is not None:
            conditions.append(SysOAuthAuditLog.user_id == user_id)
        if event_type:
            conditions.append(SysOAuthAuditLog.event_type == event_type)
        if result:
            conditions.append(SysOAuthAuditLog.result == result)
        if risk_level:
            conditions.append(SysOAuthAuditLog.risk_level == risk_level)
        if start_time is not None:
            conditions.append(SysOAuthAuditLog.create_time >= start_time)
        if end_time is not None:
            conditions.append(SysOAuthAuditLog.create_time <= end_time)
        return conditions

    @classmethod
    async def list_admin_page(
        cls,
        db: AsyncSession,
        *,
        offset: int,
        limit: int,
        **filters: Unpack[AuditFilters],
    ) -> Sequence[SysOAuthAuditLog]:
        """
        分页查询管理端 OAuth Audit 日志。

        :param db: orm对象
        :param offset: 分页偏移量
        :param limit: 分页大小
        :param filters: 审计事件筛选条件
        :return: 管理端 OAuth Audit 日志序列
        """
        query = (
            select(SysOAuthAuditLog)
            .where(*cls._conditions(**filters))
            .order_by(SysOAuthAuditLog.event_id.desc())
            .offset(max(offset, 0))
            .limit(min(max(limit, 1), 5000))
        )
        rows = await db.execute(query)

        return rows.scalars().all()

    @classmethod
    async def count_admin(
        cls,
        db: AsyncSession,
        **filters: Unpack[AuditFilters],
    ) -> int:
        """
        统计管理端 OAuth Audit 日志数量。

        :param db: orm对象
        :param filters: 审计事件筛选条件
        :return: 符合条件的 OAuth Audit 日志数量
        """
        rows = await db.execute(select(func.count()).select_from(SysOAuthAuditLog).where(*cls._conditions(**filters)))

        return rows.scalar_one()

    @classmethod
    async def archive_before(cls, db: AsyncSession, before: datetime, limit: int = 1000) -> int:
        """
        归档指定时间前的 OAuth Audit 日志。

        :param db: orm对象
        :param before: 归档截止时间
        :param limit: 单次归档数量上限
        :return: 已归档的 OAuth Audit 日志数量
        """
        result = await db.execute(
            select(SysOAuthAuditLog)
            .where(SysOAuthAuditLog.create_time < before)
            .order_by(SysOAuthAuditLog.event_id)
            .limit(min(max(limit, 1), 5000))
            .with_for_update()
        )
        rows = result.scalars().all()
        if not rows:
            return 0
        fields = tuple(column.name for column in SysOAuthAuditLog.__table__.columns)
        db.add_all([SysOAuthAuditArchive(**{field: getattr(row, field) for field in fields}) for row in rows])
        await db.flush()
        event_ids = [row.event_id for row in rows]
        await db.execute(delete(SysOAuthAuditLog).where(SysOAuthAuditLog.event_id.in_(event_ids)))

        return len(event_ids)
