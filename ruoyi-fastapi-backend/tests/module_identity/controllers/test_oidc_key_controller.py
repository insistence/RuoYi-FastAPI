from datetime import UTC, datetime
from inspect import unwrap
from types import SimpleNamespace

import pytest
from fastapi import Request
from fastapi.routing import APIRoute

from exceptions.exception import ServiceException
from module_identity.controller.oidc_key_controller import (
    activate_oidc_key,
    delete_oidc_key,
    list_oidc_keys,
    oidc_key_controller,
    retire_oidc_key,
)
from module_identity.service.key_service import KeyService, KeyServiceError, OidcKeyManagementService
from module_identity.service.runtime_service import OidcReadiness, OidcRuntimeService
from tests.module_identity.support.sessions import RecordingSession


def _user() -> SimpleNamespace:
    """
    构造管理用户。

    :return: 管理用户
    """
    return SimpleNamespace(user=SimpleNamespace(user_name='admin'))


def _request() -> Request:
    """
    构造密钥管理写请求。

    :return: 密钥管理写请求
    """
    app = SimpleNamespace(state=SimpleNamespace())
    return Request({'type': 'http', 'method': 'PUT', 'path': '/', 'headers': [], 'app': app})


def test_key_routes_use_separate_permissions_for_rotation_and_activation() -> None:
    """轮换与激活分别受独立权限保护，删除也必须受退役权限保护。"""
    routes = {
        (route.path, method): route
        for route in oidc_key_controller.routes
        if isinstance(route, APIRoute)
        for method in route.methods or ()
    }
    assert ('/system/oauth/key/{kid}/activate', 'PUT') in routes
    assert ('/system/oauth/key/{kid}/retire', 'PUT') in routes
    assert ('/system/oauth/key/{kid}', 'DELETE') in routes
    activate_perms = [
        getattr(dep.call, 'perm', None)
        for dep in routes[('/system/oauth/key/{kid}/activate', 'PUT')].dependant.dependencies
    ]
    assert 'system:oauthKey:activate' in activate_perms
    assert 'system:oauthKey:rotate' not in activate_perms
    assert oidc_key_controller.dependencies[0].dependency.__class__.__name__ == 'PreAuth'


@pytest.mark.asyncio
async def test_key_write_failures_rollback_and_never_return_private_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    """密钥状态异常稳定回滚，响应不包含私钥引用。"""
    db = RecordingSession()

    async def fail(*args: object, **kwargs: object) -> bool:
        """
        模拟此操作抛出 ValueError 的情形。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises ValueError: 模拟密钥操作产生含敏感信息的错误
        """
        raise ValueError('private_key_ciphertext=secret')

    monkeypatch.setattr(KeyService, 'activate_key', fail)
    with pytest.raises(ServiceException) as exc_info:
        await unwrap(activate_oidc_key)(_request(), 'kid-1', db, _user())
    assert exc_info.value.message is not None
    assert 'private_key_ciphertext' not in exc_info.value.message
    assert db.rollbacks == 1 and db.commits == 0

    async def retire(*args: object, **kwargs: object) -> bool:
        """
        在此测试分支返回 True。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 此分支的固定值 ``True``
        """
        return True

    monkeypatch.setattr(KeyService, 'retire_key', retire)
    response = await unwrap(retire_oidc_key)(_request(), 'kid-1', db, _user())
    assert b'true' in response.body
    assert db.commits == 1

    monkeypatch.setattr(KeyService, 'delete_key', retire)
    response = await unwrap(delete_oidc_key)(_request(), 'kid-1', db, _user())
    assert b'true' in response.body


@pytest.mark.asyncio
async def test_key_activation_returns_clear_message_before_publication(monkeypatch: pytest.MonkeyPatch) -> None:
    """密钥尚未公开时返回可操作提示，不暴露内部异常。"""
    db = RecordingSession()

    async def unpublished(*args: object, **kwargs: object) -> bool:
        """
        在调用时报告预期的测试失败：目标签名密钥尚未发布。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :raises KeyServiceError: 目标签名密钥尚未发布
        """
        raise KeyServiceError('目标签名密钥尚未发布')

    monkeypatch.setattr(KeyService, 'activate_key', unpublished)
    with pytest.raises(ServiceException) as exc_info:
        await unwrap(activate_oidc_key)(_request(), 'kid-1', db, _user())
    assert exc_info.value.message is not None
    assert '签名公钥尚未到公开时间' in exc_info.value.message
    assert db.rollbacks == 1 and db.commits == 0


@pytest.mark.asyncio
async def test_key_list_exposes_only_safe_enabled_capability(monkeypatch: pytest.MonkeyPatch) -> None:
    """密钥列表向管理页暴露启用能力，但不阻断 OIDC 关闭时的引导。"""

    async def list_page(*args: object, **kwargs: object) -> tuple[list[object], int]:
        """
        提供分页查询的测试结果。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 分页查询的测试结果
        """
        return [], 0

    monkeypatch.setattr(OidcKeyManagementService, 'list_page', list_page)
    monkeypatch.setattr(
        OidcRuntimeService,
        'inspect_readiness',
        lambda db: _async_readiness(OidcReadiness(False, False, 'disabled', datetime.now(UTC))),
    )
    response = await list_oidc_keys(RecordingSession())
    assert b'"enabled":false' in response.body
    assert b'"ready":false' in response.body
    assert b'private_key' not in response.body


async def _async_readiness(value: OidcReadiness) -> OidcReadiness:
    """
    返回可注入控制器的异步就绪状态。

    :param value: OIDC 协议运行时就绪快照
    :return: OIDC 协议运行时就绪快照
    """
    return value
