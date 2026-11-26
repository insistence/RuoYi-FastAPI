import argparse
import configparser
import json
import os
import re
import secrets
import sys
from typing import Annotated, ClassVar, Literal
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, SecretStr, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from exceptions.exception import DataSourceNotFoundException
from utils.time_util import TimezoneUtil


class AppSettings(BaseSettings):
    """应用配置。"""

    app_env: str = Field(default='dev', description='应用运行环境')
    app_name: str = Field(default='RuoYi-FastAPI', description='应用名称')
    app_root_path: str = Field(default='/dev-api', description='部署在反向代理后的应用路径前缀')
    app_host: str = Field(default='0.0.0.0', description='应用监听地址')
    app_port: int = Field(default=9099, description='应用监听端口')
    app_version: str = Field(default='2.0.0', description='应用版本号')
    app_release_id: str = Field(default='', description='当前部署的发布标识')
    app_reload: bool = Field(default=True, description='是否在源码变更后自动重启')
    app_workers: int = Field(default=1, description='应用工作进程数')
    app_ip_location_query: bool = Field(default=True, description='是否查询客户端 IP 的地理位置')
    app_same_time_login: bool = Field(default=True, description='是否允许同一账号同时登录')
    app_current_user_cache_enabled: bool = Field(default=True, description='是否缓存当前用户的资料和权限')
    app_current_user_cache_ttl_seconds: int = Field(default=5, ge=1, le=60, description='当前用户缓存的有效期（秒）')
    app_demo_mode: bool = Field(default=False, description='是否启用演示模式')
    app_disable_swagger: bool = Field(default=False, description='是否关闭 Swagger UI')
    app_disable_redoc: bool = Field(default=False, description='是否关闭 ReDoc 接口文档')
    app_trusted_proxy_ips: str = Field(default='127.0.0.1,::1', description='可转发客户端地址的受信任代理 IP')
    app_trusted_proxy_hops: int = Field(default=1, description='解析客户端地址时信任的代理跳数')
    app_default_enabled_plugins: str = Field(default='ai', description='默认启用的插件标识')
    app_timezone: str = Field(default='Asia/Shanghai', description='业务日期和时间使用的 IANA 时区')

    @field_validator('app_timezone')
    @classmethod
    def validate_app_timezone(cls, value: str) -> str:
        """
        校验应用业务时区是否为有效的IANA时区名称。

        :param value: IANA时区名称
        :return: 去除首尾空格后的IANA时区名称
        :raises ValueError: 应用时区不是有效的 IANA 名称
        """
        try:
            return TimezoneUtil.validate_timezone_name(value)
        except ValueError as exc:
            raise ValueError(f'APP_TIMEZONE: {exc}') from None


class I18nSettings(BaseSettings):
    """国际化配置。"""

    SOURCE_LOCALE: ClassVar[str] = 'zh-CN'
    i18n_default_locale: str = Field(
        default=SOURCE_LOCALE, min_length=1, max_length=63, description='未指定语言时使用的语言标记'
    )


class JwtSettings(BaseSettings):
    """Jwt配置。"""

    jwt_secret_key: str = Field(default_factory=lambda: secrets.token_hex(32), description='签发和校验 JWT 的密钥')
    jwt_algorithm: str = Field(default='HS256', description='JWT 签名算法')
    jwt_expire_minutes: int = Field(default=1440, description='JWT 的有效期（分钟）')
    jwt_redis_expire_minutes: int = Field(default=30, gt=0, description='Redis 登录会话的有效期（分钟）')

    @field_validator('jwt_secret_key', mode='before')
    @classmethod
    def generate_empty_secret_key(cls, value: object) -> object:
        """
        Jwt密钥未配置时生成随机值。

        :param value: 环境变量中的Jwt密钥
        :return: 已配置的Jwt密钥或随机生成的密钥
        """
        if value is None or (isinstance(value, str) and not value.strip()):
            return secrets.token_hex(32)
        return value


class DataSourceSettings(BaseModel):
    """单个数据源配置。"""

    model_config = ConfigDict(hide_input_in_errors=True)

    db_type: Literal['mysql', 'postgresql'] = Field(description='数据库类型')
    db_host: str = Field(min_length=1, description='数据库服务器地址')
    db_port: int = Field(ge=1, le=65535, description='数据库监听端口')
    db_username: str = Field(min_length=1, description='数据库连接用户名')
    db_password: SecretStr = Field(description='数据库连接密码')
    db_database: str = Field(min_length=1, description='数据库名称')

    db_echo: bool = Field(default=True, description='是否输出 SQLAlchemy 执行的 SQL')
    db_connect_timeout: int = Field(default=10, gt=0, description='建立数据库连接的超时时间（秒）')
    db_max_overflow: int = Field(default=10, ge=0, description='连接池可临时增加的最大连接数')
    db_pool_size: int = Field(default=20, ge=1, description='连接池保留的连接数')
    db_pool_recycle: int = Field(default=3600, ge=-1, description='回收数据库连接的时限（秒），负一表示禁用')
    db_pool_timeout: int = Field(default=30, gt=0, description='等待连接池分配连接的超时时间（秒）')
    db_required: bool = Field(default=True, description='应用启动时是否要求该数据源可用')

    @computed_field(description='SQLGlot 解析该数据源 SQL 时使用的方言')
    @property
    def sqlglot_parse_dialect(self) -> str:
        """
        获取SQLGlot解析方言。

        :return: SQLGlot解析方言
        """
        if self.db_type == 'postgresql':
            return 'postgres'
        return self.db_type


