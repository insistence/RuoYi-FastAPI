# React Web 格式约定

使用项目内的 Prettier 3.6.2：`pnpm format` 格式化，`pnpm format:check` 只检查。配置位于 `.prettierrc.json`，与 Vue2/Vue3 Web 和 Mobile 一致：2 空格缩进、单引号、不加分号、LF 换行。编辑器可安装 Prettier 与 EditorConfig。

命令检查整个工程，`.prettierignore` 排除依赖、构建产物、缓存、锁文件、生成文件和外部资源。CI 的 Quality 工作流使用同一套循环检查三个框架的 Web/Mobile，无需为 React 单独列出目录。

React 组件使用 `.jsx`，纯工具使用 `.js`；保留 Vue Web 的业务目录和后端路由契约。不要将 Vue 指令、Element Plus 样式或自动导入配置复制进 React 组件。

`tests/plugins/fixtures/bridge-b0d16a3e/pluginBridge.js` 是历史 SDK 的逐字节兼容性夹具，已在 `.prettierignore` 排除，请勿格式化。
