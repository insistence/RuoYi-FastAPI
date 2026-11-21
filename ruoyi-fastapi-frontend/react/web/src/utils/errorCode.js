import { t } from '../i18n/index.js'
export default function errorCode(t) {
  return {
    get 401() {
      return t('common:network.authenticationFailedUnableToAccessSystemResources')
    },
    get 403() {
      return t('common:network.youDoNotHavePermissionForThisAction')
    },
    get 404() {
      return t('common:network.theRequestedResourceWasNotFound')
    },
    get default() {
      return t('common:network.unknownSystemErrorContactYourAdministrator')
    },
  }
}
