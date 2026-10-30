import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import CronField from './field'
export default function Field(props) {
  useI18n()

  return (
    <CronField
      {...props}
      name="second"
      label={t('common:seconds')}
      min={0}
      max={59}
    />
  )
}