DATA_SOURCE_NAME_PATTERN = re.compile(r'^[a-z][a-z0-9_-]{0,63}$')


class DataBaseSettings(BaseSettings):
    """数据库集合配置。"""

    model_config = SettingsConfigDict(hide_input_in_errors=True)

    db_default_source: str = Field(default='primary', description='默认数据源名称')
    db_sources: Annotated[dict[str, DataSourceSettings], NoDecode] = Field(
        default_factory=dict, description='按名称索引的数据源配置'
    )

    @field_validator('db_sources', mode='before')
    @classmethod
    def parse_sources_json(cls, value: object) -> object:
        """
        解析显式传入的数据源JSON字符串。

        :param value: 数据源配置原始值
        :return: 解析后的数据源配置
        :raises ValueError: DB_SOURCES JSON 格式错误
        """
        if not isinstance(value, str):
            return value
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            raise ValueError('DB_SOURCES JSON 格式错误') from None

    @model_validator(mode='after')
    def validate_sources(self) -> 'DataBaseSettings':
        """
        校验数据源集合和默认数据源配置。

        :return: 数据库集合配置
        :raises ValueError: DB_SOURCES 不能为空
        """
        if not self.db_sources:
            raise ValueError('DB_SOURCES 不能为空')
        if self.db_default_source not in self.db_sources:
            raise ValueError(f'默认数据源不存在：{self.db_default_source}')
        for name in self.db_sources:
            if not DATA_SOURCE_NAME_PATTERN.fullmatch(name):
                raise ValueError(f'数据源名称不合法：{name}')
        return self

    def get_source(self, name: str | None = None) -> DataSourceSettings:
        """
        获取指定数据源配置。

        :param name: 数据源名称
        :return: 数据源配置
        :raises DataSourceNotFoundException: 指定的数据源没有配置
        """
        source_name = name or self.db_default_source
        try:
            return self.db_sources[source_name]
        except KeyError as exc:
            raise DataSourceNotFoundException(source_name) from exc

    @property
    def default_source(self) -> DataSourceSettings:
        """
        获取默认数据源配置。

        :return: 默认数据源配置
        """
        return self.get_source()


class RedisSettings(BaseSettings):
    """Redis配置。"""

    redis_host: str = Field(default='127.0.0.1', description='Redis 服务器地址')
    redis_port: int = Field(default=6379, description='Redis 监听端口')
    redis_username: str = Field(default='', description='Redis 认证用户名')
    redis_password: str = Field(default='', description='Redis 认证密码')
    redis_database: int = Field(default=2, description='Redis 数据库编号')


class LogSettings(BaseSettings):
    """日志与队列配置。"""

    log_mask_enabled: bool = Field(default=True, description='是否对日志中的敏感值脱敏')
    log_mask_placeholder: str = Field(default='******', description='替换敏感日志值的占位符')
    log_mask_fields: str = Field(
        default=(
            'password,old_password,new_password,confirm_password,api_key,token,access_token,refresh_token,'
            'authorization,client_secret,secret,secret_key,private_key,private_key_pem,credential,credentials,'
            'sms_code,captcha_code,system_prompt'
        ),
        description='需要完全遮盖的日志字段',
    )
    log_partial_mask_fields: str = Field(
        default='phonenumber,phone,mobile,email', description='仅遮盖部分内容的日志字段'
    )
    log_config_secret_patterns: str = Field(
        default='password,token,secret,key,private,credential,access,jwt,captcha,sms',
        description='用来识别敏感配置键的名称模式',
    )
    log_stream_key: str = Field(default='log:stream', description='存放待处理日志的 Redis Stream 键')
    log_stream_group: str = Field(default='log_aggregator', description='消费日志的 Redis 消费组名称')
    log_stream_consumer_prefix: str = Field(default='worker', description='日志消费者名称的前缀')
    log_stream_batch_size: int = Field(default=100, description='每批读取的最大日志条数')
    log_stream_block_ms: int = Field(default=2000, description='等待新日志的阻塞时间（毫秒）')
    log_stream_maxlen: int = Field(default=100000, description='日志流保留的最大条目数')
    log_stream_claim_idle_ms: int = Field(default=60000, description='待确认日志可被其他消费者认领前的空闲时长（毫秒）')
    log_stream_claim_interval_ms: int = Field(default=5000, description='两次认领未确认日志的间隔（毫秒）')
    log_stream_claim_batch_size: int = Field(default=100, description='每次认领未确认日志的最大条数')
    log_stream_dedup_ttl: int = Field(default=3600, description='日志去重标记的有效期（秒）')
    log_stream_dedup_prefix: str = Field(default='log:dedup', description='Redis 日志去重键的前缀')

    loguru_json: bool = Field(default=False, description='是否以 JSON 输出日志')
    loguru_level: str = Field(default='INFO', description='输出日志的最低级别')
    loguru_stdout: bool = Field(default=True, description='是否将日志写入标准输出')
    log_file_enabled: bool = Field(default=True, description='是否写入日志文件')
    log_file_base_dir: str = Field(default='logs', description='日志文件的根目录')
    loguru_rotation: str = Field(default='50MB', description='日志文件轮转条件')
    loguru_retention: str = Field(default='30 days', description='已轮转日志的保留期限')
    loguru_compression: str = Field(default='zip', description='归档日志文件的压缩格式')
    log_instance_id: str = Field(default='prod', description='写入日志的应用实例标识')
    log_service_name: str = Field(default='ruoyi-fastapi-backend', description='写入日志的服务名称')
    log_worker_id: str = Field(default='auto', description='写入日志的工作进程标识')


