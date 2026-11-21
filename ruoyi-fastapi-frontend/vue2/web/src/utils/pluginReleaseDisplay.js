import { t } from '@/i18n/adapter'
import { getPluginReleaseView as getOriginalView } from './pluginReleaseFormatter'

const releaseLabels = {
  active: () => t('pluginAdmin:release.active'),
  disabled: () => t('pluginAdmin:release.disabled'),
  partial: () => t('pluginAdmin:release.partial'),
  pending_restart: () => t('pluginAdmin:release.pending_restart'),
  failed: () => t('pluginAdmin:release.failed'),
  no_target: () => t('pluginAdmin:release.no_target'),
  unknown: () => t('pluginAdmin:release.unknown'),
  verificationFailed: () => t('pluginAdmin:release.verificationFailed'),
}
const preparationLabels = {
  idle: () => t('pluginAdmin:preparation.idle'),
  preparing: () => t('pluginAdmin:preparation.preparing'),
  prepared: () => t('pluginAdmin:preparation.prepared'),
  failed: () => t('pluginAdmin:preparation.failed'),
  unknown: () => t('pluginAdmin:preparation.unknown'),
}

export function getPluginReleaseView(plugin = {}) {
  const view = getOriginalView(plugin)
  const release = plugin.release || {}
  const count = (value) =>
    Number.isInteger(value) && value >= 0 ? String(value) : t('common:unknown')
  const counts = Object.fromEntries(
    ['healthy', 'disabled', 'mismatch', 'stale', 'missing', 'failed'].map((key) => [
      key,
      count(release[key + 'Workers']),
    ])
  )
  return {
    ...view,
    label: release.verificationError
      ? releaseLabels.verificationFailed()
      : (releaseLabels[release.status] || releaseLabels.unknown)(),
    preparationLabel: (preparationLabels[release.prepareStatus] || preparationLabels.unknown)(),
    counts,
    workerSummary: t('pluginAdmin:release.workerSummary', {
      status: plugin.enabled === '1' ? releaseLabels.disabled() : t('pluginAdmin:release.ready'),
      count: count(plugin.enabled === '1' ? release.disabledWorkers : release.healthyWorkers),
      live: count(release.liveWorkers),
      expected: count(release.expectedWorkers),
    }),
  }
}
