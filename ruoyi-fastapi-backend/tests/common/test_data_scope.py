from types import SimpleNamespace

import pytest
from fastapi import Request
from sqlalchemy import Column, Integer, MetaData, Table, create_engine, select
from sqlalchemy.orm import registry

from common.aspect.data_scope import GetDataScope
from common.context import RequestContext
from module_admin.entity.do.role_do import SysRoleDept
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.role_vo import RoleModel
from utils.dependency_util import DependencyUtil


@pytest.mark.parametrize(
    ('roles', 'admin', 'expected'),
    [
        ([], False, []),
        ([('1', '1', '0')], False, []),
        ([('1', '0', '2')], False, []),
        ([(None, '0', '0')], False, []),
        ([('2', '0', '0')], False, [1, 2]),
        ([('2', '0', '0'), ('2', '0', '0')], False, [1, 2, 3]),
        ([('5', '0', '0')], False, [1]),
        ([('3', '0', '0')], False, [1, 2]),
        ([('3', '0', '0'), ('5', '0', '0')], False, [1, 2]),
        ([('5', '0', '0'), ('1', '1', '0')], False, [1]),
        ([('1', '0', '0')], False, [1, 2, 3]),
        ([], True, [1, 2, 3]),
    ],
)
def test_data_scope_filters_real_query(
    monkeypatch: pytest.MonkeyPatch, roles: list[tuple], admin: bool, expected: list[int]
) -> None:
    """数据权限范围过滤实际查询。"""
    metadata = MetaData()
    table = Table(
        'records',
        metadata,
        Column('user_id', Integer, primary_key=True, comment='用户标识'),
        Column('dept_id', Integer, comment='部门标识'),
    )
    mapper = registry()

    class Record:
        """表示用于测试数据范围的记录。"""

    mapper.map_imperatively(Record, table)
    user = SimpleNamespace(
        user_id=1,
        dept_id=10,
        admin=admin,
        role=[
            RoleModel.model_validate({'roleId': index + 2, 'dataScope': scope, 'status': status, 'delFlag': deleted})
            for index, (scope, status, deleted) in enumerate(roles)
        ],
    )
    monkeypatch.setattr(RequestContext, 'get_current_user', lambda: SimpleNamespace(user=user))
    monkeypatch.setattr(DependencyUtil, 'check_exclude_routes', lambda *args, **kwargs: None)
    condition = GetDataScope(Record)(Request({'type': 'http'}))
    query = select(table.c.user_id).where(condition).order_by(table.c.user_id)
    engine = create_engine('sqlite://')
    metadata.create_all(engine)
    try:
        with engine.begin() as connection:
            role_dept = SysRoleDept.get_table()
            role_dept.create(connection)
            connection.execute(role_dept.insert(), [{'role_id': 2, 'dept_id': 10}, {'role_id': 3, 'dept_id': 20}])
            connection.execute(
                table.insert(),
                [
                    {'user_id': 1, 'dept_id': 10},
                    {'user_id': 2, 'dept_id': 10},
                    {'user_id': 3, 'dept_id': 20},
                ],
            )
            assert list(connection.scalars(query)) == expected
            if not expected:
                assert 'WHERE 0 = 1' in str(query.compile(engine))
    finally:
        engine.dispose()
        mapper.dispose()


@pytest.mark.parametrize(
    ('user', 'user_alias', 'dept_alias'),
    [
        (None, 'user_id', 'dept_id'),
        ({'role': [None]}, 'user_id', 'dept_id'),
        ({'role': [{'dataScope': '5', 'status': '0', 'delFlag': '0'}]}, 'user_id', 'dept_id'),
        ({'deptId': 10, 'role': [{'dataScope': '3', 'status': '0', 'delFlag': '0'}]}, None, None),
    ],
)
def test_incomplete_data_scope_grants_no_rows(
    monkeypatch: pytest.MonkeyPatch, user: dict | None, user_alias: str | None, dept_alias: str | None
) -> None:
    """用户、角色、本人标识或所需列缺失时，限制条件应拒绝全部记录。"""
    # 绕过认证依赖，验证数据权限对异常上下文的防御行为。
    profile = None
    if user is not None:
        profile = SimpleNamespace(
            admin=False,
            user_id=user.get('userId'),
            dept_id=user.get('deptId'),
            role=[RoleModel.model_validate(role) if role else None for role in user['role']],
        )
    current = SimpleNamespace(user=profile)
    monkeypatch.setattr(RequestContext, 'get_current_user', lambda: current)
    monkeypatch.setattr(DependencyUtil, 'check_exclude_routes', lambda *args, **kwargs: None)
    condition = GetDataScope(SysUser, user_alias, dept_alias)(Request({'type': 'http'}))
    assert str(condition) == 'false'
