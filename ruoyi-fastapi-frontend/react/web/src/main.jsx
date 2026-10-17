import { createRoot } from 'react-dom/client'
import App from './App'
// 全局组件样式、业务样式与页面过渡样式。
import 'antd/dist/reset.css'
import './assets/styles/react.css'
import './assets/styles/transitions.css'

// 挂载应用；主题、反馈实例与路由上下文由 App 统一配置。
createRoot(document.getElementById('root')).render(<App />)