class TransportCryptoSettings(BaseSettings):
    """传输层加解密配置。"""

    transport_crypto_enabled: bool = Field(default=True, description='是否启用请求和响应的传输加密')
    transport_crypto_mode: Literal['off', 'optional', 'required'] = Field(
        default='optional', description='接口传输加密模式'
    )
    transport_crypto_algorithm: str = Field(default='RSA_OAEP_AES_256_GCM', description='传输加密协议使用的算法')
    transport_crypto_kid: str = Field(default='default', description='当前传输密钥的标识')
    transport_crypto_public_key: str = Field(default='', description='用于传输加密的公钥')
    transport_crypto_private_key: str = Field(default='', description='用于传输解密的私钥')
    transport_crypto_legacy_key_pairs: str = Field(default='[]', description='轮换后仍可用于解密的旧密钥对')
    transport_crypto_rsa_key_size: int = Field(default=2048, description='传输加密 RSA 密钥的位数')
    transport_crypto_public_key_ttl_seconds: int = Field(default=3600, description='传输公钥的缓存时长（秒）')
    transport_crypto_frontend_config_ttl_seconds: int = Field(
        default=300, description='前端缓存传输加密配置的时长（秒）'
    )
    transport_crypto_max_get_url_length: int = Field(default=4096, description='加密 GET 请求允许的最大 URL 长度')
    transport_crypto_clock_skew_seconds: int = Field(
        default=120, description='校验加密请求时间戳时允许的时钟偏差（秒）'
    )
    transport_crypto_replay_ttl_seconds: int = Field(default=300, description='加密请求防重放标记的有效期（秒）')
    transport_crypto_enabled_paths: str = Field(default='', description='启用传输加密的接口路径')
    transport_crypto_required_paths: str = Field(default='', description='必须使用传输加密的接口路径')
    transport_crypto_exclude_paths: str = Field(
        default=(
            '/openapi.json,/docs,/docs/oauth2-redirect,/redoc,'
            '/transport/crypto/frontend-config,/transport/crypto/public-key,/common/download,/common/download/resource,'
            '/common/files,/system/file/download,'
            '/.well-known/openid-configuration,/.well-known/oauth-authorization-server,'
            '/oauth2/authorize,/oauth2/token,/oauth2/userinfo,/oauth2/jwks,'
            '/oauth2/revoke,/oauth2/introspect,/oauth2/logout'
        ),
        description='跳过传输加密的接口路径',
    )


