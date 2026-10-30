import { t } from '../../../../i18n/index.js'
import { formatFileSize } from './fileFormatters'
const issueTypeOptions = [
  {
    get label() {
      return t('system:invalidMetadata')
    },
    value: 'invalid_metadata',
  },
  {
    get label() {
      return t('system:physicalFileMissing')
    },
    value: 'missing_file',
  },
  {
    get label() {
      return t('system:activeFileInRecycleBin')
    },
    value: 'unexpected_trash',
  },
  {
    get label() {
      return t('system:recycledFileInActiveStorage')
    },
    value: 'unexpected_source',
  },
  {
    get label() {
      return t('system:duplicatePhysicalFile')
    },
    value: 'duplicate_file',
  },
  {
    get label() {
      return t('system:wrongStorageArea')
    },
    value: 'wrong_storage_root',
  },
  {
    get label() {
      return t('system:fileSizeMismatch')
    },
    value: 'size_mismatch',
  },
  {
    get label() {
      return t('system:fileDigestMismatch')
    },
    value: 'hash_mismatch',
  },
  {
    get label() {
      return t('system:orphanedPhysicalFile')
    },
    value: 'orphan_file',
  },
  {
    get label() {
      return t('system:unsafeDirectoryEntry')
    },
    value: 'unsafe_entry',
  },
]
const dangerousActions = ['delete_quarantine', 'accept_current', 'register_orphan']
const actionDescriptions = {
  get ignore() {
    return t('system:keepThisIssueWithoutCountingItAsPendingIt')
  },
  get reopen() {
    return t('system:returnAnIgnoredIssueToPendingStatus')
  },
  get restore_source() {
    return t('system:restoreThePhysicalFileFromTheRecycleBinTo')
  },
  get move_to_trash() {
    return t('system:moveTheRecycledFileFromActiveStorageToIts')
  },
  get move_to_expected_root() {
    return t('system:moveThePhysicalFileToTheStorageAreaRegistered')
  },
  get quarantine_file() {
    return t('system:moveTheAbnormalCopyOrOrphanedFileToQuarantine')
  },
  get restore_quarantine() {
    return t('system:restoreTheQuarantinedFileToItsPreviousLocationAnd')
  },
  get delete_quarantine() {
    return t('system:permanentlyDeleteTheQuarantinedFileThisCannotBeUndone')
  },
  get accept_current() {
    return t('system:recalculateTheCurrentPhysicalFileSizeAndDigestAnd')
  },
  get register_orphan() {
    return t('system:registerTheOrphanedPhysicalFileAsAnActiveFile')
  },
}

function formatLocation(root, key) {
  return root && key ? `${root}:${key}` : '-'
}

function formatOptionalSize(size) {
  return size === null || size === undefined ? '-' : formatFileSize(size)
}

function issueTypeLabel(type) {
  return issueTypeOptions.find((item) => item.value === type)?.label || type
}

function severityLabel(severity) {
  return (
    { critical: t('common:critical'), warning: t('common:warning'), info: t('common:notice') }[
      severity
    ] || severity
  )
}

function severityTagType(severity) {
  return { critical: 'danger', warning: 'warning', info: 'info' }[severity] || 'info'
}

function issueStatusLabel(status) {
  return (
    {
      open: t('system:pending'),
      ignored: t('system:ignored'),
      quarantined: t('system:quarantined'),
      resolved: t('system:resolved'),
    }[status] || status
  )
}

function issueStatusType(status) {
  return (
    {
      open: 'danger',
      ignored: 'info',
      quarantined: 'warning',
      resolved: 'success',
    }[status] || 'info'
  )
}

function runStatusLabel(status) {
  return (
    {
      running: t('system:running'),
      completed: t('common:completed'),
      failed: t('common:failed'),
    }[status] || t('system:notRunYet')
  )
}

function runStatusType(status) {
  return (
    {
      running: 'warning',
      completed: 'success',
      failed: 'danger',
    }[status] || 'info'
  )
}

function actionLabel(action) {
  return (
    {
      ignore: t('system:ignoreIssue'),
      reopen: t('system:reopen'),
      restore_source: t('system:restoreToActiveStorage'),
      move_to_trash: t('system:moveToRecycledStorage'),
      move_to_expected_root: t('system:moveToExpectedArea'),
      quarantine_file: t('system:quarantineFile'),
      restore_quarantine: t('system:restoreQuarantinedFile'),
      delete_quarantine: t('system:permanentlyDeleteQuarantinedFile'),
      accept_current: t('system:acceptCurrentFile'),
      register_orphan: t('system:registerOrphanedFile'),
    }[action] || action
  )
}

export {
  issueTypeOptions,
  dangerousActions,
  actionDescriptions,
  formatLocation,
  formatOptionalSize,
  issueTypeLabel,
  severityLabel,
  severityTagType,
  issueStatusLabel,
  issueStatusType,
  runStatusLabel,
  runStatusType,
  actionLabel,
}
