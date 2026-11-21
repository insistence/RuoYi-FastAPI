import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import FileTag from './FileTag'
import { TableAction } from '@/components/TableActions'
import './style.css'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
} from 'antd'
import Table from '@/components/Table'
import {
  getFileReconcileStats,
  handleFileReconcileIssue,
  listFileReconcileIssue,
  listFileReconcileRun,
  startFileReconcile,
} from '@/api/system/file'
import Pagination from '@/components/Pagination'
import { message } from '@/plugins/modal'
import { parseTime } from '@/utils/ruoyi'
import {
  actionDescriptions,
  actionLabel,
  dangerousActions,
  formatLocation,
  formatOptionalSize,
  issueStatusLabel,
  issueStatusType,
  issueTypeLabel,
  issueTypeOptions,
  runStatusLabel,
  runStatusType,
  severityLabel,
  severityTagType,
} from './reconcileFormatters'

export default function FileReconcileDrawer({ open, onClose, onSuccess }) {
  useI18n()

  const [stats, setStats] = useState({}),
    [issues, setIssues] = useState({ rows: [], total: 0 }),
    [runs, setRuns] = useState({ rows: [], total: 0 }),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10, status: 'open' }),
    [runQuery, setRunQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [loading, setLoading] = useState(false),
    [checkHash, setCheckHash] = useState(false),
    [scanning, setScanning] = useState(false),
    [action, setAction] = useState(),
    [saving, setSaving] = useState(false),
    [form] = Form.useForm(),
    [actionForm] = Form.useForm()
  useLocalizedFormErrors(form, actionForm)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [summary, issueResult, runResult] = await Promise.all([
        getFileReconcileStats(),
        listFileReconcileIssue(query),
        listFileReconcileRun(runQuery),
      ])
      setStats(summary.data || {})
      setIssues(issueResult)
      setRuns(runResult)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query, runQuery])
  useEffect(() => {
    if (open) load()
    else setAction(undefined)
  }, [open, load])
  useEffect(() => {
    if (!open || stats.latestRun?.status !== 'running') return
    const timer = setInterval(() => {
      if (!document.hidden && !loading) load()
    }, 3000)
    return () => clearInterval(timer)
  }, [open, stats.latestRun?.status, load, loading])
  function openAction(key, row) {
    setAction({ key, row })
    actionForm.resetFields()
    actionForm.setFieldsValue({
      originalName: row.originalName || row.actualKey?.split('/').pop() || '',
      reason: '',
    })
  }
  async function submit() {
    const values = await actionForm.validateFields()
    setSaving(true)
    try {
      await handleFileReconcileIssue(action.row.issueId, {
        action: action.key,
        reason: values.reason,
        ...(action.key === 'register_orphan' ? { originalName: values.originalName } : {}),
      })
      message.success(t('file:reconcile.storageIssueProcessedSuccessfully'))
      setAction(undefined)
      load()
      onSuccess()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const issueColumns = [
    {
      align: 'center',
      title: t('file:reconcile.level'),
      dataIndex: 'severity',
      width: 80,
      render: (value) => <FileTag type={severityTagType(value)}>{severityLabel(value)}</FileTag>,
    },
    {
      align: 'center',
      title: t('file:shared.issueType'),
      dataIndex: 'issueType',
      width: 130,
      render: issueTypeLabel,
    },
    {
      title: t('file:file'),
      width: 170,
      render: (_, row) => (
        <>
          {row.originalName || t('file:unregisteredFile')}
          <div className="cell-secondary">{row.fileId || '-'}</div>
        </>
      ),
    },
    {
      title: t('file:reconcile.storageLocation'),
      width: 230,
      render: (_, row) => (
        <>
          {t('file:reconcile.expected')}
          {formatLocation(row.expectedRoot, row.expectedKey)}
          <div className="cell-secondary">
            {t('file:reconcile.actual')}
            {formatLocation(row.actualRoot, row.actualKey)}
          </div>
        </>
      ),
    },
    {
      align: 'right',
      title: t('file:reconcile.size'),
      width: 130,
      render: (_, row) => (
        <>
          {t('file:reconcile.expected')}
          {formatOptionalSize(row.expectedSize)}
          <div className="cell-secondary">
            {t('file:reconcile.actual')}
            {formatOptionalSize(row.actualSize)}
          </div>
        </>
      ),
    },
    {
      align: 'center',
      title: t('common:status'),
      dataIndex: 'status',
      width: 90,
      render: (value) => <FileTag type={issueStatusType(value)}>{issueStatusLabel(value)}</FileTag>,
    },
    { title: t('file:reconcile.issueDescription'), dataIndex: 'detail', width: 180 },
    {
      align: 'center',
      title: t('file:reconcile.lastDetected'),
      dataIndex: 'lastSeenTime',
      width: 170,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      fixed: 'right',
      width: 70,
      render: (_, row) =>
        row.availableActions?.length ? (
          <Dropdown
            disabled={stats.latestRun?.status === 'running'}
            menu={{
              items: row.availableActions.map((key) => ({
                key,
                label: actionLabel(key),
                danger: dangerousActions.includes(key),
              })),
              onClick: ({ key }) => openAction(key, row),
            }}
          >
            <TableAction
              iconOnly={true}
              symbol="Setting"
              disabled={stats.latestRun?.status === 'running'}
            >
              {t('file:processIssue')}
            </TableAction>
          </Dropdown>
        ) : (
          '-'
        ),
    },
  ]
  const runColumns = [
    {
      width: 100,
      align: 'center',
      title: t('monitor:taskStatus'),
      dataIndex: 'status',
      render: (value) => <FileTag type={runStatusType(value)}>{runStatusLabel(value)}</FileTag>,
    },
    {
      width: 100,
      align: 'center',
      title: t('file:reconcile.trigger'),
      dataIndex: 'triggerType',
      render: (value) => (value === 'scheduled' ? t('system:scheduledTasks') : t('monitor:manual')),
    },
    {
      width: 90,
      align: 'center',
      title: t('file:reconcile.digestVerification'),
      dataIndex: 'checkHash',
      render: (value) => (value ? t('common:yes') : t('common:no')),
    },
    ...Object.entries({
      scannedFileCount: t('file:reconcile.fileRecords'),
      scannedStorageCount: t('file:reconcile.physicalFiles'),
      issueCount: t('file:reconcile.issuesFound'),
      newIssueCount: t('file:reconcile.newIssues'),
      resolvedIssueCount: t('file:reconcile.automaticallyRecovered'),
      startedBy: t('file:reconcile.initiatedBy'),
    }).map(([dataIndex, title]) => ({
      dataIndex,
      title,
      align: dataIndex === 'startedBy' ? 'center' : 'right',
    })),
    {
      width: 170,
      align: 'center',
      title: t('common:startTime'),
      dataIndex: 'startedTime',
      render: (value) => parseTime(value),
    },
    {
      width: 170,
      align: 'center',
      title: t('file:reconcile.completedAt'),
      dataIndex: 'finishedTime',
      render: (value) => parseTime(value),
    },
    { width: 180, title: t('common:failureReason'), dataIndex: 'errorMessage' },
  ]
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title={t('file:reconcile.fileStorageReconciliation')}
        open={open}
        onClose={onClose}
        size="88%"
      >
        <Alert
          title={t(
            'file:reconcile.reconciliationChecksFileMetadataAgainstPublicProtectedAndRecycled'
          )}
          type="info"
          showIcon
          style={{ marginBottom: 0 }}
        />
        <div className="file-reconcile-summary">
          {[
            [
              t('file:reconcile.pending'),
              'openCount',
              'danger',
              t('file:reconcile.issuesRequiringReviewOrRepair'),
            ],
            [
              t('file:reconcile.criticalIssues'),
              'criticalCount',
              'critical',
              t('file:reconcile.missingMisplacedOrInconsistentFiles'),
            ],
            [
              t('file:reconcile.warnings'),
              'warningCount',
              'warning',
              t('file:reconcile.orphanedFilesOrInconsistentRecycleStatus'),
            ],
            [
              t('file:reconcile.quarantineFile'),
              'quarantinedCount',
              'quarantine',
              t('file:reconcile.onlyAdministratorsCanRestoreOrPermanentlyDelete'),
            ],
          ].map(([title, key, tone, hint]) => (
            <div
              key={key}
              className={`summary-card summary-card--${tone}`}
            >
              <div className="summary-card__label">{title}</div>
              <div className="summary-card__value">{stats[key] || 0}</div>
              <div className="summary-card__hint">{hint}</div>
            </div>
          ))}
          <div className="summary-card summary-card--run">
            <div className="summary-card__label">{t('file:reconcile.latestTask')}</div>
            <div className="summary-card__status">
              <FileTag type={runStatusType(stats.latestRun?.status)}>
                {runStatusLabel(stats.latestRun?.status)}
              </FileTag>
            </div>
            <div className="summary-card__hint">
              {stats.latestRun
                ? parseTime(stats.latestRun.startedTime)
                : t('file:reconcile.notRunYet')}
            </div>
          </div>
        </div>
        <div className="file-reconcile-toolbar">
          <div className="reconcile-toolbar__tip">
            {t('file:reconcile.fullDigestVerificationReadsAllFileContentsEnableIt')}
          </div>
          <Space>
            <span>{t('file:reconcile.verifySha256')}</span>
            <Switch
              checked={checkHash}
              onChange={setCheckHash}
            />
            <Button
              className="ruoyi-plain-button"
              icon={<ReloadOutlined />}
              loading={scanning}
              disabled={stats.latestRun?.status === 'running'}
              onClick={async () => {
                setScanning(true)
                try {
                  await startFileReconcile({ checkHash })
                  message.success(t('file:reconcile.storageReconciliationStarted'))
                  load()
                } catch {
                } finally {
                  setScanning(false)
                }
              }}
            >
              {t('file:reconcile.startReconciliation')}
            </Button>
          </Space>
        </div>
        <Tabs
          items={[
            {
              key: 'issues',
              label: t('file:reconcile.issueDetails'),
              children: (
                <>
                  <Form
                    form={form}
                    initialValues={{ status: 'open' }}
                    layout="inline"
                    className="search-form"
                    colon={false}
                    labelCol={{ flex: '68px' }}
                    onFinish={(values) =>
                      setQuery({
                        ...values,
                        pageNum: 1,
                        pageSize: query.pageSize,
                      })
                    }
                  >
                    <Form.Item
                      label={t('file:reconcile.keyword')}
                      name="keyword"
                    >
                      <Input
                        style={{ width: 200 }}
                        allowClear
                        placeholder={t('file:reconcile.fileNameIdOrRelativePath')}
                      />
                    </Form.Item>
                    <Form.Item
                      name="issueType"
                      label={t('file:shared.issueType')}
                    >
                      <Select
                        placeholder={t('file:reconcile.allTypes')}
                        allowClear
                        style={{ width: 200 }}
                        options={issueTypeOptions}
                      />
                    </Form.Item>
                    <Form.Item
                      name="severity"
                      label={t('file:reconcile.severity')}
                    >
                      <Select
                        placeholder={t('file:reconcile.allSeverities')}
                        allowClear
                        style={{ width: 200 }}
                        options={['critical', 'warning', 'info'].map((value) => ({
                          value,
                          label: severityLabel(value),
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      name="status"
                      label={t('file:reconcile.processingStatus')}
                    >
                      <Select
                        placeholder={t('common:allStatuses')}
                        allowClear
                        style={{ width: 200 }}
                        options={['open', 'ignored', 'quarantined', 'resolved'].map((value) => ({
                          value,
                          label: issueStatusLabel(value),
                        }))}
                      />
                    </Form.Item>
                    <Form.Item>
                      <Space>
                        <Button
                          icon={<SearchOutlined />}
                          htmlType="submit"
                          type="primary"
                        >
                          {t('common:search')}
                        </Button>
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => {
                            form.resetFields()
                            setQuery({
                              pageNum: 1,
                              pageSize: 10,
                              status: 'open',
                            })
                          }}
                        >
                          {t('common:reset')}
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>
                  <Table
                    rowKey="issueId"
                    dataSource={issues.rows}
                    columns={issueColumns}
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 1600 }}
                  />
                  <Pagination
                    total={issues.total}
                    page={query.pageNum}
                    limit={query.pageSize}
                    onChange={(page) => setQuery({ ...query, ...page })}
                  />
                </>
              ),
            },
            {
              key: 'runs',
              label: t('file:reconcile.taskHistory'),
              children: (
                <>
                  <Table
                    rowKey="runId"
                    dataSource={runs.rows}
                    columns={runColumns}
                    loading={loading}
                    pagination={false}
                    scroll={{ x: 1500 }}
                  />
                  <Pagination
                    total={runs.total}
                    page={runQuery.pageNum}
                    limit={runQuery.pageSize}
                    onChange={setRunQuery}
                  />
                </>
              ),
            },
          ]}
        />
      </Drawer>
      <Modal
        width="520px"
        className="file-dialog "
        title={actionLabel(action?.key)}
        open={!!action}
        onCancel={() => setAction(undefined)}
        onOk={submit}
        confirmLoading={saving}
      >
        <Alert
          title={actionDescriptions[action?.key]}
          type={dangerousActions.includes(action?.key) ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          name="src-views-system-file-components-FileReconcileDrawer-jsx-editor-7"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '90px' }}
          form={actionForm}
          layout="horizontal"
        >
          {action?.key === 'register_orphan' && (
            <Form.Item
              name="originalName"
              label={t('file:originalName')}
              rules={[{ required: true, whitespace: true }]}
            >
              <Input
                maxLength={255}
                placeholder={t('file:reconcile.mustMatchThePhysicalFileExtension')}
              />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label={t('file:reconcile.processingReason')}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('file:reconcile.enterAReasonForProcessing'),
              },
            ]}
          >
            <Input.TextArea
              placeholder={t('file:reconcile.enterTheReasonItWillBeRetainedInThe')}
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
