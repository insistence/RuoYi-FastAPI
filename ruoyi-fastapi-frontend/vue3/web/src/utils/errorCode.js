import { t } from '@/i18n/adapter'
export default {
  get 401() {
    return t('components:authenticationFailedUnableToAccessSystemResources')
  },
  get 403() {
    return t('components:youDoNotHavePermissionToPerformThisAction')
  },
  get 404() {
    return t('components:theRequestedResourceDoesNotExist')
  },
  default: () => t('components:anUnknownErrorOccurredPleaseContactTheAdministrator'),
}
