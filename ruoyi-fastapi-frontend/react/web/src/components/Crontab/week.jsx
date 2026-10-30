import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import CronField from './field'
export default function Field(props) {
  useI18n()

  return (
    <CronField
      {...props}
      name="week"
      label={t('common:week')}
      min={1}
      max={7}
    />
  )
}
