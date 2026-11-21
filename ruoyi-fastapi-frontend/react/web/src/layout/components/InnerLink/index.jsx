import { resolveRouteTitle } from '@/i18n'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import IFrame from '@/components/iFrame'
import { useLocation } from 'react-router-dom'
import { innerLinkUrl } from '@/utils/innerLink'
export default function InnerLink({ route }) {
  useI18n()

  const location = useLocation()
  const link = innerLinkUrl(route.meta?.link, location.search)
  return link ? (
    <IFrame
      src={link}
      title={resolveRouteTitle(route) || t('common:embeddedPage')}
    />
  ) : null
}
