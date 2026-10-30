import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { ReloadOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Switch,
  Tag,
} from 'antd'
import Table from '@/components/Table'
import { getTransportCryptoMonitor } from '@/api/monitor/transportCrypto'
import { parseTime } from '@/utils/ruoyi'
import EChart from '@/components/EChart'
import './style.css'
function CryptoTag({ color = 'default', effect = 'light', ...props }) {
  useI18n()

  return (
    <Tag
      {...props}
      className={`crypto-tag crypto-tag--${color} crypto-tag--${effect}`}
    />
  )
}

const scopeLabels = {
  get 'redis-aggregated'() {
    return t('monitor:redisAggregation')
  },
  get 'redis-aggregated+local-fallback'() {
    return t('monitor:redisAggregationLocalFallback')
  },
  get 'process-local-fallback'() {
    return t('monitor:localFallback')
  },
}
const scopeDescriptions = {
  get 'redis-aggregated'() {
    return t('monitor:statisticsAreAggregatedInRedisAcrossWorkersAndInstances')
  },
  get 'redis-aggregated+local-fallback'() {
    return t('monitor:redisAggregationIsActiveButSomeWritesFellBack')
  },
  get 'process-local-fallback'() {
    return t('monitor:monitoringDataIsNotBeingWrittenToRedisThis')
  },
}
const rate = (value, total) => (total ? (Number(value || 0) / Number(total)) * 100 : 0)
const reasonColor = (value) =>
  ['decrypt_failed', 'aad_mismatch', 'replay_detected', 'kid_mismatch'].includes(value)
    ? 'error'
    : ['timestamp_expired', 'required_missing'].includes(value)
      ? 'warning'
      : 'default'
