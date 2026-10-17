# React Web

React 19 + Ant Design 6 + Ant Design X + Vite。业务目录、接口参数、后端菜单路径与 Vue3 Web 对应。

## 安装与启动

进入本工程目录，使用满足依赖要求的 Node.js，pnpm 版本以 `package.json` 的 `packageManager` 字段为准。

```sh
pnpm install --no-frozen-lockfile
pnpm dev
```

依赖锁文件由安装过程生成，不纳入 Git 提交。启动后访问终端输出的服务地址；端口可通过 Vite 配置或启动参数调整。

前端需要访问配套 FastAPI 服务，后端可以部署在开发机、共享服务或容器环境。使用后端已有账户登录，注册入口由后端 `registerEnabled` 控制。

## 环境配置

按运行模式使用 `.env.development`、`.env.production`、`.env.staging` 或 `.env.docker`；环境专属配置可放在对应的 `.env.<mode>.local` 中，也可由构建环境注入。`.local` 文件不纳入 Git 提交。

| 变量                    | 用途                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `VITE_APP_PROXY_TARGET` | 开发代理的后端目标地址，必须能由开发服务器访问                |
| `VITE_APP_BASE_API`     | 浏览器请求 API 的公共前缀，需与对应模式下的代理或网关配置一致 |
| `VITE_APP_PLUGIN_BASE`  | 插件公开路径前缀，需与后端 `APP_ROOT_PATH` 及反向代理配置一致 |

开发模式配置示例，后端域名需替换为实际服务地址：

```dotenv
VITE_APP_PROXY_TARGET=https://backend.example.com
VITE_APP_BASE_API=/dev-api
VITE_APP_PLUGIN_BASE=/dev-api
```

开发代理处理业务 API、插件 iframe、运行时与 SSE 路径，以及 `/.well-known`、`/auth/interaction`、`/oauth2`。前端环境变量在构建时写入产物，部署环境变化时应使用对应配置重新构建。

## 构建与部署

```sh
pnpm test
pnpm build          # .env.production，输出 dist/
pnpm build:stage    # .env.staging
pnpm build:docker   # .env.docker
pnpm preview
```

部署时将 `dist/` 交给静态服务器，配置 SPA 回退至 `index.html`，并按构建时使用的路径前缀将接口、插件和统一认证请求代理到后端。插件 SSE 代理应关闭缓冲并保持流连接；插件页面和宿主的路径、来源约束应与后端配置一致。`pnpm preview` 用于预览构建产物。

已提供多阶段 `Dockerfile` 和 MySQL/PostgreSQL 的 Nginx 配置，例如：

```sh
docker build -t ruoyi-react-web .
docker build --build-arg NGINX_CONFIG=bin/nginx.dockerpg.conf -t ruoyi-react-web:postgres .
```

容器构建根据工程依赖清单安装依赖，不要求宿主提供锁文件。提供的 Nginx 配置是部署模板，上游服务名、接口前缀和代理规则需与实际部署网络匹配。构建默认生成 gzip 文件，原文件保留；是否发送预压缩资源由部署服务器决定。Windows 可使用 `bin/run-web.bat` 与 `bin/build.bat`。

## 开发约定

- 页面放在与 Vue 对应的 `src/views/...` 中，公共组件按原职责放在 `src/components`。
- `api` 保留后端契约；`store/modules` 使用 Zustand，动态菜单经 `router` 映射到页面模块。
- 权限按钮使用 `Permission`/权限工具；路由访问同样校验权限，不能只隐藏菜单。
- 时间显示及提交使用 `utils/time` 和 `BusinessDateTimePicker`；编辑时保留原始值和 DST 选择信息。
- 插件页面可使用 `plugins/<插件标识>/views` 下的 React 组件，或后端提供的隔离 iframe。桥接协议与 SSE 逻辑沿用原项目的边界检查。
- 在线表单构建器输出 React/Ant Design JSX，后端代码生成器选择 `react-antd` 模板。
- 业务附件使用 `BusinessFileUpload` 的 `value/onChange`，值为 `{fileId, name, url}[]`；不要与普通 `FileUpload` 的 URL 字符串混用。`ref.getFileIds()` 返回业务关联需要的文件 ID。
- `JsonEditor` 使用受控文本值，支持 `valueType="array"/"object"`、`validate` 和 `readOnly`，Monaco 与 Worker 按需加载。

## 代码格式

`pnpm format` 格式化整个工程，`pnpm format:check` 只检查。Prettier 3.6.2 的规则与 Vue2/Vue3 Web/Mobile 一致；CI 通过统一循环检查六个工程，项目特有的生成文件和历史兼容性夹具由 `.prettierignore` 排除。详见[格式约定](./FORMATTING.md)。

## 测试

测试分组与执行顺序和 Vue3 Web 对齐。`pnpm test` 先执行 `test:unit`（认证中心 → 插件 → 定时任务），再执行 `test:contract`（共享时间契约）。当前共有 13 个 Node 测试文件和 3 个 React 组件测试文件。

| 命令                    | 范围                                                |
| ----------------------- | --------------------------------------------------- |
| `pnpm test`             | 顺序运行全部单元测试和时间契约                      |
| `pnpm test:unit`        | 认证中心、插件、定时任务，包含对应的 React 组件测试 |
| `pnpm test:contract`    | 共享时间契约，调用 `test:time`                      |
| `pnpm test:job`         | 定时任务表单参数                                    |
| `pnpm test:plugin`      | 插件桥接、代理、SSE、兼容性、配置状态及组件生命周期 |
| `pnpm test:auth-center` | 认证中心基础逻辑及认证交互 hook                     |
| `pnpm test:time`        | 单独运行共享时间契约                                |
| `pnpm test:components`  | 单独运行全部 React 组件与 hook 测试                 |

组件测试使用 Vitest / React Testing Library，已归入认证和插件分组；执行 `pnpm test` 时每个测试文件只运行一次。

CI 按 React Web 的变更选中本工程，安装使用 `pnpm install --no-frozen-lockfile`，执行格式检查、单元/组件测试、三时区契约及生产/Docker 模式构建。插件网络验收覆盖真实 HTTPS 代理、会话 Cookie、CSRF、SSE 和 WebSocket。隔离的 MySQL/PostgreSQL E2E 覆盖登录、29 个菜单页面与权限、用户时区，以及岗位/参数/公告 CRUD；其他 Vue 业务操作用例尚未计入 React 覆盖。详见[CI 与本地复现说明](../../../ruoyi-fastapi-test/README.md#ci-分类与触发)。

## 插件开发

插件 CLI 已支持 React 源码模板：`ruoyi plugin create demo --template=crud-page --frontend-framework=react`。生成页面使用 Hooks、Ant Design 和 `.jsx` 路由入口；详见[插件开发手册](../../../ruoyi-fastapi-backend/docs/plugin_development.md#2-快速开始)。
