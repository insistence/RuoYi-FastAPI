import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from fastapi import FastAPI, Request, status
from redis.exceptions import TimeoutError as RedisTimeoutError

from common.annotation.cache_annotation import ApiCacheManager
from common.constant import ApiGroup
from config.env import AppConfig
from exceptions.handle import handle_exception
from module_admin.controller.login_controller import login_controller
from module_admin.service.login_service import LoginService
from utils.jwt_util import JwtUtil
from utils.response_util import ResponseUtil
from utils.time_util import TimezoneUtil

_USER_ID = '7'
_SESSION_ID = 'logout-session'


def _token(*, expired: bool = False, session_id: str = _SESSION_ID) -> str:
    return JwtUtil.encode(
        {
            'user_id': _USER_ID,
            'session_id': session_id,
            'exp': int(TimezoneUtil.utc_now().timestamp()) + (-60 if expired else 3600),
        }
    )


@pytest.fixture
def logout_app(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    app = FastAPI()
    app.state.redis = object()
    app.include_router(login_controller)
    handle_exception(app)
    logout = AsyncMock(return_value=True)
    clear_cache = AsyncMock(return_value=0)
    monkeypatch.setattr(LoginService, 'logout_services', logout)
    monkeypatch.setattr(ApiCacheManager, 'clear_namespaces', clear_cache)
    return SimpleNamespace(app=app, logout=logout, clear_cache=clear_cache)


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [False, True])
@pytest.mark.parametrize('expired', [False, True])
@pytest.mark.parametrize('scheme', ['Bearer', 'bearer'])
async def test_logout_passes_full_token_and_selected_session_to_service(
    logout_app: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    same_time_login: bool,
    expired: bool,
    scheme: str,
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    token = _token(expired=expired)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=logout_app.app), base_url='http://test') as client:
        response = await client.post('/logout', headers={'Authorization': f'{scheme} {token}'})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()['code'] == status.HTTP_200_OK
    assert response.json()['msg'] == '退出成功'
    logout_app.logout.assert_awaited_once()
    request, token_id, expected_token = logout_app.logout.await_args.args
    assert isinstance(request, Request)
    assert request.app is logout_app.app
    assert token_id == (_SESSION_ID if same_time_login else _USER_ID)
    assert expected_token == token
    logout_app.clear_cache.assert_awaited_once_with(logout_app.app.state.redis, ApiGroup.LOGOUT_MUTATION)


@pytest.mark.asyncio
@pytest.mark.parametrize('authorization', [None, 'Basic credentials', 'Bearer invalid-token'])
async def test_logout_rejects_invalid_credentials_before_session_or_cache_changes(
    logout_app: SimpleNamespace, authorization: str | None
) -> None:
    headers = {'Authorization': authorization} if authorization else {}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=logout_app.app), base_url='http://test') as client:
        response = await client.post('/logout', headers=headers)

    assert response.json()['code'] == status.HTTP_401_UNAUTHORIZED
    logout_app.logout.assert_not_awaited()
    logout_app.clear_cache.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('same_time_login', [False, True])
async def test_concurrent_logout_requests_keep_their_own_tokens(
    logout_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, same_time_login: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_same_time_login', same_time_login)
    tokens = [_token(session_id='old-session'), _token(session_id='new-session')]
    entered, resume = asyncio.Event(), asyncio.Event()
    arguments = []

    async def logout(request: Request, token_id: str, token: str) -> bool:
        arguments.append((token_id, token))
        if len(arguments) == len(tokens):
            entered.set()
        await resume.wait()
        return True

    logout_app.logout.side_effect = logout
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=logout_app.app), base_url='http://test') as client:
        pending = asyncio.gather(
            *(client.post('/logout', headers={'Authorization': f'Bearer {token}'}) for token in tokens)
        )
        await entered.wait()
        resume.set()
        responses = await pending

    expected_ids = ['old-session', 'new-session'] if same_time_login else [_USER_ID, _USER_ID]
    assert set(arguments) == set(zip(expected_ids, tokens, strict=True))
    assert all(response.json()['msg'] == '退出成功' for response in responses)
    assert logout_app.clear_cache.await_count == len(tokens)


@pytest.mark.asyncio
async def test_logout_service_failure_does_not_report_success_or_clear_cache(
    logout_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    logout_app.logout.side_effect = RedisTimeoutError('redis timeout')
    success = Mock(wraps=ResponseUtil.success)
    monkeypatch.setattr(ResponseUtil, 'success', success)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=logout_app.app), base_url='http://test') as client:
        with pytest.raises(RedisTimeoutError):
            await client.post('/logout', headers={'Authorization': f'Bearer {_token()}'})

    success.assert_not_called()
    logout_app.clear_cache.assert_not_awaited()


@pytest.mark.asyncio
async def test_cancelled_logout_does_not_report_success_or_clear_cache(
    logout_app: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    entered, resume = asyncio.Event(), asyncio.Event()

    async def logout(request: Request, token_id: str, token: str) -> bool:
        entered.set()
        await resume.wait()
        return True

    logout_app.logout.side_effect = logout
    success = Mock(wraps=ResponseUtil.success)
    monkeypatch.setattr(ResponseUtil, 'success', success)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=logout_app.app), base_url='http://test') as client:
        pending = asyncio.create_task(client.post('/logout', headers={'Authorization': f'Bearer {_token()}'}))
        await entered.wait()
        pending.cancel()
        with pytest.raises(asyncio.CancelledError):
            await pending

    success.assert_not_called()
    logout_app.clear_cache.assert_not_awaited()