class OidcSettings(BaseSettings):
    """
    OIDC/OAuth2 认证中心配置。

    OIDC 默认关闭，关闭时只保留可安全解析的默认值，不要求发行者、签名密钥
    或不透明令牌 Pepper，从而保证现有 Legacy JWT 启动路径完全不变。
    """

    oidc_enabled: bool = Field(default=False, description='是否启用 OIDC 身份提供方')
    oidc_issuer: str = Field(default='https://auth.example.com', description='OIDC 令牌的签发者标识')
    oidc_public_base_url: str = Field(default='https://auth.example.com', description='对外发布 OIDC 端点的基础地址')

    oidc_require_pkce: bool = Field(default=True, description='是否要求授权码流程使用 PKCE')
    oidc_pkce_methods: str = Field(default='S256', description='允许的 PKCE 挑战方法')
    oidc_allowed_clock_skew_seconds: int = Field(default=60, ge=0, description='OIDC 令牌校验允许的时钟偏差（秒）')
    oidc_authorization_code_ttl_seconds: int = Field(default=90, gt=0, description='授权码有效期（秒）')
    oidc_interaction_ttl_seconds: int = Field(default=300, gt=0, description='登录和授权交互的有效期（秒）')
    oidc_id_token_ttl_seconds: int = Field(default=300, gt=0, description='身份令牌有效期（秒）')
    oidc_access_token_ttl_seconds: int = Field(default=600, gt=0, description='访问令牌的默认有效期（秒）')
    oidc_max_access_token_ttl_seconds: int = Field(default=1800, gt=0, description='访问令牌允许的最长有效期（秒）')
    oidc_refresh_token_idle_seconds: int = Field(default=604800, gt=0, description='刷新令牌允许空闲的最长时间（秒）')
    oidc_refresh_token_absolute_seconds: int = Field(
        default=2592000, gt=0, description='刷新令牌从签发起的最长有效期（秒）'
    )

    oidc_sso_idle_seconds: int = Field(default=1800, gt=0, description='单点登录会话允许空闲的最长时间（秒）')
    oidc_sso_absolute_seconds: int = Field(default=28800, gt=0, description='普通单点登录会话的最长有效期（秒）')
    oidc_sso_remember_absolute_seconds: int = Field(
        default=604800, gt=0, description='选择记住登录后会话的最长有效期（秒）'
    )
    oidc_sso_cookie_name: str = Field(default='__Host-ruoyi-sso', description='单点登录 Cookie 名称')
    oidc_sso_cookie_secure: bool = Field(default=True, description='是否仅通过 HTTPS 发送单点登录 Cookie')
    oidc_sso_cookie_samesite: Literal['lax', 'strict', 'none'] = Field(
        default='lax', description='单点登录 Cookie 的跨站发送策略'
    )
    oidc_sso_cookie_domain: str | None = Field(default=None, description='单点登录 Cookie 的作用域名')

    oidc_signing_algorithm: Literal['RS256'] = Field(default='RS256', description='OIDC 令牌的签名算法')
    oidc_signing_key_source: Literal['file', 'kms', 'hsm'] = Field(default='file', description='OIDC 签名密钥的来源')
    oidc_signing_private_key_path: str = Field(default='', description='OIDC 签名私钥文件路径')
    oidc_signing_key_encryption_key: str = Field(default='', description='加密存储 OIDC 签名私钥的密钥')
    oidc_active_kid: str = Field(default='', description='当前用于签发令牌的密钥标识')
    oidc_key_rotation_overlap_seconds: int = Field(
        default=86400, gt=0, description='密钥轮换时新旧密钥并存的时长（秒）'
    )

    oidc_token_hash_pepper: str = Field(default='', description='计算 OIDC 令牌摘要时使用的独立密钥')

    oidc_cors_allowed_origins: str = Field(default='', description='允许跨域访问 OIDC 端点的来源')
    oidc_interaction_login_url: str = Field(
        default='https://auth.example.com/auth-center/login', description='OIDC 交互登录页面地址'
    )
    oidc_interaction_consent_url: str = Field(
        default='https://auth.example.com/auth-center/consent', description='OIDC 授权确认页面地址'
    )
    oidc_interaction_error_url: str = Field(
        default='https://auth.example.com/auth-center/error', description='OIDC 交互错误页面地址'
    )

    oidc_audit_retention_days: int = Field(default=180, gt=0, description='OIDC 审计记录保留天数')
    oidc_backchannel_logout_timeout_seconds: int = Field(default=5, gt=0, description='后通道注销请求的超时时间（秒）')
    oidc_legacy_auth_isolation_enabled: bool = Field(default=True, description='是否隔离 OIDC 与旧版登录认证')
    OIDC_PEPPER_MIN_BYTES: ClassVar[int] = 32

    @staticmethod
    def _normalise_url(value: str, field_name: str, *, allow_empty: bool = False) -> str:
        """
        规范化并校验认证中心地址。

        :param value: 待校验的 URL 文本
        :param field_name: 配置字段名称
        :param allow_empty: 是否允许空值
        :return: 去除尾部斜杠且不含 query/fragment 的 URL
        :raises ValueError: URL 不是绝对 HTTP(S) 地址或含有不安全部分
        """
        value = value.strip().strip('\'"')
        if not value:
            if allow_empty:
                return ''
            raise ValueError(f'{field_name} 不能为空')
        parsed = urlsplit(value)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            raise ValueError(f'{field_name} 必须是绝对 HTTP(S) URL')
        if parsed.username or parsed.password:
            raise ValueError(f'{field_name} 不得包含用户信息')
        if parsed.query or parsed.fragment:
            raise ValueError(f'{field_name} 不得包含查询参数或片段标识')
        path = parsed.path.rstrip('/')
        return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, '', ''))

    @staticmethod
    def _is_local_http(url: str) -> bool:
        """
        判断 URL 是否属于仅开发环境允许的本机 HTTP 地址。

        :param url: 已解析的 URL
        :return: 是否为 localhost、127.0.0.1 或 ::1 的 HTTP 地址
        """
        parsed = urlsplit(url)
        host = (parsed.hostname or '').lower()
        return parsed.scheme == 'http' and host in {'localhost', '127.0.0.1', '::1'}

    @property
    def pkce_method_list(self) -> tuple[str, ...]:
        """
        返回规范化后的 PKCE 方法集合。

        :return: 以逗号分隔配置解析出的 PKCE 方法
        """
        return tuple(item.strip() for item in self.oidc_pkce_methods.split(',') if item.strip())

    @property
    def cors_origin_list(self) -> tuple[str, ...]:
        """
        返回规范化后的、用于精确匹配的注册 Origin。

        :return: 去除空项和尾部斜杠后的 Origin 集合
        """
        return tuple(item.strip().rstrip('/') for item in self.oidc_cors_allowed_origins.split(',') if item.strip())

    def _validate_issuer_urls(self, app_env: str) -> None:
        """
        校验 issuer、公开基址及环境协议要求。

        :param app_env: 当前应用环境
        :raises ValueError: issuer 不安全、含路径前缀或公开地址不一致
        """
        if self.oidc_issuer != self.oidc_public_base_url:
            raise ValueError('OIDC_PUBLIC_BASE_URL 必须与 OIDC_ISSUER 一致')
        parsed = urlsplit(self.oidc_issuer)
        if parsed.path.rstrip('/'):
            raise ValueError('OIDC_ISSUER 不得包含路径前缀')
        if parsed.scheme != 'https' and not (
            app_env in {'dev', 'test', 'local'} and self._is_local_http(self.oidc_issuer)
        ):
            raise ValueError('OIDC_ISSUER 生产环境必须使用 HTTPS')
        if urlsplit(self.oidc_public_base_url).scheme != parsed.scheme:
            raise ValueError('OIDC_PUBLIC_BASE_URL 必须与签发者地址使用相同协议')

    def _validate_protocol_options(self) -> None:
        """
        校验 PKCE 和各类协议 TTL。

        :raises ValueError: 协议选项不符合统一认证安全边界
        """
        if not self.oidc_require_pkce:
            raise ValueError('OIDC_REQUIRE_PKCE 启用认证中心时必须为 true')
        if self.pkce_method_list != ('S256',):
            raise ValueError('OIDC_PKCE_METHODS 目前只能配置为 S256')
        if self.oidc_access_token_ttl_seconds > self.oidc_max_access_token_ttl_seconds:
            raise ValueError('OIDC_MAX_ACCESS_TOKEN_TTL_SECONDS 不能小于默认访问令牌有效期')
        if self.oidc_refresh_token_idle_seconds > self.oidc_refresh_token_absolute_seconds:
            raise ValueError('刷新令牌闲置有效期不能大于绝对有效期')
        if self.oidc_sso_absolute_seconds > self.oidc_sso_remember_absolute_seconds:
            raise ValueError('单点登录保持登录期限不能小于普通会话的绝对有效期')

    def _validate_secret_material(self) -> None:
        """
        校验 OIDC Pepper、签名密钥定位信息和 Legacy 隔离开关。

        :raises ValueError: Pepper、密钥或隔离策略不符合要求
        """
        if not self.oidc_legacy_auth_isolation_enabled:
            raise ValueError('OIDC_LEGACY_AUTH_ISOLATION_ENABLED 启用认证中心时必须为 true')
        pepper = self.oidc_token_hash_pepper.strip()
        if len(pepper.encode('utf-8')) < self.OIDC_PEPPER_MIN_BYTES:
            raise ValueError('OIDC_TOKEN_HASH_PEPPER 至少需要 32 字节')
        secret_values = {
            os.getenv('JWT_SECRET_KEY', '').strip(),
            os.getenv('TRANSPORT_CRYPTO_PRIVATE_KEY', '').strip(),
            os.getenv('TRANSPORT_CRYPTO_PUBLIC_KEY', '').strip(),
        }
        legacy_config = globals().get('JwtConfig')
        transport_config = globals().get('TransportCryptoConfig')
        if legacy_config is not None:
            secret_values.add(str(getattr(legacy_config, 'jwt_secret_key', '')).strip())
        if transport_config is not None:
            secret_values.add(str(getattr(transport_config, 'transport_crypto_private_key', '')).strip())
            secret_values.add(str(getattr(transport_config, 'transport_crypto_public_key', '')).strip())
        secret_values.add(self.oidc_signing_key_encryption_key.strip())
        if pepper in secret_values:
            raise ValueError('OIDC_TOKEN_HASH_PEPPER 不得复用原有 JWT 密钥或传输加密密钥')
        # 运行时以数据库 active 密钥为唯一事实；密钥可来自数据库加密密文，
        # 因此不能在配置层强制 OIDC_ACTIVE_KID 或文件路径。

    def _validate_cookie(self) -> None:
        """
        校验认证中心 SSO Cookie 的固定安全属性。

        :raises ValueError: Cookie 名称、Secure、SameSite 或 Domain 不符合要求
        """
        if not self.oidc_sso_cookie_name.startswith('__Host-'):
            raise ValueError('OIDC_SSO_COOKIE_NAME 必须使用 __Host- 前缀')
        if not self.oidc_sso_cookie_secure:
            raise ValueError('OIDC_SSO_COOKIE_SECURE 启用认证中心时必须为 true')
        if self.oidc_sso_cookie_domain:
            raise ValueError('__Host- SSO Cookie 不得设置 Domain')
        if self.oidc_sso_cookie_samesite != 'lax':
            raise ValueError('OIDC_SSO_COOKIE_SAMESITE 必须为 lax')

    def _validate_interaction_urls(self) -> None:
        """
        校验认证交互 URL 与 issuer 的同源约束。

        :raises ValueError: 交互地址不是 HTTPS 同源地址
        """
        issuer = urlsplit(self.oidc_issuer)
        for field_name, value in (
            ('OIDC_INTERACTION_LOGIN_URL', self.oidc_interaction_login_url),
            ('OIDC_INTERACTION_CONSENT_URL', self.oidc_interaction_consent_url),
            ('OIDC_INTERACTION_ERROR_URL', self.oidc_interaction_error_url),
        ):
            normalised = self._normalise_url(value, field_name)
            parsed = urlsplit(normalised)
            if (parsed.scheme, parsed.hostname, parsed.port) != (issuer.scheme, issuer.hostname, issuer.port):
                raise ValueError(f'{field_name} 的协议、主机名和端口必须与 OIDC_ISSUER 一致')
            setattr(self, field_name.lower(), normalised)

    def _validate_cors_origins(self, app_env: str) -> None:
        """
        校验显式 CORS Origin 配置。

        :param app_env: 当前应用环境
        :raises ValueError: Origin 含 userinfo、path、query、fragment 或协议不安全
        """
        for origin in self.cors_origin_list:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {'http', 'https'}
                or not parsed.netloc
                or parsed.username
                or parsed.password
                or parsed.path
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError('OIDC_CORS_ALLOWED_ORIGINS 只能包含协议、主机名和可选端口')
            if parsed.scheme != 'https' and not (app_env in {'dev', 'test', 'local'} and self._is_local_http(origin)):
                raise ValueError('生产环境 OIDC_CORS_ALLOWED_ORIGINS 必须使用 HTTPS')

    @model_validator(mode='after')
    def validate_oidc_configuration(self) -> 'OidcSettings':
        """
        执行 OIDC 启动级安全校验。

        :return: 已完成规范化和安全校验的配置对象
        """
        self.oidc_issuer = self._normalise_url(self.oidc_issuer, 'OIDC_ISSUER', allow_empty=not self.oidc_enabled)
        self.oidc_public_base_url = self._normalise_url(
            self.oidc_public_base_url,
            'OIDC_PUBLIC_BASE_URL',
            allow_empty=not self.oidc_enabled,
        )
        if not self.oidc_enabled:
            return self

        app_env = os.getenv('APP_ENV', 'dev').strip().strip('\'"').lower() or 'dev'
        self._validate_issuer_urls(app_env)
        self._validate_protocol_options()
        self._validate_secret_material()
        self._validate_cookie()
        self._validate_interaction_urls()
        self._validate_cors_origins(app_env)
        return self


