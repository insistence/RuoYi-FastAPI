from fastapi import Request, params
from sqlalchemy import ColumnElement, false, func, or_, select, true

from common.context import RequestContext
from module_admin.entity.do.dept_do import SysDept
from module_admin.entity.do.role_do import SysRoleDept
from utils.dependency_util import DependencyUtil


class GetDataScope:
    """
    获取当前用户数据权限对应的查询sql语句。

    :cvar DATA_SCOPE_ALL: 可以访问所有部门数据的数据权限标识
    :cvar DATA_SCOPE_CUSTOM: 使用角色自定义部门范围的数据权限标识
    :cvar DATA_SCOPE_DEPT: 仅可访问本部门数据的权限标识
    :cvar DATA_SCOPE_DEPT_AND_CHILD: 可访问本部门及下级部门数据的权限标识
    :cvar DATA_SCOPE_SELF: 仅可访问本人数据的权限标识
    :ivar query_alias: 所要查询表对应的sqlalchemy模型类，不可为空
    :ivar user_alias: 用户id字段别名，默认为'user_id'
    :ivar dept_alias: 部门id字段别名，默认为'dept_id'
    """

    DATA_SCOPE_ALL = '1'
    DATA_SCOPE_CUSTOM = '2'
    DATA_SCOPE_DEPT = '3'
    DATA_SCOPE_DEPT_AND_CHILD = '4'
    DATA_SCOPE_SELF = '5'

    def __init__(
        self,
        query_alias: type,
        user_alias: str | None = 'user_id',
        dept_alias: str | None = 'dept_id',
    ) -> None:
        """
        获取当前用户数据权限对应的查询sql语句。

        :param query_alias: 所要查询表对应的sqlalchemy模型类，不可为空
        :param user_alias: 用户id字段别名，默认为'user_id'
        :param dept_alias: 部门id字段别名，默认为'dept_id'
        """
        self.query_alias = query_alias
        self.user_alias = user_alias
        self.dept_alias = dept_alias

    def __call__(self, request: Request) -> ColumnElement[bool]:
        """
        根据当前用户和角色构建数据范围查询条件。

        :param request: 当前 HTTP 请求
        :return: 限制当前用户可见数据的 SQL 条件
        """
        DependencyUtil.check_exclude_routes(request, err_msg='当前路由不在认证规则内，不可使用GetDataScope依赖项')
        user = RequestContext.get_current_user().user
        if user is None:
            return false()
        if user.admin:
            return true()
        roles = [role for role in user.role or [] if role is not None and role.status == '0' and role.del_flag == '0']
        scopes = {role.data_scope for role in roles}
        if self.DATA_SCOPE_ALL in scopes:
            return true()

        conditions: list[ColumnElement[bool]] = []
        dept_column = getattr(self.query_alias, self.dept_alias, None) if self.dept_alias else None
        if dept_column is not None:
            custom_role_ids = [
                role.role_id for role in roles if role.data_scope == self.DATA_SCOPE_CUSTOM and role.role_id is not None
            ]
            if custom_role_ids:
                departments = select(SysRoleDept.dept_id).where(SysRoleDept.role_id.in_(custom_role_ids))
                conditions.append(dept_column.in_(departments))
            if user.dept_id is not None and self.DATA_SCOPE_DEPT in scopes:
                conditions.append(dept_column == user.dept_id)
            if user.dept_id is not None and self.DATA_SCOPE_DEPT_AND_CHILD in scopes:
                departments = select(SysDept.dept_id).where(
                    or_(SysDept.dept_id == user.dept_id, func.find_in_set(user.dept_id, SysDept.ancestors))
                )
                conditions.append(dept_column.in_(departments))
        user_column = getattr(self.query_alias, self.user_alias, None) if self.user_alias else None
        if user_column is not None and user.user_id is not None and self.DATA_SCOPE_SELF in scopes:
            conditions.append(user_column == user.user_id)
        return or_(false(), *conditions)


def DataScopeDependency(  # noqa: N802
    query_alias: type,
    user_alias: str | None = 'user_id',
    dept_alias: str | None = 'dept_id',
) -> params.Depends:
    """
    当前用户数据权限依赖。

    :param query_alias: 所要查询表对应的sqlalchemy模型类，不可为空
    :param user_alias: 用户id字段别名，默认为'user_id'
    :param dept_alias: 部门id字段别名，默认为'dept_id'
    :return: 当前用户数据权限依赖
    """
    return params.Depends(GetDataScope(query_alias, user_alias, dept_alias))
