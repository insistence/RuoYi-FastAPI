import { useLocalizedText } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useState } from 'react'
import { previewJob } from '@/api/monitor/job'
import { formatBusinessTime } from '@/utils/time'

export default function CrontabResult({ expression, timeZone }) {
  useI18n()

  const [result, setResult] = useState({ nextRunTimes: [], timeZone }),
    [loading, setLoading] = useState(false),
    [error, setError] = useLocalizedText('')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setResult({ nextRunTimes: [], timeZone })
    const timer = setTimeout(async () => {
      try {
        const response = await previewJob(
          { cronExpression: expression, timeZone, count: 5 },
          controller.signal
        )
        if (!controller.signal.aborted) setResult(response.data)
      } catch (err) {
        if (!controller.signal.aborted)
          setError((t) => err.message || t('common:unableToRetrieveRunTimes'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [expression, timeZone])
  return (
    <section
      className="cron-result"
      aria-busy={loading}
    >
      <p>
        {t('common:next5Runs')}
        {result.timeZone}）
      </p>
      {error ? (
        <p
          role="alert"
          className="cron-preview-error"
        >
          {error}
        </p>
      ) : (
        <ul
          className="cron-result-list"
          aria-live="polite"
        >
          {loading ? (
            <li>{t('common:retrievingRunTimes')}</li>
          ) : !result.nextRunTimes.length ? (
            <li>{t('common:noFutureRuns')}</li>
          ) : (
            result.nextRunTimes.map((item) => (
              <li key={item}>
                {formatBusinessTime(item, 'YYYY-MM-DD HH:mm:ss Z', result.timeZone)}
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  )
}
