from sqlalchemy import Nullable, Row, Select, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from module_admin.entity.do.dept_do import SysDept
from module_admin.entity.do.user_do import SysUser


async def login_by_account(db: AsyncSession, user_name: str) -> Row[SysUser, SysDept | None] | None:
    """
    根据用户名查询用户信息。

    :param db: orm对象
    :param user_name: 用户名
    :return: 用户及其有效部门，未匹配用户时返回 None
    """
    statement: Select[SysUser, SysDept | None] = (
        select(SysUser, Nullable(SysDept))
        .where(SysUser.user_name == user_name, SysUser.del_flag == '0')
        .join(
            SysDept,
            and_(SysUser.dept_id == SysDept.dept_id, SysDept.status == '0', SysDept.del_flag == '0'),
            isouter=True,
        )
        .distinct()
    )
    return (await db.execute(statement)).first()
