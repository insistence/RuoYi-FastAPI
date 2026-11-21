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
  return accessType === 'public' ? t('file:shared.publicFiles') : t('file:shared.protectedFiles')
}

export function statusLabel(status) {
  return (
    {
      active: t('layout:notices.active'),
      deleted: t('file:shared.deleted'),
      purging: t('file:shared.deleting'),
    }[status] || status
  )
}

export function expirationLabel(expireTime) {
  if (!expireTime) return t('file:shared.noExpiry')
  const remainingTime = new Date(expireTime).getTime() - Date.now()
  if (remainingTime <= 0) return t('common:expired')
  if (remainingTime <= 7 * 24 * 60 * 60 * 1000) return t('file:shared.expiringSoonLabel')
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
      missing: t('file:shared.fileMissing'),
      quarantined: t('file:shared.quarantined'),
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
      acl_update: t('file:shared.permissionChange'),
      transfer: t('file:shared.ownershipTransfer'),
      delete: t('file:shared.moveToRecycleBin'),
      restore: t('common:restore'),
      purge: t('file:shared.permanentlyDelete'),
      reconcile: t('file:shared.storageReconciliation'),
      retention_extend: t('file:shared.retentionExtension'),
      retention_dispose: t('file:shared.expiryDisposal'),
    }[action] || action
  )
}

export function resultLabel(result) {
  return (
    {
      allowed: t('file:shared.allowed'),
      denied: t('file:shared.denied'),
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
    return [{ label: t('file:shared.operationDetails'), value: operationDetail }]
  }
}

function auditDetailKeyLabel(key) {
  return (
    {
      previousAclVersion: t('file:shared.previousPermissionsVersion'),
      newAclVersion: t('file:shared.newPermissionsVersion'),
      entryCount: t('file:shared.permissionCount'),
      allowCount: t('file:shared.allowCount'),
      denyCount: t('file:shared.denyCount'),
      subjectTypeCounts: t('file:shared.principalTypeStatistics'),
      previousOwnerUserId: t('file:shared.previousOwnerId'),
      previousDeptId: t('file:shared.previousDepartmentId'),
      newOwnerUserId: t('file:shared.newOwnerId'),
      newOwnerName: t('file:shared.newOwner'),
      newDeptId: t('file:shared.newDepartmentId'),
      reason: t('common:operationReason'),
      originalName: t('file:originalName'),
      accessType: t('file:accessType'),
      referenceCount: t('file:shared.businessReferenceCount'),
      previousStatus: t('file:shared.previousStatus'),
      newStatus: t('file:shared.newStatus'),
      truncated: t('file:shared.detailsTruncated'),
      preview: t('file:shared.detailsPreview'),
      issueId: t('file:shared.reconciliationIssueId'),
      issueType: t('file:shared.issueType'),
      action: t('file:shared.processingAction'),
      actualRoot: t('file:shared.actualStorageArea'),
      actualKey: t('file:shared.actualRelativePath'),
      expectedRoot: t('file:shared.expectedStorageArea'),
      expectedKey: t('file:shared.expectedRelativePath'),
      previousExpireTime: t('file:shared.previousExpiryTime'),
      newExpireTime: t('file:shared.newExpiryTime'),
      expireTime: t('file:shared.expiryTime'),
      range: t('file:shared.requestedRange'),
      rangeStart: t('file:shared.rangeStartByte'),
      rangeEnd: t('file:shared.rangeEndByte'),
      fileSize: t('file:shared.totalFileSize'),
      releasedReferenceCount: t('file:shared.removedReferenceCount'),
      releasedReferences: t('file:shared.removedReferenceDetails'),
    }[key] || key
  )
}
