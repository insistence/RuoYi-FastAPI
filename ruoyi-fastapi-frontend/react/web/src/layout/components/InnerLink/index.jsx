import IFrame from '@/components/iFrame'
import { useLocation } from 'react-router-dom'
import { innerLinkUrl } from '@/utils/innerLink'
export default function InnerLink({ route }) {
  const location = useLocation()
  const link = innerLinkUrl(route.meta?.link, location.search)
  return link ? (
    <IFrame
      src={link}
      title={route.meta?.title || '内嵌页面'}
    />
  ) : null
}
