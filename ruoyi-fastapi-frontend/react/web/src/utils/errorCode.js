import { t } from '../i18n/index.js'
export default function errorCode(t) {
  return {
    get 401() {
      return t('common:authenticationFailedUnableToAccessSystemResources')
    },
    get 403() {
      return t('common:youDoNotHavePermissionForThisAction')
    },
    get 404() {
      return t('common:theRequestedResourceWasNotFound')
    },
    get default() {
      return t('common:unknownSystemErrorContactYourAdministrator')
    },
  }
}
