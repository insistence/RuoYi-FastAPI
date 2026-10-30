import { t } from '../../../../i18n/index.js'
import { parseTime } from '@/utils/ruoyi'

export function formatFileSize(size) {
  const bytes = Number(size || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function accessTypeLabel(accessType) {
  return accessType === 'public' ? t('system:publicFiles') : t('system:protectedFiles')
}

export function statusLabel(status) {
  return (
    {
      active: t('layout:notices.active'),
      deleted: t('system:deleted'),
      purging: t('system:deleting'),
    }[status] || status
  )
}

export function expirationLabel(expireTime) {
  if (!expireTime) return t('system:noExpiry')
  const remainingTime = new Date(expireTime).getTime() - Date.now()
  if (remainingTime <= 0) return t('common:expired')
  if (remainingTime <= 7 * 24 * 60 * 60 * 1000) return t('system:components.expiringSoonLabel')
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
      missing: t('system:fileMissing'),
      quarantined: t('system:quarantined'),
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
      acl_update: t('system:permissionChange'),
      transfer: t('system:ownershipTransfer'),
      delete: t('system:moveToRecycleBin'),
      restore: t('common:restore'),
      purge: t('system:permanentlyDelete'),
      reconcile: t('system:storageReconciliation'),
      retention_extend: t('system:retentionExtension'),
      retention_dispose: t('system:expiryDisposal'),
    }[action] || action
  )
}

export function resultLabel(result) {
  return (
    {
      allowed: t('system:allowed'),
      denied: t('system:denied'),
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
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '-'),
    }))
  } catch {
    return [{ label: t('system:operationDetails'), value: operationDetail }]
  }
}

function auditDetailKeyLabel(key) {
  return (
    {
      previousAclVersion: t('system:previousPermissionsVersion'),
      newAclVersion: t('system:newPermissionsVersion'),
      entryCount: t('system:permissionCount'),
      allowCount: t('system:allowCount'),
      denyCount: t('system:denyCount'),
      subjectTypeCounts: t('system:principalTypeStatistics'),
      previousOwnerUserId: t('system:previousOwnerId'),
      previousDeptId: t('system:previousDepartmentId'),
      newOwnerUserId: t('system:newOwnerId'),
      newOwnerName: t('system:newOwner'),
      newDeptId: t('system:newDepartmentId'),
      reason: t('common:operationReason'),
      originalName: t('file:originalName'),
      accessType: t('file:accessType'),
      referenceCount: t('system:businessReferenceCount'),
      previousStatus: t('system:previousStatus'),
      newStatus: t('system:newStatus'),
      truncated: t('system:detailsTruncated'),
      preview: t('system:detailsPreview'),
      issueId: t('system:reconciliationIssueId'),
      issueType: t('system:issueType'),
      action: t('system:processingAction'),
      actualRoot: t('system:actualStorageArea'),
      actualKey: t('system:actualRelativePath'),
      expectedRoot: t('system:expectedStorageArea'),
      expectedKey: t('system:expectedRelativePath'),
      previousExpireTime: t('system:previousExpiryTime'),
      newExpireTime: t('system:newExpiryTime'),
      expireTime: t('system:expiryTime'),
      range: t('system:requestedRange'),
      rangeStart: t('system:rangeStartByte'),
      rangeEnd: t('system:rangeEndByte'),
      fileSize: t('system:totalFileSize'),
      releasedReferenceCount: t('system:removedReferenceCount'),
      releasedReferences: t('system:removedReferenceDetails'),
    }[key] || key
  )
}
