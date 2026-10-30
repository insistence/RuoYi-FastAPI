export default function errorCode(t) {
  return {
    get 401() {
      return t('mobile:authenticationFailedUnableToAccessSystemResources')
    },
    get 403() {
      return t('mobile:youDoNotHavePermissionForThisAction')
    },
    get 404() {
      return t('mobile:theRequestedResourceWasNotFound')
    },
    get default() {
      return t('mobile:unknownSystemErrorContactYourAdministrator')
    },
  }
}
