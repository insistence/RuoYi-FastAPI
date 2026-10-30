import { t } from '../i18n/index.js'
export function normalizePluginPlanResponse(result) {
  const payload = result || {}
  const plan = payload.plan || {}
  const items = Array.isArray(plan.items) ? plan.items : []
  const blockers = Array.isArray(plan.blockers) ? plan.blockers : []
  const capabilityBlockers = Array.isArray(payload.capabilityBlockers)
    ? payload.capabilityBlockers
    : []
  const requestedPluginIds = Array.isArray(plan.requestedPluginIds) ? plan.requestedPluginIds : []
  const orderedPluginIds = Array.isArray(plan.orderedPluginIds) ? plan.orderedPluginIds : []
  const requestedPluginIdSet = new Set(requestedPluginIds)
  const executablePluginIds = requestedPluginIds.length
    ? orderedPluginIds.filter((pluginId) => requestedPluginIdSet.has(pluginId))
    : orderedPluginIds

  return {
    ok: Boolean(payload.ok),
    message: payload.message || '',
    operation: payload.operation || plan.operation || '',
    requestedPluginIds,
    orderedPluginIds,
    executablePluginIds,
    items,
    blockers,
    capabilityBlockers,
    blockerCount: Number.isInteger(plan.blockerCount)
      ? plan.blockerCount + capabilityBlockers.length
      : blockers.length + capabilityBlockers.length,
  }
}

export function normalizePluginBatchResponse(result) {
  const payload = result || {}
  const planResult = normalizePluginPlanResponse(payload)
  const summary = payload.summary || {}

  return {
    ...planResult,
    dryRun: Boolean(payload.dryRun),
    continueOnError: Boolean(payload.continueOnError),
    executed: Array.isArray(payload.executed) ? payload.executed : [],
    failed: payload.failed || null,
    summary: {
      total: Number.isInteger(summary.total) ? summary.total : 0,
      succeeded: Number.isInteger(summary.succeeded) ? summary.succeeded : 0,
      failed: Number.isInteger(summary.failed) ? summary.failed : 0,
      skipped: Number.isInteger(summary.skipped) ? summary.skipped : 0,
    },
  }
}

export function getPlanOperationLabel(operation, operationOptions = []) {
  if (!operation) {
    return '-'
  }

  const matched = operationOptions.find((item) => String(item.value) === String(operation))
  return matched?.label || operation
}

export function getPlanReadyTagType(ready) {
  return ready ? 'success' : 'danger'
}

export function getPlanBlockerStatusLabel(status) {
  const statusMap = {
    missing: t('common:missingDependencies'),
    not_installed: t('common:notInstalled'),
    disabled: t('common:notEnabled'),
    version_unsatisfied: t('common:versionRequirementNotMet'),
    source_version_unsatisfied: t('common:sourceVersionRequirementNotMet'),
    cycle: t('common:circularDependency'),
    unknown_operation: t('common:unknownOperation'),
  }

  return statusMap[status] || status || '-'
}

export function getValidationLevelLabel(level) {
  const levelMap = {
    error: t('common:error'),
    warning: t('common:warning'),
    info: t('common:notice'),
  }

  return levelMap[level] || level || '-'
}

export function getValidationLevelTagType(level) {
  const typeMap = {
    error: 'danger',
    warning: 'warning',
    info: 'info',
  }

  return typeMap[level] || 'info'
}

export function normalizePluginActionResult(result) {
  const normalized = result || {}
  const firstCheck = Array.isArray(normalized.checks) ? normalized.checks[0] : undefined
  if (!firstCheck) {
    return {
      ...normalized,
      manifestIssues: Array.isArray(normalized.manifestIssues) ? normalized.manifestIssues : [],
      manifestWarnings: Array.isArray(normalized.manifestWarnings)
        ? normalized.manifestWarnings
        : [],
    }
  }

  return {
    ...normalized,
    pluginId: normalized.pluginId || firstCheck.pluginId,
    dependencyOk: firstCheck.dependencies
      ? !firstCheck.missingDependencies?.length && !firstCheck.unsatisfiedDependencies?.length
      : undefined,
    structureOk: !firstCheck.structureErrors?.length,
    menuConflictOk: !firstCheck.menuConflicts?.length,
    dependencies: firstCheck.dependencies || [],
    manifestIssues: firstCheck.manifestIssues || [],
    manifestWarnings: firstCheck.manifestWarnings || [],
    structureErrors: firstCheck.structureErrors || [],
    menuConflicts: firstCheck.menuConflicts || [],
  }
}

export function normalizePluginOperationLogDetail(detail) {
  const payload = detail || {}
  const result = payload.result || {}
  const summary = payload.summary || result.summary || {}

  return {
    ...payload,
    result,
    summary,
    executed: Array.isArray(result.executed) ? result.executed : [],
    actionItems: Array.isArray(result.actions) ? result.actions : [],
    planItems: Array.isArray(result.plan?.items) ? result.plan.items : [],
    validationItems: buildOperationValidationItems(result),
    configChanges: buildOperationConfigChanges(result, summary),
    failedSuggestion: buildOperationFailedSuggestion(result),
  }
}

function buildOperationValidationItems(result) {
  const firstCheck = Array.isArray(result.checks) ? result.checks[0] : {}
  const validationGroups = [
    [t('pluginAdmin:dependencies'), result.dependencies || firstCheck.dependencies],
    [t('common:manifestError'), result.manifestIssues || firstCheck.manifestIssues],
    [t('common:manifestWarning'), result.manifestWarnings || firstCheck.manifestWarnings],
    [
      t('pluginAdmin:dependencyTitle'),
      result.pluginDependencyErrors || firstCheck.pluginDependencyErrors,
    ],
    [t('common:structure'), result.structureErrors || firstCheck.structureErrors],
    [t('pluginAdmin:menuConflict'), result.menuConflicts || firstCheck.menuConflicts],
  ]

  return validationGroups.flatMap(([category, items]) =>
    Array.isArray(items)
      ? items.map((item) => ({
          category,
          level: item.level || (category.includes(t('common:warning')) ? 'warning' : 'error'),
          kind: item.kind || item.name || item.status || '-',
          value: item.value || item.requirement || item.path || item.pluginId || item.perms || '-',
          message: item.message || item.suggestion || item.reason || '',
        }))
      : []
  )
}

function buildOperationConfigChanges(result, summary) {
  if (Array.isArray(summary.changes)) {
    return summary.changes
  }
  if (Array.isArray(result.summary?.changes)) {
    return result.summary.changes
  }
  const changedKeys = Array.isArray(summary.changedKeys) ? summary.changedKeys : []

  return changedKeys.map((key) => ({
    key,
    label: key,
    before: '-',
    after: '-',
    secret: false,
  }))
}

function buildOperationFailedSuggestion(result) {
  return (
    result.failed?.suggestion ||
    result.failed?.result?.message ||
    result.error?.suggestion ||
    result.suggestion ||
    ''
  )
}
