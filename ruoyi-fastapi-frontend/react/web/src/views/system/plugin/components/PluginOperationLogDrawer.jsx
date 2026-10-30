import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useState } from 'react'
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  FileProtectOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tabs,
} from 'antd'
import Table from '@/components/Table'
import {
  getPluginOperationLog,
  listPluginOperationLog,
  retainPluginOperationLog,
} from '@/api/system/plugin'
import { getConfigKey } from '@/api/system/config'
import {
  normalizePluginOperationLogDetail,
  getValidationLevelLabel,
  getValidationLevelTagType,
} from '@/utils/pluginPlanFormatter'
import {
  formatActionPlanState,
  formatJson,
  formatPlanDependencies,
  formatPluginOperation,
  formatPluginTime,
  formatRetentionMessage,
  getOperationLogStatusLabel,
  getOperationLogStatusTagType,
  operationLogStatusOptions,
} from '../formatter'
import Pagination from '@/components/Pagination'
import HasPermi from '@/directive/permission/hasPermi'
import RightToolbar from '@/components/RightToolbar'
import { TableAction } from '@/components/TableActions'
import PluginTag from './PluginTag'
import { confirm, message } from '@/plugins/modal'
import { download } from '@/utils/request'
import { getDisplayTimezone } from '@/utils/time'

