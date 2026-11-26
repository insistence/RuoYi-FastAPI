from typing import Literal, NotRequired, TypedDict

AccessStatus = Literal['allowed', 'blocked']
AuthorizationStatus = Literal['active', 'revoked', 'expired']
AuditResult = Literal['success', 'failure']
AuditRiskLevel = Literal['normal', 'medium', 'high', 'critical']
ClientUriType = Literal['redirect', 'post_logout', 'backchannel_logout', 'cors_origin']
InteractionAction = Literal['login', 'consent', 'redirect', 'changePassword']


ResponseType = Literal['code']
ResponseMode = Literal['query']
SubjectType = Literal['public']
SigningAlgorithm = Literal['RS256']
TokenEndpointAuthMethod = Literal['none', 'client_secret_basic']
CodeChallengeMethod = Literal['S256']


class InteractionRecord(TypedDict):
    """
    从 Redis 读取并校验后的认证交互记录。

    :ivar interactionId: 交互标识
    :ivar requestedAt: 发起请求的 UTC 时间
    :ivar csrfHash: 当前交互的 CSRF 摘要
    :ivar status: 当前交互状态
    :ivar version: 状态变更的版本号
    :ivar clientPk: 客户端主键
    :ivar clientId: 客户端公开标识
    :ivar redirectUri: 已验证的回调地址
    :ivar responseType: 授权响应类型
    :ivar scopes: 请求的权限范围
    :ivar resources: 请求的资源受众
    :ivar state: 客户端传入的状态值
    :ivar nonce: 与授权请求绑定的随机值
    :ivar codeChallenge: PKCE 挑战值
    :ivar codeChallengeMethod: PKCE 挑战算法
    :ivar prompt: 授权请求的交互提示
    :ivar maxAge: 允许的最长认证间隔秒数
    :ivar consentRequired: 是否需要用户同意
    :ivar grantId: 已持久化的授权标识
    :ivar authenticatedSid: 已认证的会话标识
    :ivar userId: 已认证的用户编号
    :ivar subjectId: 已认证的主体标识
    :ivar authVersion: 当前用户的认证版本
    :ivar credentialProofHash: 密码认证证明的摘要
    :ivar rememberMe: 用户是否选择保持登录
    """

    interactionId: str
    requestedAt: str
    csrfHash: str
    status: str
    version: int
    clientPk: int
    clientId: str
    redirectUri: str
    responseType: Literal['code']
    scopes: list[str]
    resources: list[str]
    state: str | None
    nonce: str
    codeChallenge: str
    codeChallengeMethod: Literal['S256']
    prompt: list[str] | str | None
    maxAge: int | None
    consentRequired: bool
    grantId: NotRequired[str | None]
    authenticatedSid: NotRequired[str | None]
    userId: NotRequired[int | None]
    subjectId: NotRequired[str | None]
    authVersion: NotRequired[int | None]
    credentialProofHash: NotRequired[str | None]
    rememberMe: NotRequired[bool]
