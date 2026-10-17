import { defineConfig } from "@tarojs/cli";
import path from "node:path";
import { WeappTailwindcss } from "weapp-tailwindcss/vite";

const root = path.resolve(__dirname, "..");
const target = process.env.TARO_ENV || "weapp";
const apiBase =
  process.env.TARO_APP_BASE_API ||
  (target === "h5" ? "/dev-api" : "http://127.0.0.1:9099");
export default defineConfig({
  projectName: "ruoyi-fastapi-react-mobile",
  date: "2026-10-11",
  designWidth: 750,
  deviceRatio: { 640: 2.34 / 2, 750: 1, 375: 2, 828: 1.81 / 2 },
  sourceRoot: "src",
  outputRoot: `dist/${target}`,
  alias: { "@": path.resolve(root, "src") },
  framework: "react",
  rn: {
    appName: "RuoYiFastAPI",
    output: {
      android: "dist/rn/android/index.bundle",
      androidAssetsDest: "dist/rn/android",
      ios: "dist/rn/ios/main.jsbundle",
      iosAssetsDest: "dist/rn/ios",
    },
  },
  plugins: ["kwai", "lark", "xhs"].includes(target)
    ? [`@tarojs/plugin-platform-${target}`]
    : [],
  defineConstants: { "process.env.TARO_APP_BASE_API": JSON.stringify(apiBase) },
  copy: {
    patterns: [
      {
        from: path.resolve(root, "src/static").replace(/\\/g, "/"),
        to: `dist/${target}/static`,
      },
    ],
  },
  compiler:
    target === "rn"
      ? { type: "webpack5" }
      : {
          type: "vite",
          vitePlugins: [
            ...(target === "h5"
              ? [
                  {
                    name: "mobile-h5-dependencies",
                    config: () => ({
                      optimizeDeps: {
                        entries: [
                          path.resolve(root, "src/app.jsx"),
                          path.resolve(root, "src/pages/**/*.jsx"),
                        ],
                        include: [
                          "@tarojs/components",
                          "@formatjs/intl-getcanonicallocales/polyfill.js",
                          "@formatjs/intl-locale/polyfill.js",
                          "@formatjs/intl-pluralrules/polyfill.js",
                          "@formatjs/intl-pluralrules/locale-data/en.js",
                          "@formatjs/intl-numberformat/polyfill.js",
                          "@formatjs/intl-numberformat/locale-data/en.js",
                          "@formatjs/intl-datetimeformat/polyfill.js",
                          "@formatjs/intl-datetimeformat/locale-data/en.js",
                          "dayjs",
                          "dayjs/plugin/utc.js",
                          "fflate",
                          "zustand",
                        ],
                      },
                    }),
                  },
                ]
              : []),
            WeappTailwindcss({
              tailwindcssBasedir: root,
              cssEntries: [path.resolve(root, "src/app.css")],
              cssOptions: { rem2rpx: true, injectAdditionalCssVarScope: true },
            }),
          ],
        },
  mini: {
    postcss: { pxtransform: { enable: true }, cssModules: { enable: false } },
  },
  h5: {
    postcss: { pxtransform: { enable: false } },
    publicPath: "/",
    staticDirectory: "static",
    router: { mode: "hash" },
    devServer: {
      host: "127.0.0.1",
      port: 9090,
      open: false,
      proxy: {
        "/dev-api": {
          target: "http://127.0.0.1:9099",
          changeOrigin: true,
          rewrite: (url) => url.replace(/^\/dev-api/, ""),
        },
      },
    },
  },
});
