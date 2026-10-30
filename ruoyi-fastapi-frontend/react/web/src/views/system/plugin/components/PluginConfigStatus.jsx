import { useLocalizedText } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useState } from 'react'
import { Alert, Button } from 'antd'
import { getPluginConfigStatus } from '@/api/system/plugin'

export default function PluginConfigStatus({ pluginId, refreshKey = 0 }) {
  useI18n()

  const [data, setData] = useState(),
    [loading, setLoading] = useState(false),
    [error, setError] = useLocalizedText(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    setData(undefined)
    setError('')
    setLoading(false)
    if (!pluginId) return
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getPluginConfigStatus(pluginId, controller.signal)
      .then((result) => active && setData(result.data))
      .catch(() => {
        if (active) {
          setData(undefined)
          setError((t) => t('system:couldNotLoadConfigurationStatusSavedSettingsAreUnaffected'))
        }
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
      controller.abort()
    }
  }, [pluginId, refreshKey, revision])
  const statusText =
    data?.state === 'restart_required'
      ? t('system:startupConfigurationForValueObservedProcessesWillUpdateAfter', {
          pendingWorkers: data.pendingWorkers,
        })
      : data?.state === 'observed_match'
        ? t('system:startupConfigurationForValueObservedProcessesMatchesTheSaved', {
            matchedWorkers: data.matchedWorkers,
          })
        : t('system:noRunningStartupConfigurationHasBeenObservedCheckThat')
  return (
    <section
      className="plugin-config-status"
      aria-label={t('system:configurationActivationStatus')}
      aria-busy={loading}
      style={{ marginBottom: 24 }}
    >
      <div className="config-status-toolbar">
        <strong>{t('system:configurationActivationStatus')}</strong>
        <Button
          className="ruoyi-table-action"
          type="link"
          loading={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {t('system:refreshStatus')}
        </Button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : data ? (
        <>
          <Alert
            showIcon
            title={statusText}
            type={data.state === 'restart_required' ? 'warning' : 'info'}
          />
          <p>
            {data.scope === 'reporting_workers'
              ? t('pluginAdmin:includesOnlyReportingProcesses')
              : data.scope === 'current_worker'
                ? t('pluginAdmin:thisQueryIncludesOnlyTheCurrentProcess')
                : t('pluginAdmin:noProcessDataAvailable')}
            {t('system:startupSnapshotsUpdateAfterRestartPluginsAreResponsibleFor')}
            {data.sampleIntervalSeconds
              ? t('pluginAdmin:remoteStatusIsReportedEveryValueSeconds', {
                  sampleIntervalSeconds: data.sampleIntervalSeconds,
                })
              : ''}
          </p>
          {data.unknownWorkers ||
          data.invalidSnapshots ||
          data.staleSnapshots ||
          data.workerLimitReached ? (
            <p>
              {t('system:someProcessVersionsAreUnconfirmed')}
              {data.unknownWorkers || 0} {t('system:haveNotReportedAConfigurationVersion')}
              {data.invalidSnapshots || 0} {t('system:invalidSamples')}
              {data.staleSnapshots || 0} {t('system:expiredSamples')}
              {data.workerLimitReached ? t('system:thisQueryReachedTheProcessSamplingLimit') : ''}
            </p>
          ) : null}
          <details>
            <summary>{t('system:viewConfigurationVersionsAndProcessDetails')}</summary>
            <p className="config-revision">
              {t('system:savedVersion')}
              {data.desiredRevision}
            </p>
            {data.workers?.length ? (
              <ul className="config-workers">
                {data.workers.map((worker) => (
                  <li key={worker.workerId}>
                    <p className="config-revision">
                      {t('system:process')} {worker.workerId} {t('system:plugin')} {worker.version}
                    </p>
                    <p>
                      {!worker.active
                        ? t('system:notActivated')
                        : worker.matchesDesired
                          ? t('pluginAdmin:startupSnapshotMatches')
                          : t('pluginAdmin:startupSnapshotWillUpdateAfterRestart')}
                    </p>
                    <p className="config-revision">
                      {t('system:startupVersion')}
                      {worker.startupRevision}
                    </p>
                    {worker.lastReadRevision && (
                      <p className="config-revision">
                        {t('system:lastOnDemandRead')}
                        {worker.lastReadRevision}
                        {t('system:doesNotConfirmApplicationByTheBusinessLogic')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {t('system:noProcessesSupportingConfigurationVersionReportingHaveBeenObserved')}
              </p>
            )}
          </details>
        </>
      ) : loading ? (
        <p role="status">{t('system:loadingConfigurationVersions')}</p>
      ) : null}
    </section>
  )
}
