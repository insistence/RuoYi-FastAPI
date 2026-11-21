import { createPluginLocaleRuntime } from './plugin.mjs'
import { useTranslation } from 'react-i18next'
import { i18n } from './index'

export function useI18n() {
  const { t } = useTranslation('common', {
    i18n: i18n.engine,
    bindI18n: 'languageChanged preferenceChanged',
  })
  return { t, locale: i18n.locale, preference: i18n.preference, i18n }
}

export function createPluginI18n(meta, resources, namespace) {
  const plugin = createPluginLocaleRuntime({ host: i18n, meta, resources, namespace })
  plugin.useI18n = function useI18n() {
    const { t } = useTranslation(namespace, { i18n: plugin.engine })
    return { t, locale: plugin.locale, i18n: plugin }
  }
  return plugin
}
