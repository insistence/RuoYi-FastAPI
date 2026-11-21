import { t } from '../../../i18n/index.js'
export const eventGroups = [
  {
    get label() {
      return t('monitor:signInAndAuthorization')
    },
    options: [
      {
        get label() {
          return t('monitor:signInAuthorizationRequested')
        },
        value: 'authorize_requested',
      },
      {
        get label() {
          return t('monitor:signInAuthorizationCompleted')
        },
        value: 'authorize_succeeded',
      },
      {
        get label() {
          return t('monitor:signInAuthorizationDeclined')
        },
        value: 'authorize_denied',
      },
      {
        get label() {
          return t('monitor:userSignedIn')
        },
        value: 'login_succeeded',
      },
      {
        get label() {
          return t('monitor:userSignInFailed')
        },
        value: 'login_failed',
      },
      {
        get label() {
          return t('monitor:userGrantedAuthorization')
        },
        value: 'consent_granted',
      },
      {
        get label() {
          return t('monitor:userWithdrewAuthorization')
        },
        value: 'consent_revoked',
      },
    ],
  },
  {
    get label() {
      return t('monitor:credentialsAndSessions')
    },
    options: [
      {
        get label() {
          return t('monitor:accessTokenIssued')
        },
        value: 'token_issued',
      },
      {
        get label() {
          return t('monitor:accessTokenProcessingFailed')
        },
        value: 'token_failed',
      },
      {
        get label() {
          return t('monitor:refreshTokenRenewed')
        },
        value: 'refresh_rotated',
      },
      {
        get label() {
          return t('monitor:refreshTokenReuseDetected')
        },
        value: 'refresh_reuse_detected',
      },
      {
        get label() {
          return t('monitor:accessTokenRevoked')
        },
        value: 'token_revoked',
      },
      {
        get label() {
          return t('monitor:sessionEnded')
        },
        value: 'session_revoked',
      },
      {
        get label() {
          return t('monitor:userAuthorizationRevoked')
        },
        value: 'grant_revoked',
      },
      {
        get label() {
          return t('monitor:userAccessToAppBlocked')
        },
        value: 'client_access_blocked',
      },
      {
        get label() {
          return t('monitor:userAccessToAppAllowed')
        },
        value: 'client_access_allowed',
      },
      {
        get label() {
          return t('monitor:appSignOutNotificationDelivered')
        },
        value: 'backchannel_logout_succeeded',
      },
      {
        get label() {
          return t('monitor:appSignOutNotificationFailed')
        },
        value: 'backchannel_logout_failed',
      },
    ],
  },
  {
    get label() {
      return t('monitor:configurationAndSecurity')
    },
    options: [
      {
        get label() {
          return t('monitor:appRegistered')
        },
        value: 'client_created',
      },
      {
        get label() {
          return t('monitor:appDisabled')
        },
        value: 'client_disabled',
      },
      {
        get label() {
          return t('monitor:appSecretUpdated')
        },
        value: 'client_secret_rotated',
      },
      {
        get label() {
          return t('monitor:signingKeyRotated')
        },
        value: 'signing_key_rotated',
      },
      {
        get label() {
          return t('monitor:serviceAccessPolicyChanged')
        },
        value: 'resource_policy_changed',
      },
      {
        get label() {
          return t('monitor:permissionPolicyChanged')
        },
        value: 'scope_policy_changed',
      },
      {
        get label() {
          return t('monitor:authorizationCodeReuseDetected')
        },
        value: 'authorization_code_reused',
      },
      {
        get label() {
          return t('monitor:appAuthenticationFailed')
        },
        value: 'invalid_client',
      },
      {
        get label() {
          return t('monitor:userIdentityMissing')
        },
        value: 'identity_subject_missing',
      },
      {
        get label() {
          return t('monitor:accountSecurityVersionChanged')
        },
        value: 'security_version_changed',
      },
    ],
  },
]

const eventLabels = Object.fromEntries(
  eventGroups.flatMap((group) => group.options).map((item) => [item.value, item.label])
)

export function eventLabel(value) {
  return eventLabels[value] || value || t('monitor:unknownSecurityOperation')
}

