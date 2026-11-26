from datetime import datetime

from sqlalchemy import CHAR, BigInteger, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from common.types import DbUtcDateTime
from config.database import Base
from utils.time_util import TimezoneUtil


class SysLogininfor(Base):
    """系统访问记录。"""

    __tablename__ = 'sys_logininfor'
    __table_args__ = {'comment': '系统访问记录'}

    info_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='访问ID'
    )
    user_name: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='用户账号')
    ipaddr: Mapped[str | None] = mapped_column(String(128), nullable=True, server_default="''", comment='登录IP地址')
    login_location: Mapped[str | None] = mapped_column(
        String(255), nullable=True, server_default="''", comment='登录地点'
    )
    browser: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='浏览器类型')
    os: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='操作系统')
    status: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='登录状态（0成功 1失败）'
    )
    msg: Mapped[str | None] = mapped_column(String(255), nullable=True, server_default="''", comment='提示消息')
    login_time: Mapped[datetime | None] = mapped_column(
        DbUtcDateTime(), nullable=True, default=TimezoneUtil.utc_now, comment='访问时间'
    )

    idx_sys_logininfor_s = Index('idx_sys_logininfor_s', status)
    idx_sys_logininfor_lt = Index('idx_sys_logininfor_lt', login_time)


class SysOperLog(Base):
    """操作日志记录。"""

    __tablename__ = 'sys_oper_log'
    __table_args__ = {'comment': '操作日志记录'}

    oper_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='日志主键'
    )
    title: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='模块标题')
    business_type: Mapped[int | None] = mapped_column(
        Integer, nullable=True, server_default='0', comment='业务类型（0其它 1新增 2修改 3删除）'
    )
    method: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='方法名称')
    request_method: Mapped[str | None] = mapped_column(
        String(10), nullable=True, server_default="''", comment='请求方式'
    )
    operator_type: Mapped[int | None] = mapped_column(
        Integer, nullable=True, server_default='0', comment='操作类别（0其它 1后台用户 2手机端用户）'
    )
    oper_name: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='操作人员')
    dept_name: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='部门名称')
    oper_url: Mapped[str | None] = mapped_column(String(255), nullable=True, server_default="''", comment='请求URL')
    oper_ip: Mapped[str | None] = mapped_column(String(128), nullable=True, server_default="''", comment='主机地址')
    oper_location: Mapped[str | None] = mapped_column(
        String(255), nullable=True, server_default="''", comment='操作地点'
    )
    oper_param: Mapped[str | None] = mapped_column(String(2000), nullable=True, server_default="''", comment='请求参数')
    json_result: Mapped[str | None] = mapped_column(
        String(2000), nullable=True, server_default="''", comment='返回参数'
    )
    status: Mapped[int | None] = mapped_column(
        Integer, nullable=True, server_default='0', comment='操作状态（0正常 1异常）'
    )
    error_msg: Mapped[str | None] = mapped_column(String(2000), nullable=True, server_default="''", comment='错误消息')
    oper_time: Mapped[datetime | None] = mapped_column(
        DbUtcDateTime(), nullable=True, default=TimezoneUtil.utc_now, comment='操作时间'
    )
    cost_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True, server_default='0', comment='消耗时间')

    idx_sys_oper_log_bt = Index('idx_sys_oper_log_bt', business_type)
    idx_sys_oper_log_s = Index('idx_sys_oper_log_s', status)
    idx_sys_oper_log_ot = Index('idx_sys_oper_log_ot', oper_time)
