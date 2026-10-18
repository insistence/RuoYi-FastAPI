# RuoYi-FastAPI Vue3 移动端

基于 `uni-app` 的 Vue3、Vite 5.4.21、Tailwind CSS 4.3.3 和 weapp-tailwindcss 5.6.3 开发。

## 特性

- ⚡️ [Vue 3](https://github.com/vuejs/core), [Vite](https://github.com/vitejs/vite), [pnpm](https://pnpm.io/) - 快 & 稳定

- 🎨 [TailwindCSS](https://tailwindcss.com/) - 世界上最流行，生态最好的原子化CSS框架

- 😃 [集成 Iconify](https://github.com/egoist/tailwindcss-icons) - [icones.js.org](https://icones.js.org/) 中的所有图标都为你所用

- 📥 [API 自动加载](https://github.com/antfu/unplugin-auto-import) - 直接使用 Composition API 无需引入

- 🧬 [多端样式生成](https://tw.weapp.dev/docs/multi-platform) - H5 保留浏览器样式，小程序自动处理单位和类名转义

- 🦾 [TypeScript](https://www.typescriptlang.org/) & [ESLint](https://eslint.org/) & [Stylelint](https://stylelint.io/) - 样式，类型，统一的校验与格式化规则，保证你的代码风格和质量

## 快速开始

本工程位于 `ruoyi-fastapi-frontend/vue3/mobile`，由原 `ruoyi-fastapi-app` 迁入，与同仓库 Vue2/Vue3 Web 和 Vue2 移动端共用 `ruoyi-fastapi-backend`。从仓库根目录执行：

```bash
cd ruoyi-fastapi-frontend/vue3/mobile
pnpm install
pnpm dev:h5
# 微信小程序
pnpm dev:mp-weixin
```

后续命令均在本工程目录执行。

> [!IMPORTANT]
> Node.js 使用 22.x（最低 22.22.2）或 24.x（最低 24.15.0），推荐对应版本线的最新补丁。CI 分别验证两条版本线。包管理器版本以 `package.json` 的 `packageManager` 为准。
>
> 另外谨慎升级 `package.json` 中锁定的 `pinia`/`vue`/`@vue/*` 相关包的版本，新版本可能 `uni-app` 没有兼容，造成一些奇怪的 bug

当前 `@dcloudio` 平台与编译器包统一使用 `3.0.0-5020620260917001`；Vue、`@vue/shared` 和 `@vue/runtime-core` 固定为 3.4.21，与 uni-app 编译器一致。Vite 恢复并保留项目原有的 5.4.21，等待 uni-app 上游适配后再跨大版本升级。上游仍声明 Vite 5.2.8 的精确 peer 版本，因此安装时可能保留这一已有提示。Tailwind CSS 4 和 weapp-tailwindcss 5 的升级独立保留。

Tailwind 入口为 `src/app.css`，通过 `src/App.vue` 引入。`vite.config.ts` 中的 `WeappTailwindcss` 同时负责 H5 和小程序 CSS 生成；不要在 H5 禁用插件，也不要重复注册 `@tailwindcss/vite`、`@tailwindcss/postcss` 或运行 `weapp-tw patch`。`tailwind.config.ts` 仅保留 Iconify 插件，颜色与扫描范围在 CSS 入口中维护。参见 [官方接入说明](https://tw.weapp.dev/docs/quick-start/frameworks/uni-app-vite)。

### vscode

使用 `vscode` 的开发者，请先安装 [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) 智能提示与感应插件

其他 IDE 请参考 [weapp-tailwindcss 文档](https://tw.weapp.dev/)。

### 更换 Appid

把 `src/manifest.json` 中的 `appid`, 更换为你自己的 `appid`, 比如 `uni-app` / `mp-weixin` 平台。

## 代码格式

使用 Prettier 3.9.10，与 Vue Web 端保持一致：2 空格缩进、单引号、不加分号、LF 换行。

```bash
pnpm format       # 格式化源码、测试、工程配置和文档
pnpm format:check # 只检查，不修改文件
```

`.prettierignore` 排除依赖、构建产物、缓存、锁文件和 `src/auto-imports.d.ts` 等自动生成的类型声明。CI 的 Quality 工作流执行同版本检查，格式不符合规范会失败。

## 升级依赖

- `pnpm up:pkg` 升级除了 `uni-app` 相关的其他依赖
- `pnpm up:uniapp` 升级 `uni-app` 相关的依赖

推荐先使用 `pnpm up:pkg` 升级, 再使用 `pnpm up:uniapp` 进行升级，因为 `pnpm up:uniapp` 很有可能会进行版本的降级已达到和 `uni-app` 版本匹配的效果

## 切换镜像源

默认使用 npm 官方源；如需镜像，可在 `pnpm-workspace.yaml` 配置 `registry`，或安装时传入 `--registry`。

pnpm 11 的工程设置位于 `pnpm-workspace.yaml`，`.npmrc` 仅用于认证信息；不要提交令牌。

## 包管理器

本工程统一使用 `pnpm@11.28.6`。`pnpm-lock.yaml` 应与 `package.json`、`pnpm-workspace.yaml` 一起提交到 Git，固定直接和传递依赖。首次拉取及 CI 使用 `pnpm install --frozen-lockfile`；有意新增或升级依赖时使用 `pnpm add` / `pnpm update`，检查锁文件差异并一起提交。不要手工编辑或删除锁文件。

### weapp-ide-cli

本项目已经集成 `weapp-ide-cli` 可以通过 `cli` 对 `ide` 进行额外操作

- `pnpm open:dev` 打开微信开发者工具，引入 `dist/dev/mp-weixin`
- `pnpm open:build` 打开微信开发者工具，引入 `dist/build/mp-weixin`

[详细信息](https://www.npmjs.com/package/weapp-ide-cli)

## tailwindcss 生态

详见：<https://github.com/aniftyco/awesome-tailwindcss>

你可以在这里找到许多现成的UI，组件模板。

## 单位转换

- `rem` -> `rpx` (默认开启, 见 `vite.config.ts` 中 `uvtw` 插件的 `rem2rpx` 选项)
- `px` -> `rpx` (默认不开启，可在 `postcss.config.ts` 中引入 `postcss-pxtransform` 开启配置)

## Tips

- 升级 `uni-app` 依赖的方式为 `pnpm dlx @dcloudio/uvm` 后，选择对应的 `Package Manager` 即可。而升级其他包的方式，可以使用 `pnpm up -Li`，这个是 `pnpm` 自带的方式。
- 使用 `vscode` 记得安装官方插件 `stylelint`,`tailwindcss`, 已在 `.vscode/extensions.json` 中设置推荐
