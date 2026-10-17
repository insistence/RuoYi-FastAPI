# React Web 格式约定

使用项目内的 Prettier：`pnpm format`。配置位于 `.prettierrc.json`，编辑器可安装 Prettier 与 EditorConfig。

React 组件使用 `.jsx`，纯工具使用 `.js`；保留 Vue Web 的业务目录和后端路由契约。不要将 Vue 指令、Element Plus 样式或自动导入配置复制进 React 组件。

`tests/plugins/fixtures/bridge-b0d16a3e/pluginBridge.js` 是历史 SDK 的逐字节兼容性夹具，已在 `.prettierignore` 排除，请勿格式化。
