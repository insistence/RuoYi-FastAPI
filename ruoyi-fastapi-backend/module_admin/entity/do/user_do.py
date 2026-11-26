from datetime import datetime

from sqlalchemy import CHAR, BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from common.mixin import AuditTimeMixin
from common.types import DbUtcDateTime
from config.database import Base
from config.env import DataBaseConfig
from utils.common_util import SqlalchemyUtil


class SysUser(AuditTimeMixin, Base):
    """用户信息表。"""

    __tablename__ = 'sys_user'
    __table_args__ = {'comment': '用户信息表'}

    user_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, nullable=False, autoincrement=True, comment='用户ID'
    )
    dept_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type, False),
        comment='部门ID',
    )
    user_name: Mapped[str] = mapped_column(String(30), nullable=False, comment='用户账号')
    nick_name: Mapped[str] = mapped_column(String(30), nullable=False, comment='用户昵称')
    user_type: Mapped[str | None] = mapped_column(
        String(2), nullable=True, server_default='00', comment='用户类型（00系统用户）'
    )
    email: Mapped[str | None] = mapped_column(String(50), nullable=True, server_default="''", comment='用户邮箱')
    phonenumber: Mapped[str | None] = mapped_column(String(11), nullable=True, server_default="''", comment='手机号码')
    sex: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='用户性别（0男 1女 2未知）'
    )
    avatar: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='头像地址')
    locale: Mapped[str] = mapped_column(String(63), nullable=False, server_default='zh-CN', comment='语言偏好')
    locale_revision: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default='0', comment='语言偏好版本')
    time_zone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default='auto', comment='显示时区（auto跟随设备或IANA名称）'
    )
    password: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="''", comment='密码')
    status: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='帐号状态（0正常 1停用）'
    )
    del_flag: Mapped[str | None] = mapped_column(
        CHAR(1), nullable=True, server_default='0', comment='删除标志（0代表存在 2代表删除）'
    )
    login_ip: Mapped[str | None] = mapped_column(String(128), nullable=True, server_default="''", comment='最后登录IP')
    login_date: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='最后登录时间')
    pwd_update_date: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment='密码最后更新时间')
    create_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='创建者')
    update_by: Mapped[str | None] = mapped_column(String(64), nullable=True, server_default="''", comment='更新者')
    remark: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        server_default=SqlalchemyUtil.get_server_default_null(DataBaseConfig.default_source.db_type),
        comment='备注',
    )


class SysUserRole(Base):
    """用户和角色关联表。"""

    __tablename__ = 'sys_user_role'
    __table_args__ = {'comment': '用户和角色关联表'}

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, nullable=False, comment='用户ID')
    role_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, nullable=False, comment='角色ID')


class SysUserPost(Base):
    """用户与岗位关联表。"""

    __tablename__ = 'sys_user_post'
    __table_args__ = {'comment': '用户与岗位关联表'}

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, nullable=False, comment='用户ID')
    post_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, nullable=False, comment='岗位ID')
