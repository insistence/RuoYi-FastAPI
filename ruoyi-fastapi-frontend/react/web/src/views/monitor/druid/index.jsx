import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
export default function Druid() {
  useI18n()

  return <div className="app-container">{t('monitor:dataMonitoring')}</div>
}
