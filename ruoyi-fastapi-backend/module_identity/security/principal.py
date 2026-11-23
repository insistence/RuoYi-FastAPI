from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class OidcUserPrincipal:
    """
    OIDC 用户主体，不承载可变数据库 user_id。

    :ivar subject_id: 身份主体的唯一标识
    :ivar client_id: 客户端标识
    :ivar scopes: 已授予或请求的权限范围
    :ivar audience: 令牌适用的目标资源标识
    :ivar sid: 关联的单点登录会话标识
    :ivar auth_version: 用户认证安全版本
    """

    subject_id: str
    client_id: str
    scopes: frozenset[str] = field(default_factory=frozenset)
    audience: tuple[str, ...] = ()
    sid: str | None = None
    auth_version: int | None = None

    @property
    def sub(self) -> str:
        """
        返回稳定的 OIDC Subject。

        :return: OIDC 主体标识
        """
        return self.subject_id


@dataclass(frozen=True, slots=True)
class OAuthClientPrincipal:
    """
    已完成 Client Authentication 的外部应用主体。

    :ivar client_id: 客户端标识
    :ivar client_type: 客户端类型（public公开客户端 confidential机密客户端）
    :ivar auth_method: 客户端使用的认证方式
    """

    client_id: str
    client_type: str
    auth_method: str | None = None


@dataclass(frozen=True, slots=True)
class MachinePrincipal:
    """
    明确的 client_credentials 身份，绝不伪装为用户。

    :ivar client_id: 客户端标识
    :ivar subject: 令牌所代表的主体
    :ivar scopes: 已授予或请求的权限范围
    :ivar audience: 令牌适用的目标资源标识
    """

    client_id: str
    subject: str | None = None
    scopes: frozenset[str] = field(default_factory=frozenset)
    audience: tuple[str, ...] = ()

    @property
    def is_machine(self) -> bool:
        """
        标识该主体来自 client_credentials 机器身份。

        :return: 固定返回 True
        """
        return True
