from types import SimpleNamespace

import pytest
from fastapi import Request
from sqlalchemy import Column, Integer, MetaData, Table, create_engine, select
from sqlalchemy.orm import registry

from common.aspect.data_scope import GetDataScope
from common.context import RequestContext
from module_admin.entity.vo.role_vo import RoleModel
from utils.dependency_util import DependencyUtil


@pytest.mark.parametrize(
    ('roles', 'admin', 'expected'),
    [
        ([], False, []),
        ([('1', '1', '0')], False, []),
        ([('1', '0', '2')], False, []),
        ([(None, '0', '0')], False, []),
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
    metadata = MetaData()
    table = Table('records', metadata, Column('user_id', Integer, primary_key=True), Column('dept_id', Integer))
    mapper = registry()

    class Record:
        pass

    mapper.map_imperatively(Record, table)
    user = SimpleNamespace(
        user_id=1,
        dept_id=10,
        admin=admin,
        role=[
            RoleModel(roleId=index + 2, dataScope=scope, status=status, delFlag=deleted)
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
