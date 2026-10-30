import Vue from 'vue'
import { i18n } from './index'

export const localeState = Vue.observable({ locale: i18n.locale, preference: i18n.preference })
i18n.engine.on('languageChanged', (locale) => {
  localeState.locale = locale
})
i18n.engine.on('preferenceChanged', (preference) => {
  localeState.preference = preference
})
export const t = (key, options) => {
  void localeState.locale
  return i18n.t(key, options)
}
export const resolveText = (original, translations) => {
  void localeState.locale
  return i18n.resolveText(original, translations)
}
export const resolveRouteTitle = (route) => {
  void localeState.locale
  return i18n.resolveRouteTitle(route)
}
export const useI18n = () => ({ state: localeState, t, i18n })
export default {
  install(Vue) {
    Vue.prototype.$t = t
    Vue.prototype.$resolveText = resolveText
    Vue.prototype.$routeTitle = resolveRouteTitle
    Vue.prototype.$locale = localeState
  },
}
