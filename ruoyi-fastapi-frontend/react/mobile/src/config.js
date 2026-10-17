import logo from "@/assets/logo.png";
export default {
  baseUrl: process.env.TARO_APP_BASE_API,
  appInfo: {
    name: "RuoYi-FastAPI-APP",
    version: "1.10.0",
    logo,
    site_url: "https://vfadmin.insistence.tech",
    agreements: [
      { title: "隐私政策", url: "/pages/common/privacy/index" },
      { title: "用户服务协议", url: "/pages/common/agreement/index" },
    ],
  },
};
