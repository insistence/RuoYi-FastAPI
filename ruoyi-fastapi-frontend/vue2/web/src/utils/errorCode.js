import { t } from '@/i18n'
const errorCode = {
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

export default errorCode

export function getResponseMessage({ msg, code }) {
  if (typeof msg === 'string' && msg.trim()) return msg
  return Object.prototype.hasOwnProperty.call(errorCode, code) ? errorCode[code] : errorCode.default
}
