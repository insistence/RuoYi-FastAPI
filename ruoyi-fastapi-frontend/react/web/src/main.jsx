import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/i18n'
import { registerGeneratedResources } from '@/i18n/generated.mjs'
import { getToken } from '@/utils/auth'
registerGeneratedResources(
  i18n,
  import.meta.glob('./i18n/locales/*/generated.*.json', { eager: true, import: 'default' })
)
i18n.initialize(Boolean(getToken()))
import { createRoot } from 'react-dom/client'
import App from './App'
// 全局组件样式、业务样式与页面过渡样式。
import 'antd/dist/reset.css'
import './assets/styles/react.css'
import './assets/styles/transitions.css'

// 挂载应用；主题、反馈实例与路由上下文由 App 统一配置。
createRoot(document.getElementById('root')).render(
  <I18nextProvider i18n={i18n.engine}>
    <App />
  </I18nextProvider>
)
