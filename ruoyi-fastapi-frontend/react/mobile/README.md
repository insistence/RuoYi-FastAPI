# React / Taro 移动端

以 Vue3 移动端的 17 个页面为基础，采用 Taro 4.3、React 18.2、Vite 4.5.14、Tailwind CSS 4.3.3 和 weapp-tailwindcss 5.6.3。页面路径、接口和 `store/modules` 的职责保持对应关系。

## 启动与接口地址

Node.js 使用 22.x（最低 22.22.2）或 24.x（最低 24.15.0），推荐对应版本线的最新补丁。CI 分别验证两条版本线。包管理器版本以 `package.json` 的 `packageManager` 为准。

```sh
pnpm install
pnpm dev:h5             # H5 默认端口 9090，访问启动日志中显示的地址
pnpm dev:mp-weixin      # 微信开发者工具导入 dist/weapp
pnpm build:h5
pnpm build:mp-weixin
```

本工程统一使用 `pnpm@11.28.6`。`pnpm-lock.yaml` 应与 `package.json`、`pnpm-workspace.yaml` 一起提交到 Git，固定直接和传递依赖。首次拉取及 CI 使用 `pnpm install --frozen-lockfile`；有意新增或升级依赖时使用 `pnpm add` / `pnpm update`，检查锁文件差异并一起提交。不要手工编辑或删除锁文件。

Taro 核心包保持同一版本，Vite 保留 Taro 4.3 runner 声明支持的 4.5.14。Vite 6 在本工程中存在 H5 开发服务启动问题，Vite 7 删除了 Taro 使用的旧 HTML 钩子，Vite 8 还更换了底层打包器，因此等待上游适配后再升级。weapp-tailwindcss 5.6.3 的可选 Vite peer 要求 5.2 以上，安装时仍会显示兼容提示；当前组合已验证开发服务、H5 和小程序构建，后续升级应重复这些检查。React 18.2、React Native 0.73 和 Expo 50 也必须作为一组维护，不能跟随 Web 端升级到 React 19。

