import { t } from '../../../i18n/index.js'
import {
  canInstall,
  canUpgrade,
  canUninstall,
  isOrphanPlugin,
  canExecuteActionResult,
  isOperationBlocked,
  isCapabilityOperationBlocked,
} from '@/utils/pluginCapabilities'
export {
  canInstall,
  canUpgrade,
  canUninstall,
  isOrphanPlugin,
  canExecuteActionResult,
  isOperationBlocked,
  isCapabilityOperationBlocked,
}
import { parseTime } from '@/utils/ruoyi'
import { getPlanOperationLabel, normalizePluginActionResult } from '@/utils/pluginPlanFormatter'
const INVALID_PLUGIN_TIME_VALUES = new Set(['', '-', '0', '0-0-0 0:0:0', '0000-00-00 00:00:00'])
export function formatPluginTime(value) {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'string' && INVALID_PLUGIN_TIME_VALUES.has(value.trim())) {
    return '-'
  }

  const formatted = parseTime(value)
  if (!formatted || INVALID_PLUGIN_TIME_VALUES.has(String(formatted).trim())) {
    return '-'
  }

  return formatted
}

export const pluginStatusOptions = [
  {
    get label() {
      return t('system:discovered')
    },
    value: 'discovered',
    tagType: 'info',
  },
  {
    get label() {
      return t('system:installed')
    },
    value: 'installed',
    tagType: 'success',
  },
  {
    get label() {
      return t('system:upgradeAvailable')
    },
    value: 'pending_upgrade',
    tagType: 'warning',
  },
  {
    get label() {
      return t('common:exception')
    },
    value: 'error',
    tagType: 'danger',
  },
]

export const operationLogStatusOptions = [
  {
    get label() {
      return t('common:success')
    },
    value: 'success',
    tagType: 'success',
  },
  {
    get label() {
      return t('common:failed')
    },
    value: 'failed',
    tagType: 'danger',
  },
  {
    get label() {
      return t('system:blocked')
    },
    value: 'blocked',
    tagType: 'warning',
  },
  {
    get label() {
      return t('system:dryRun')
    },
    value: 'dry_run',
    tagType: 'info',
  },
]

export function getStatusLabel(status) {
  const option = pluginStatusOptions.find((item) => item.value === status)
  return option ? option.label : status || '-'
}

export function getStatusTagType(status) {
  const option = pluginStatusOptions.find((item) => item.value === status)
  return option ? option.tagType : 'info'
}

export function getCapabilityReason(capability) {
  return (
    capability?.primaryReason ||
    capability?.warnings?.[0] ||
    t('system:thisEnvironmentDoesNotPermitThisPluginOperation')
  )
}

export function getDependencyPolicyReason(policy) {
  const messages = [
    ...(Array.isArray(policy?.reasons) ? policy.reasons : []),
    ...(Array.isArray(policy?.requirements) ? policy.requirements : []),
  ]
  return messages[0] || t('system:theCurrentDependencyPolicyDoesNotPermitInstallation')
}

export function getOperationTooltip(row, operation, label) {
  return isOperationBlocked(row, operation) ? getCapabilityReason(row.capability) : label
}

export function getDependencyTagType(row) {
  if (row.status === 'skipped') {
    return 'info'
  }
  return row.ok ? 'success' : 'danger'
}

export function formatDependencyInstalled(row) {
  if (row.status === 'skipped') {
    return t('system:notApplicable')
  }
  return row.installed ? t('common:yes') : t('common:no')
}

export function formatDependencyVersionSatisfied(row) {
  if (row.status === 'skipped') {
    return t('system:notApplicable')
  }
  return row.versionSatisfied ? t('common:yes') : t('common:no')
}

export function normalizeActionResult(result) {
  return normalizePluginActionResult(result)
}

export function buildErrorActionResult(error, context = {}) {
  const message = getErrorMessage(error)
  const payload = error?.response?.data?.data || {}
  const migrationRecovery = payload.migrationRecovery
  return {
    ok: false,
    pluginId: payload.pluginId || context.pluginId,
    operation: payload.operation || context.operation,
    dependencyOk: false,
    structureOk: undefined,
    menuConflictOk: undefined,
    failedStep: payload.failedStep,
    migrationRecovery,
    error: {
      message: payload.error || message,
      suggestion:
        migrationRecovery?.suggestion ||
        t('system:runPluginChecksAndResolveDirectoryDependencyMenuAnd'),
      raw: serializeError(error),
    },
    message,
  }
}

