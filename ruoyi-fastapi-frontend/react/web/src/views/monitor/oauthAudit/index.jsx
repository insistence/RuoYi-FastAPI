import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

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
  useI18n()

  const [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [detail, setDetail] = useState(null)
  useLocalizedFormErrors(form)
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
      title: t('monitor:occurredAt'),
      width: 170,
      render: (_, row) => parseTime(row.occurredAt || row.createTime),
    },
    {
      title: t('monitor:operation'),
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
      title: t('monitor:relatedEntities'),
      width: 200,
      render: (_, row) => (
        <div className="subject-cell">
          <span>{row.userName || row.userId || t('monitor:systemOrMachineIdentity')}</span>
          <small>{row.clientName || row.clientId || t('monitor:noApplicationLinked')}</small>
        </div>
      ),
    },
    {
      title: t('common:source'),
      width: 150,
      render: (_, row) => (
        <div className="subject-cell">
          <span>{row.ipAddress || t('monitor:internal')}</span>
          <small>{sourceText(row)}</small>
        </div>
      ),
    },
    {
      align: 'center',
      title: t('monitor:result'),
      width: 105,
      render: (_, row) => (
        <OAuthTag type={row.result === 'success' ? 'success' : 'danger'}>
          {row.result === 'success' ? t('common:completed') : t('monitor:incomplete')}
        </OAuthTag>
      ),
    },
    {
      align: 'center',
      title: t('monitor:risk'),
      width: 110,
      render: (_, row) => (
        <OAuthTag type={riskType(row.riskLevel)}>{riskText(row.riskLevel)}</OAuthTag>
      ),
    },
    {
      title: t('monitor:oauthAudit.needsAttention'),
      width: 210,
      ellipsis: true,
      render: (_, row) => failureText(row.failureCode, row.result),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 100,
      fixed: 'right',
      render: (_, row) => (
        <TableAction
          symbol="View"
          onClick={() => setDetail(row)}
        >
          {t('common:view')}
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
        label={t('monitor:operation')}
        name="eventType"
      >
        <Select
          placeholder={t('monitor:allOperations')}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 200 }}
          options={eventGroups}
        />
      </Form.Item>
      <Form.Item
        label={t('common:apply')}
        name="clientId"
      >
        <Input
          style={{ width: 200 }}
          placeholder={t('authCenter:appId')}
          allowClear
        />
      </Form.Item>
      <Form.Item
        label={t('system:user.user')}
        name="userId"
      >
        <Input
          placeholder={t('system:user.id')}
          allowClear
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item
        label={t('monitor:result')}
        name="result"
      >
        <Select
          style={{ width: 200 }}
          placeholder={t('monitor:allResults')}
          allowClear
          options={[
            { value: 'success', label: t('common:completed') },
            { value: 'failure', label: t('monitor:incomplete') },
          ]}
        />
      </Form.Item>
      <Form.Item
        label={t('monitor:riskLevel')}
        name="riskLevel"
      >
        <Select
          style={{ width: 200 }}
          placeholder={t('monitor:allRiskLevels')}
          allowClear
          options={['normal', 'medium', 'high', 'critical'].map((value) => ({
            value,
            label: value === 'medium' ? t('monitor:oauthAudit.needsAttention') : riskText(value),
          }))}
        />
      </Form.Item>
      <Form.Item
        label={t('monitor:occurredAt')}
        name="dateRange"
      >
        <BusinessDateTimeRangePicker
          label={t('monitor:occurredAt')}
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
            {t('common:find')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              form.resetFields()
              setQuery((current) => ({ pageNum: 1, pageSize: current.pageSize }))
            }}
          >
            {t('common:clear')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
  return (
    <PageFrame
      className="oauth-audit-page"
      title={t('monitor:securityLogs')}
      description={t('monitor:reviewSignInsAuthorizationsIssuedCredentialsAndPolicyChanges')}
      section={t('monitor:securityOperations')}
      filterHint={t('monitor:logsAreSanitizedAndContainNoPasswordsSecretsOr')}
      actions={
        <HasPermi value={['monitor:oauthAudit:export']}>
          <Button
            className="ruoyi-plain-button"
            icon={<DownloadOutlined />}
            onClick={exportRows}
          >
            {t('monitor:exportCurrentResults')}
          </Button>
        </HasPermi>
      }
      filters={showSearch && filters}
      toolbar={
        <>
          <span className="result-count">
            {t('layout:found')} <strong>{total}</strong> {t('monitor:records')}
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
        locale={{
          emptyText: <Empty description={t('monitor:noSecurityLogsMatchTheCurrentFilters')} />,
        }}
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
        title={t('monitor:securityEventDetails')}
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
                <p>
                  {parseTime(detail.occurredAt || detail.createTime) || t('monitor:timeUnknown')}
                </p>
              </div>
              <div className="detail-tags">
                <OAuthTag type={detail.result === 'success' ? 'success' : 'danger'}>
                  {detail.result === 'success' ? t('common:completed') : t('monitor:incomplete')}
                </OAuthTag>
                <OAuthTag type={riskType(detail.riskLevel)}>{riskText(detail.riskLevel)}</OAuthTag>
              </div>
            </div>
            <section className="detail-section">
              <h4>{t('monitor:whatHappened')}</h4>
              <p>
                {eventSummary(detail)}
                {detail.result === 'failure' || detail.failureCode
                  ? `。${failureText(detail.failureCode, detail.result)}`
                  : ''}
              </p>
            </section>
            <Descriptions
              className="detail-descriptions"
              column={1}
              bordered
              items={[
                [
                  t('monitor:relatedUser'),
                  detail.userName || detail.userId || t('monitor:systemOrMachineIdentity'),
                ],
                [
                  t('monitor:relatedApp'),
                  detail.clientName || detail.clientId || t('monitor:noApplicationLinked'),
                ],
                [t('monitor:relatedService'), detail.resourceId || t('monitor:noServiceLinked')],
                [t('monitor:sourceAddress'), detail.ipAddress || t('monitor:internal')],
                [t('common:failureReason'), failureText(detail.failureCode, detail.result)],
              ].map(([label, children]) => ({ key: label, label, children }))}
            />
            <Collapse
              className="technical-details"
              ghost
              expandIconPlacement="end"
              items={[
                {
                  key: 'diagnostics',
                  label: t('monitor:viewTroubleshootingDetails'),
                  children: (
                    <dl>
                      {[
                        [t('monitor:eventCode'), detail.eventType],
                        [t('monitor:eventId'), detail.auditId || detail.eventId],
                        [t('monitor:traceId'), detail.traceId],
                        [t('authCenter:userPrincipal'), detail.subjectId],
                        [t('monitor:sessionId'), detail.sid],
                        [t('monitor:authorizationId'), detail.grantId],
                        [t('monitor:tokenId'), detail.tokenId],
                        [t('monitor:errorCode'), detail.failureCode],
                        [t('monitor:browserInformation'), detail.userAgent],
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
