import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import IFrame from '@/components/iFrame'
export default function Swagger() {
  useI18n()

  return (
    <IFrame
      src={`${import.meta.env.VITE_APP_BASE_API}/proxy-docs`}
      title={t('tool:systemApiDocumentation')}
    />
  )
}
