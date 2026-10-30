import { useTranslation } from 'react-i18next'
import { i18n } from './index'

export function useI18n() {
  const { t } = useTranslation('common', {
    i18n: i18n.engine,
    bindI18n: 'languageChanged preferenceChanged',
  })
  return { t, locale: i18n.locale, preference: i18n.preference, i18n }
}
