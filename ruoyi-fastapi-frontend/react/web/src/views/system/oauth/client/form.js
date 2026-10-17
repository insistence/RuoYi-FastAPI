import { splitRegisteredUris } from "../../../../utils/oauthUri.js";
export const defaults = {
  clientName: "",
  clientType: "confidential",
  tokenEndpointAuthMethod: "client_secret_basic",
  grantTypes: ["authorization_code", "refresh_token"],
  responseTypes: ["code"],
  requirePkce: true,
  requireConsent: true,
  trustedClient: false,
  scopeCodes: ["openid"],
  allowedRoleKeys: [],
  preAuthorizedScopeCodes: [],
  resourceIds: [],
  redirectUris: [],
  postLogoutRedirectUris: [],
  backchannelLogoutUris: [],
  corsOrigins: [],
  accessTokenTtlSeconds: null,
  refreshTokenIdleSeconds: null,
  refreshTokenAbsoluteSeconds: null,
  logoUri: null,
  policyUri: null,
  tosUri: null,
  remark: "",
};
export const uriFields = [
  ["redirectUris", "登录返回地址", "redirect"],
  ["postLogoutRedirectUris", "退出返回地址", "post_logout"],
  ["backchannelLogoutUris", "后台退出通知", "backchannel_logout"],
  ["corsOrigins", "允许的网页来源", "cors_origin"],
];

export function toEditor(detail = {}) {
  const values = structuredClone({ ...defaults, ...detail });
  for (const [name] of uriFields)
    values[name] = splitRegisteredUris(
      Array.isArray(values[name]) ? values[name].join("\n") : values[name],
    );
  return values;
}
export function clientPayload(values, clientId) {
  const data = Object.fromEntries(
    Object.keys(defaults).map((key) => [key, values[key] ?? defaults[key]]),
  );
  data.responseTypes = data.grantTypes.includes("authorization_code") ? ["code"] : [];
  for (const [name] of uriFields)
    data[name] = splitRegisteredUris(
      Array.isArray(data[name]) ? data[name].join("\n") : data[name],
    );
  if (clientId) data.clientId = clientId;
  return data;
}
