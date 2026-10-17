import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { normalizePluginBase } from "./src/utils/pluginBridge.js";
import createCompression from "./vite/plugins/compression.js";

export default defineConfig(({ mode }) => {
  // 按运行模式读取环境变量，开发代理默认连接本地后端。
  const env = loadEnv(mode, process.cwd());
  const target = env.VITE_APP_PROXY_TARGET || "http://127.0.0.1:9099";
  // 规范化插件外部部署前缀，代理匹配和路径改写使用同一值。
  const pluginBase = normalizePluginBase(env.VITE_APP_PLUGIN_BASE || "");
  return {
    // React 编译与按环境配置启用的静态资源压缩。
    plugins: [react(), ...createCompression(env)],
    resolve: {
      // 将 @ 统一指向业务源码目录。
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    // 开发服务器与后端接口代理。
    server: {
      host: "0.0.0.0",
      port: 80,
      proxy: {
        // 插件应用代理保留原始 Host，并支持 WebSocket 连接。
        [`${pluginBase}/apps/`]: {
          target,
          changeOrigin: false,
          ws: true,
          // Uvicorn 会补回 root_path，转发时只剥离一次外部部署前缀。
          rewrite: (path) => path.slice(pluginBase.length),
          configure(proxy) {
            proxy.on("proxyRes", (upstream, _request, response) => {
              if (
                upstream.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
                "text/event-stream"
              )
                return;
              // pipe 不会自动传播上游异常关闭，及时结束下游以便插件报告失败并重连。
              upstream.once("aborted", () => response.destroy());
              upstream.once("error", () => response.destroy());
              // 浏览器中途关闭连接时释放尚未完成的上游流。
              response.once("close", () => {
                if (!upstream.complete) upstream.destroy();
              });
            });
          },
        },
        // 插件运行时接口使用相同的部署前缀改写规则。
        [`${pluginBase}/plugin/runtime/`]: {
          target,
          changeOrigin: false,
          rewrite: (path) => path.slice(pluginBase.length),
        },
        // 业务 API 的开发前缀只在代理入口使用，后端接收去除前缀的路径。
        "/dev-api": {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/dev-api/, ""),
        },
        // OIDC 发现、认证交互和 OAuth 接口保持原始路径转发。
        "/.well-known": { target, changeOrigin: true },
        "/auth/interaction": { target, changeOrigin: true },
        "/oauth2": { target, changeOrigin: true },
      },
    },
    // 构建关闭源码映射，并设置分块体积告警阈值，单位为 kB。
    build: { sourcemap: false, chunkSizeWarningLimit: 1200 },
  };
});
