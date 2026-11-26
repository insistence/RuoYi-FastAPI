import json

import pytest
from pydantic import SecretStr, ValidationError

from config.env import DataBaseSettings, DataSourceNotFoundException, DataSourceSettings

DEFAULT_CONNECT_TIMEOUT = 10


def _source(**overrides: object) -> dict[str, object]:
    """
    构造数据库配置测试所需的数据源。

    :param overrides: 调用方按名称传入的附加选项
    :return: 数据库配置测试所需的数据源
    """
    values: dict[str, object] = {
        'db_type': 'mysql',
        'db_host': 'db.example.test',
        'db_port': 3306,
        'db_username': 'app',
        'db_password': 'super-secret',
        'db_database': 'appdb',
    }
    values.update(overrides)
    return values


def test_db_sources_json_is_parsed_and_password_is_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    """解析数据源 JSON 并保护密码字段。"""
    monkeypatch.setenv('DB_DEFAULT_SOURCE', 'primary')
    monkeypatch.setenv('DB_SOURCES', json.dumps({'primary': _source()}))

    settings = DataBaseSettings(_env_file=None)
    source = settings.default_source

    assert settings.get_source() is source
    assert isinstance(source.db_password, SecretStr)
    assert source.db_password.get_secret_value() == 'super-secret'
    assert source.db_connect_timeout == DEFAULT_CONNECT_TIMEOUT
    assert 'super-secret' not in repr(source)
    assert source.sqlglot_parse_dialect == 'mysql'


def test_postgresql_uses_sqlglot_postgres_dialect() -> None:
    """PostgreSQL 使用 sqlglot 的 postgres 方言。"""
    source = DataSourceSettings.model_validate(_source(db_type='postgresql', db_port=5432))

    assert source.sqlglot_parse_dialect == 'postgres'


def test_data_source_allows_disabling_pool_recycle() -> None:
    """数据源支持禁用连接池回收。"""
    source = DataSourceSettings.model_validate(_source(db_pool_recycle=-1))

    assert source.db_pool_recycle == -1


@pytest.mark.parametrize('db_connect_timeout', [0, -1])
def test_data_source_rejects_invalid_connect_timeout(db_connect_timeout: int) -> None:
    """数据源拒绝无效的连接超时。"""
    with pytest.raises(ValidationError):
        DataSourceSettings.model_validate(_source(db_connect_timeout=db_connect_timeout))


@pytest.mark.parametrize(
    ('field', 'value', 'message'),
    [
        ('DB_SOURCES', '{}', 'DB_SOURCES 不能为空'),
        ('DB_DEFAULT_SOURCE', 'missing', '默认数据源不存在'),
    ],
)
def test_database_settings_rejects_empty_or_unknown_default(
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    value: str,
    message: str,
) -> None:
    """数据库设置拒绝空的或未知的默认数据源。"""
    monkeypatch.setenv('DB_SOURCES', json.dumps({'primary': _source()}))
    monkeypatch.setenv('DB_DEFAULT_SOURCE', 'primary')
    monkeypatch.setenv(field, value)

    with pytest.raises(ValidationError, match=message):
        DataBaseSettings(_env_file=None)


def test_database_settings_rejects_invalid_source_name() -> None:
    """数据库设置拒绝无效的数据源名称。"""
    with pytest.raises(ValidationError, match='数据源名称不合法'):
        DataBaseSettings(
            _env_file=None,
            db_default_source='Primary',
            db_sources={'Primary': DataSourceSettings.model_validate(_source())},
        )


def test_database_settings_does_not_expose_legacy_flat_fields() -> None:
    """数据库设置不暴露旧的平铺字段。"""
    settings = DataBaseSettings(
        _env_file=None,
        db_sources={'primary': DataSourceSettings.model_validate(_source())},
    )

    assert not hasattr(settings, 'db_type')
    assert not hasattr(settings, 'db_password')


def test_get_source_rejects_unconfigured_name() -> None:
    """获取未配置的数据源时报错。"""
    settings = DataBaseSettings(
        _env_file=None,
        db_sources={'primary': DataSourceSettings.model_validate(_source())},
    )

    with pytest.raises(DataSourceNotFoundException):
        settings.get_source('reporting')


def test_malformed_sources_json_does_not_echo_password(monkeypatch: pytest.MonkeyPatch) -> None:
    """数据源 JSON 格式错误时隐藏密码。"""
    secret = 'must-not-leak'
    monkeypatch.setenv('DB_SOURCES', f'{{"primary":{{"db_password":"{secret}"')

    with pytest.raises(ValueError, match='DB_SOURCES JSON 格式错误') as exc_info:
        DataBaseSettings(_env_file=None)

    assert secret not in str(exc_info.value)


def test_invalid_source_fields_do_not_echo_password(monkeypatch: pytest.MonkeyPatch) -> None:
    """数据源字段无效时隐藏密码。"""
    secret = 'valid-json-secret'
    monkeypatch.setenv('DB_SOURCES', json.dumps({'primary': {'db_type': 'mysql', 'db_password': secret}}))

    with pytest.raises(ValidationError) as exc_info:
        DataBaseSettings(_env_file=None)

    assert secret not in str(exc_info.value)
