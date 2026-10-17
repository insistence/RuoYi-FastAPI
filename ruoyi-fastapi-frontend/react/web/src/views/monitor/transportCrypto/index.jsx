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
  return (
    <Tag
      {...props}
      className={`crypto-tag crypto-tag--${color} crypto-tag--${effect}`}
    />
  )
}

const scopeLabels = {
  'redis-aggregated': 'Redis 聚合',
  'redis-aggregated+local-fallback': 'Redis 聚合 + 本地回退',
  'process-local-fallback': '本地回退',
}
const scopeDescriptions = {
  'redis-aggregated': '统计结果已聚合到 Redis，可覆盖多 worker / 多实例共享的监控口径。',
  'redis-aggregated+local-fallback':
    '当前以 Redis 聚合为主，部分监控写入曾降级到本地内存，建议检查 Redis 连接稳定性。',
  'process-local-fallback':
    '当前监控未写入 Redis，页面展示的是本进程本地统计，请优先检查 Redis 可用性。',
}
const rate = (value, total) => (total ? (Number(value || 0) / Number(total)) * 100 : 0)
const reasonColor = (value) =>
  ['decrypt_failed', 'aad_mismatch', 'replay_detected', 'kid_mismatch'].includes(value)
    ? 'error'
    : ['timestamp_expired', 'required_missing'].includes(value)
      ? 'warning'
      : 'default'
export default function TransportCrypto() {
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
    ? ['稳定', 'success', '当前暂无解密失败记录，链路运行稳定。']
    : successRate >= 95
      ? ['良好', 'success', '存在少量失败事件，建议继续观察失败原因分布。']
      : successRate >= 80
        ? ['关注', 'warning', '近期已有一定比例的异常请求，建议优先检查失败原因与最近失败记录。']
        : ['告警', 'error', '异常比例偏高，建议立即排查密钥版本、AAD 绑定、时间窗与重放校验。']
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
    ['encryptedRequests', '加密请求', '#409eff'],
    ['decryptSuccess', '解密成功', '#67c23a'],
    ['decryptFailure', '解密失败', '#f56c6c'],
    ['encryptedResponses', '加密响应', '#909399'],
  ]
  return (
    <div className="app-container transport-crypto-page">
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {[
            [
              '传输加密状态',
              { required: '强制加密', optional: '可选加密', off: '已关闭' }[
                data.transportCryptoMode
              ] || '未配置',
              `当前模式：${data.transportCryptoMode || '-'}`,
              data.transportCryptoEnabled ? '已启用' : '未启用',
              data.transportCryptoEnabled ? 'success' : 'default',
            ],
            [
              '请求总览',
              Number(data.requestsTotal || 0).toString(),
              `明文 ${Number(data.plainRequestsTotal || 0).toString()} / 加密 ${Number(data.encryptedRequestsTotal || 0).toString()}`,
              '命中规则',
              'processing',
            ],
            [
              '解密成功率',
              Number(data.decryptSuccessTotal || 0).toString(),
              `失败 ${Number(data.decryptFailureTotal || 0).toString()} / 强制拒绝 ${Number(data.requiredRejectedTotal || 0).toString()}`,
              `${successRate.toFixed(1)}%`,
              successRate >= 95 ? 'success' : successRate >= 80 ? 'warning' : 'error',
            ],
            [
              '响应加密',
              Number(data.encryptedResponsesTotal || 0).toString(),
              `明文 ${Number(data.plainResponsesTotal || 0).toString()} / 错误加密 ${Number(data.encryptedErrorResponsesTotal || 0).toString()}`,
              'JSON 响应',
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
              title="当前配置"
              extra={
                <Space size={12}>
                  <Switch
                    aria-label="自动刷新"
                    checked={autoRefresh}
                    onChange={setAutoRefresh}
                    checkedChildren="自动刷新"
                    unCheckedChildren="手动"
                  />
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    loading={loading}
                    onClick={load}
                  >
                    刷新
                  </Button>
                </Space>
              }
            >
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                items={[
                  ['统计范围', scopeLabels[data.monitorScope] || data.monitorScope || '-'],
                  ['应用环境', data.appEnv || '-'],
                  [
                    '当前密钥版本',
                    <CryptoTag color="processing">{data.currentKid || '-'}</CryptoTag>,
                  ],
                  ['监控起始时间', parseTime(data.startedAt) || '-'],
                  ['支持的密钥版本', tags(data.supportedKids)],
                  ['失败原因种类', reasons.length],
                  [
                    '聚合说明',
                    scopeDescriptions[data.monitorScope] || '当前展示传输加密运行状态与统计信息。',
                  ],
                  [
                    '启用路径',
                    data.enabledPaths?.length ? tags(data.enabledPaths, 'success') : '全部接口',
                  ],
                  ['强制加密路径', tags(data.requiredPaths, 'warning')],
                  ['排除路径', tags(data.excludePaths, 'default')],
                ].map(([label, children]) => ({
                  key: label,
                  label,
                  children,
                  span: ['聚合说明', '排除路径'].includes(label) ? 2 : 1,
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
              title="运行健康度"
              extra={<CryptoTag color={health[1]}>{health[0]}</CryptoTag>}
            >
              {[
                ['解密成功率', successRate],
                ['加密请求占比', requestRate],
                ['加密响应占比', responseRate],
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
              title="失败原因统计"
              extra={
                <Space>
                  <span className="crypto-card-subtitle">按 Redis 聚合口径统计</span>
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
                            ? `${item.reason}\n次数：${item.count}\n占比：${rate(item.count, reasonsTotal).toFixed(1)}%`
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
                          name: '失败次数',
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
                  description="暂无失败记录"
                />
              )}
              <div className="crypto-table-title">明细数据</div>
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
                    title: '失败原因',
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
                  { width: 100, align: 'center', title: '次数', dataIndex: 'count' },
                  {
                    width: 120,
                    align: 'center',
                    title: '占比',
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
              title="密钥版本统计"
              extra={
                <Space>
                  <span className="crypto-card-subtitle">观察不同 kid 的运行状态</span>
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
                  description="暂无密钥统计数据"
                />
              )}
              <div className="crypto-table-title">明细数据</div>
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
                    title: '密钥版本',
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
                    title: '成功率',
                    render: (_, row) =>
                      `${rate(row.decryptSuccess, Number(row.decryptSuccess || 0) + Number(row.decryptFailure || 0)).toFixed(1)}%`,
                  },
                ]}
              />
            </Card>
          </Col>
          <Col span={24}>
            <Card
              title="最近失败记录"
              extra={
                <Space>
                  <span className="crypto-card-subtitle">
                    最近{' '}
                    {
                      (data.recentFailures || []).filter(
                        (item) => (!reason || item.reason === reason) && (!kid || item.kid === kid)
                      ).length
                    }{' '}
                    条
                  </span>
                  {(reason || kid) && <CryptoTag>已按当前选择联动筛选</CryptoTag>}
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
                    title: '时间',
                    width: 170,
                    render: (_, row) => parseTime(row.time || row.timestamp) || '-',
                  },
                  {
                    align: 'center',
                    title: '请求方法',
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
                    title: '请求路径',
                    dataIndex: 'path',
                    width: 260,
                    ellipsis: true,
                    render: (value) => value || '-',
                  },
                  {
                    title: '失败原因',
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
                    title: '密钥版本',
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
