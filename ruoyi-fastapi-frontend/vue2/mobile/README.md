# RuoYi-FastAPI Vue2 移动端

Node.js 使用 22.x（最低 22.22.2）或 24.x（最低 24.15.0），推荐对应版本线的最新补丁。CI 分别验证两条版本线。包管理器版本以 `package.json` 的 `packageManager` 为准。

基于 `uni-app` 的 Vue2、Tailwind CSS 4.3.3 和 weapp-tailwindcss 5.6.3 开发。

## 快速开始

本工程位于 `ruoyi-fastapi-frontend/vue2/mobile`，与同仓库 Vue2/Vue3 Web 和 Vue3 移动端共用 `ruoyi-fastapi-backend`。从仓库根目录执行：

```bash
cd ruoyi-fastapi-frontend/vue2/mobile
pnpm install
pnpm dev:h5
```

后续命令均在本工程目录执行。后端地址在 `src/config.js` 的 `baseUrl` 中配置；真机或模拟器运行时需使用设备可访问的后端地址。

> 本项目已经集成 `weapp-ide-cli` 可以通过 `cli` 对 `ide` 进行额外操作，[详细信息](https://www.npmjs.com/package/weapp-ide-cli)

### 构建小程序

```bash
pnpm dev:mp-weixin
```

### 打开微信开发者工具

> 需要打开开发者工具，设置，安全中的服务端口选项

```bash
pnpm open:dev
```

## 代码格式

使用 Prettier 3.9.10，与 Vue Web 端保持一致：2 空格缩进、单引号、不加分号、LF 换行。

```bash
pnpm format       # 格式化源码、测试、工程配置和文档
pnpm format:check # 只检查，不修改文件
```

`.prettierignore` 排除依赖、构建产物、缓存、锁文件、生成的类型声明和 `src/vendor` 第三方兼容代码。`public/index.html` 保留模板格式。CI 的 Quality 工作流执行同版本检查，格式不符合规范会失败。

## Tips

- Tailwind 入口为 `src/app.css`，与 [Vue 2 Webpack 参考模板](https://github.com/icebreaker-template/uni-app-webpack-tailwindcss-v4) 一样，通过 `src/main.ts` 直接导入，确保开发模式的 Tailwind loader 能处理入口；不要改回 `<style>` 内的嵌套 `@import`，否则 H5 开发页面会缺少工具类样式。`vue.config.js` 的 `WeappTailwindcss` 同时负责 H5 和小程序 CSS 生成。不要再配置 `weapp-tw patch`，也不要额外注册 Tailwind 的 PostCSS 插件。`tailwind.config.js` 仅保留 Iconify 插件，颜色与扫描范围在 CSS 入口中维护。
- `cssMatcher` 排除 uni-h5 直接复制的 `static/index.<hash>.css`，避免插件把框架基础样式误当成 Tailwind 入口并覆盖。开发与生产浏览器检查同时验证工具类、图标、导航栏和页面高度。
- 上游 Vue 2 模板用于存量项目兼容参考，官方新项目主线是 Vue 3 + Vite。本工程保留 Vue 2、Vue CLI 5 / Webpack 5，锁定 Tailwind CSS 4.3.3 和 weapp-tailwindcss 5.6.3；后续升级必须同时验证开发启动、H5 和微信构建。Tailwind 4 的 H5 浏览器要求参见 [兼容说明](https://tailwindcss.com/docs/compatibility)，`browserslist` 不会自动补齐其现代 CSS 能力。
- `@dcloudio` 平台与编译器包统一使用 `2.0.2-5020620260917001`，Vue 与 `vue-template-compiler` 保持 2.6.14。升级时需整组调整，并重新验证 H5、微信和无原生 Intl 的浏览器构建。
- Vue CLI 5 / webpack 5 的兼容补丁由 `postinstall` 自动执行：DefinePlugin 使用公开 API，微信独立分包插件延迟加载。当前补丁覆盖普通小程序构建；启用独立分包前需单独迁移其 webpack 4 插件。
- `pnpm-workspace.yaml` 的 `overrides` 将间接依赖 `postcss-urlrewrite` 固定到 0.3.0，使用上游的 `util.types.isRegExp` 修复，兼容 Node 24。
- Jest 保持 25.5.4，与 uni-app 自动化工具配套；不要直接升级到最新大版本。
- `vue-loader` 保持 `prettify: false`：uni-app 的旧模板编译器要求同步格式化结果，与 Prettier 3 的异步 API 不兼容。此选项只关闭生成代码的美化，不影响源码格式化；`test:bundle` 覆盖开发模式模板编译，CI 还会实际启动 `dev:h5` 验证登录页面。

本工程统一使用 `pnpm@11.28.6`。`pnpm-lock.yaml` 应与 `package.json`、`pnpm-workspace.yaml` 一起提交到 Git，固定直接和传递依赖。首次拉取及 CI 使用 `pnpm install --frozen-lockfile`；有意新增或升级依赖时使用 `pnpm add` / `pnpm update`，检查锁文件差异并一起提交。不要手工编辑或删除锁文件。
