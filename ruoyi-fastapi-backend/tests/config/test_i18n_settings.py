import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

from config.env import I18nSettings

BACKEND_DIR = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize('locale', ['zh-CN', 'en-US', 'ja-JP'])
def test_i18n_settings_read_environment_without_limiting_languages(
    monkeypatch: pytest.MonkeyPatch, locale: str
) -> None:
    """验证语言配置允许尚未发布的语言标签。"""
    monkeypatch.setenv('I18N_DEFAULT_LOCALE', locale)

    assert I18nSettings().i18n_default_locale == locale


@pytest.mark.parametrize('locale', ['', 'a' * 64])
def test_i18n_settings_reject_invalid_length(locale: str) -> None:
    """验证语言配置拒绝空标签和过长标签。"""
    with pytest.raises(ValidationError, match='i18n_default_locale'):
        I18nSettings(i18n_default_locale=locale)


def _load_i18n_config(
    tmp_path: Path, file_locale: str | None, external_locale: str | None
) -> subprocess.CompletedProcess[str]:
    """
    在独立进程中读取指定环境文件和环境变量，返回配置加载结果。

    :param tmp_path: pytest 为当前用例创建的临时目录
    :param file_locale: 配置文件中设置的语言
    :param external_locale: 外部环境指定的语言
    :return: 独立进程解析出的国际化配置
    """
    (tmp_path / '.env.i18n-test').write_text(
        '' if file_locale is None else f'I18N_DEFAULT_LOCALE={file_locale}\n', encoding='utf-8'
    )
    process_env = {
        key: value for key, value in os.environ.items() if key != 'APP_ENV' and not key.startswith(('I18N_', 'OIDC_'))
    }
    process_env['PYTHONPATH'] = str(BACKEND_DIR)
    process_env['DB_DEFAULT_SOURCE'] = 'primary'
    process_env['DB_SOURCES'] = json.dumps(
        {
            'primary': {
                'db_type': 'mysql',
                'db_host': '127.0.0.1',
                'db_port': 1,
                'db_username': 'test',
                'db_password': 'test',
                'db_database': 'isolated',
            }
        }
    )
    if external_locale is not None:
        process_env['I18N_DEFAULT_LOCALE'] = external_locale
    script = """
import json
from common.context import LocaleContext, RequestContext
from config.env import I18nConfig, get_config
from i18n.locale import LocaleUtil
print(json.dumps({
    'env': get_config.run_env,
    'configured': I18nConfig.i18n_default_locale,
    'context': LocaleContext().locale,
    'current': RequestContext.get_current_locale().locale,
    'negotiated': LocaleUtil.negotiate_language('unsupported'),
    'source': I18nConfig.SOURCE_LOCALE,
}))
"""
    return subprocess.run(
        [sys.executable, '-c', script, '--env', 'i18n-test'],
        cwd=tmp_path,
        env=process_env,
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )


@pytest.mark.parametrize(
    ('file_locale', 'external_locale', 'expected'),
    [(None, None, 'zh-CN'), ('en-US', None, 'en-US'), ('en-US', 'zh-CN', 'zh-CN')],
)
def test_i18n_config_uses_selected_env_file_and_external_priority(
    tmp_path: Path, file_locale: str | None, external_locale: str | None, expected: str
) -> None:
    """验证指定环境文件生效，且外部环境变量可以覆盖文件配置。"""
    result = _load_i18n_config(tmp_path, file_locale, external_locale)

    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        'env': 'i18n-test',
        'configured': expected,
        'context': expected,
        'current': expected,
        'negotiated': expected,
        'source': 'zh-CN',
    }


def test_i18n_config_rejects_unregistered_default_locale(tmp_path: Path) -> None:
    """验证服务启动时会拒绝未注册的默认语言。"""
    result = _load_i18n_config(tmp_path, 'ja-JP', None)

    assert result.returncode != 0
    assert 'I18N_DEFAULT_LOCALE must be registered' in result.stderr
