import { t } from '../i18n/index.js'
const RELEASE_STATUSES = {
  active: {
    get label() {
      return t('common:active')
    },
    tagType: 'success',
  },
  disabled: {
    get label() {
      return t('common:disabled')
    },
    tagType: 'info',
  },
  partial: {
    get label() {
      return t('pluginAdmin:release.partiallyActive')
    },
    tagType: 'warning',
  },
  pending_restart: {
    get label() {
      return t('pluginAdmin:release.waitingForRestart')
    },
    tagType: 'warning',
  },
  failed: {
    get label() {
      return t('pluginAdmin:release.releaseError')
    },
    tagType: 'danger',
  },
  no_target: {
    get label() {
      return t('common:noTargetSelected')
    },
    tagType: 'info',
  },
}

const PREPARATION_LABELS = {
  get idle() {
    return t('pluginAdmin:release.notPrepared')
  },
  get preparing() {
    return t('pluginAdmin:release.preparing')
  },
  get prepared() {
    return t('pluginAdmin:release.prepared')
  },
  get failed() {
    return t('pluginAdmin:release.preparationFailed')
  },
}

function workerCount(value) {
  return Number.isInteger(value) && value >= 0 ? String(value) : t('common:unknown')
}

/**
 * 将插件发布状态转换为列表和详情共用的展示信息。
 *
 * @param {Object} plugin 后端返回的插件信息
 * @returns {Object} 发布状态标签、进程统计和异常信息
 */
export function getPluginReleaseView(plugin = {}) {
  const release = plugin.release || {}
  const status = RELEASE_STATUSES[release.status] || {
    label: t('pluginAdmin:release.unknownStatus'),
    tagType: 'info',
  }
  const error = release.verificationError || release.lastError || ''
  return {
    ...status,
    label: release.verificationError ? t('pluginAdmin:release.validationFailed') : status.label,
    tagType: release.verificationError ? 'danger' : status.tagType,
    preparationLabel: PREPARATION_LABELS[release.prepareStatus] || t('common:unknown'),
    workerSummary: t('pluginAdmin:release.valueValueOnlineValueExpectedValue', {
      arg0: plugin.enabled === '1' ? t('common:disabled') : t('pluginAdmin:release.ready'),
      arg1: workerCount(plugin.enabled === '1' ? release.disabledWorkers : release.healthyWorkers),
      arg2: workerCount(release.liveWorkers),
      arg3: workerCount(release.expectedWorkers),
    }),
    counts: {
      healthy: workerCount(release.healthyWorkers),
      disabled: workerCount(release.disabledWorkers),
      mismatch: workerCount(release.mismatchWorkers),
      stale: workerCount(release.staleWorkers),
      missing: workerCount(release.missingWorkers),
      failed: workerCount(release.failedWorkers),
    },
    error,
    restartRequired: release.restartRequired === true,
    unavailable: !plugin.release,
  }
}
