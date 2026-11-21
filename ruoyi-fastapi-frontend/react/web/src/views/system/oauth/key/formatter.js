import { t } from '../../../../i18n/index.js'
import { parseTime } from '@/utils/ruoyi'

export function statusText(value) {
  return (
    {
      pending: t('oauth:key.awaitingActivation'),
      active: t('oauth:key.signing'),
      retiring: t('oauth:key.verifyingOldCredentials'),
      retired: t('oauth:key.retired'),
      compromised: t('oauth:key.possiblyCompromised'),
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
      pending: t('oauth:key.publicKeyPublishedNotYetIssuingNewCredentials'),
      active: t('oauth:key.usedToIssueNewIdentityAndAccessCredentials'),
      retiring: t('oauth:key.noLongerIssuingNewCredentialsOnlyVerifyingUnexpiredOld'),
      retired: t('oauth:key.removedFromThePublicKeyList'),
      compromised: t('oauth:key.markedAsUntrustedCompleteEmergencyRotationAsSoonAs'),
    }[value] || t('oauth:key.unknownStatusInformation')
  )
}

export function publicFingerprint(jwk) {
  if (!jwk?.n) {
    return t('oauth:key.publicFingerprintUnavailable')
  }
  return t('oauth:key.publicFingerprintRsaValue', { arg0: jwk.n.slice(0, 18) })
}

export function nextActionText(row) {
  return (
    {
      pending: t('oauth:key.waitingToStart'),
      active: t('oauth:key.stopSigningWhenTheNextKeyTakesOver'),
      retiring: t('oauth:key.waitingForAllOldCredentialsToExpire'),
      retired: t('oauth:key.metadataCanBeRemoved'),
      compromised: t('oauth:key.scheduleEmergencyRotationNow'),
    }[row.status] || t('oauth:key.noPlan')
  )
}

export function nextActionTime(row) {
  if (row.status === 'pending') {
    return parseTime(row.signingStartAt) || t('oauth:key.manualActivationRequired')
  }
  if (['retiring', 'retired'].includes(row.status)) {
    return row.removeFromJwksAt
      ? t('oauth:key.earliestCleanupValue', { arg0: parseTime(row.removeFromJwksAt) })
      : t('oauth:key.waitingForTheSafeVerificationWindowToEnd')
  }
  if (row.status === 'active') {
    return t('oauth:key.noAutomaticStopTimeIsSet')
  }
  return t('oauth:key.checkTheSecurityLogs')
}

export function activationDisabledReason(row) {
  const publishAt = new Date(row.publishAt).getTime()
  if (!Number.isFinite(publishAt)) {
    return t('oauth:key.invalidPublicKeyPublicationTimeRefreshTheListAnd')
  }
  if (publishAt > Date.now()) {
    return t('oauth:key.thePublicKeyWillBePublishedAtValueIt', { arg0: parseTime(row.publishAt) })
  }
  return ''
}