export function buildErrorBatchResult(error, operation, executablePluginIds = []) {
  const message = getErrorMessage(error)

  return {
    ok: false,
    operation,
    message,
    summary: {
      total: executablePluginIds.length,
      succeeded: 0,
      failed: 1,
      skipped: Math.max(executablePluginIds.length - 1, 0),
    },
    executed: [
      {
        pluginId: executablePluginIds[0] || '-',
        operation,
        ok: false,
        status: 'failed',
        message,
        suggestion: t('system:reviewAuditDetailsOrBackendLogsThenTryAgain'),
      },
    ],
  }
}

export function getErrorMessage(error) {
  if (!error) {
    return t('system:pluginOperationFailed')
  }
  if (typeof error === 'string') {
    return error
  }
  return (
    error.message || error.msg || error.response?.data?.msg || t('system:pluginOperationFailed')
  )
}

export function serializeError(error) {
  if (!error) {
    return {}
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  return {
    message: error.message,
    name: error.name,
    status: error.response?.status,
    data: error.response?.data,
  }
}

export function isUserCancel(error) {
  return error === 'cancel' || error === 'close' || error?.message === 'cancel'
}

export function formatBoolean(value) {
  if (value === undefined || value === null) {
    return '-'
  }
  return value ? t('system:passed') : t('common:exception')
}

export function formatPlanDependencies(dependencies) {
  return Array.isArray(dependencies) && dependencies.length ? dependencies.join(', ') : '-'
}

export function formatPluginIdsForDisplay(pluginIds) {
  const ids = Array.isArray(pluginIds) ? pluginIds.filter(Boolean) : []
  if (!ids.length) {
    return '-'
  }
  const visibleIds = ids.slice(0, 8).join(', ')
  return ids.length > 8
    ? t('pluginAdmin:summary.pluginList', { ids: visibleIds, count: ids.length })
    : visibleIds
}

export function formatConfigDefaultValue(item) {
  const value = item.default
  if (item.secret && value !== undefined && value !== null && value !== '') {
    return '******'
  }
  if (value === undefined || value === null || value === '') {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

export function formatConfigConstraint(item) {
  const constraints = []
  if (item.min !== undefined && item.min !== null) {
    constraints.push(t('pluginAdmin:constraint.minimum', { value: item.min }))
  }
  if (item.max !== undefined && item.max !== null) {
    constraints.push(t('pluginAdmin:constraint.maximum', { value: item.max }))
  }
  if (item.pattern) {
    constraints.push(t('pluginAdmin:constraint.pattern', { value: item.pattern }))
  }
  if (Array.isArray(item.options) && item.options.length) {
    constraints.push(
      t('pluginAdmin:constraint.options', {
        value: item.options.map(formatConfigOption).join(', '),
      })
    )
  }
  return constraints.length ? constraints.join('; ') : '-'
}

export function formatConfigOption(option) {
  if (!option || typeof option !== 'object') {
    return String(option)
  }
  const value = option.value === undefined || option.value === null ? '' : String(option.value)
  return option.label ? option.label + '(' + value + ')' : value
}

export function formatPluginOperation(operation, dictionary = []) {
  return getPlanOperationLabel(operation, dictionary)
}

export function getOperationLogStatusLabel(status) {
  const option = operationLogStatusOptions.find((item) => item.value === status)

  return option ? option.label : status || '-'
}

export function getOperationLogStatusTagType(status) {
  const option = operationLogStatusOptions.find((item) => item.value === status)

  return option ? option.tagType : 'info'
}

export function formatRetentionMessage(result) {
  const actionText = result.dryRun ? t('common:preview') : t('monitor:deletePermanently')
  const cutoffTime = formatPluginTime(result.cutoffTime)
  return t('pluginAdmin:summary.retention', {
    action: actionText,
    days: result.retentionDays,
    cutoff: cutoffTime,
    matched: result.matchedCount,
    deleted: result.deletedCount,
  })
}

export function formatActionPlanState(action) {
  if (action.ok === true) {
    return t('system:passed')
  }
  if (action.ok === false) {
    return t('common:exception')
  }
  if (action.hook) {
    return action.hook
  }
  if (action.targetEnabled !== undefined) {
    return action.targetEnabled ? t('system:targetEnabled') : t('system:targetDisabled')
  }
  if (action.targetStatus !== undefined) {
    return action.targetStatus === '0' ? t('system:targetHealthy') : t('system:targetDisabled')
  }
  return '-'
}

export function formatJson(value) {
  return JSON.stringify(value || {}, null, 2)
}
