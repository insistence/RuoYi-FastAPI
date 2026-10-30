import zhAi from '../../plugins/ai/locales/zh-CN.json' with { type: 'json' }
import enAi from '../../plugins/ai/locales/en-US.json' with { type: 'json' }
import meta from './locale-meta.json' with { type: 'json' }
import locale0Auth from './locales/zh-CN/auth.json' with { type: 'json' }
import locale0AuthCenter from './locales/zh-CN/authCenter.json' with { type: 'json' }
import locale0Common from './locales/zh-CN/common.json' with { type: 'json' }
import locale0File from './locales/zh-CN/file.json' with { type: 'json' }
import locale0Layout from './locales/zh-CN/layout.json' with { type: 'json' }
import locale0Monitor from './locales/zh-CN/monitor.json' with { type: 'json' }
import locale0PluginAdmin from './locales/zh-CN/pluginAdmin.json' with { type: 'json' }
import locale0System from './locales/zh-CN/system.json' with { type: 'json' }
import locale0Tool from './locales/zh-CN/tool.json' with { type: 'json' }
import locale1Auth from './locales/en-US/auth.json' with { type: 'json' }
import locale1AuthCenter from './locales/en-US/authCenter.json' with { type: 'json' }
import locale1Common from './locales/en-US/common.json' with { type: 'json' }
import locale1File from './locales/en-US/file.json' with { type: 'json' }
import locale1Layout from './locales/en-US/layout.json' with { type: 'json' }
import locale1Monitor from './locales/en-US/monitor.json' with { type: 'json' }
import locale1PluginAdmin from './locales/en-US/pluginAdmin.json' with { type: 'json' }
import locale1System from './locales/en-US/system.json' with { type: 'json' }
import locale1Tool from './locales/en-US/tool.json' with { type: 'json' }

export { meta }
export const resources = {
  'zh-CN': {
    'plugin.ai': zhAi,
    auth: locale0Auth,
    authCenter: locale0AuthCenter,
    common: locale0Common,
    file: locale0File,
    layout: locale0Layout,
    monitor: locale0Monitor,
    pluginAdmin: locale0PluginAdmin,
    system: locale0System,
    tool: locale0Tool,
  },
  'en-US': {
    'plugin.ai': enAi,
    auth: locale1Auth,
    authCenter: locale1AuthCenter,
    common: locale1Common,
    file: locale1File,
    layout: locale1Layout,
    monitor: locale1Monitor,
    pluginAdmin: locale1PluginAdmin,
    system: locale1System,
    tool: locale1Tool,
  },
}
