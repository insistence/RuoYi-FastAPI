from unittest.mock import NonCallableMagicMock, create_autospec

from fastapi import FastAPI, Request
from sqlalchemy.ext.asyncio import AsyncSession

from module_admin.entity.vo.dept_vo import DeptModel
from module_admin.entity.vo.role_vo import RoleModel
from module_admin.entity.vo.user_vo import CurrentUserModel, UserInfoModel


def make_query_db(commit_error: Exception | None = None) -> NonCallableMagicMock:
    """
    创建记录事务操作的异步会话替身。

    :param commit_error: 提交时抛出的异常
    :return: 遵循异步数据库会话接口的模拟对象
    """
    session = create_autospec(AsyncSession, instance=True, spec_set=True)
    assert isinstance(session, NonCallableMagicMock)
    session.commit.side_effect = commit_error
    return session


def make_current_user(
    user_id: int = 10,
    *,
    user_name: str | None = None,
    admin: bool = False,
    role_ids: list[int] | None = None,
    dept_id: int | None = None,
    ancestors: str = '',
) -> CurrentUserModel:
    """
    构造后台服务测试使用的当前用户。

    :param user_id: 用户标识
    :param user_name: 用户账号
    :param admin: 是否为管理员
    :param role_ids: 已分配角色标识
    :param dept_id: 所属部门标识
    :param ancestors: 部门祖先标识串
    :return: 包含角色和部门信息的当前用户
    """
    roles = role_ids or []
    user = UserInfoModel(
        user_id=user_id,
        user_name=user_name if user_name is not None else f'user{user_id}',
        admin=admin,
        role=[RoleModel(role_id=role_id) for role_id in roles],
        role_ids=','.join(str(role_id) for role_id in roles),
        dept_id=dept_id,
        dept=DeptModel(dept_id=dept_id, ancestors=ancestors) if dept_id is not None else None,
    )
    return CurrentUserModel(user=user, roles=[], permissions=[])


def make_redis_request(redis: object) -> Request:
    """
    构造带有 Redis 客户端的后台请求。

    :param redis: 当前应用使用的 Redis 客户端或测试替身
    :return: 携带独立应用状态的 HTTP 请求
    """
    app = FastAPI()
    app.state.redis = redis
    return Request({'type': 'http', 'app': app, 'headers': []})
