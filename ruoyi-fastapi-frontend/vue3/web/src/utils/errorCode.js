import { t } from '@/i18n/adapter'
const errorCode = {
  get 401() {
    return t('components:authenticationFailedUnableToAccessSystemResources')
  },
  get 403() {
    return t('components:youDoNotHavePermissionToPerformThisAction')
  },
  get 404() {
    return t('components:theRequestedResourceDoesNotExist')
  },
  get default() {
    return t('components:anUnknownErrorOccurredPleaseContactTheAdministrator')
  },
}

export default errorCode

export function getResponseMessage({ msg, code }) {
  if (typeof msg === 'string' && msg.trim()) return msg
  return Object.prototype.hasOwnProperty.call(errorCode, code) ? errorCode[code] : errorCode.default
}
