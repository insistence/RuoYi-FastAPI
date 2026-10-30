import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import CronField from './field'
export default function Field(props) {
  useI18n()

  return (
    <CronField
      {...props}
      name="day"
      label={t('common:day')}
      min={1}
      max={31}
    />
  )
}