export function eventSummary(row = {}) {
  const labels = {
    authorize_requested: t('monitor:anAppRequestedUserSignInOrPermissionAuthorization'),
    authorize_succeeded: t('monitor:identityVerificationAndAppAuthorizationCompleted'),
    authorize_denied: t('monitor:theSignInOrAuthorizationRequestWasNotContinued'),
    login_succeeded: t('monitor:theUserPassedAuthentication'),
    login_failed: t('monitor:theUserDidNotPassAuthentication'),
    consent_granted: t('monitor:theUserAllowedTheAppToAccessTheRequested'),
    consent_revoked: t('monitor:theUserWithdrewTheAppSOngoingAccess'),
    token_issued: t('monitor:theSystemIssuedANewShortLivedAccessToken'),
    token_failed: t('monitor:theSystemDidNotIssueAnAccessTokenTo'),
    refresh_rotated: t('monitor:theAppSRefreshTokenWasSecurelyRenewed'),
    refresh_reuse_detected: t('monitor:anOldRefreshTokenWasReusedAndMayHave'),
    token_revoked: t('monitor:anAccessTokenWasInvalidated'),
    session_revoked: t('monitor:anExternalSignInSessionWasForciblyEnded'),
    grant_revoked: t('monitor:aUserSAuthorizationForAnAppWasRevoked'),
    client_access_blocked: t('monitor:anAdministratorBlockedTheUserSAccessToThe'),
    client_access_allowed: t('monitor:anAdministratorUnblockedTheUserSAccessToThe'),
    backchannel_logout_succeeded: t('monitor:theSystemNotifiedRelatedAppsToEndTheirLocal'),
    backchannel_logout_failed: t('monitor:aRelatedAppDidNotReceiveTheSignOut'),
    client_created: t('monitor:aNewAppRegisteredWithTheAuthenticationService'),
    client_disabled: t('monitor:anAppWasBlockedFromUsingTheAuthenticationService'),
    client_secret_rotated: t('monitor:theSecretUsedToAuthenticateTheAppWasUpdated'),
    signing_key_rotated: t('monitor:theKeyUsedToSignIdentityCredentialsWasUpdated'),
    resource_policy_changed: t('monitor:aServiceSAllowedCredentialsOrUserInformationSettings'),
    scope_policy_changed: t('monitor:aPermissionSScopeOrUserConfirmationRequirementsChanged'),
    authorization_code_reused: t('monitor:aOneTimeAuthorizationCodeWasReusedIndicatingA'),
    invalid_client: t('monitor:theAppCouldNotAuthenticateItself'),
    identity_subject_missing: t('monitor:theUserLacksTheStableIdentityRequiredForAuthentication'),
    security_version_changed: t(
      'monitor:accountSecurityInformationChangedExistingSessionsWillGraduallyExpire'
    ),
  }
  return labels[row.eventType] || t('monitor:theSystemRecordedAnAuthenticationSecurityOperation')
}

export function eventTone(row = {}) {
  if (row.result === 'failure' || ['high', 'critical'].includes(row.riskLevel)) {
    return 'danger'
  }
  if (row.riskLevel === 'medium') {
    return 'warning'
  }
  return 'normal'
}

export function sourceText(row = {}) {
  if (row.userAgent) {
    return row.userAgent.length > 26 ? `${row.userAgent.slice(0, 26)}…` : row.userAgent
  }
  return row.ipAddress ? t('monitor:externalRequest') : t('monitor:administrativeAction')
}

export function failureText(code, result) {
  if (result !== 'failure' && !code) {
    return t('monitor:noActionRequired')
  }
  const labels = {
    invalid_request: t('monitor:theRequestIsIncompleteOrIncorrectlyFormatted'),
    invalid_client: t('monitor:appAuthenticationFailedCheckTheAppCredentials'),
    invalid_grant: t('monitor:theSignInOrAuthorizationCredentialsHaveExpired'),
    unauthorized_client: t('monitor:theAppIsNotAllowedToUseThisSign'),
    unsupported_grant_type: t('monitor:thisSignInMethodIsNotSupported'),
    invalid_scope: t('monitor:theAppRequestedAPermissionThatIsNotAvailable'),
    access_denied: t('monitor:theUserOrASecurityPolicyDeniedThisOperation'),
    login_required: t('monitor:theUserNeedsToSignInAgain'),
    consent_required: t('monitor:theUserMustConfirmTheAppSRequestedPermissions'),
    server_error: t('monitor:theAuthenticationServiceCannotCompleteTheRequestRightNow'),
    temporarily_unavailable: t('monitor:theAuthenticationServiceIsTemporarilyUnavailable'),
  }
  return (
    labels[code] ||
    (code
      ? t('monitor:operationIncompleteValue', { code })
      : t('monitor:theOperationDidNotCompleteNoSpecificReasonIs'))
  )
}

export function riskText(value) {
  return (
    {
      normal: t('common:general'),
      medium: t('monitor:needsAttention'),
      high: t('monitor:highRisk'),
      critical: t('common:critical'),
    }[value] || t('common:general')
  )
}

export function riskType(value) {
  return { normal: 'info', medium: 'warning', high: 'danger', critical: 'danger' }[value] || 'info'
}