class PluginDependencyPolicySettings(BaseSettings):
    """插件依赖安装策略配置。"""

    plugin_dependency_policy_mode: str = Field(
        default='dev=explicit,test=plan_only,stage=locked,prod=plan_only', description='插件依赖安装的策略模式'
    )
    plugin_dependency_allow_prod_install: bool = Field(default=False, description='是否允许在生产环境安装插件依赖')
    plugin_dependency_require_yes: bool = Field(default=True, description='安装插件依赖前是否要求显式确认')
    plugin_dependency_require_allowlist: bool | None = Field(default=None, description='是否要求依赖出现在允许清单中')
    plugin_dependency_require_lockfile: bool | None = Field(default=None, description='安装插件依赖时是否要求锁文件')
    plugin_dependency_lockfile: str = Field(default='', description='插件依赖锁文件路径')
    plugin_dependency_allowlist: str = Field(default='', description='允许安装的插件依赖清单')
    plugin_dependency_offline_dir: str = Field(default='', description='存放离线依赖包的目录')
    plugin_dependency_pip_index_url: str = Field(default='', description='安装 Python 依赖时使用的软件包索引地址')
    plugin_dependency_npm_registry: str = Field(default='', description='安装前端依赖时使用的 npm 仓库地址')
    plugin_dependency_install_timeout: int = Field(default=600, description='插件依赖安装的超时时间（秒）')


