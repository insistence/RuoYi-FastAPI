from typing import Any

from sqlalchemy import ColumnElement, Table, delete, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from common.vo import PageModel
from module_admin.entity.do.log_do import SysLogininfor, SysOperLog
from module_admin.entity.vo.log_vo import LogininforModel, LoginLogPageQueryModel, OperLogModel, OperLogPageQueryModel
from utils.common_util import SnakeCaseUtil
from utils.page_util import PageUtil
from utils.time_util import TimezoneUtil


def _log_order(
    table: Table,
    query: OperLogPageQueryModel | LoginLogPageQueryModel,
    time_column: str,
) -> ColumnElement:
    """
    根据查询参数选择日志排序列，缺少有效排序条件时按日志时间倒序。

    :param table: 日志表
    :param query: 含排序字段和方向的日志查询参数
    :param time_column: 日志时间列名
    :return: SQL 排序表达式
    """
    if query.order_by_column and query.is_asc:
        column = table.c.get(SnakeCaseUtil.camel_to_snake(query.order_by_column))
        if column is not None:
            return column.asc() if query.is_asc == 'ascending' else column.desc()
    return table.c[time_column].desc()


class OperationLogDao:
    """操作日志管理模块数据库操作层。"""

    @classmethod
    async def get_operation_log_list(
        cls, db: AsyncSession, query_object: OperLogPageQueryModel, is_page: bool = False
    ) -> PageModel | list[dict[str, Any]]:
        """
        根据查询参数获取操作日志列表信息。

        :param db: orm对象
        :param query_object: 查询参数对象
        :param is_page: 是否开启分页
        :return: 操作日志列表信息对象
        """
        order_by_column = _log_order(SysOperLog.get_table(), query_object, 'oper_time')
        time_range = TimezoneUtil.local_date_strings_to_utc(
            query_object.begin_time, query_object.end_time, timezone_name=TimezoneUtil.get_request_timezone()
        )
        query = (
            select(SysOperLog)
            .where(
                SysOperLog.title.like(f'%{query_object.title}%') if query_object.title else true(),
                SysOperLog.oper_name.like(f'%{query_object.oper_name}%') if query_object.oper_name else true(),
                SysOperLog.business_type == query_object.business_type if query_object.business_type else true(),
                SysOperLog.status == query_object.status if query_object.status else true(),
                SysOperLog.oper_time >= time_range[0] if time_range and time_range[0] is not None else true(),
                SysOperLog.oper_time < time_range[1] if time_range and time_range[1] is not None else true(),
            )
            .distinct()
            .order_by(order_by_column)
        )
        operation_log_list: PageModel | list[dict[str, Any]] = await PageUtil.paginate(
            db, query, query_object.page_num, query_object.page_size, is_page
        )

        return operation_log_list

    @classmethod
    async def add_operation_log_dao(cls, db: AsyncSession, operation_log: OperLogModel) -> SysOperLog:
        """
        新增操作日志数据库操作。

        :param db: orm对象
        :param operation_log: 操作日志对象
        :return: 新增校验结果
        """
        db_operation_log = SysOperLog(**operation_log.model_dump())
        db.add(db_operation_log)
        await db.flush()

        return db_operation_log

    @classmethod
    async def delete_operation_log_dao(cls, db: AsyncSession, operation_log: OperLogModel) -> None:
        """
        删除操作日志数据库操作。

        :param db: orm对象
        :param operation_log: 操作日志对象
        """
        await db.execute(delete(SysOperLog).where(SysOperLog.oper_id.in_([operation_log.oper_id])))

    @classmethod
    async def clear_operation_log_dao(cls, db: AsyncSession) -> None:
        """
        清除操作日志数据库操作。

        :param db: orm对象
        """
        await db.execute(delete(SysOperLog))


class LoginLogDao:
    """登录日志管理模块数据库操作层。"""

    @classmethod
    async def get_login_log_list(
        cls, db: AsyncSession, query_object: LoginLogPageQueryModel, is_page: bool = False
    ) -> PageModel | list[dict[str, Any]]:
        """
        根据查询参数获取登录日志列表信息。

        :param db: orm对象
        :param query_object: 查询参数对象
        :param is_page: 是否开启分页
        :return: 登录日志列表信息对象
        """
        order_by_column = _log_order(SysLogininfor.get_table(), query_object, 'login_time')
        time_range = TimezoneUtil.local_date_strings_to_utc(
            query_object.begin_time, query_object.end_time, timezone_name=TimezoneUtil.get_request_timezone()
        )
        query = (
            select(SysLogininfor)
            .where(
                SysLogininfor.ipaddr.like(f'%{query_object.ipaddr}%') if query_object.ipaddr else true(),
                SysLogininfor.user_name.like(f'%{query_object.user_name}%') if query_object.user_name else true(),
                SysLogininfor.status == query_object.status if query_object.status else true(),
                SysLogininfor.login_time >= time_range[0] if time_range and time_range[0] is not None else true(),
                SysLogininfor.login_time < time_range[1] if time_range and time_range[1] is not None else true(),
            )
            .distinct()
            .order_by(order_by_column)
        )
        login_log_list: PageModel | list[dict[str, Any]] = await PageUtil.paginate(
            db, query, query_object.page_num, query_object.page_size, is_page
        )

        return login_log_list

    @classmethod
    async def add_login_log_dao(cls, db: AsyncSession, login_log: LogininforModel) -> SysLogininfor:
        """
        新增登录日志数据库操作。

        :param db: orm对象
        :param login_log: 登录日志对象
        :return: 新增校验结果
        """
        db_login_log = SysLogininfor(**login_log.model_dump())
        db.add(db_login_log)
        await db.flush()

        return db_login_log

    @classmethod
    async def delete_login_log_dao(cls, db: AsyncSession, login_log: LogininforModel) -> None:
        """
        删除登录日志数据库操作。

        :param db: orm对象
        :param login_log: 登录日志对象
        """
        await db.execute(delete(SysLogininfor).where(SysLogininfor.info_id.in_([login_log.info_id])))

    @classmethod
    async def clear_login_log_dao(cls, db: AsyncSession) -> None:
        """
        清除登录日志数据库操作。

        :param db: orm对象
        """
        await db.execute(delete(SysLogininfor))
