import { t } from '../../../../i18n/index.js'
import { parseTime } from '@/utils/ruoyi'

export function statusText(value) {
  return (
    {
      pending: t('system:awaitingActivation'),
      active: t('system:signing'),
      retiring: t('system:verifyingOldCredentials'),
      retired: t('system:retired'),
      compromised: t('system:possiblyCompromised'),
    }[value] || value
  )
}

export function statusType(value) {
  return (
    {
      pending: 'primary',
      active: 'success',
      retiring: 'warning',
      retired: 'info',
      compromised: 'danger',
    }[value] || 'info'
  )
}

export function roleText(value) {
  return (
    {
      pending: t('system:publicKeyPublishedNotYetIssuingNewCredentials'),
      active: t('system:usedToIssueNewIdentityAndAccessCredentials'),
      retiring: t('system:noLongerIssuingNewCredentialsOnlyVerifyingUnexpiredOld'),
      retired: t('system:removedFromThePublicKeyList'),
      compromised: t('system:markedAsUntrustedCompleteEmergencyRotationAsSoonAs'),
    }[value] || t('system:unknownStatusInformation')
  )
}

export function publicFingerprint(jwk) {
  if (!jwk?.n) {
    return t('system:publicFingerprintUnavailable')
  }
  return t('system:publicFingerprintRsaValue', { arg0: jwk.n.slice(0, 18) })
}

export function nextActionText(row) {
  return (
    {
      pending: t('system:waitingToStart'),
      active: t('system:stopSigningWhenTheNextKeyTakesOver'),
      retiring: t('system:waitingForAllOldCredentialsToExpire'),
      retired: t('system:metadataCanBeRemoved'),
      compromised: t('system:scheduleEmergencyRotationNow'),
    }[row.status] || t('system:noPlan')
  )
}

export function nextActionTime(row) {
  if (row.status === 'pending') {
    return parseTime(row.signingStartAt) || t('system:manualActivationRequired')
  }
  if (['retiring', 'retired'].includes(row.status)) {
    return row.removeFromJwksAt
      ? t('system:earliestCleanupValue', { arg0: parseTime(row.removeFromJwksAt) })
      : t('system:waitingForTheSafeVerificationWindowToEnd')
  }
  if (row.status === 'active') {
    return t('system:noAutomaticStopTimeIsSet')
  }
  return t('system:checkTheSecurityLogs')
}

export function activationDisabledReason(row) {
  const publishAt = new Date(row.publishAt).getTime()
  if (!Number.isFinite(publishAt)) {
    return t('system:invalidPublicKeyPublicationTimeRefreshTheListAnd')
  }
  if (publishAt > Date.now()) {
    return t('system:thePublicKeyWillBePublishedAtValueIt', { arg0: parseTime(row.publishAt) })
  }
  return ''
}
