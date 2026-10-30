import { createLocaleRuntime } from './runtime.mjs'
import { meta, resources } from './registry'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn.js'
import 'dayjs/locale/en.js'

export const i18n = createLocaleRuntime({
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
  scope: 'ruoyi-vue3-web:' + (import.meta.env.VITE_APP_BASE_API || ''),
  deviceLocales: () =>
    typeof navigator === 'undefined' ? [] : navigator.languages || [navigator.language],
  onChange(code, entry) {
    dayjs.locale(entry.dayjs || 'en')
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code
      document.documentElement.dir = entry.direction
    }
  },
})
export const t = i18n.t
export const resolveRouteTitle = (route) => i18n.resolveRouteTitle(route)
export const refreshDeviceLocale = () => i18n.refreshDeviceLocale()

if (typeof window !== 'undefined') {
  window.addEventListener('focus', refreshDeviceLocale)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshDeviceLocale()
  })
  window.addEventListener('storage', (event) => i18n.acceptStorageEvent(event.key, event.newValue))
}
