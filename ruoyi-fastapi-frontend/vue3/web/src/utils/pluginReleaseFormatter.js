import { translateMessage } from '../i18n/message.mjs'
const RELEASE_STATUSES = {
  active: {
    get label() {
      return translateMessage('plugins:active', '已生效')
    },
    tagType: 'success',
  },
  disabled: {
    get label() {
      return translateMessage('components:disabled', '已停用')
    },
    tagType: 'info',
  },
  partial: {
    get label() {
      return translateMessage('plugins:partiallyActive', '部分生效')
    },
    tagType: 'warning',
  },
  pending_restart: {
    get label() {
      return translateMessage('plugins:waitingForRestart', '等待重启')
    },
    tagType: 'warning',
  },
  failed: {
    get label() {
      return translateMessage('plugins:releaseError', '发布异常')
    },
    tagType: 'danger',
  },
  no_target: {
    get label() {
      return translateMessage('plugins:noTargetSelected', '未选择目标')
    },
    tagType: 'info',
  },
}

const PREPARATION_LABELS = {
  get idle() {
    return translateMessage('plugins:notPrepared', '尚未准备')
  },
  get preparing() {
    return translateMessage('plugins:preparing', '准备中')
  },
  get prepared() {
    return translateMessage('plugins:prepared', '准备完成')
  },
  get failed() {
    return translateMessage('plugins:preparationFailed', '准备失败')
  },
}

function workerCount(value) {
  return Number.isInteger(value) && value >= 0
    ? String(value)
    : translateMessage('components:unknown', '未知')
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
    get label() {
      return translateMessage('plugins:unknownStatus', '状态未知')
    },
    tagType: 'info',
  }
  const error = release.verificationError || release.lastError || ''
  return {
    ...status,
    label: release.verificationError
      ? translateMessage('plugins:validationFailed', '验证失败')
      : status.label,
    tagType: release.verificationError ? 'danger' : status.tagType,
    preparationLabel:
      PREPARATION_LABELS[release.prepareStatus] || translateMessage('components:unknown', '未知'),
    workerSummary: translateMessage(
      'plugins:release.workerSummary',
      `${plugin.enabled === '1' ? translateMessage('components:disabled', '已停用') : translateMessage('plugins:ready', '已就绪')} ${workerCount(
        plugin.enabled === '1' ? release.disabledWorkers : release.healthyWorkers
      )} · 在线 ${workerCount(release.liveWorkers)} / 预期 ${workerCount(release.expectedWorkers)}`,
      {
        status:
          plugin.enabled === '1'
            ? translateMessage('components:disabled', '已停用')
            : translateMessage('plugins:ready', '已就绪'),
        ready: workerCount(
          plugin.enabled === '1' ? release.disabledWorkers : release.healthyWorkers
        ),
        live: workerCount(release.liveWorkers),
        expected: workerCount(release.expectedWorkers),
      }
    ),
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
