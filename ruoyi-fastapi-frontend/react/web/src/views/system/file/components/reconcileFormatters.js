import { t } from '../../../../i18n/index.js'
import { formatFileSize } from './fileFormatters'
const issueTypeOptions = [
  {
    get label() {
      return t('file:reconcile.invalidMetadata')
    },
    value: 'invalid_metadata',
  },
  {
    get label() {
      return t('file:reconcile.physicalFileMissing')
    },
    value: 'missing_file',
  },
  {
    get label() {
      return t('file:reconcile.activeFileInRecycleBin')
    },
    value: 'unexpected_trash',
  },
  {
    get label() {
      return t('file:reconcile.recycledFileInActiveStorage')
    },
    value: 'unexpected_source',
  },
  {
    get label() {
      return t('file:reconcile.duplicatePhysicalFile')
    },
    value: 'duplicate_file',
  },
  {
    get label() {
      return t('file:reconcile.wrongStorageArea')
    },
    value: 'wrong_storage_root',
  },
  {
    get label() {
      return t('file:reconcile.fileSizeMismatch')
    },
    value: 'size_mismatch',
  },
  {
    get label() {
      return t('file:reconcile.fileDigestMismatch')
    },
    value: 'hash_mismatch',
  },
  {
    get label() {
      return t('file:reconcile.orphanedPhysicalFile')
    },
    value: 'orphan_file',
  },
  {
    get label() {
      return t('file:reconcile.unsafeDirectoryEntry')
    },
    value: 'unsafe_entry',
  },
]
const dangerousActions = ['delete_quarantine', 'accept_current', 'register_orphan']
const actionDescriptions = {
  get ignore() {
    return t('file:reconcile.keepThisIssueWithoutCountingItAsPendingIt')
  },
  get reopen() {
    return t('file:reconcile.returnAnIgnoredIssueToPendingStatus')
  },
  get restore_source() {
    return t('file:reconcile.restoreThePhysicalFileFromTheRecycleBinTo')
  },
  get move_to_trash() {
    return t('file:reconcile.moveTheRecycledFileFromActiveStorageToIts')
  },
  get move_to_expected_root() {
    return t('file:reconcile.moveThePhysicalFileToTheStorageAreaRegistered')
  },
  get quarantine_file() {
    return t('file:reconcile.moveTheAbnormalCopyOrOrphanedFileToQuarantine')
  },
  get restore_quarantine() {
    return t('file:reconcile.restoreTheQuarantinedFileToItsPreviousLocationAnd')
  },
  get delete_quarantine() {
    return t('file:reconcile.permanentlyDeleteTheQuarantinedFileThisCannotBeUndone')
  },
  get accept_current() {
    return t('file:reconcile.recalculateTheCurrentPhysicalFileSizeAndDigestAnd')
  },
  get register_orphan() {
    return t('file:reconcile.registerTheOrphanedPhysicalFileAsAnActiveFile')
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
      open: t('file:reconcile.pending'),
      ignored: t('file:reconcile.ignored'),
      quarantined: t('file:shared.quarantined'),
      resolved: t('file:reconcile.resolved'),
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
      running: t('file:reconcile.running'),
      completed: t('common:completed'),
      failed: t('common:failed'),
    }[status] || t('file:reconcile.notRunYet')
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
      ignore: t('file:reconcile.ignoreIssue'),
      reopen: t('file:reconcile.reopen'),
      restore_source: t('file:reconcile.restoreToActiveStorage'),
      move_to_trash: t('file:reconcile.moveToRecycledStorage'),
      move_to_expected_root: t('file:reconcile.moveToExpectedArea'),
      quarantine_file: t('file:reconcile.quarantineFile'),
      restore_quarantine: t('file:reconcile.restoreQuarantinedFile'),
      delete_quarantine: t('file:reconcile.permanentlyDeleteQuarantinedFile'),
      accept_current: t('file:reconcile.acceptCurrentFile'),
      register_orphan: t('file:reconcile.registerOrphanedFile'),
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
