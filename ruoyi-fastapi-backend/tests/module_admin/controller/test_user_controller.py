import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from common.enums import PasswordCharacterType
from common.vo import CrudResponseModel
from module_admin.controller.user_controller import (
    change_system_user_profile_info,
    edit_system_user,
    reset_system_user_pwd,
)
from module_admin.entity.vo.user_vo import EditUserModel, UpdateUserProfileModel
from module_admin.service.user_service import UserService
from utils.pwd_util import PwdUtil


@pytest.mark.asyncio
async def test_admin_reset_password_uses_front_end_default_rule() -> None:
    redis = SimpleNamespace()
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(redis=redis)))
    reset_user = EditUserModel(userId=2, password='abcdef')
    current_user = SimpleNamespace(user=SimpleNamespace(admin=True, user_name='admin'))
    expected = object()

    with (
        patch.object(UserService, 'check_user_allowed_services', new_callable=AsyncMock),
        patch.object(UserService, 'validate_password_services', new_callable=AsyncMock) as validate_password,
        patch.object(
            UserService,
            'edit_user_services',
            new=AsyncMock(return_value=CrudResponseModel(is_success=True, message='重置成功')),
        ),
        patch.object(PwdUtil, 'get_password_hash', return_value='hashed-password'),
        patch(
            'module_admin.controller.user_controller.ResponseUtil.success',
            return_value=expected,
        ),
    ):
        result = await inspect.unwrap(reset_system_user_pwd)(
            request,
            reset_user,
            object(),
            current_user,
            object(),
        )

    assert result is expected
    validate_password.assert_awaited_once_with(redis, 'abcdef', PasswordCharacterType.DEFAULT)


@pytest.mark.parametrize(
    'management_field',
    [
        {'deptId': 200},
        {'password': 'attacker-controlled'},
        {'status': '1'},
        {'delFlag': '2'},
        {'userType': '99'},
        {'createBy': 'attacker'},
    ],
)
def test_update_user_profile_model_rejects_management_fields(management_field: dict) -> None:
    with pytest.raises(ValidationError):
        UpdateUserProfileModel(nickName='普通用户', **management_field)


@pytest.mark.asyncio
async def test_update_user_profile_only_forwards_editable_fields() -> None:
    request = SimpleNamespace()
    user_info = UpdateUserProfileModel(
        nickName='新昵称',
        email='user@example.com',
        phonenumber='13800138000',
        sex='2',
    )
    current_user = SimpleNamespace(
        user=SimpleNamespace(
            user_id=2,
            user_name='user',
            role_ids='2',
            post_ids='3',
            role=[],
        )
    )
    expected = object()

    with (
        patch.object(
            UserService,
            'edit_user_services',
            new=AsyncMock(return_value=CrudResponseModel(is_success=True, message='更新成功')),
        ) as edit_user_services,
        patch(
            'module_admin.controller.user_controller.ResponseUtil.success',
            return_value=expected,
        ),
    ):
        result = await inspect.unwrap(change_system_user_profile_info)(
            request,
            user_info,
            object(),
            current_user,
        )

    assert result is expected
    edit_user = edit_user_services.await_args.args[1]
    update_fields = edit_user.model_dump(exclude_unset=True)
    assert update_fields['nick_name'] == '新昵称'
    assert update_fields['email'] == 'user@example.com'
    assert update_fields['phonenumber'] == '13800138000'
    assert update_fields['sex'] == '2'
    assert not {
        'dept_id',
        'password',
        'status',
        'del_flag',
        'user_type',
        'create_by',
        'create_time',
    }.intersection(update_fields)


@pytest.mark.asyncio
@pytest.mark.parametrize('operation_type', [None, 'pwd', 'status', 'avatar'])
async def test_edit_user_does_not_accept_password_or_internal_operation_type(operation_type: str | None) -> None:
    """普通编辑权限不能调用密码重置路径或写入内部维护字段。"""
    payload = EditUserModel(
        userId=2,
        deptId=100,
        userName='tester',
        nickName='新昵称',
        roleIds=[2],
        postIds=[3],
        password='injected-password-hash',
        type=operation_type,
        delFlag='2',
        loginIp='forged-ip',
        createBy='forged-creator',
    )
    current_user = SimpleNamespace(user=SimpleNamespace(admin=True, user_name='admin'))
    with patch.object(
        UserService,
        'edit_user_services',
        AsyncMock(return_value=CrudResponseModel(is_success=True, message='更新成功')),
    ) as edit_user:
        await inspect.unwrap(edit_system_user)(object(), payload, object(), current_user, object(), object(), object())

    update = edit_user.await_args.args[1]
    fields = update.model_dump(exclude_unset=True)
    assert not {'password', 'type', 'del_flag', 'login_ip', 'create_by'}.intersection(fields)
    assert update.nick_name == '新昵称'
    assert update.role_ids == [2]
    assert update.post_ids == [3]
    assert update.update_by == 'admin'