`src/app.css` 使用 Tailwind CSS 4 的 CSS 入口，`WeappTailwindcss` 在 H5 和小程序构建中统一生成样式；不要再叠加 Tailwind 官方 Vite / PostCSS 插件。参见 [weapp-tailwindcss 的 Taro 接入说明](https://tw.weapp.dev/docs/quick-start/frameworks/taro)。

H5 开发服务默认端口为 `9090`，与 Vue2、Vue3 移动端保持一致。监听地址、端口和代理目标由 `config/index.ts` 中的 `h5.devServer` 配置；如需同时运行多个移动端版本，请为它们配置不同端口，并以启动日志中的实际地址为准。

H5 默认使用 `/dev-api` 作为接口前缀；根据后端部署地址调整开发代理，或通过 `TARO_APP_BASE_API` 指定接口地址。小程序和 App 应在启动或构建前设置目标设备可访问的后端地址。

在命令行或 CI 环境中设置 `TARO_APP_BASE_API`，例如使用 POSIX Shell：

```sh
TARO_APP_BASE_API=https://api.example.com pnpm build:mp-weixin
```

PowerShell 的等价写法：

```powershell
$env:TARO_APP_BASE_API = 'https://api.example.com'
pnpm build:mp-weixin
```

接口地址在编译时注入，更换环境后需重新构建。上述变量同样适用于 H5 和 RN 构建命令。小程序需配置自己的 AppID、合法请求/上传域名；项目中的测试 AppID 应在发布前替换。H5 使用 hash 路由，部署目录为 `dist/h5`；使用相对 API 前缀时，需在部署服务中配置对应的反向代理。

## 平台对应

| 平台                           | 构建命令/目标                       | 产物与集成方式                                                         |
| ------------------------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| H5                             | `build:h5`                          | `dist/h5`，部署到 Web 服务                                             |
| 微信                           | `build:mp-weixin` / weapp           | `dist/weapp`，导入微信开发者工具                                       |
| 支付宝                         | `build:mp-alipay` / alipay          | `dist/alipay`，导入对应开发者工具                                      |
| 百度                           | `build:mp-baidu` / swan             | `dist/swan`，导入对应开发者工具                                        |
| 抖音                           | `build:mp-toutiao` / tt             | `dist/tt`，导入对应开发者工具                                          |
| QQ                             | `build:mp-qq` / qq                  | `dist/qq`，导入对应开发者工具                                          |
| 京东                           | `build:mp-jd` / jd                  | `dist/jd`，导入对应开发者工具                                          |
| 快手                           | `build:mp-kuaishou` / kwai          | `dist/kwai`，使用社区平台插件                                          |
| 飞书                           | `build:mp-lark` / lark              | `dist/lark`，使用社区平台插件                                          |
| 小红书                         | `build:mp-xhs` / xhs                | `dist/xhs`，使用社区平台插件                                           |
| 鸿蒙                           | `build:harmony-hybrid`              | `dist/harmony-hybrid`，集成到对应容器                                  |
| Android / iOS App              | `build:rn:android` / `build:rn:ios` | `dist/rn/android` / `dist/rn/ios`，集成 JS bundle 和资源后编译原生工程 |
| H5 SSR                         | 无对应命令                          | 本工程未提供服务端渲染目标                                             |
| quickapp-webview / 华为 / 联盟 | 无对应命令                          | 本工程未提供对应构建目标                                               |

表中的命令均通过 `pnpm` 执行。`build:app` 是 Android JS bundle 的别名，`dev:app` 启动 Taro 的 Metro 开发服务。各平台发布前需使用对应开发者工具和设备验证登录加密、上传、Canvas、WebView 域名限制及平台权限。

## 原生 App

原生基线为 React Native 0.73.11 / Expo SDK 50，与 Taro 4.3 RN 运行时配套。使用 [Taro 官方原生壳工程](https://github.com/NervJS/taro-native-shell/tree/0.73.0) 或已有兼容的 RN 工程，将应用注册名设置为 `RuoYiFastAPI`，并集成本工程声明的原生依赖。

```sh
pnpm dev:rn
pnpm build:rn:android   # dist/rn/android/index.bundle + assets
pnpm build:rn:ios       # dist/rn/ios/main.jsbundle + assets
```

CI 为两种 bundle 命令追加 `--reset-cache`，分别从干净的 Metro 缓存构建。重新安装依赖后如遇到旧模块解析缓存，也可使用 `pnpm build:rn:ios --reset-cache` 或 Android 的等价命令。

配置位于 `config/index.ts`、`metro.config.js` 和 `babel.config.js`。原生壳需链接 AsyncStorage、Expo Crypto/Image Manipulator/Image Picker、SVG、Gesture Handler、Screens 等依赖；相册/相机用途说明与 Android 权限应在壳工程中配置。仅安装 Expo Go 不能替代包含这些原生模块的开发包。

本工程的 RN 构建命令只输出 JS bundle 和资源。生成 APK/IPA 需要在原生壳工程中配置 Android SDK/Gradle 或 Xcode 工具链，完成原生编译、签名及设备测试。

平台差异集中在 `.rn.js/.rn.jsx` 文件：

- 同步存储调用通过内存缓存适配 AsyncStorage，先恢复账户数据再挂载页面，写入按顺序执行。
- 传输加密使用 Expo Crypto 的安全随机数，头像使用 Expo Image Manipulator 裁剪。
- `components/primitives.rn.jsx` 实现当前页面所用的原生网格、文本继承、SVG 图标、滚动及样式；H5/小程序继续使用 Taro 组件和 weapp-tailwindcss。
- RN 0.73 不支持 CSS 的模糊、backdrop 和部分过渡效果；这些装饰效果在原生端降级。

## 验证与维护

```sh
pnpm test
pnpm test:unit
pnpm test:contract
pnpm check:platforms h5 weapp alipay swan tt qq jd kwai lark xhs harmony-hybrid
pnpm format
pnpm format:check
pnpm generate:icons
node scripts/pack-timezones.cjs
```

`pnpm test` 先执行裁剪、原生样式、路由参数、传输加密和时区数据单元测试，再执行时间契约及缺少原生 Intl 时的兼容测试。CI 在 UTC、Asia/Shanghai、America/New_York 三个宿主时区重复执行 `test:contract`。

PR 中验证 H5/微信构建、H5 登录与资料页，以及 Android/iOS JS bundle。完整 CI 模式增加表中其他已支持的小程序和鸿蒙目标。依赖按本工程声明的 pnpm 版本安装，使用 `--frozen-lockfile`；平台构建日志和浏览器失败诊断保存在 Actions artifact。流程与本地复现方式见[CI 说明](../../../ruoyi-fastapi-test/README.md#ci-分类与触发)。

格式化使用 Prettier 3.9.10，与 Vue2/Vue3 的规则一致：2 空格缩进、单引号、不加分号、LF 换行。`pnpm format` 格式化整个工程，`pnpm format:check` 只检查；依赖、缓存、构建产物、锁文件、生成的时区/图标数据及 HTML 入口模板通过 `.prettierignore` 排除。CI 的 Quality 工作流统一检查六个前端工程。

需要导入打包的图片放在 `src/assets`，底栏等静态路径资源保留在 `src/static`。不要从 `static` 导入图片模块：Taro H5 开发服务器会直接返回图片，绕过 Vite 的模块转换。

构建矩阵日志在 `.cache/platform-check`，脚本同时检查 H5 产物是否包含应用入口。`src/index.html` 的模板脚本必须保留为一行，以匹配 Taro 4.3 的入口替换规则，已加入格式化忽略列表。

时区表以压缩数据打包，测试验证所有 IANA 时区记录和转换与原始 FormatJS 数据完全一致。新增图标时修改 `scripts/generate-icons.cjs` 并重新生成 CSS/原生 SVG 数据。新增页面样式时同步更新 `utils/nativeStyles.js`，测试会检查页面中的静态类名是否均有原生对应项。

加密随机数只使用 Web Crypto、平台安全 API 或原生 Expo Crypto；平台缺少安全随机源时会明确报错，不回退到 `Math.random`。生产上线前应验证目标平台是否提供所需随机数能力。

参考：[Taro + Vite + Tailwind v4 模板](https://github.com/icebreaker-template/taro-vite-tailwindcss-v4)、[weapp-tailwindcss 文档](https://tw.weapp.dev/)、[Taro 文档](https://docs.taro.zone/)。