class PluginArtifactSettings(BaseSettings):
    """签名插件制品与维护发布配置；默认关闭以兼容目录插件部署。"""

    plugin_artifact_enabled: bool = Field(default=False, description='是否启用插件制品交付')
    plugin_artifact_store: str = Field(default='vf_admin/plugin_artifacts', description='插件制品的存储目录')
    plugin_artifact_trust_file: str = Field(default='', description='声明受信任制品签发者的配置文件路径')
    plugin_artifact_heartbeat_seconds: int = Field(
        default=15, ge=1, le=60, description='插件制品工作进程发送心跳的间隔（秒）'
    )
    plugin_artifact_worker_ttl_seconds: int = Field(
        default=60, ge=3, le=600, description='插件制品工作进程心跳记录的有效期（秒）'
    )

    @model_validator(mode='after')
    def validate_artifact_settings(self) -> 'PluginArtifactSettings':
        """
        拒绝缺少信任根的启用配置和无法容纳正常心跳的超时。

        :return: 通过信任根及维护心跳配置校验的制品设置
        :raises ValueError: 启用签名插件制品时必须配置 PLUGIN_ARTIFACT_TRUST_FILE；PLUGIN_ARTIFACT_STORE 不能为空；插件 worker 超时必须至少为心跳间隔的三倍
        """
        if self.plugin_artifact_enabled and not self.plugin_artifact_trust_file.strip():
            raise ValueError('启用签名插件制品时必须配置 PLUGIN_ARTIFACT_TRUST_FILE')
        if not self.plugin_artifact_store.strip():
            raise ValueError('PLUGIN_ARTIFACT_STORE 不能为空')
        if self.plugin_artifact_worker_ttl_seconds < 3 * self.plugin_artifact_heartbeat_seconds:
            raise ValueError('插件 worker 超时必须至少为心跳间隔的三倍')
        return self


