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
  return accessType === 'public'
    ? t('file:messages.publicFiles')
    : t('file:messages.protectedFiles')
}

export function statusLabel(status) {
  return (
    {
      active: t('layout:notices.active'),
      deleted: t('file:messages.deleted'),
      purging: t('file:messages.deleting'),
    }[status] || status
  )
}

export function expirationLabel(expireTime) {
  if (!expireTime) return t('file:messages.noExpiry')
  const remainingTime = new Date(expireTime).getTime() - Date.now()
  if (remainingTime <= 0) return t('common:expired')
  if (remainingTime <= 7 * 24 * 60 * 60 * 1000) return t('file:messages.expiringSoon')
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
      missing: t('file:messages.fileMissing'),
      quarantined: t('file:messages.quarantined'),
      invalid: t('common:exception'),
    }[storageStatus] || t('common:unknown')
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
      upload: t('common:upload'),
      download: t('common:download'),
      acl_update: t('file:messages.permissionChange'),
      transfer: t('file:messages.ownershipTransfer'),
      delete: t('file:messages.moveToRecycleBin'),
      restore: t('common:restore'),
      purge: t('file:messages.permanentlyDelete'),
      reconcile: t('file:messages.storageReconciliation'),
      retention_extend: t('file:messages.retentionExtension'),
      retention_dispose: t('file:messages.expiryDisposal'),
    }[action] || action
  )
}

export function resultLabel(result) {
  return (
    {
      allowed: t('file:messages.allowed'),
      denied: t('file:messages.denied'),
      completed: t('common:completed'),
      failed: t('common:failed'),
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
      value:
        typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value === undefined || value === null ? '-' : value),
    }))
  } catch {
    return [{ label: t('file:messages.operationDetails'), value: operationDetail }]
  }
}

function auditDetailKeyLabel(key) {
  return (
    {
      previousAclVersion: t('file:messages.previousPermissionsVersion'),
      newAclVersion: t('file:messages.newPermissionsVersion'),
      entryCount: t('file:messages.permissionCount'),
      allowCount: t('file:messages.allowCount'),
      denyCount: t('file:messages.denyCount'),
      subjectTypeCounts: t('file:messages.principalTypeStatistics'),
      previousOwnerUserId: t('file:messages.previousOwnerID'),
      previousDeptId: t('file:messages.previousDepartmentID'),
      newOwnerUserId: t('file:messages.newOwnerID'),
      newOwnerName: t('file:messages.newOwner'),
      newDeptId: t('file:messages.newDepartmentID'),
      reason: t('common:operationReason'),
      originalName: t('file:originalName'),
      accessType: t('file:accessType'),
      referenceCount: t('file:messages.businessReferenceCount'),
      previousStatus: t('file:messages.previousStatus'),
      newStatus: t('file:messages.newStatus'),
      truncated: t('file:messages.detailsTruncated'),
      preview: t('file:messages.detailsPreview'),
      issueId: t('file:messages.reconciliationIssueID'),
      issueType: t('file:messages.issueType'),
      action: t('file:messages.processingAction'),
      actualRoot: t('file:messages.actualStorageArea'),
      actualKey: t('file:messages.actualRelativePath'),
      expectedRoot: t('file:messages.expectedStorageArea'),
      expectedKey: t('file:messages.expectedRelativePath'),
      previousExpireTime: t('file:messages.previousExpiryTime'),
      newExpireTime: t('file:messages.newExpiryTime'),
      expireTime: t('file:messages.expiryTime'),
      range: t('file:messages.requestedRange'),
      rangeStart: t('file:messages.rangeStartByte'),
      rangeEnd: t('file:messages.rangeEndByte'),
      fileSize: t('file:messages.totalFileSize'),
      releasedReferenceCount: t('file:messages.removedReferenceCount'),
      releasedReferences: t('file:messages.removedReferenceDetails'),
    }[key] || key
  )
}
