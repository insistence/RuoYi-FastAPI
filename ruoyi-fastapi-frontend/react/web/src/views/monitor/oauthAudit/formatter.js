export const eventGroups = [
  {
    label: "登录与授权",
    options: [
      { label: "收到登录授权请求", value: "authorize_requested" },
      { label: "登录授权已完成", value: "authorize_succeeded" },
      { label: "登录授权被拒绝", value: "authorize_denied" },
      { label: "用户登录成功", value: "login_succeeded" },
      { label: "用户登录失败", value: "login_failed" },
      { label: "用户同意授权", value: "consent_granted" },
      { label: "用户撤销授权", value: "consent_revoked" },
    ],
  },
  {
    label: "凭据与会话",
    options: [
      { label: "访问凭据已签发", value: "token_issued" },
      { label: "访问凭据处理失败", value: "token_failed" },
      { label: "刷新凭据已更新", value: "refresh_rotated" },
      { label: "发现刷新凭据被重复使用", value: "refresh_reuse_detected" },
      { label: "访问凭据已撤销", value: "token_revoked" },
      { label: "登录会话已下线", value: "session_revoked" },
      { label: "用户授权已撤销", value: "grant_revoked" },
      { label: "用户应用访问已禁止", value: "client_access_blocked" },
      { label: "用户应用访问已允许", value: "client_access_allowed" },
      { label: "应用退出通知成功", value: "backchannel_logout_succeeded" },
      { label: "应用退出通知失败", value: "backchannel_logout_failed" },
    ],
  },
  {
    label: "配置与安全",
    options: [
      { label: "应用已注册", value: "client_created" },
      { label: "应用已停用", value: "client_disabled" },
      { label: "应用密钥已更新", value: "client_secret_rotated" },
      { label: "签名密钥已轮换", value: "signing_key_rotated" },
      { label: "服务访问策略已变更", value: "resource_policy_changed" },
      { label: "权限策略已变更", value: "scope_policy_changed" },
      { label: "发现授权码被重复使用", value: "authorization_code_reused" },
      { label: "应用身份验证失败", value: "invalid_client" },
      { label: "用户身份标识缺失", value: "identity_subject_missing" },
      { label: "账户安全版本已变更", value: "security_version_changed" },
    ],
  },
];

const eventLabels = Object.fromEntries(
  eventGroups.flatMap((group) => group.options).map((item) => [item.value, item.label]),
);

export function eventLabel(value) {
  return eventLabels[value] || value || "未知安全操作";
}

export function eventSummary(row = {}) {
  const labels = {
    authorize_requested: "应用发起了用户登录或权限授权请求",
    authorize_succeeded: "用户身份确认和应用授权流程已经完成",
    authorize_denied: "登录或权限授权请求没有继续执行",
    login_succeeded: "用户已经通过身份验证",
    login_failed: "用户身份验证没有通过",
    consent_granted: "用户允许应用访问所请求的信息",
    consent_revoked: "用户取消了应用的持续访问权限",
    token_issued: "系统为应用签发了新的短期访问凭据",
    token_failed: "系统没有为应用签发访问凭据",
    refresh_rotated: "应用用于续期的凭据已经安全更新",
    refresh_reuse_detected: "同一份旧续期凭据被再次使用，可能存在泄露",
    token_revoked: "一份访问凭据已经作废",
    session_revoked: "一个外部登录会话已经被强制结束",
    grant_revoked: "一项用户对应用的访问授权已经撤销",
    client_access_blocked: "管理员已禁止用户访问指定应用，并撤销现有授权",
    client_access_allowed: "管理员已解除用户对指定应用的访问禁止，仍需重新授权",
    backchannel_logout_succeeded: "系统已经通知关联应用结束本地登录会话",
    backchannel_logout_failed: "关联应用没有成功接收退出通知",
    client_created: "一个新应用已接入统一认证",
    client_disabled: "一个应用已被禁止继续使用统一认证",
    client_secret_rotated: "应用用于证明身份的密钥已经更新",
    signing_key_rotated: "系统用于签署身份凭据的密钥已经更新",
    resource_policy_changed: "一个服务允许访问的凭据或用户信息配置已变更",
    scope_policy_changed: "一个权限的适用范围或用户确认要求已变更",
    authorization_code_reused: "一次性登录授权码被再次使用，可能存在攻击",
    invalid_client: "应用无法证明自己的身份",
    identity_subject_missing: "用户缺少统一认证所需的稳定身份标识",
    security_version_changed: "账户安全信息变更，旧登录状态将逐步失效",
  };
  return labels[row.eventType] || "系统记录了一次认证安全操作";
}

export function eventTone(row = {}) {
  if (row.result === "failure" || ["high", "critical"].includes(row.riskLevel)) {
    return "danger";
  }
  if (row.riskLevel === "medium") {
    return "warning";
  }
  return "normal";
}

export function sourceText(row = {}) {
  if (row.userAgent) {
    return row.userAgent.length > 26 ? `${row.userAgent.slice(0, 26)}…` : row.userAgent;
  }
  return row.ipAddress ? "外部请求" : "后台操作";
}

export function failureText(code, result) {
  if (result !== "failure" && !code) {
    return "无需处理";
  }
  const labels = {
    invalid_request: "请求信息不完整或格式不正确",
    invalid_client: "应用身份验证失败，请检查应用凭据",
    invalid_grant: "登录或授权凭据已经失效",
    unauthorized_client: "应用未获准使用当前登录方式",
    unsupported_grant_type: "系统不支持当前登录方式",
    invalid_scope: "应用请求了尚未开放的权限",
    access_denied: "用户或安全策略拒绝了本次操作",
    login_required: "用户需要重新登录",
    consent_required: "需要用户确认应用所需权限",
    server_error: "认证服务暂时无法完成请求",
    temporarily_unavailable: "认证服务暂时不可用",
  };
  return labels[code] || (code ? `操作未完成（${code}）` : "操作未完成，详情中暂无具体原因");
}

export function riskText(value) {
  return { normal: "常规", medium: "需关注", high: "高风险", critical: "严重" }[value] || "常规";
}

export function riskType(value) {
  return { normal: "info", medium: "warning", high: "danger", critical: "danger" }[value] || "info";
}
