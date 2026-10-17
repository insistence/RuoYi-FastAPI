# AI 管理 React 前端

宿主位于 `ruoyi-fastapi-frontend/react/web`，共享后端 `plugins/ai` 接口及菜单权限。后端菜单路径无需修改：

| 菜单组件路径            | React 页面              |
| ----------------------- | ----------------------- |
| `plugin/ai/model/index` | `views/model/index.jsx` |
| `plugin/ai/chat/index`  | `views/chat/index.jsx`  |

模型管理支持供应商、模型、密钥和生成参数配置；聊天支持会话历史、图片、流式输出与停止、Markdown、代码、KaTeX 和 Mermaid。按钮权限使用 `HasPermi`，服务端仍负责鉴权。

页面使用 React、Ant Design X、markstream-react、stream-diffs、KaTeX、Mermaid，依赖统一声明在宿主 `package.json` 中。进入宿主工程后使用 `pnpm install --no-frozen-lockfile`、`pnpm dev`、`pnpm build`；依赖锁文件由安装过程生成，不纳入 Git 提交。服务地址、接口前缀及构建模式按[宿主说明](../../README.md)配置。

消息正文与思考过程统一使用 [markstream-react](https://markstream.simonhe.me/zh/frameworks/react.html)，对应 Vue 版的 markstream-vue。两处均通过 `final={!loading}` 同步流式结束/停止状态，通过 `isDark` 跟随宿主主题；代码高亮由 `stream-diffs` 提供，KaTeX 和 Mermaid 由渲染器按需加载。已引入官方 Markdown 与 KaTeX 样式，保留原版思考区折叠布局和三点等待动画。HTML 使用渲染器的 `safe` 策略。

后端 AI 清单已声明 dependencies.frontend.react，插件结构检查支持 React 的 .jsx 页面。后端启动或执行插件命令前设置 RUOYI_PLUGIN_FRONTEND_FRAMEWORK=react，即可使用现有 check、install-deps、lock-deps 流程；安装和启用共用同一后端，不需要为 React 再安装一份。具体命令见[后端 AI 插件说明](../../../../../ruoyi-fastapi-backend/plugins/ai/README.md#react-宿主)。

后端 CLI 已提供 React 基础页及 CRUD 源码模板，可使用 `ruoyi plugin create demo --template=crud-page --frontend-framework=react` 生成独立的新插件。AI 插件继续使用现有实现，无需重新生成。独立 iframe 插件通过宿主 PluginFrame 与桥接 SDK 运行。
