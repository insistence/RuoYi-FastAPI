import { t } from '@/i18n'
export default {
  get 401() {
    return t('common:network.unauthorized')
  },
  get 403() {
    return t('common:network.forbidden')
  },
  get 404() {
    return t('common:network.notFound')
  },
  get default() {
    return t('common:network.unknown')
  },
}
