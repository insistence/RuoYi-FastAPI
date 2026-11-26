import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from module_admin.controller.user_controller import change_system_user_timezone
from module_admin.dao.user_dao import UserDao
from module_admin.entity.do.user_do import SysUser
from module_admin.entity.vo.user_vo import UserInfoModel, UserModel, UserTimezoneModel
from module_admin.service.user_service import UserService
from tests.module_admin.service.helpers import make_query_db
from utils.common_util import CamelCaseUtil


@pytest.mark.parametrize('value', ['auto', 'UTC', 'Asia/Shanghai', 'America/New_York', ' Asia/Kathmandu '])
def test_timezone_preference_validation(value: str) -> None:
    """校验用户的时区偏好。"""
    assert UserTimezoneModel(time_zone=value).time_zone == value.strip()
    assert UserModel(time_zone=value).time_zone == value.strip()


@pytest.mark.parametrize('value', ['', None, 'Mars/Olympus', 'UTC+8', '../UTC', 'a' * 65])
def test_invalid_timezone_preference_rejected(value: object) -> None:
    """拒绝无效的时区偏好。"""
    with pytest.raises(ValidationError):
        UserTimezoneModel.model_validate({'timeZone': value})
    with pytest.raises(ValidationError):
        UserModel.model_validate({'timeZone': value})


def test_timezone_endpoint_rejects_identity_and_management_fields() -> None:
    """时区接口拒绝身份及管理字段。"""
    with pytest.raises(ValidationError):
        UserTimezoneModel.model_validate({'timeZone': 'UTC', 'userId': 2})
    with pytest.raises(ValidationError):
        UserTimezoneModel.model_validate({'timeZone': 'UTC', 'roleIds': [1]})


@pytest.mark.asyncio
async def test_timezone_update_persists_only_current_account() -> None:
    """更新时区只写入当前账号。"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    try:
        async with engine.begin() as connection:
            await connection.run_sync(SysUser.get_table().create)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with sessions() as db:
            db.add_all(
                [
                    SysUser(user_id=1, user_name='one', nick_name='One', email='one@example.com', password='hash'),
                    SysUser(user_id=2, user_name='two', nick_name='Two'),
                ]
            )
            await db.commit()
        async with sessions() as db:
            current_user = SimpleNamespace(user=SimpleNamespace(user_id=1, user_name='one'))
            await inspect.unwrap(change_system_user_timezone)(
                SimpleNamespace(), UserTimezoneModel(time_zone='America/New_York'), db, current_user
            )
        async with sessions() as db:
            users = (await db.scalars(select(SysUser).order_by(SysUser.user_id))).all()
            assert [user.time_zone for user in users] == ['America/New_York', 'auto']
            assert users[0].email == 'one@example.com'
            assert users[0].nick_name == 'One'
            assert users[0].update_by == 'one'
            info = UserInfoModel(**CamelCaseUtil.transform_result(users[0]))
            assert info.model_dump(by_alias=True)['timeZone'] == 'America/New_York'
            await UserService.update_user_timezone_services(db, 1, 'one', 'auto')
        async with sessions() as db:
            user = await db.get(SysUser, 1)
            assert user is not None
            assert user.time_zone == 'auto'
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_timezone_update_rolls_back_on_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """时区更新失败时回滚。"""
    db = make_query_db()
    monkeypatch.setattr(UserDao, 'edit_user_dao', AsyncMock(side_effect=RuntimeError('database unavailable')))
    with pytest.raises(RuntimeError):
        await UserService.update_user_timezone_services(db, 1, 'one', 'UTC')
    db.commit.assert_not_awaited()
    db.rollback.assert_awaited_once()
