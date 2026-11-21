import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from common.vo import CrudResponseModel
from exceptions.exception import ServiceException
from module_admin.controller.dept_controller import add_system_dept, edit_system_dept
from module_admin.entity.vo.dept_vo import DeptModel
from module_admin.service.dept_service import DeptService


@pytest.mark.asyncio
async def test_add_dept_rejects_parent_outside_data_scope() -> None:
    current_user = SimpleNamespace(user=SimpleNamespace(admin=False, user_name='operator'))
    parent_id = 200
    with (
        patch.object(
            DeptService,
            'check_dept_data_scope_services',
            AsyncMock(side_effect=ServiceException(message='没有权限访问部门数据')),
        ) as check_scope,
        patch.object(DeptService, 'add_dept_services', AsyncMock()) as add_dept,
        pytest.raises(ServiceException),
    ):
        await inspect.unwrap(add_system_dept)(
            object(), DeptModel(parentId=parent_id, deptName='新部门'), object(), current_user, object()
        )
    assert check_scope.await_args.args[1] == parent_id
    add_dept.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(('parent_id', 'parent_changed'), [(100, False), (200, True)])
async def test_edit_dept_checks_changed_parent_scope(parent_id: int, parent_changed: bool) -> None:
    current_user = SimpleNamespace(user=SimpleNamespace(admin=False, user_name='operator'))
    query_db, scope = object(), object()
    with (
        patch.object(
            DeptService,
            'check_dept_data_scope_services',
            AsyncMock(side_effect=[None, ServiceException(message='没有权限访问部门数据')]),
        ) as check_scope,
        patch.object(DeptService, 'dept_detail_services', AsyncMock(return_value=DeptModel(deptId=101, parentId=100))),
        patch.object(
            DeptService,
            'edit_dept_services',
            AsyncMock(return_value=CrudResponseModel(is_success=True, message='更新成功')),
        ) as edit_dept,
    ):
        args = (object(), DeptModel(deptId=101, parentId=parent_id), query_db, current_user, scope)
        if parent_changed:
            with pytest.raises(ServiceException):
                await inspect.unwrap(edit_system_dept)(*args)
            assert [call.args[1] for call in check_scope.await_args_list] == [101, 200]
            edit_dept.assert_not_awaited()
        else:
            await inspect.unwrap(edit_system_dept)(*args)
            check_scope.assert_awaited_once_with(query_db, 101, scope)
            edit_dept.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_add_dept_does_not_require_parent_data_scope() -> None:
    current_user = SimpleNamespace(user=SimpleNamespace(admin=True, user_name='admin'))
    with (
        patch.object(DeptService, 'check_dept_data_scope_services', AsyncMock()) as check_scope,
        patch.object(
            DeptService,
            'add_dept_services',
            AsyncMock(return_value=CrudResponseModel(is_success=True, message='新增成功')),
        ) as add_dept,
    ):
        await inspect.unwrap(add_system_dept)(
            object(), DeptModel(parentId=100, deptName='新部门'), object(), current_user, object()
        )
    check_scope.assert_not_awaited()
    add_dept.assert_awaited_once()
