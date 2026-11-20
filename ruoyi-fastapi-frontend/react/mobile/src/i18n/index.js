import '@/utils/time' // 原生端须先加载 Intl 兼容实现，再初始化 i18next。
import '@formatjs/intl-pluralrules/locale-data/zh.js'
import '@formatjs/intl-numberformat/locale-data/zh.js'
import '@formatjs/intl-datetimeformat/locale-data/zh.js'
import appManifest from '../../package.json'
import { createLocaleRuntime } from './runtime.mjs'
import { meta, resources } from './registry'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import { getDeviceLocales } from '@/utils/deviceLocale'
import { setMessageTranslator } from './message.mjs'
import { getStorage, setStorage } from '@/utils/platformStorage'
import config from '@/config'

export const i18n = createLocaleRuntime({
  appVersion: appManifest.version,
  meta,
  resources,
  storage: { get: getStorage, set: setStorage },
  scope: 'ruoyi-react-mobile:' + (config.baseUrl || ''),
  deviceLocales: getDeviceLocales,
  onChange(code, entry) {
    dayjs.locale(entry.dayjs || 'en')
  },
})
setMessageTranslator(i18n.t)
export const t = i18n.t
export const resolveRouteTitle = (route) => i18n.resolveRouteTitle(route)
export const refreshDeviceLocale = () => i18n.refreshDeviceLocale()
