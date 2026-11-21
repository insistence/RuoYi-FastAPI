import { useLocalizedText } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { ReloadOutlined } from '@ant-design/icons'
import './style.css'
import { Fragment, useEffect, useState } from 'react'
import { Alert, Button, Empty, Spin } from 'antd'
import { getPluginRuntimeMetrics } from '@/api/system/plugin'
import PluginTag from './PluginTag'

export default function PluginRuntimeMetrics({ pluginId }) {
  useI18n()

  const [data, setData] = useState(),
    [error, setError] = useLocalizedText(''),
    [loading, setLoading] = useState(false),
    [updatedAt, setUpdatedAt] = useState(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    setData(undefined)
    setUpdatedAt('')
    setError('')
    setLoading(false)
    if (!pluginId) return
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getPluginRuntimeMetrics(pluginId, controller.signal)
      .then((result) => {
        if (active) {
          setData(result.data)
          setUpdatedAt(new Date().toLocaleTimeString())
        }
      })
      .catch(
        () => active && setError((t) => t('pluginAdmin:metrics.couldNotLoadRuntimeMetricsTryAgain'))
      )
      .finally(() => active && setLoading(false))
    return () => {
      active = false
      controller.abort()
    }
  }, [pluginId, revision])
  const dropped = (data?.workers || []).reduce(
    (total, worker) => total + (worker.droppedSeries || 0),
    0
  )
  return (
    <section
      className="plugin-metrics"
      aria-label={t('pluginAdmin:metrics.pluginRuntimeMonitoring')}
      aria-busy={loading}
    >
      <div className="metrics-toolbar">
        <span role="status">
          {updatedAt
            ? t('pluginAdmin:queriedAtValue', { updatedAt })
            : t('pluginAdmin:queryCumulativeMetricsFromRunningProcesses')}
        </span>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {t('pluginAdmin:metrics.refreshMetrics')}
        </Button>
      </div>
      {error ? (
        <Alert
          type="error"
          title={error}
          showIcon
        />
      ) : (
        <Spin spinning={loading}>
          {data && (
            <>
              {data.supported !== false && (
                <>
                  <Alert
                    title={
                      data.scope === 'reporting_workers'
                        ? t('pluginAdmin:reportedProcessesValue', {
                            observedWorkers: data.observedWorkers,
                          })
                        : t('pluginAdmin:showingOnlyTheProcessHandlingThisRequest')
                    }
                    description={t(
                      'pluginAdmin:metrics.metricsAccumulateFromProcessStartupAndResetOnRestart'
                    )}
                    showIcon
                    type={data.scope === 'reporting_workers' ? 'info' : 'warning'}
                  />
                  <p className="metrics-hint">
                    {t('pluginAdmin:metrics.samplingInterval')} {data.sampleIntervalSeconds || '-'}{' '}
                    {t('pluginAdmin:metrics.secondsValidityPeriod')} {data.sampleTtlSeconds || '-'}{' '}
                    {t('pluginAdmin:metrics.secondsDurationCoversTheCompleteRequestOrTaskP95')}
                  </p>
                </>
              )}
              {data.workerLimitReached ||
              data.invalidSnapshots ||
              data.staleSnapshots ||
              dropped ? (
                <Alert
                  showIcon
                  type="warning"
                  title={t('pluginAdmin:metrics.someSamplesWereExcludedFromTheStatistics')}
                  description={t(
                    'pluginAdmin:invalidValueExpiredValueOverMetricCapacityValueProcess',
                    {
                      arg0: data.invalidSnapshots || 0,
                      arg1: data.staleSnapshots || 0,
                      dropped,
                      arg3: data.workerLimitReached
                        ? t('pluginAdmin:reached')
                        : t('pluginAdmin:notReached'),
                    }
                  )}
                />
              ) : null}
              {!data.series?.length && (
                <Empty
                  description={
                    data.supported === false
                      ? t('pluginAdmin:runtimeMonitoringIsDisabledForThisProcess')
                      : t('pluginAdmin:noRuntimeMetricsForThisPluginOnlyLoadedV2')
                  }
                />
              )}{' '}
              {(data.series || []).map((row) => (
                <article
                  className="metrics-record"
                  key={[row.version, row.digest, row.generation, row.operation].join(':')}
                >
                  <div className="metrics-record-title">
                    <strong>{row.operation}</strong>
                    <PluginTag
                      type="primary"
                      effect="plain"
                    >
                      {row.version}
                    </PluginTag>
                  </div>
                  <dl className="metrics-values">
                    {[
                      [t('pluginAdmin:metrics.calls'), row.started],
                      [t('pluginAdmin:metrics.inFlight'), row.active],
                      [t('common:success'), row.succeeded],
                      [t('pluginAdmin:metrics.rejected'), row.rejected],
                      [
                        t('pluginAdmin:metrics.failuresFailureRate'),
                        `${row.failed} / ${row.failureRatePercent}%`,
                      ],
                      [t('common:cancel'), row.cancelled],
                      [t('pluginAdmin:metrics.timeoutsIncludedInFailures'), row.timedOut],
                      [t('pluginAdmin:metrics.averageDuration'), `${row.averageDurationMs} ms`],
                      [
                        t('pluginAdmin:metrics.p95EstimatedUpperBound'),
                        `${row.p95UpperBoundMs} ms`,
                      ],
                      [
                        t('pluginAdmin:metrics.maximumDuration'),
                        `${Number(row.durationMaxMs).toFixed(1)} ms`,
                      ],
                    ].map(([title, value]) => (
                      <div key={title}>
                        <dt>{title}</dt>
                        <dd>{value ?? '-'}</dd>
                      </div>
                    ))}
                  </dl>
                  <details>
                    <summary>{t('pluginAdmin:metrics.versionIdentityAndRecentErrors')}</summary>
                    <dl className="metrics-identities">
                      {[
                        [
                          t('pluginAdmin:metrics.artifactDigest'),
                          row.digest || t('pluginAdmin:sourcePlugin'),
                        ],
                        [t('pluginAdmin:shared.releaseGeneration'), row.generation],
                        [t('pluginAdmin:metrics.latestError'), row.lastErrorType],
                        [t('pluginAdmin:metrics.traceId'), row.lastErrorRequestId],
                      ].map(([label, children]) => (
                        <Fragment key={label}>
                          <dt>{label}</dt>
                          <dd>{children || '-'}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </details>
                </article>
              ))}
            </>
          )}
        </Spin>
      )}
    </section>
  )
}
