from pathlib import Path

import pytest
from pydantic import ValidationError

from config.env import AppSettings

CACHE_LIFETIME_SECONDS = 3
DEFAULT_CACHE_LIFETIME_SECONDS = 5


@pytest.mark.parametrize('seconds', [0, -1, 61])
def test_current_user_cache_rejects_invalid_lifetime(seconds: int) -> None:
    """缓存必须短时过期，不能配置为永久有效或非法有效期。"""
    with pytest.raises(ValidationError, match='app_current_user_cache_ttl_seconds'):
        AppSettings(app_current_user_cache_ttl_seconds=seconds)


def test_current_user_cache_is_enabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """未显式配置时启用缓存，并使用短时硬过期。"""
    monkeypatch.delenv('APP_CURRENT_USER_CACHE_ENABLED', raising=False)
    monkeypatch.delenv('APP_CURRENT_USER_CACHE_TTL_SECONDS', raising=False)

    settings = AppSettings()

    assert settings.app_current_user_cache_enabled is True
    assert settings.app_current_user_cache_ttl_seconds == DEFAULT_CACHE_LIFETIME_SECONDS


@pytest.mark.parametrize('enabled', [True, False])
def test_current_user_cache_environment_configuration(monkeypatch: pytest.MonkeyPatch, enabled: bool) -> None:
    """缓存开关和有效期可通过环境变量配置。"""
    monkeypatch.setenv('APP_CURRENT_USER_CACHE_ENABLED', str(enabled).lower())
    monkeypatch.setenv('APP_CURRENT_USER_CACHE_TTL_SECONDS', str(CACHE_LIFETIME_SECONDS))

    settings = AppSettings()

    assert settings.app_current_user_cache_enabled is enabled
    assert settings.app_current_user_cache_ttl_seconds == CACHE_LIFETIME_SECONDS


@pytest.mark.parametrize('environment', ['dev', 'prod', 'dockermy', 'dockerpg'])
def test_environment_templates_include_current_user_cache_settings(environment: str) -> None:
    """各部署环境明确提供缓存开关及默认硬过期时间。"""
    environment_file = Path(__file__).resolve().parents[2] / f'.env.{environment}'
    content = environment_file.read_text()

    assert 'APP_CURRENT_USER_CACHE_ENABLED = true' in content
    assert 'APP_CURRENT_USER_CACHE_TTL_SECONDS = 5' in content
