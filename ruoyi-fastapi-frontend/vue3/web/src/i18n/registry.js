import meta from './locale-meta.json'
import zh from './locales/zh-CN/common.json'
import en from './locales/en-US/common.json'
import zhAuth from './locales/zh-CN/auth.json'
import enAuth from './locales/en-US/auth.json'
import zhLayout from './locales/zh-CN/layout.json'
import enLayout from './locales/en-US/layout.json'

import zhSystem from './locales/zh-CN/system.json'
import enSystem from './locales/en-US/system.json'

import zhComponents from './locales/zh-CN/components.json'
import enComponents from './locales/en-US/components.json'

import zhAuthCenter from './locales/zh-CN/authCenter.json'
import enAuthCenter from './locales/en-US/authCenter.json'

import zhDashboard from './locales/zh-CN/dashboard.json'
import enDashboard from './locales/en-US/dashboard.json'

import zhMonitor from './locales/zh-CN/monitor.json'
import enMonitor from './locales/en-US/monitor.json'

import zhOauth from './locales/zh-CN/oauth.json'
import enOauth from './locales/en-US/oauth.json'

import zhTools from './locales/zh-CN/tools.json'
import enTools from './locales/en-US/tools.json'

import zhUtility from './locales/zh-CN/utility.json'
import enUtility from './locales/en-US/utility.json'

import zhFiles from './locales/zh-CN/files.json'
import enFiles from './locales/en-US/files.json'

import zhPlugins from './locales/zh-CN/plugins.json'
import enPlugins from './locales/en-US/plugins.json'

import zhAi from '../../plugins/ai/locales/zh-CN.json'
import enAi from '../../plugins/ai/locales/en-US.json'

export { meta }
export const resources = {
  'zh-CN': {
    utility: zhUtility,
    common: zh,
    'plugin.ai': zhAi,
    auth: zhAuth,
    layout: zhLayout,
    system: zhSystem,
    plugins: zhPlugins,
    files: zhFiles,
    tools: zhTools,
    oauth: zhOauth,
    monitor: zhMonitor,
    dashboard: zhDashboard,
    authCenter: zhAuthCenter,
    components: zhComponents,
  },
  'en-US': {
    utility: enUtility,
    common: en,
    'plugin.ai': enAi,
    auth: enAuth,
    layout: enLayout,
    system: enSystem,
    plugins: enPlugins,
    files: enFiles,
    tools: enTools,
    oauth: enOauth,
    monitor: enMonitor,
    dashboard: enDashboard,
    authCenter: enAuthCenter,
    components: enComponents,
  },
}