class GenSettings:
    """
    代码生成配置。

    :cvar author: 生成代码使用的作者名称
    :cvar package_name: 包名
    :cvar auto_remove_pre: 生成模型名称时是否去除表名前缀
    :cvar table_prefix: 生成代码时识别的数据库表前缀
    :cvar allow_overwrite: 是否允许覆盖已有生成文件
    :cvar GEN_PATH: 保存生成代码的目录
    """

    author = 'insistence'
    package_name = 'module_admin.system'
    auto_remove_pre = False
    table_prefix = 'sys_'
    allow_overwrite = False

    GEN_PATH = 'vf_admin/gen_path'

    def __init__(self) -> None:
        """确保代码生成目录存在。"""
        if not os.path.exists(self.GEN_PATH):
            os.makedirs(self.GEN_PATH)


class UploadSettings:
    """
    上传配置。

    :cvar UPLOAD_PREFIX: 公开上传文件使用的访问路径前缀
    :cvar UPLOAD_PATH: 公开上传文件的存放目录
    :cvar PRIVATE_UPLOAD_PATH: 私有上传文件的存放目录
    :cvar FILE_TRASH_PATH: 文件移入回收站后的存放目录
    :cvar FILE_RECONCILE_QUARANTINE_PATH: 对账发现异常文件时使用的隔离目录
    :cvar UPLOAD_MACHINE: 生成上传文件标识所使用的机器代号
    :cvar DEFAULT_ALLOWED_EXTENSION: 默认允许上传的文件扩展名
    :cvar DOWNLOAD_PATH: 存放待下载文件的目录
    :cvar MAX_FILE_SIZE: 允许上传的最大字节数
    """

    UPLOAD_PREFIX = '/profile'
    UPLOAD_PATH = 'vf_admin/upload_path'
    PRIVATE_UPLOAD_PATH = 'vf_admin/private_upload_path'
    FILE_TRASH_PATH = 'vf_admin/file_trash_path'
    FILE_RECONCILE_QUARANTINE_PATH = 'vf_admin/file_reconcile_quarantine_path'
    UPLOAD_MACHINE = 'A'
    DEFAULT_ALLOWED_EXTENSION = [
        # 图片
        'bmp',
        'gif',
        'jpg',
        'jpeg',
        'png',
        # Word、Excel 和 PowerPoint 文档
        'doc',
        'docx',
        'xls',
        'xlsx',
        'ppt',
        'pptx',
        'html',
        'htm',
        'txt',
        # 压缩文件
        'rar',
        'zip',
        'gz',
        'bz2',
        # 视频格式
        'mp4',
        'avi',
        'rmvb',
        # PDF 文档
        'pdf',
    ]
    DOWNLOAD_PATH = 'vf_admin/download_path'
    MAX_FILE_SIZE = 100 * 1024 * 1024

    def __init__(self) -> None:
        """准备上传、私有文件、回收站和对账隔离目录。"""
        if not os.path.exists(self.UPLOAD_PATH):
            os.makedirs(self.UPLOAD_PATH)
        if not os.path.exists(self.PRIVATE_UPLOAD_PATH):
            os.makedirs(self.PRIVATE_UPLOAD_PATH)
        if not os.path.exists(self.FILE_TRASH_PATH):
            os.makedirs(self.FILE_TRASH_PATH)
        if not os.path.exists(self.FILE_RECONCILE_QUARANTINE_PATH):
            os.makedirs(self.FILE_RECONCILE_QUARANTINE_PATH)
        if not os.path.exists(self.DOWNLOAD_PATH):
            os.makedirs(self.DOWNLOAD_PATH)


