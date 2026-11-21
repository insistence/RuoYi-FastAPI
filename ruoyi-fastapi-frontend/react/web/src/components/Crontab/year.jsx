import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import CronField from './field'
export default function Field(props) {
  useI18n()

  return (
    <CronField
      {...props}
      name="year"
      label={t('components:cron.year')}
      min={1970}
      max={2099}
    />
  )
}
