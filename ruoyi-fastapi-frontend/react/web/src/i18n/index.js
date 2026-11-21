import { setMessageTranslator } from './message.mjs'
import { setPluginMessageTranslator } from '../utils/pluginBridge.js'
import appManifest from '../../package.json' with { type: 'json' }
import { createLocaleRuntime } from './runtime.mjs'
import { meta, resources } from './registry.js'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn.js'
import 'dayjs/locale/en.js'

const scope = 'ruoyi-react-web:' + (import.meta.env?.VITE_APP_BASE_API || '')
export const i18n = createLocaleRuntime({
  appVersion: appManifest.version,
  meta,
  resources,
  storage: {
    get: (key) => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value)
      } catch {}
    },
  },
  scope,
  deviceLocales: () =>
    typeof navigator === 'undefined' ? [] : navigator.languages || [navigator.language],
  onChange(code, entry) {
    dayjs.locale(entry.dayjs || 'en')
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code
      document.documentElement.dir = entry.direction
      const text = i18n.t('common:loadingSystemResourcesPleaseWait')
      const label = document.getElementById('bootstrap-loading-text')
      if (label) label.textContent = text
      try {
        sessionStorage.setItem(`${scope}:bootstrap-loading`, text)
      } catch {}
    }
  },
})
export const t = i18n.t
setMessageTranslator(t)
setPluginMessageTranslator(t)
export const resolveRouteTitle = (route) => i18n.resolveRouteTitle(route)
export const refreshDeviceLocale = () => i18n.refreshDeviceLocale()

if (typeof window !== 'undefined') {
  window.addEventListener('focus', refreshDeviceLocale)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshDeviceLocale()
  })
  window.addEventListener('storage', (event) => i18n.acceptStorageEvent(event.key, event.newValue))
}