export default function TransportCrypto() {
  useI18n()

  const [data, setData] = useState({}),
    [loading, setLoading] = useState(false),
    [autoRefresh, setAutoRefresh] = useState(true),
    [reason, setReason] = useState(''),
    [kid, setKid] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData((await getTransportCryptoMonitor()).data || {})
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, 15000)
    return () => clearInterval(timer)
  }, [autoRefresh, load])
  const reasons = Object.entries(data.failureReasons || {})
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    reasonsTotal = reasons.reduce((sum, item) => sum + Number(item.count || 0), 0)
  const kids = [...(data.kidStats || [])].sort((a, b) =>
    a.kid === data.currentKid
      ? -1
      : b.kid === data.currentKid
        ? 1
        : Number(b.encryptedRequests || 0) +
          Number(b.decryptSuccess || 0) +
          Number(b.decryptFailure || 0) -
          Number(a.encryptedRequests || 0) -
          Number(a.decryptSuccess || 0) -
          Number(a.decryptFailure || 0)
  )
  const successRate = rate(
      data.decryptSuccessTotal,
      Number(data.decryptSuccessTotal || 0) + Number(data.decryptFailureTotal || 0)
    ),
    requestRate = rate(data.encryptedRequestsTotal, data.requestsTotal),
    responseRate = rate(
      data.encryptedResponsesTotal,
      Number(data.encryptedResponsesTotal || 0) + Number(data.plainResponsesTotal || 0)
    )
  const health = !data.decryptFailureTotal
    ? [
        t('monitor:stable'),
        'success',
        t('monitor:noDecryptionFailuresHaveBeenRecordedTheConnectionIs'),
      ]
    : successRate >= 95
      ? [
          t('authCenter:good'),
          'success',
          t('monitor:aFewFailuresHaveOccurredContinueMonitoringTheirCauses'),
        ]
      : successRate >= 80
        ? [
            t('monitor:attention'),
            'warning',
            t('monitor:recentRequestsIncludeFailuresReviewFailureCausesAndRecent'),
          ]
        : [t('monitor:alert'), 'error', t('monitor:theFailureRateIsHighCheckKeyVersionsAad')]
  const tags = (values, color = 'processing') =>
    values?.length ? (
      <Space
        wrap
        size={8}
      >
        {values.map((value) => (
          <CryptoTag
            color={color}
            effect="plain"
            key={value}
          >
            {value}
          </CryptoTag>
        ))}
      </Space>
    ) : (
      '-'
    )
  const selected = (setter) => (value) => setter((previous) => (previous === value ? '' : value))
  const chooseReason = selected(setReason),
    chooseKid = selected(setKid)
  const kidFields = [
    ['encryptedRequests', t('monitor:encryptedRequests'), '#409eff'],
    ['decryptSuccess', t('monitor:decryptionSucceeded'), '#67c23a'],
    ['decryptFailure', t('monitor:decryptionFailed'), '#f56c6c'],
    ['encryptedResponses', t('monitor:encryptedResponses'), '#909399'],
  ]
  return (
    <div className="app-container transport-crypto-page">
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {[
            [
              t('monitor:transportEncryptionStatus'),
              {
                required: t('monitor:encryptionRequired'),
                optional: t('monitor:optionalEncryption'),
                off: t('layout:notices.closed'),
              }[data.transportCryptoMode] || t('monitor:notConfigured'),
              t('monitor:currentModeValue', { arg0: data.transportCryptoMode || '-' }),
              data.transportCryptoEnabled ? t('monitor:enabled') : t('common:notEnabled'),
              data.transportCryptoEnabled ? 'success' : 'default',
            ],
            [
              t('monitor:requestOverview'),
              Number(data.requestsTotal || 0).toString(),
              t('monitor:plaintextValueEncryptedValue', {
                arg0: Number(data.plainRequestsTotal || 0).toString(),
                arg1: Number(data.encryptedRequestsTotal || 0).toString(),
              }),
              t('monitor:matchingRules'),
              'processing',
            ],
            [
              t('monitor:decryptionSuccessRate'),
              Number(data.decryptSuccessTotal || 0).toString(),
              t('monitor:failedValueEnforcedRejectionsValue', {
                arg0: Number(data.decryptFailureTotal || 0).toString(),
                arg1: Number(data.requiredRejectedTotal || 0).toString(),
              }),
              `${successRate.toFixed(1)}%`,
              successRate >= 95 ? 'success' : successRate >= 80 ? 'warning' : 'error',
            ],
            [
              t('monitor:responseEncryption'),
              Number(data.encryptedResponsesTotal || 0).toString(),
              t('monitor:plaintextValueEncryptedErrorsValue', {
                arg0: Number(data.plainResponsesTotal || 0).toString(),
                arg1: Number(data.encryptedErrorResponsesTotal || 0).toString(),
              }),
              t('monitor:jsonResponses'),
              'warning',
            ],
          ].map(([title, value, description, badge, color]) => (
            <Col
              xs={24}
              md={12}
              xl={6}
              key={title}
            >
              <Card className="crypto-summary">
                <div className="crypto-summary-header">
                  <span>{title}</span>
                  <CryptoTag color={color}>{badge}</CryptoTag>
                </div>
                <div className="crypto-summary-value">{value}</div>
                <div className="crypto-summary-description">{description}</div>
              </Card>
            </Col>
          ))}
          <Col
            xs={24}
            xl={16}
          >
            <Card
              title={t('monitor:currentConfiguration')}
              extra={
                <Space size={12}>
                  <Switch
                    aria-label={t('monitor:autoRefresh')}
                    checked={autoRefresh}
                    onChange={setAutoRefresh}
                    checkedChildren={t('monitor:autoRefresh')}
                    unCheckedChildren={t('monitor:manual')}
                  />
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    loading={loading}
                    onClick={load}
                  >
                    {t('layout:tags.refresh')}
                  </Button>
                </Space>
              }
            >
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                items={[
                  [
                    t('monitor:statisticsScope'),
                    scopeLabels[data.monitorScope] || data.monitorScope || '-',
                  ],
                  [t('monitor:appEnvironment'), data.appEnv || '-'],
                  [
                    t('monitor:currentKeyVersion'),
                    <CryptoTag color="processing">{data.currentKid || '-'}</CryptoTag>,
                  ],
                  [t('monitor:monitoringStartedAt'), parseTime(data.startedAt) || '-'],
                  [t('monitor:supportedKeyVersions'), tags(data.supportedKids)],
                  [t('monitor:failureCategories'), reasons.length],
                  [
                    t('monitor:aggregationInformation'),
                    scopeDescriptions[data.monitorScope] ||
                      t('monitor:transportEncryptionStatusAndStatistics'),
                  ],
                  [
                    t('monitor:enabledPaths'),
                    data.enabledPaths?.length
                      ? tags(data.enabledPaths, 'success')
                      : t('monitor:allApis'),
                  ],
                  [t('monitor:encryptionRequiredPaths'), tags(data.requiredPaths, 'warning')],
                  [t('monitor:excludedPaths'), tags(data.excludePaths, 'default')],
                ].map(([label, children]) => ({
                  key: label,
                  label,
                  children,
                  span: [t('monitor:aggregationInformation'), t('monitor:excludedPaths')].includes(
                    label
                  )
                    ? 2
                    : 1,
                }))}
              />
            </Card>
          </Col>
          <Col
            xs={24}
            xl={8}
          >
            <Card
              className="crypto-health"
              title={t('monitor:health')}
              extra={<CryptoTag color={health[1]}>{health[0]}</CryptoTag>}
            >
              {[
                [t('monitor:decryptionSuccessRate'), successRate],
                [t('monitor:encryptedRequestShare'), requestRate],
                [t('monitor:encryptedResponseShare'), responseRate],
              ].map(([label, value], i) => (
                <div
                  className="crypto-health-item"
                  key={label}
                >
                  <div className="crypto-health-label">
                    <span>{label}</span>
                    <span>{value.toFixed(1)}%</span>
                  </div>
                  <Progress
                    strokeColor={
                      i === 0 && successRate >= 80 && successRate < 95 ? '#e6a23c' : undefined
                    }
                    percent={Number(value.toFixed(1))}
                    size="small"
                    status={
                      i === 0
                        ? successRate >= 95
                          ? 'success'
                          : successRate >= 80
                            ? 'normal'
                            : 'exception'
                        : i === 1
                          ? 'success'
                          : 'normal'
                    }
                  />
                </div>
              ))}
              <Alert
                title={health[2]}
                type={health[1]}
                showIcon
              />
            </Card>
          </Col>
          <Col
            xs={24}
            xl={10}
          >
            <Card
              title={t('monitor:failureCauses')}
              extra={
                <Space>
                  <span className="crypto-card-subtitle">
                    {t('monitor:statisticsAggregatedInRedis')}
                  </span>
                  {reason && (
                    <CryptoTag
                      closable
                      color="error"
                      onClose={() => setReason('')}
                    >
                      {reason}
                    </CryptoTag>
                  )}
                </Space>
              }
            >
              {reasons.length ? (
                <div className="crypto-chart">
                  <EChart
                    height="100%"
                    onClick={(event) => chooseReason(reasons[event.dataIndex]?.reason)}
                    option={{
                      animationDuration: 400,
                      tooltip: {
                        trigger: 'axis',
                        axisPointer: { type: 'shadow' },
                        renderMode: 'richText',
                        formatter: (params) => {
                          const item = reasons[params[0]?.dataIndex]
                          return item
                            ? t('monitor:valueCountValuePercentageValue', {
                                reason: item.reason,
                                count: item.count,
                                arg2: rate(item.count, reasonsTotal).toFixed(1),
                              })
                            : ''
                        },
                      },
                      grid: { left: 120, right: 24, bottom: 16, top: 16, containLabel: true },
                      xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
                      yAxis: {
                        type: 'category',
                        axisTick: { show: false },
                        data: reasons.map((item) => item.reason),
                      },
                      series: [
                        {
                          type: 'bar',
                          name: t('monitor:failureCount'),
                          barMaxWidth: 22,
                          label: { show: true, position: 'right' },
                          data: reasons.map((item) => ({
                            value: Number(item.count),
                            itemStyle: {
                              borderRadius: [0, 6, 6, 0],
                              color:
                                reasonColor(item.reason) === 'error'
                                  ? '#f56c6c'
                                  : reasonColor(item.reason) === 'warning'
                                    ? '#e6a23c'
                                    : '#409eff',
                              opacity: !reason || reason === item.reason ? 1 : 0.35,
                            },
                          })),
                        },
                      ],
                    }}
                  />
                </div>
              ) : (
                <Empty
                  styles={{ image: { height: 88 } }}
                  description={t('monitor:noFailuresRecorded')}
                />
              )}
              <div className="crypto-table-title">{t('monitor:detailedData')}</div>
              <Table
                scroll={{ x: 400, y: 260 }}
                rowKey="reason"
                rowClassName={(row) => (row.reason === reason ? 'ant-table-row-selected' : '')}
                size="small"
                pagination={false}
                dataSource={reasons.filter((item) => !reason || reason === item.reason)}
                onRow={(row) => ({ onClick: () => chooseReason(row.reason) })}
                columns={[
                  {
                    title: t('common:failureReason'),
                    dataIndex: 'reason',
                    width: 180,
                    render: (value) => (
                      <CryptoTag
                        color={reasonColor(value)}
                        effect="plain"
                      >
                        {value || '-'}
                      </CryptoTag>
                    ),
                  },
                  { width: 100, align: 'center', title: t('monitor:count'), dataIndex: 'count' },
                  {
                    width: 120,
                    align: 'center',
                    title: t('monitor:share'),
                    render: (_, row) => `${rate(row.count, reasonsTotal).toFixed(1)}%`,
                  },
                ]}
              />
            </Card>
          </Col>
          <Col
            xs={24}
            xl={14}
          >
            <Card
              title={t('monitor:keyVersionStatistics')}
              extra={
                <Space>
                  <span className="crypto-card-subtitle">{t('monitor:monitorEachKeyIdKid')}</span>
                  {kid && (
                    <CryptoTag
                      closable
                      color="success"
                      onClose={() => setKid('')}
                    >
                      {kid}
                    </CryptoTag>
                  )}
                </Space>
              }
            >
              {kids.length ? (
                <div className="crypto-chart">
                  <EChart
                    height="100%"
                    onClick={(event) => chooseKid(kids[event.dataIndex]?.kid)}
                    option={{
                      animationDuration: 400,
                      color: kidFields.map(([, , color]) => color),
                      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                      legend: { top: 0 },
                      grid: { left: 24, right: 24, top: 48, bottom: 32, containLabel: true },
                      xAxis: {
                        type: 'category',
                        data: kids.map((item) => item.kid || '-'),
                        axisLabel: { interval: 0, rotate: kids.length > 4 ? 20 : 0 },
                      },
                      yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
                      series: kidFields.map(([key, name, color]) => ({
                        name,
                        type: 'bar',
                        barMaxWidth: 18,
                        data: kids.map((item) => ({
                          value: Number(item[key] || 0),
                          itemStyle: {
                            color,
                            opacity: !kid || kid === item.kid ? 1 : 0.35,
                          },
                        })),
                      })),
                    }}
                  />
                </div>
              ) : (
                <Empty
                  styles={{ image: { height: 88 } }}
                  description={t('monitor:noKeyStatisticsAvailable')}
                />
              )}
              <div className="crypto-table-title">{t('monitor:detailedData')}</div>
              <Table
                rowKey="kid"
                rowClassName={(row) => (row.kid === kid ? 'ant-table-row-selected' : '')}
                size="small"
                pagination={false}
                scroll={{ x: 700, y: 260 }}
                dataSource={kids.filter((item) => !kid || kid === item.kid)}
                onRow={(row) => ({ onClick: () => chooseKid(row.kid) })}
                columns={[
                  {
                    title: t('monitor:keyVersion'),
                    dataIndex: 'kid',
                    width: 140,
                    render: (value) => (
                      <CryptoTag color={value === data.currentKid ? 'success' : 'default'}>
                        {value}
                      </CryptoTag>
                    ),
                  },
                  ...kidFields.map(([dataIndex, title]) => ({
                    align: 'center',
                    width: 110,
                    dataIndex,
                    title,
                  })),
                  {
                    width: 120,
                    align: 'center',
                    title: t('monitor:successRate'),
                    render: (_, row) =>
                      `${rate(row.decryptSuccess, Number(row.decryptSuccess || 0) + Number(row.decryptFailure || 0)).toFixed(1)}%`,
                  },
                ]}
              />
            </Card>
          </Col>
          <Col span={24}>
            <Card
              title={t('monitor:recentFailures')}
              extra={
                <Space>
                  <span className="crypto-card-subtitle">
                    {t('monitor:recent')}{' '}
                    {
                      (data.recentFailures || []).filter(
                        (item) => (!reason || item.reason === reason) && (!kid || item.kid === kid)
                      ).length
                    }{' '}
                    {t('common:records')}
                  </span>
                  {(reason || kid) && (
                    <CryptoTag>{t('monitor:filteredByTheCurrentSelection')}</CryptoTag>
                  )}
                </Space>
              }
            >
              <Table
                rowKey="_rowKey"
                dataSource={(data.recentFailures || [])
                  .map((item, index) => ({ ...item, _rowKey: index }))
                  .filter(
                    (item) => (!reason || item.reason === reason) && (!kid || item.kid === kid)
                  )}
                pagination={false}
                scroll={{ x: 850 }}
                columns={[
                  {
                    title: t('monitor:time'),
                    width: 170,
                    render: (_, row) => parseTime(row.time || row.timestamp) || '-',
                  },
                  {
                    align: 'center',
                    title: t('monitor:requestMethod'),
                    dataIndex: 'method',
                    width: 100,
                    render: (value) => (
                      <CryptoTag
                        color="processing"
                        effect="plain"
                      >
                        {value || '-'}
                      </CryptoTag>
                    ),
                  },
                  {
                    title: t('monitor:requestPath'),
                    dataIndex: 'path',
                    width: 260,
                    ellipsis: true,
                    render: (value) => value || '-',
                  },
                  {
                    title: t('common:failureReason'),
                    dataIndex: 'reason',
                    width: 180,
                    render: (value) => (
                      <CryptoTag
                        color={reasonColor(value)}
                        effect="plain"
                      >
                        {value || '-'}
                      </CryptoTag>
                    ),
                  },
                  {
                    title: t('monitor:keyVersion'),
                    dataIndex: 'kid',
                    width: 140,
                    render: (value) => value || '-',
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