class CachePathConfig:
    """
    缓存目录配置。

    :cvar PATH: 缓存目录的绝对路径
    :cvar PATHSTR: 缓存目录的相对名称
    """

    PATH = os.path.join(os.path.abspath(os.getcwd()), 'caches')
    PATHSTR = 'caches'


class GetConfig:
    """
    获取配置。

    :ivar run_env: 从命令行或环境配置选中的运行环境
    """

    def __init__(self) -> None:
        """从命令行参数确定当前运行环境。"""
        self.run_env = self.parse_cli_args()

    def get_app_config(self) -> AppSettings:
        """
        获取应用配置。

        :return: 应用配置
        """
        # 实例化应用配置模型
        return AppSettings()

    def get_i18n_config(self) -> I18nSettings:
        """
        获取国际化配置。

        :return: 国际化配置
        """
        return I18nSettings()

    def get_jwt_config(self) -> JwtSettings:
        """
        获取Jwt配置。

        :return: Jwt配置
        """
        # 实例化Jwt配置模型
        return JwtSettings()

    def get_database_config(self) -> DataBaseSettings:
        """
        获取数据库配置。

        :return: 数据库配置
        """
        # 实例化数据库配置模型
        return DataBaseSettings()

    def get_redis_config(self) -> RedisSettings:
        """
        获取Redis配置。

        :return: Redis配置
        """
        # 实例化Redis配置模型
        return RedisSettings()

    def get_log_config(self) -> LogSettings:
        """
        获取日志配置。

        :return: 日志配置
        """
        return LogSettings()

    def get_transport_crypto_config(self) -> TransportCryptoSettings:
        """
        获取传输层加解密配置。

        :return: 传输层加解密配置
        """
        return TransportCryptoSettings()

    def get_oidc_config(self) -> OidcSettings:
        """
        获取统一认证中心配置。

        OIDC 配置由模型自身执行启动级校验；关闭时不会校验密钥和 Pepper。

        :return: 统一认证中心配置
        """
        return OidcSettings()

    def get_plugin_dependency_policy_config(self) -> PluginDependencyPolicySettings:
        """
        获取插件依赖安装策略配置。

        :return: 插件依赖安装策略配置
        """
        return PluginDependencyPolicySettings()

    def get_gen_config(self) -> GenSettings:
        """
        获取代码生成配置。

        :return: 代码生成配置
        """
        # 实例化代码生成配置
        return GenSettings()

    def get_upload_config(self) -> UploadSettings:
        """
        获取上传配置。

        :return: 上传配置
        """
        # 实例上传配置
        return UploadSettings()

    @staticmethod
    def parse_cli_args() -> str:
        """
        解析命令行参数并加载对应环境配置。

        ``run_env`` 用于选择 ``.env.*`` 配置文件，实际应用环境以配置
        文件中的 ``APP_ENV`` 为准。

        :return: 当前加载的运行环境配置名称
        """
        run_env = os.environ.get('APP_ENV', '')
        # 检查是否在alembic环境中运行，如果是则跳过参数解析
        if 'alembic' in sys.argv[0] or any('alembic' in arg for arg in sys.argv):
            ini_config = configparser.ConfigParser()
            ini_config.read('alembic.ini', encoding='utf-8')
            if 'settings' in ini_config:
                # 获取env选项
                run_env = ini_config['settings'].get('env') or run_env
        elif 'uvicorn' in sys.argv[0]:
            # 使用uvicorn启动时，命令行参数需要按照uvicorn的文档进行配置，无法自定义参数
            pass
        else:
            # 使用argparse定义命令行参数
            parser = argparse.ArgumentParser(description='命令行参数')
            parser.add_argument('--env', type=str, default='', help='运行环境')
            # 解析命令行参数
            args, _ = parser.parse_known_args()
            run_env = str(args.env or run_env)
        # 运行环境未指定时默认加载.env.dev
        run_env = run_env.strip() or 'dev'
        env_file = f'.env.{run_env}'
        # 加载配置，已通过外部命令设置的环境变量保持优先
        load_dotenv(env_file)
        return run_env


# 实例化获取配置类
get_config = GetConfig()
# 应用配置
AppConfig = get_config.get_app_config()
# 国际化配置
I18nConfig = get_config.get_i18n_config()
# Jwt配置
JwtConfig = get_config.get_jwt_config()
# 数据库配置
DataBaseConfig = get_config.get_database_config()
# Redis配置
RedisConfig = get_config.get_redis_config()
# 日志配置
LogConfig = get_config.get_log_config()
# 传输层加解密配置
TransportCryptoConfig = get_config.get_transport_crypto_config()
# 统一认证中心配置
OidcConfig = get_config.get_oidc_config()
# 插件依赖安装策略配置
PluginDependencyPolicyConfig = get_config.get_plugin_dependency_policy_config()
# 签名插件制品与维护发布配置
PluginArtifactConfig = PluginArtifactSettings()
# 代码生成配置
GenConfig = get_config.get_gen_config()
# 上传配置
UploadConfig = get_config.get_upload_config()