export default function PluginOperationLogDrawer({ open, onClose, dictionary = [] }) {
  useI18n()

  const [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(false),
    [detail, setDetail] = useState(),
    [revision, setRevision] = useState(0),
    [days, setDays] = useState(180),
    [defaultDays, setDefaultDays] = useState(180),
    [retention, setRetention] = useState(),
    [retaining, setRetaining] = useState(false),
    [exporting, setExporting] = useState(false)
  useLocalizedFormErrors(form)
  const [showSearch, setShowSearch] = useState(true)
  useEffect(() => {
    if (!open) return
    form.resetFields()
    setQuery({ pageNum: 1, pageSize: 10 })
    setRetention(undefined)
    getConfigKey('sys.plugin.operationLogRetentionDays')
      .then((result) => {
        const value = Number(result.msg)
        if (Number.isInteger(value) && value >= 0) {
          setDays(value)
          setDefaultDays(value)
        }
      })
      .catch(() => {})
  }, [open, form])
  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    listPluginOperationLog(query)
      .then((result) => active && setData(result))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, query, revision])
  const operation = (value) => formatPluginOperation(value, dictionary),
    table = (rows, columns, emptyText, minWidth) => (
      <Table
        size="small"
        bordered
        pagination={false}
        rowKey={(_, index) => index}
        dataSource={rows || []}
        columns={columns}
        locale={{ emptyText }}
        scroll={{ x: minWidth }}
      />
    )
  async function retain(dryRun) {
    if (!Number.isInteger(days) || days < 0)
      return message.warning(t('pluginAdmin:enterAValidRetentionPeriodInDays'))
    try {
      if (!dryRun)
        await confirm(
          days === 0
            ? t('pluginAdmin:clearAllPluginOperationAuditLogsBeforeTheCurrent')
            : t('pluginAdmin:clearPluginOperationAuditLogsOlderThanValueDays', { days })
        )
      setRetaining(true)
      const result = await retainPluginOperationLog({
        retentionDays: days,
        dryRun,
      })
      setRetention(result.data)
      if (!dryRun) {
        message.success(t('system:pluginAuditLogsDeleted'))
        setRevision((value) => value + 1)
      }
    } catch {
    } finally {
      setRetaining(false)
    }
  }
  return (
    <>
      <Drawer
        rootClassName="plugin-audit-drawer"
        closable={{ placement: 'end' }}
        title={t('system:pluginOperationAudit')}
        open={open}
        onClose={onClose}
        size="max(50vw, min(600px, 100vw))"
      >
        <div className="plugin-audit-content">
          {showSearch && (
            <Form
              form={form}
              name="plugin-audit-query"
              layout="inline"
              className="search-form"
              labelCol={{ flex: '68px' }}
              colon={false}
              onFinish={({ dateRange, ...values }) =>
                setQuery({
                  ...values,
                  beginTime: dateRange?.[0]?.format('YYYY-MM-DD'),
                  endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
                  pageNum: 1,
                  pageSize: query.pageSize,
                })
              }
            >
              <Form.Item
                name="pluginId"
                label={t('pluginAdmin:id')}
              >
                <Input
                  placeholder={t('system:enterAPluginId')}
                  allowClear
                />
              </Form.Item>
              <Form.Item
                name="operation"
                label={t('common:actions')}
              >
                <Select
                  placeholder={t('monitor:log.operationType')}
                  allowClear
                  options={dictionary}
                />
              </Form.Item>
              <Form.Item
                name="status"
                label={t('common:status')}
              >
                <Select
                  placeholder={t('monitor:job.executionStatus')}
                  allowClear
                  options={operationLogStatusOptions}
                />
              </Form.Item>
              <Form.Item
                name="dateRange"
                label={t('common:createdTime')}
              >
                <DatePicker.RangePicker
                  placeholder={[t('common:startDate'), t('common:endDate')]}
                  aria-label={t('monitor:dateRangeValue', { arg0: getDisplayTimezone() })}
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button
                    icon={<SearchOutlined />}
                    type="primary"
                    htmlType="submit"
                  >
                    {t('common:search')}
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      form.resetFields()
                      setQuery({ pageNum: 1, pageSize: 10 })
                    }}
                  >
                    {t('common:reset')}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}
          <Collapse
            className="plugin-audit-maintenance"
            expandIconPlacement="end"
            items={[
              {
                key: 'retention',
                label: (
                  <Space size={8}>
                    <strong>{t('system:auditRetentionPolicy')}</strong>
                    <PluginTag className="plugin-audit-retention-tag">
                      {t('layout:size.default')} {defaultDays} {t('system:days')}
                    </PluginTag>
                  </Space>
                ),
                children: (
                  <>
                    <Space
                      className="plugin-audit-retention-form"
                      wrap
                      size={12}
                    >
                      {t('system:retentionDays')}
                      <InputNumber
                        min={0}
                        max={3650}
                        precision={0}
                        value={days}
                        onChange={(value) => {
                          setDays(value)
                          setRetention(undefined)
                        }}
                      />
                      <Button
                        icon={<FileProtectOutlined />}
                        loading={retaining}
                        onClick={() => retain(true)}
                      >
                        {t('system:previewCleanup')}
                      </Button>
                      <HasPermi value={['system:plugin:edit']}>
                        <Button
                          icon={<DeleteOutlined />}
                          className="ruoyi-plain-button ruoyi-plain-button--danger"
                          loading={retaining}
                          onClick={() => retain(false)}
                        >
                          {t('system:confirmCleanup')}
                        </Button>
                      </HasPermi>
                    </Space>
                    {retention && (
                      <Alert
                        style={{ marginTop: 12 }}
                        showIcon
                        title={formatRetentionMessage(retention)}
                        type={retention.deletedCount ? 'success' : 'info'}
                      />
                    )}
                  </>
                ),
              },
            ]}
          />
          <div className="plugin-audit-table">
            <div className="plugin-audit-table-toolbar">
              <HasPermi value={['system:plugin:export']}>
                <Button
                  icon={<DownloadOutlined />}
                  className="ruoyi-plain-button ruoyi-plain-button--warning"
                  loading={exporting}
                  onClick={async () => {
                    setExporting(true)
                    try {
                      await download(
                        'system/plugin/operation-log/export',
                        { ...query, exportLimit: 5000 },
                        `plugin_operation_log_${Date.now()}.xlsx`
                      )
                    } finally {
                      setExporting(false)
                    }
                  }}
                >
                  {t('common:export')}
                </Button>
              </HasPermi>
              <RightToolbar
                showSearch={showSearch}
                onShowSearch={setShowSearch}
                onQuery={() => setRevision((value) => value + 1)}
              />
            </div>
            <Table
              size="small"
              bordered
              rowKey="operationId"
              loading={loading}
              dataSource={data.rows}
              pagination={false}
              scroll={{ x: 830 }}
              columns={[
                { width: 90, align: 'center', title: t('system:logId'), dataIndex: 'operationId' },
                {
                  width: 90,
                  align: 'center',
                  title: t('common:actions'),
                  dataIndex: 'operation',
                  render: operation,
                },
                {
                  width: 90,
                  align: 'center',
                  title: t('common:status'),
                  dataIndex: 'status',
                  render: (value) => (
                    <PluginTag type={getOperationLogStatusTagType(value)}>
                      {getOperationLogStatusLabel(value)}
                    </PluginTag>
                  ),
                },
                {
                  width: 180,
                  title: t('system:components.plugin'),
                  ellipsis: true,
                  dataIndex: 'pluginIds',
                  render: formatPlanDependencies,
                },
                {
                  width: 70,
                  align: 'center',
                  title: t('common:success'),
                  render: (_, row) => row.summary?.succeeded ?? 0,
                },
                {
                  width: 70,
                  align: 'center',
                  title: t('common:failed'),
                  render: (_, row) => row.summary?.failed ?? 0,
                },
                {
                  width: 170,
                  align: 'center',
                  title: t('common:createdTime'),
                  dataIndex: 'createTime',
                  render: formatPluginTime,
                },
                {
                  width: 70,
                  align: 'center',
                  title: t('common:actions'),
                  render: (_, row) => (
                    <TableAction
                      iconOnly
                      symbol="View"
                      aria-label={t('system:auditDetails')}
                      tooltip={t('common:details')}
                      onClick={() =>
                        getPluginOperationLog(row.operationId)
                          .then((result) =>
                            setDetail(normalizePluginOperationLogDetail(result.data))
                          )
                          .catch(() => {})
                      }
                    >
                      {t('common:details')}
                    </TableAction>
                  ),
                },
              ]}
            />
            <Pagination
              total={data.total}
              page={query.pageNum}
              limit={query.pageSize}
              onChange={(page) => setQuery({ ...query, ...page })}
            />
          </div>
          <div className="plugin-audit-footer">
            <Button onClick={onClose}>{t('layout:search.close')}</Button>
          </div>
        </div>
      </Drawer>
      <Modal
        className="plugin-dialog plugin-result-dialog plugin-audit-detail"
        title={t('system:auditDetails')}
        open={!!detail}
        width="min(920px, calc(100vw - 32px))"
        onCancel={() => setDetail(undefined)}
        footer={<Button onClick={() => setDetail(undefined)}>{t('layout:search.close')}</Button>}
      >
        {detail && (
          <>
            <Descriptions
              bordered
              column={3}
              className="plugin-audit-description"
              items={[
                [t('system:logId'), detail.operationId || '-'],
                [t('common:actions'), operation(detail.operation)],
                [t('common:status'), getOperationLogStatusLabel(detail.status)],
                [t('system:dryRun'), detail.dryRun ? t('common:yes') : t('common:no')],
                [
                  t('system:continueAfterFailure'),
                  detail.continueOnError ? t('common:yes') : t('common:no'),
                ],
                [t('common:createdTime'), formatPluginTime(detail.createTime)],
                [t('system:components.plugin'), formatPlanDependencies(detail.pluginIds), 3],
                [t('common:remark'), detail.remark || '-', 3],
              ].map(([label, children, span]) => ({ key: label, label, children, span }))}
            />
            <Tabs
              items={[
                {
                  key: 'summary',
                  label: t('system:summary'),
                  children: (
                    <Descriptions
                      bordered
                      column={3}
                      className="plugin-audit-description"
                      items={[
                        [t('system:successCount'), detail.summary?.succeeded ?? 0],
                        [t('system:failureCount'), detail.summary?.failed ?? 0],
                        [t('system:skippedCount'), detail.summary?.skipped ?? 0],
                        [
                          t('system:configurationChanges'),
                          formatPlanDependencies(detail.summary?.changedKeys),
                          3,
                        ],
                        [
                          t('system:failureSuggestions'),
                          detail.failedSuggestion || t('system:none'),
                          3,
                        ],
                        [
                          t('system:failedStep'),
                          detail.failedStep ||
                            detail.result?.failedStep ||
                            detail.result?.failed?.result?.failedStep ||
                            t('system:none'),
                          3,
                        ],
                      ].map(([label, children, span]) => ({
                        key: label,
                        label,
                        children,
                        span,
                      }))}
                    />
                  ),
                },
                {
                  key: 'validation',
                  label: t('system:checkResults'),
                  children: table(
                    detail.validationItems,
                    [
                      {
                        width: 120,
                        align: 'center',
                        title: t('system:category'),
                        dataIndex: 'category',
                      },
                      {
                        width: 90,
                        align: 'center',
                        title: t('common:level'),
                        dataIndex: 'level',
                        render: (value) => (
                          <PluginTag type={getValidationLevelTagType(value)}>
                            {getValidationLevelLabel(value)}
                          </PluginTag>
                        ),
                      },
                      { width: 180, title: t('common:type'), dataIndex: 'kind', ellipsis: true },
                      { width: 180, title: t('system:object'), dataIndex: 'value', ellipsis: true },
                      { title: t('common:description'), dataIndex: 'message', ellipsis: true },
                    ],
                    t('system:noCheckResults'),
                    790
                  ),
                },
                {
                  key: 'actions',
                  label: t('system:actionPlan'),
                  children: table(
                    detail.actionItems,
                    [
                      { title: t('system:action'), dataIndex: 'label', ellipsis: true },
                      {
                        width: 80,
                        align: 'center',
                        title: t('common:enable'),
                        dataIndex: 'enabled',
                        render: (value) => (
                          <PluginTag type={value ? 'success' : 'info'}>
                            {value ? t('common:yes') : t('common:no')}
                          </PluginTag>
                        ),
                      },
                      {
                        width: 80,
                        align: 'center',
                        title: t('common:count'),
                        dataIndex: 'count',
                        render: (value) => value ?? '-',
                      },
                      {
                        title: t('common:status'),
                        ellipsis: true,
                        render: (_, row) => formatActionPlanState(row),
                      },
                    ],
                    t('system:noActionPlan'),
                    500
                  ),
                },
                {
                  key: 'plan',
                  label: t('system:dependencyPlan'),
                  children: table(
                    detail.planItems,
                    [
                      {
                        width: 150,
                        title: t('pluginAdmin:id'),
                        dataIndex: 'pluginId',
                        ellipsis: true,
                      },
                      {
                        width: 110,
                        align: 'center',
                        title: t('system:version'),
                        dataIndex: 'version',
                      },
                      {
                        width: 90,
                        align: 'center',
                        title: t('system:ready'),
                        dataIndex: 'ready',
                        render: (value) => (
                          <PluginTag type={value ? 'success' : 'danger'}>
                            {value ? t('common:yes') : t('common:no')}
                          </PluginTag>
                        ),
                      },
                      {
                        title: t('pluginAdmin:dependencies'),
                        dataIndex: 'dependencies',
                        ellipsis: true,
                        render: formatPlanDependencies,
                      },
                    ],
                    t('system:noDependencyPlan'),
                    550
                  ),
                },
                {
                  key: 'executed',
                  label: t('monitor:job.history'),
                  children: table(
                    detail.executed,
                    [
                      {
                        width: 140,
                        title: t('pluginAdmin:id'),
                        dataIndex: 'pluginId',
                        ellipsis: true,
                      },
                      {
                        width: 90,
                        align: 'center',
                        title: t('common:actions'),
                        dataIndex: 'operation',
                        render: operation,
                      },
                      {
                        width: 90,
                        align: 'center',
                        title: t('common:status'),
                        render: (_, row) => (
                          <PluginTag type={row.ok ? 'success' : 'danger'}>
                            {row.status || '-'}
                          </PluginTag>
                        ),
                      },
                      {
                        width: 90,
                        align: 'center',
                        title: t('monitor:job.duration'),
                        dataIndex: 'durationMs',
                        render: (value) => `${value ?? '-'}ms`,
                      },
                      {
                        width: 150,
                        title: t('system:failedStep'),
                        ellipsis: true,
                        render: (_, row) => row.failedStep || row.result?.failedStep || '-',
                      },
                      {
                        width: 220,
                        title: t('common:description'),
                        dataIndex: 'message',
                        ellipsis: true,
                      },
                      {
                        width: 260,
                        title: t('common:suggestion'),
                        dataIndex: 'suggestion',
                        ellipsis: true,
                      },
                    ],
                    t('system:noExecutionRecords'),
                    1040
                  ),
                },
                {
                  key: 'config',
                  label: t('system:components.configurationChanges'),
                  children: table(
                    detail.configChanges,
                    [
                      {
                        width: 180,
                        title: t('system:configurationKey'),
                        dataIndex: 'key',
                        ellipsis: true,
                      },
                      { width: 160, title: t('common:name'), dataIndex: 'label', ellipsis: true },
                      {
                        width: 80,
                        align: 'center',
                        title: t('system:sensitive'),
                        dataIndex: 'secret',
                        render: (value) => (
                          <PluginTag type={value ? 'warning' : 'info'}>
                            {value ? t('common:yes') : t('common:no')}
                          </PluginTag>
                        ),
                      },
                      {
                        title: t('system:before'),
                        ellipsis: true,
                        render: (_, row) =>
                          row.secret
                            ? '******'
                            : typeof row.before === 'object'
                              ? JSON.stringify(row.before)
                              : row.before,
                      },
                      {
                        title: t('system:after'),
                        ellipsis: true,
                        render: (_, row) =>
                          row.secret
                            ? '******'
                            : typeof row.after === 'object'
                              ? JSON.stringify(row.after)
                              : row.after,
                      },
                    ],
                    t('system:noConfigurationChanges'),
                    780
                  ),
                },
                {
                  key: 'raw',
                  label: t('system:rawResult'),
                  children: (
                    <Input.TextArea
                      rows={14}
                      value={formatJson(detail.result)}
                      readOnly
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Modal>
    </>
  )
}
