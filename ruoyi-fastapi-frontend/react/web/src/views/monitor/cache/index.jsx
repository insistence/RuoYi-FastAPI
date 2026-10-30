import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useState } from 'react'
import { Col, Row, Spin } from 'antd'
import { DesktopOutlined, PieChartOutlined, DashboardOutlined } from '@ant-design/icons'
import { getCache } from '@/api/monitor/cache'
import EChart from '@/components/EChart'
import MonitorPanel, { MetricTable } from '@/components/MonitorPanel'

export default function Cache() {
  useI18n()

  const [cache, setCache] = useState({}),
    [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getCache()
      .then((result) => {
        if (active) setCache(result.data || {})
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  const info = cache.info || {}
  const rows = [
    [
      t('monitor:redisVersion'),
      info.redis_version,
      t('monitor:runMode'),
      info.redis_mode === 'standalone' ? t('monitor:standalone') : t('monitor:cluster'),
      t('monitor:port'),
      info.tcp_port,
      t('monitor:clients'),
      info.connected_clients,
    ],
    [
      t('monitor:uptimeDays'),
      info.uptime_in_days,
      t('monitor:usedMemory'),
      info.used_memory_human,
      t('monitor:cpuUsage'),
      Number(info.used_cpu_user_children || 0).toFixed(2),
      t('monitor:memoryConfiguration'),
      info.maxmemory_human,
    ],
    [
      t('monitor:aofEnabled'),
      String(info.aof_enabled) === '0' ? t('common:no') : t('common:yes'),
      t('monitor:rdbSuccessful'),
      info.rdb_last_bgsave_status,
      t('monitor:keyCount'),
      cache.dbSize,
      t('monitor:networkInOut'),
      `${info.instantaneous_input_kbps || 0}kps/${info.instantaneous_output_kbps || 0}kps`,
    ],
  ]
  return (
    <div className="app-container monitor-page">
      <Spin spinning={loading}>
        <Row gutter={[10, 10]}>
          <Col span={24}>
            <MonitorPanel
              title={t('common:basicInfo')}
              icon={<DesktopOutlined />}
            >
              <MetricTable rows={rows} />
            </MonitorPanel>
          </Col>
          <Col
            xs={24}
            md={12}
          >
            <MonitorPanel
              title={t('monitor:commandStatistics')}
              icon={<PieChartOutlined />}
            >
              <EChart
                height={420}
                option={{
                  tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c} ({d}%)' },
                  series: [
                    {
                      name: t('system:command'),
                      type: 'pie',
                      roseType: 'radius',
                      radius: [15, 95],
                      center: ['50%', '38%'],
                      data: cache.commandStats || [],
                      animationEasing: 'cubicInOut',
                      animationDuration: 1000,
                    },
                  ],
                }}
              />
            </MonitorPanel>
          </Col>
          <Col
            xs={24}
            md={12}
          >
            <MonitorPanel
              title={t('monitor:memoryInformation')}
              icon={<DashboardOutlined />}
            >
              <EChart
                height={420}
                option={{
                  tooltip: { formatter: `{b} <br/>{a} : ${info.used_memory_human || '-'}` },
                  series: [
                    {
                      name: t('monitor:peak'),
                      type: 'gauge',
                      min: 0,
                      max: 1000,
                      detail: { formatter: info.used_memory_human || '-' },
                      data: [
                        {
                          value: parseFloat(info.used_memory_human) || 0,
                          name: t('monitor:memoryUsage'),
                        },
                      ],
                    },
                  ],
                }}
              />
            </MonitorPanel>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
