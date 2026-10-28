from unittest.mock import patch

import pytest
from pydantic import ValidationError

from config.env import JwtSettings


def test_empty_jwt_secret_key_is_generated(monkeypatch: pytest.MonkeyPatch) -> None:
    """校验空Jwt密钥会自动生成32字节随机值。"""
    monkeypatch.setenv('JWT_SECRET_KEY', '')

    with patch('config.env.secrets.token_hex', return_value='a' * 64) as token_hex:
        settings = JwtSettings()

    token_hex.assert_called_once_with(32)
    assert settings.jwt_secret_key == 'a' * 64


def test_missing_jwt_secret_key_is_generated(monkeypatch: pytest.MonkeyPatch) -> None:
    """校验未配置Jwt密钥时也会使用安全随机默认值。"""
    monkeypatch.delenv('JWT_SECRET_KEY', raising=False)

    with patch('config.env.secrets.token_hex', return_value='b' * 64) as token_hex:
        settings = JwtSettings()

    token_hex.assert_called_once_with(32)
    assert settings.jwt_secret_key == 'b' * 64


def test_configured_jwt_secret_key_is_preserved(monkeypatch: pytest.MonkeyPatch) -> None:
    """校验显式配置的Jwt密钥不会被随机值覆盖。"""
    configured_secret = 'configured-jwt-secret'
    monkeypatch.setenv('JWT_SECRET_KEY', configured_secret)

    with patch('config.env.secrets.token_hex') as token_hex:
        settings = JwtSettings()

    token_hex.assert_not_called()
    assert settings.jwt_secret_key == configured_secret


@pytest.mark.parametrize('minutes', [0, -1])
def test_redis_session_expiration_rejects_nonpositive_minutes(minutes: int) -> None:
    """会话续期时间必须为正数，避免EXPIRE删除会话后仍被视为续期成功。"""
    with pytest.raises(ValidationError, match='jwt_redis_expire_minutes'):
        JwtSettings(jwt_redis_expire_minutes=minutes)


@pytest.mark.parametrize('minutes', ['0', '-1'])
def test_redis_session_expiration_rejects_invalid_environment(monkeypatch: pytest.MonkeyPatch, minutes: str) -> None:
    """环境变量中的非法会话有效期应在加载配置时被拒绝。"""
    monkeypatch.setenv('JWT_REDIS_EXPIRE_MINUTES', minutes)

    with pytest.raises(ValidationError, match='jwt_redis_expire_minutes'):
        JwtSettings()


@pytest.mark.parametrize('minutes', ['1', '30'])
def test_redis_session_expiration_accepts_positive_environment(monkeypatch: pytest.MonkeyPatch, minutes: str) -> None:
    """保留合法环境变量的分钟单位和取值。"""
    monkeypatch.setenv('JWT_REDIS_EXPIRE_MINUTES', minutes)

    assert JwtSettings().jwt_redis_expire_minutes == int(minutes)
