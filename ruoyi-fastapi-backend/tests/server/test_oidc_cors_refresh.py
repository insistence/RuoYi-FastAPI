from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from config.env import OidcConfig
from module_identity.service.runtime_service import OidcRuntimeService


@pytest.mark.asyncio
async def test_registered_cors_changes_reach_other_workers_and_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    """注册的跨域规则变更传达到其他进程且失败时拒绝访问。"""
    monkeypatch.setattr(OidcConfig, 'oidc_enabled', True)
    state = {'version': '0', 'origins': ('https://old.example',)}

    async def get(_key: str) -> str:
        """
        读取测试存储中的指定键。

        :param _key: 回调接收的查找键
        :return: 测试存储中的指定键
        """
        return state['version']

    async def incr(_key: str) -> None:
        """
        增加测试缓存键的计数。

        :param _key: 回调接收的查找键
        """
        state['version'] = str(int(state['version']) + 1)

    async def load() -> tuple[str, ...]:
        """
        捕获加载请求并提供测试密钥。

        :return: 为当前测试准备的密钥
        """
        return state['origins']

    redis = SimpleNamespace(get=get, incr=incr)
    worker_a = SimpleNamespace(state=SimpleNamespace(redis=redis))
    worker_b = SimpleNamespace(state=SimpleNamespace(redis=redis))
    monkeypatch.setattr(OidcRuntimeService, 'load_cors_origins', load)
    for app in (worker_a, worker_b):
        await OidcRuntimeService.ensure_cors_snapshot(app)
    state['origins'] = ('https://new.example',)
    await OidcRuntimeService.cors_snapshot_callback(worker_a)()
    await OidcRuntimeService.ensure_cors_snapshot(worker_b)
    assert (
        worker_a.state.oidc_registered_cors_origins == worker_b.state.oidc_registered_cors_origins == state['origins']
    )
    # 有时限的缓存兜底无需依赖变更通知
    state['origins'] = ()
    worker_b.state.oidc_cors_loaded_at = 0
    await OidcRuntimeService.ensure_cors_snapshot(worker_b)
    assert worker_b.state.oidc_registered_cors_origins == ()
    worker_a.state.oidc_cors_loaded_at = 0
    monkeypatch.setattr(
        OidcRuntimeService, 'load_cors_origins', AsyncMock(side_effect=RuntimeError('database unavailable'))
    )
    await OidcRuntimeService.ensure_cors_snapshot(worker_a)
    assert worker_a.state.oidc_registered_cors_origins == ()
