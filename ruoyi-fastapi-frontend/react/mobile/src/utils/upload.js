import Taro from "@tarojs/taro";
import appConfig from "@/config";
import { getToken } from "@/utils/auth";
import { getDisplayTimezone } from "@/utils/time";
import { toast, tansParams } from "@/utils/common";
import { handleSessionExpired } from "./request";
export default async function upload(config) {
  const header = { "X-Timezone": getDisplayTimezone(), ...config.header };
  if (getToken() && config.headers?.isToken !== false)
    header.Authorization = `Bearer ${getToken()}`;
  const query = config.params
    ? tansParams(config.params).replace(/&$/, "")
    : "";
  try {
    const response = await Taro.uploadFile({
      url: appConfig.baseUrl + config.url + (query ? "?" + query : ""),
      filePath: config.filePath,
      name: config.name || "file",
      timeout: config.timeout || 20000,
      header,
      formData: config.formData,
    });
    let result;
    try {
      result =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;
    } catch {
      throw new Error("上传接口返回了无效的数据");
    }
    if (response.statusCode === 401 || result.code === 401)
      handleSessionExpired();
    if (response.statusCode >= 400 || (result.code ?? 200) !== 200)
      throw new Error(result.msg || "上传失败");
    return result;
  } catch (error) {
    toast(error.message || error.errMsg || "上传失败");
    throw error;
  }
}
