import pytest
from pydantic import ValidationError

from config.env import AppSettings


def test_app_timezone_accepts_valid_iana_name(monkeypatch: pytest.MonkeyPatch) -> None:
    """应用时区接受有效的 IANA 名称。"""
    monkeypatch.setenv('APP_TIMEZONE', 'America/New_York')

    assert AppSettings(_env_file=None).app_timezone == 'America/New_York'


@pytest.mark.parametrize('timezone_name', ['', 'Not/A-Timezone'])
def test_app_timezone_rejects_invalid_name(timezone_name: str) -> None:
    """应用时区拒绝无效名称。"""
    with pytest.raises(ValidationError, match='APP_TIMEZONE'):
        AppSettings(_env_file=None, app_timezone=timezone_name)
