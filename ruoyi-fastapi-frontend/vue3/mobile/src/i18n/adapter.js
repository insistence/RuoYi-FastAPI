import { setMessageTranslator } from './message.mjs'
import { reactive, toRef } from 'vue'
import { i18n } from './index'

export const localeState = reactive({ locale: i18n.locale, preference: i18n.preference })
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
export const useI18n = () => ({
  locale: toRef(localeState, 'locale'),
  preference: toRef(localeState, 'preference'),
  t,
  i18n,
})
export default {
  install(app) {
    setMessageTranslator(t)
    app.config.globalProperties.$t = t
    app.config.globalProperties.$locale = localeState
  },
}
