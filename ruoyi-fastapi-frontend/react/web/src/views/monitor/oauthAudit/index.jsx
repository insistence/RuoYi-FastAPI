import OAuthTag from '@/components/OAuthWorkspace/OAuthTag'
import { SearchOutlined, ReloadOutlined, DownloadOutlined, KeyOutlined } from '@ant-design/icons'
import { TableAction } from '@/components/TableActions'
import '@/components/OAuthWorkspace/entities.css'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { Button, Collapse, Descriptions, Drawer, Empty, Form, Input, Select, Space } from 'antd'
import Table from '@/components/Table'
import { listOAuthAudit } from '@/api/monitor/oauthAudit'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { serializeTimeFieldsForSubmit } from '@/utils/time'
import PageFrame from '@/components/OAuthWorkspace/PageFrame'
import { BusinessDateTimeRangePicker } from '@/components/BusinessDateTimePicker'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import HasPermi from '@/directive/permission/hasPermi'
import {
  eventGroups,
  eventLabel,
  eventSummary,
  sourceText,
  failureText,
  riskText,
  riskType,
  eventTone,
} from './formatter'
import './style.css'

function EventMark({ row, large = false }) {
  return (
    <span
      className={`event-mark is-${eventTone(row)}${large ? ' large' : ''}`}
      aria-hidden="true"
    >
      <KeyOutlined />
    </span>
  )
}
export default function OAuthAudit() {
  const [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [detail, setDetail] = useState(null)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOAuthAudit(query)
      setRows(result.rows || [])
      setTotal(result.total || 0)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  async function filterParams(values = form.getFieldsValue(true)) {
    const { dateRange, ...fields } = values
    return serializeTimeFieldsForSubmit(
      { ...fields, startTime: dateRange?.[0], endTime: dateRange?.[1] },
      ['startTime', 'endTime']
    )
  }
  async function search(values) {
    const params = await filterParams(values)
    if (params) setQuery({ ...params, pageNum: 1, pageSize: query.pageSize })
  }
  async function refresh(pagination = {}) {
    const params = await filterParams()
    if (params) setQuery((current) => ({ ...current, ...params, ...pagination }))
  }
  async function exportRows() {
    const params = await filterParams()
    if (!params) return
    await download(
      '/monitor/oauth/audit/export',
      { ...query, ...params },
      `oauth_audit_${Date.now()}.xlsx`
    ).catch(() => {})
  }
  const columns = [
    {
      title: '发生时间',
      width: 170,
      render: (_, row) => parseTime(row.occurredAt || row.createTime),
    },
    {
      title: '发生的操作',
      width: 230,
      render: (_, row) => (
        <div className="event-cell">
          <EventMark row={row} />
          <span>
            <strong>{eventLabel(row.eventType)}</strong>
            <small>{eventSummary(row)}</small>
          </span>
        </div>
      ),
    },
    {
      title: '相关对象',
      width: 200,
      render: (_, row) => (
        <div className="subject-cell">
          <span>{row.userName || row.userId || '系统或机器身份'}</span>
          <small>{row.clientName || row.clientId || '未关联具体应用'}</small>
        </div>
      ),
    },
    {
      title: '来源',
      width: 150,
      render: (_, row) => (
        <div className="subject-cell">
          <span>{row.ipAddress || '系统内部'}</span>
          <small>{sourceText(row)}</small>
        </div>
      ),
    },
    {
      align: 'center',
      title: '处理结果',
      width: 105,
      render: (_, row) => (
        <OAuthTag type={row.result === 'success' ? 'success' : 'danger'}>
          {row.result === 'success' ? '已完成' : '未完成'}
        </OAuthTag>
      ),
    },
    {
      align: 'center',
      title: '风险',
      width: 110,
      render: (_, row) => (
        <OAuthTag type={riskType(row.riskLevel)}>{riskText(row.riskLevel)}</OAuthTag>
      ),
    },
    {
      title: '需要关注',
      width: 210,
      ellipsis: true,
      render: (_, row) => failureText(row.failureCode, row.result),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_, row) => (
        <TableAction
          symbol="View"
          onClick={() => setDetail(row)}
        >
          查看
        </TableAction>
      ),
    },
  ]
  const filters = (
    <Form
      form={form}
      layout="inline"
      className="search-form"
      onFinish={search}
    >
      <Form.Item
        label="发生的操作"
        name="eventType"
      >
        <Select
          placeholder="全部操作"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 200 }}
          options={eventGroups}
        />
      </Form.Item>
      <Form.Item
        label="应用"
        name="clientId"
      >
        <Input
          style={{ width: 200 }}
          placeholder="应用编号"
          allowClear
        />
      </Form.Item>
      <Form.Item
        label="用户"
        name="userId"
      >
        <Input
          placeholder="用户编号"
          allowClear
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item
        label="处理结果"
        name="result"
      >
        <Select
          style={{ width: 200 }}
          placeholder="全部结果"
          allowClear
          options={[
            { value: 'success', label: '已完成' },
            { value: 'failure', label: '未完成' },
          ]}
        />
      </Form.Item>
      <Form.Item
        label="风险程度"
        name="riskLevel"
      >
        <Select
          style={{ width: 200 }}
          placeholder="全部风险"
          allowClear
          options={['normal', 'medium', 'high', 'critical'].map((value) => ({
            value,
            label: value === 'medium' ? '需要关注' : riskText(value),
          }))}
        />
      </Form.Item>
      <Form.Item
        label="发生时间"
        name="dateRange"
      >
        <BusinessDateTimeRangePicker
          label="发生时间"
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button
            icon={<SearchOutlined />}
            type="primary"
            htmlType="submit"
          >
            查找
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              form.resetFields()
              setQuery((current) => ({ pageNum: 1, pageSize: current.pageSize }))
            }}
          >
            清空
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
  return (
    <PageFrame
      className="oauth-audit-page"
      title="安全日志"
      description="按时间查看登录、授权、凭据签发和策略变更，快速判断一次操作是否正常、影响了谁。"
      section="安全运维"
      filterHint="日志内容已经脱敏，不包含密码、密钥或完整凭据"
      actions={
        <HasPermi value={['monitor:oauthAudit:export']}>
          <Button
            className="ruoyi-plain-button"
            icon={<DownloadOutlined />}
            onClick={exportRows}
          >
            导出当前结果
          </Button>
        </HasPermi>
      }
      filters={showSearch && filters}
      toolbar={
        <>
          <span className="result-count">
            找到 <strong>{total}</strong> 条记录
          </span>
          <RightToolbar
            showSearch={showSearch}
            onShowSearch={setShowSearch}
            onQuery={() => void refresh()}
          />
        </>
      }
    >
      <Table
        locale={{ emptyText: <Empty description="当前条件下没有安全日志" /> }}
        rowKey={(row) => row.auditId || row.eventId}
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1275 }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => void refresh(page)}
      />
      <Drawer
        rootClassName="oauth-detail-drawer oauth-audit-detail"
        title="安全事件详情"
        size="min(660px, 92vw)"
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <div className="detail-hero">
              <EventMark
                row={detail}
                large
              />
              <div>
                <strong>{eventLabel(detail.eventType)}</strong>
                <p>{parseTime(detail.occurredAt || detail.createTime) || '时间未知'}</p>
              </div>
              <div className="detail-tags">
                <OAuthTag type={detail.result === 'success' ? 'success' : 'danger'}>
                  {detail.result === 'success' ? '已完成' : '未完成'}
                </OAuthTag>
                <OAuthTag type={riskType(detail.riskLevel)}>{riskText(detail.riskLevel)}</OAuthTag>
              </div>
            </div>
            <section className="detail-section">
              <h4>发生了什么</h4>
              <p>
                {eventSummary(detail)}
                {failureText(detail.failureCode, detail.result) !== '无需处理'
                  ? `。${failureText(detail.failureCode, detail.result)}`
                  : ''}
              </p>
            </section>
            <Descriptions
              className="detail-descriptions"
              column={1}
              bordered
              items={[
                ['相关用户', detail.userName || detail.userId || '系统或机器身份'],
                ['相关应用', detail.clientName || detail.clientId || '未关联具体应用'],
                ['相关服务', detail.resourceId || '未关联具体服务'],
                ['来源地址', detail.ipAddress || '系统内部'],
                ['失败原因', failureText(detail.failureCode, detail.result)],
              ].map(([label, children]) => ({ key: label, label, children }))}
            />
            <Collapse
              className="technical-details"
              ghost
              expandIconPlacement="end"
              items={[
                {
                  key: 'diagnostics',
                  label: '查看排障信息',
                  children: (
                    <dl>
                      {[
                        ['事件代码', detail.eventType],
                        ['事件 ID', detail.auditId || detail.eventId],
                        ['链路 ID', detail.traceId],
                        ['用户主体', detail.subjectId],
                        ['会话 ID', detail.sid],
                        ['授权 ID', detail.grantId],
                        ['凭据 ID', detail.tokenId],
                        ['错误代码', detail.failureCode],
                        ['浏览器信息', detail.userAgent],
                      ].map(([label, value]) => (
                        <Fragment key={label}>
                          <dt>{label}</dt>
                          <dd>{value || '—'}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </PageFrame>
  )
}
