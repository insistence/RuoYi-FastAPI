import { t } from '@/i18n'
export default {
  get 401() {
    return t('mobile:errors.unauthorized')
  },
  get 403() {
    return t('mobile:errors.forbidden')
  },
  get 404() {
    return t('mobile:errors.notFound')
  },
  get default() {
    return t('mobile:errors.unknown')
  },
}
