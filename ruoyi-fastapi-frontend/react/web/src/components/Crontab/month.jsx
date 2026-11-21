import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import CronField from './field'
export default function Field(props) {
  useI18n()

  return (
    <CronField
      {...props}
      name="month"
      label={t('components:cron.month')}
      min={1}
      max={12}
    />
  )
}
