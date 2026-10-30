import '@/utils/time' // 原生端须先加载 Intl 兼容实现，再初始化 i18next。
import '@formatjs/intl-pluralrules/locale-data/zh.js'
import '@formatjs/intl-numberformat/locale-data/zh.js'
import '@formatjs/intl-datetimeformat/locale-data/zh.js'
import { createLocaleRuntime } from './runtime.mjs'
import { meta, resources } from './registry'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import config from '@/config'

export const i18n = createLocaleRuntime({
  meta,
  resources,
  storage: {
    get: (key) => uni.getStorageSync(key),
    set: (key, value) => uni.setStorageSync(key, value),
  },
  scope: 'ruoyi-vue3-mobile:' + (config.baseUrl || ''),
  deviceLocales: () => [uni.getSystemInfoSync().language],
  onChange(code, entry) {
    dayjs.locale(entry.dayjs || 'en')
    if (typeof uni.setLocale === 'function') uni.setLocale(code)
  },
})
export const t = i18n.t
export const resolveRouteTitle = (route) => i18n.resolveRouteTitle(route)
export const refreshDeviceLocale = () => i18n.refreshDeviceLocale()
