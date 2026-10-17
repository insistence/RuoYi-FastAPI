import './style.css'
import { useEffect, useState } from 'react'
import { Alert, Button } from 'antd'
import { getPluginConfigStatus } from '@/api/system/plugin'

export default function PluginConfigStatus({ pluginId, refreshKey = 0 }) {
  const [data, setData] = useState(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
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
          setError('配置状态查询失败，已保存内容不受影响，可刷新重试。')
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
      ? `${data.pendingWorkers} 个已观测进程的启动配置待重启更新`
      : data?.state === 'observed_match'
        ? `${data.matchedWorkers} 个已观测进程的启动配置与保存版本匹配`
        : '尚未观测到运行中的启动配置版本，请确认插件已启用并完成启动'
  return (
    <section
      className="plugin-config-status"
      aria-label="配置生效状态"
      aria-busy={loading}
      style={{ marginBottom: 24 }}
    >
      <div className="config-status-toolbar">
        <strong>配置生效状态</strong>
        <Button
          className="ruoyi-table-action"
          type="link"
          loading={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          刷新状态
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
              ? '仅统计已上报进程'
              : data.scope === 'current_worker'
                ? '当前查询仅有本进程数据'
                : '当前尚无可用的进程数据'}
            。启动快照在重启后更新；插件主动读取最新配置时，由插件负责应用。
            {data.sampleIntervalSeconds ? `远程状态每 ${data.sampleIntervalSeconds} 秒上报。` : ''}
          </p>
          {data.unknownWorkers ||
          data.invalidSnapshots ||
          data.staleSnapshots ||
          data.workerLimitReached ? (
            <p>
              部分进程版本尚不能确认：{data.unknownWorkers || 0} 个未上报配置版本，
              {data.invalidSnapshots || 0} 个无效采样，
              {data.staleSnapshots || 0} 个过期采样。
              {data.workerLimitReached ? '本次查询已达到进程采样上限。' : ''}
            </p>
          ) : null}
          <details>
            <summary>查看配置版本与进程明细</summary>
            <p className="config-revision">已保存版本：{data.desiredRevision}</p>
            {data.workers?.length ? (
              <ul className="config-workers">
                {data.workers.map((worker) => (
                  <li key={worker.workerId}>
                    <p className="config-revision">
                      进程 {worker.workerId} · 插件 {worker.version}
                    </p>
                    <p>
                      {!worker.active
                        ? '尚未激活'
                        : worker.matchesDesired
                          ? '启动快照匹配'
                          : '启动快照待重启更新'}
                    </p>
                    <p className="config-revision">启动版本：{worker.startupRevision}</p>
                    {worker.lastReadRevision && (
                      <p className="config-revision">
                        最近按需读取：{worker.lastReadRevision}（不表示业务已应用）
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>尚未观测到支持配置版本上报的进程。</p>
            )}
          </details>
        </>
      ) : loading ? (
        <p role="status">正在查询配置版本…</p>
      ) : null}
    </section>
  )
}
