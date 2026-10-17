import axios from "axios";
import { getToken, removeToken } from "./auth";
import { getDisplayTimezone } from "./time";
import { tansParams, blobValidate } from "./ruoyi";
import errorCode from "./errorCode";
import cache from "@/plugins/cache";
import { message, confirm } from "@/plugins/modal";
import { saveAs } from "file-saver";
import {
  decryptTransportErrorResponse,
  decryptTransportResponse,
  encryptTransportRequest,
  invalidateTransportKeyMeta,
  resetTransportRequestConfig,
  shouldRetryTransportWithFreshKey,
} from "./transportCrypto";

// 避免多个失效请求同时弹出重新登录提示。
export const isRelogin = { show: false };
// 统一配置接口公共前缀、超时时间和默认请求类型。
const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 10000,
  headers: { "Content-Type": "application/json;charset=utf-8" },
});
/**
 * 发送前统一补充令牌与显示时区，检查重复提交，再完成传输加密和参数序列化。
 * @param {Object} config Axios 请求配置
 * @returns {Promise<Object>} 最终发送的请求配置
 */
service.interceptors.request.use(async (config) => {
  // 内部控制标记在密钥轮换重试时保留，但不作为 HTTP 请求头发出。
  config.__requestFlags ||= Object.fromEntries(
    ["isToken", "encrypt", "encryptResponse"]
      .filter((key) => config.headers[key] !== undefined)
      .map((key) => [key, config.headers[key]]),
  );
  Object.assign(config.headers, config.__requestFlags);
  // 调用方可覆盖显示时区，并通过 isToken: false 禁止自动携带令牌。
  config.headers["X-Timezone"] ||= getDisplayTimezone();
  if (getToken() && config.headers.isToken !== false)
    config.headers.Authorization = `Bearer ${getToken()}`;
  // 默认拦截短时间内相同的 POST/PUT 请求；表单文件上传不参与快照比较。
  if (
    config.headers.repeatSubmit !== false &&
    ["post", "put"].includes(config.method) &&
    !(config.data instanceof FormData)
  ) {
    const current = {
      url: config.url,
      timezone: config.headers["X-Timezone"],
      data:
        typeof config.data === "object"
          ? JSON.stringify(config.data)
          : config.data,
      time: Date.now(),
    };
    // 快照按序列化字符串长度限制规模，超过阈值时跳过防重校验。
    if (JSON.stringify(current).length < 5 * 1024 * 1024) {
      const previous = cache.session.getJSON("sessionObj");
      if (
        previous &&
        previous.url === current.url &&
        previous.data === current.data &&
        previous.timezone === current.timezone &&
        // 防重间隔单位为毫秒，默认 1000；显示时区不同视为不同请求。
        current.time - previous.time < (config.headers.interval || 1000)
      )
        throw new Error("数据正在处理，请勿重复提交");
      cache.session.setJSON("sessionObj", current);
    }
  }
  // 在查询参数拼接前完成加密，避免明文查询串提前写入 URL。
  config = await encryptTransportRequest(config);
  // 将 GET 参数映射到 URL，并兼容地址中已有的查询串。
  if (config.method === "get" && config.params) {
    const query = tansParams(config.params).replace(/&$/, "");
    if (query) config.url += `${config.url.includes("?") ? "&" : "?"}${query}`;
    config.params = {};
  }
  // 清除只供前端拦截器使用的控制字段。
  for (const key of [
    "isToken",
    "repeatSubmit",
    "interval",
    "encrypt",
    "encryptResponse",
  ])
    delete config.headers[key];
  return config;
});
/** 用户确认后清除令牌，并携带当前地址返回登录页；取消时继续留在当前页。 */
async function expireSession() {
  if (isRelogin.show) return;
  isRelogin.show = true;
  try {
    await confirm("登录状态已过期，是否重新登录？");
    removeToken();
    location.assign(
      `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`,
    );
  } catch {
    /* 用户继续留在当前页。 */
  } finally {
    isRelogin.show = false;
  }
}
service.interceptors.response.use(
  /**
   * 先解密响应，再处理二进制数据及业务状态码。
   * @param {Object} response Axios 响应对象
   * @returns {Promise<*>} 业务数据或二进制响应数据
   */
  async (response) => {
    response = await decryptTransportResponse(response);
    if (["blob", "arraybuffer"].includes(response.config.responseType))
      return response.data;
    // 未设置业务状态码时默认成功。
    const code = response.data.code || 200;
    if (code === 200) return response.data;
    // 插件会话异常由 PluginFrame 局部处理，不触发宿主账号重新登录。
    if (response.config.pluginBridge) throw new Error("插件请求失败，请重试");
    const text = errorCode[code] || response.data.msg || errorCode.default;
    if (code === 401) void expireSession();
    else if (!response.config.skipErrorMessage)
      message[code === 601 ? "warning" : "error"](text);
    throw new Error(text);
  },
  async (error) => {
    if (axios.isCancel(error)) throw error;
    // 错误响应也可能是加密信封，先解密再提取错误信息。
    error = await decryptTransportErrorResponse(error);
    // 密钥失效时清除公钥缓存，恢复原始请求并最多重试一次。
    if (
      shouldRetryTransportWithFreshKey(error) &&
      error.config &&
      !error.config.__transportRetried
    ) {
      invalidateTransportKeyMeta();
      error.config.__transportRetried = true;
      resetTransportRequestConfig(error.config);
      error.config.headers ||= {};
      // 自动重试复用同一业务请求，跳过重复提交拦截。
      error.config.headers.repeatSubmit = false;
      return service.request(error.config);
    }
    // HTTP 错误中的插件会话同样与宿主登录状态隔离。
    if (error.config?.pluginBridge) throw new Error("插件请求失败，请重试");
    const response = error.response;
    // 保留字段级错误供表单使用，同时拼接可读提示。
    if (response?.status === 422) {
      const details = Array.isArray(response.data?.detail)
        ? response.data.detail
        : [];
      error.fieldErrors = Object.fromEntries(
        details.map((item) => [
          item.loc?.slice(1).join(".") || "参数",
          item.msg,
        ]),
      );
      error.message =
        details
          .map(
            (item) => `${item.loc?.slice(1).join(".") || "参数"}：${item.msg}`,
          )
          .join("；") ||
        response.data?.msg ||
        "请检查输入参数";
    } else
      error.message =
        response?.data?.msg ||
        ([502, 503, 504].includes(response?.status) ||
        error.message === "Network Error"
          ? "后端接口连接异常"
          : error.message?.includes("timeout")
            ? "系统接口请求超时"
            : error.message);
    if (response?.status === 401) void expireSession();
    // 调用方接管提示时仍抛出错误，避免吞掉失败结果。
    else if (!error.config?.skipErrorMessage)
      message.error(error.message || "请求失败");
    throw error;
  },
);
/**
 * 提交表单参数下载文件，并在成功或失败后关闭加载提示。
 * @param {string} url 下载接口地址
 * @param {Object} params 请求参数
 * @param {string} filename 保存时使用的文件名
 * @param {Object} [config={}] 可覆盖默认值的额外 Axios 配置
 * @returns {Promise<void>} 下载处理完成；失败时提示并继续抛出错误
 */
export async function download(url, params, filename, config = {}) {
  const close = message.loading("正在下载数据，请稍候", 0);
  try {
    const data = await service.post(url, params, {
      transformRequest: [tansParams],
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // 默认按二进制文件下载，不启用传输层加解密。
        encrypt: false,
        encryptResponse: false,
      },
      responseType: "blob",
      ...config,
    });
    if (blobValidate(data)) saveAs(data, filename);
    else {
      // 文件接口可能返回业务错误 JSON，需要读取 Blob 内容后提示。
      const result = JSON.parse(await data.text());
      throw new Error(result.msg || "下载失败");
    }
  } catch (error) {
    message.error(error.message);
    throw error;
  } finally {
    close();
  }
}
export default service;
