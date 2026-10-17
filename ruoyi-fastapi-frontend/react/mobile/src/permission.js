import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { getToken } from "@/utils/auth";
const publicPages = new Set([
  "pages/login",
  "pages/register",
  "pages/common/agreement/index",
  "pages/common/privacy/index",
  "pages/common/webview/index",
]);
export function usePageAuth() {
  const [allowed, setAllowed] = useState(!!getToken());
  useDidShow(() => {
    const path = Taro.getCurrentInstance().router?.path?.replace(/^\//, "");
    const valid = !!getToken() || publicPages.has(path);
    setAllowed(valid);
    if (!valid) Taro.reLaunch({ url: "/pages/login" });
  });
  return allowed;
}
