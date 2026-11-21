import { t } from '@/i18n/adapter'
import { parseTime } from '@/utils/ruoyi'

export function formatFileSize(size) {
  const bytes = Number(size || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function accessTypeLabel(accessType) {
  return accessType === 'public' ? t('files:publicFiles') : t('files:protectedFiles')
}

export function statusLabel(status) {
  return (
    {
      active: t('layout:notices.active'),
      deleted: t('files:deleted'),
      purging: t('files:deleting'),
    }[status] || status
  )
}

export function expirationLabel(expireTime) {
  if (!expireTime) return t('files:noExpiry')
  const remainingTime = new Date(expireTime).getTime() - Date.now()
  if (remainingTime <= 0) return t('components:expired')
  if (remainingTime <= 7 * 24 * 60 * 60 * 1000) return t('files:expiringSoonLabelText')
  return parseTime(expireTime, '{y}-{m}-{d}')
}

export function expirationTagType(expireTime) {
  if (!expireTime) return 'info'
  const remainingTime = new Date(expireTime).getTime() - Date.now()
  if (remainingTime <= 0) return 'danger'
  return remainingTime <= 7 * 24 * 60 * 60 * 1000 ? 'warning' : 'success'
}

export function isAclExpiring(expireTime) {
  if (!expireTime) return false
  const remainingTime = new Date(expireTime).getTime() - Date.now()
  return remainingTime > 0 && remainingTime <= 7 * 24 * 60 * 60 * 1000
}

export function storageStatusLabel(storageStatus) {
  return (
    {
      normal: t('layout:notices.active'),
      missing: t('files:fileMissing'),
      quarantined: t('files:quarantined'),
      invalid: t('monitor:error'),
    }[storageStatus] || t('components:unknown')
  )
}

export function storageStatusTagType(storageStatus) {
  return (
    {
      normal: 'success',
      missing: 'danger',
      quarantined: 'warning',
      invalid: 'danger',
    }[storageStatus] || 'info'
  )
}

export function actionLabel(action) {
  return (
    {
      upload: t('components:uploadLabel'),
      download: t('components:download'),
      acl_update: t('files:permissionChange'),
      transfer: t('files:ownershipTransfer'),
      delete: t('files:moveToRecycleBin'),
      restore: t('components:restore'),
      purge: t('files:permanentlyDelete'),
      reconcile: t('files:storageReconciliation'),
      retention_extend: t('files:retentionExtension'),
      retention_dispose: t('files:expiryDisposal'),
    }[action] || action
  )
}

export function resultLabel(result) {
  return (
    {
      allowed: t('files:allowed'),
      denied: t('files:denied'),
      completed: t('monitor:completed'),
      failed: t('monitor:failed'),
    }[result] || result
  )
}

export function resultTagType(result) {
  return (
    {
      allowed: 'primary',
      denied: 'danger',
      completed: 'success',
      failed: 'danger',
    }[result] || 'info'
  )
}

export function parseOperationDetail(operationDetail) {
  if (!operationDetail) return []
  try {
    const detail = JSON.parse(operationDetail)
    return Object.entries(detail).map(([key, value]) => ({
      label: auditDetailKeyLabel(key),
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '-'),
    }))
  } catch {
    return [{ label: t('files:operationDetails'), value: operationDetail }]
  }
}

function auditDetailKeyLabel(key) {
  return (
    {
      previousAclVersion: t('files:previousPermissionsVersion'),
      newAclVersion: t('files:newPermissionsVersion'),
      entryCount: t('files:permissionCount'),
      allowCount: t('files:allowCount'),
      denyCount: t('files:denyCount'),
      subjectTypeCounts: t('files:principalTypeStatistics'),
      previousOwnerUserId: t('files:previousOwnerID'),
      previousDeptId: t('files:previousDepartmentID'),
      newOwnerUserId: t('files:newOwnerID'),
      newOwnerName: t('files:newOwner'),
      newDeptId: t('files:newDepartmentID'),
      reason: t('components:reason'),
      originalName: t('components:originalFileName'),
      accessType: t('components:accessType'),
      referenceCount: t('files:businessReferenceCount'),
      previousStatus: t('files:previousStatus'),
      newStatus: t('files:newStatus'),
      truncated: t('files:detailsTruncated'),
      preview: t('files:detailsPreview'),
      issueId: t('files:reconciliationIssueID'),
      issueType: t('files:issueType'),
      action: t('files:processingAction'),
      actualRoot: t('files:actualStorageArea'),
      actualKey: t('files:actualRelativePath'),
      expectedRoot: t('files:expectedStorageArea'),
      expectedKey: t('files:expectedRelativePath'),
      previousExpireTime: t('files:previousExpiryTime'),
      newExpireTime: t('files:newExpiryTime'),
      expireTime: t('files:expiryTime'),
      range: t('files:requestedRange'),
      rangeStart: t('files:rangeStartByte'),
      rangeEnd: t('files:rangeEndByte'),
      fileSize: t('files:totalFileSize'),
      releasedReferenceCount: t('files:removedReferenceCount'),
      releasedReferences: t('files:removedReferenceDetails'),
    }[key] || key
  )
}
