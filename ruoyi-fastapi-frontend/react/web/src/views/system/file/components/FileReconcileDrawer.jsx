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
      message.success(t('system:storageIssueProcessedSuccessfully'))
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
      title: t('system:level'),
      dataIndex: 'severity',
      width: 80,
      render: (value) => <FileTag type={severityTagType(value)}>{severityLabel(value)}</FileTag>,
    },
    {
      align: 'center',
      title: t('system:issueType'),
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
      title: t('system:storageLocation'),
      width: 230,
      render: (_, row) => (
        <>
          {t('system:expected')}
          {formatLocation(row.expectedRoot, row.expectedKey)}
          <div className="cell-secondary">
            {t('system:actual')}
            {formatLocation(row.actualRoot, row.actualKey)}
          </div>
        </>
      ),
    },
    {
      align: 'right',
      title: t('system:size'),
      width: 130,
      render: (_, row) => (
        <>
          {t('system:expected')}
          {formatOptionalSize(row.expectedSize)}
          <div className="cell-secondary">
            {t('system:actual')}
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
    { title: t('system:issueDescription'), dataIndex: 'detail', width: 180 },
    {
      align: 'center',
      title: t('system:lastDetected'),
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
      title: t('system:trigger'),
      dataIndex: 'triggerType',
      render: (value) => (value === 'scheduled' ? t('system:scheduledTasks') : t('monitor:manual')),
    },
    {
      width: 90,
      align: 'center',
      title: t('system:digestVerification'),
      dataIndex: 'checkHash',
      render: (value) => (value ? t('common:yes') : t('common:no')),
    },
    ...Object.entries({
      scannedFileCount: t('system:fileRecords'),
      scannedStorageCount: t('system:physicalFiles'),
      issueCount: t('system:issuesFound'),
      newIssueCount: t('system:newIssues'),
      resolvedIssueCount: t('system:automaticallyRecovered'),
      startedBy: t('system:initiatedBy'),
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
      title: t('system:completedAt'),
      dataIndex: 'finishedTime',
      render: (value) => parseTime(value),
    },
    { width: 180, title: t('common:failureReason'), dataIndex: 'errorMessage' },
  ]
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title={t('system:fileStorageReconciliation')}
        open={open}
        onClose={onClose}
        size="88%"
      >
        <Alert
          title={t('system:reconciliationChecksFileMetadataAgainstPublicProtectedAndRecycled')}
          type="info"
          showIcon
          style={{ marginBottom: 0 }}
        />
        <div className="file-reconcile-summary">
          {[
            [t('system:pending'), 'openCount', 'danger', t('system:issuesRequiringReviewOrRepair')],
            [
              t('system:criticalIssues'),
              'criticalCount',
              'critical',
              t('system:missingMisplacedOrInconsistentFiles'),
            ],
            [
              t('system:warnings'),
              'warningCount',
              'warning',
              t('system:orphanedFilesOrInconsistentRecycleStatus'),
            ],
            [
              t('system:quarantineFile'),
              'quarantinedCount',
              'quarantine',
              t('system:onlyAdministratorsCanRestoreOrPermanentlyDelete'),
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
            <div className="summary-card__label">{t('system:latestTask')}</div>
            <div className="summary-card__status">
              <FileTag type={runStatusType(stats.latestRun?.status)}>
                {runStatusLabel(stats.latestRun?.status)}
              </FileTag>
            </div>
            <div className="summary-card__hint">
              {stats.latestRun ? parseTime(stats.latestRun.startedTime) : t('system:notRunYet')}
            </div>
          </div>
        </div>
        <div className="file-reconcile-toolbar">
          <div className="reconcile-toolbar__tip">
            {t('system:fullDigestVerificationReadsAllFileContentsEnableIt')}
          </div>
          <Space>
            <span>{t('system:verifySha256')}</span>
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
                  message.success(t('system:storageReconciliationStarted'))
                  load()
                } catch {
                } finally {
                  setScanning(false)
                }
              }}
            >
              {t('system:startReconciliation')}
            </Button>
          </Space>
        </div>
        <Tabs
          items={[
            {
              key: 'issues',
              label: t('system:issueDetails'),
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
                      label={t('system:keyword')}
                      name="keyword"
                    >
                      <Input
                        style={{ width: 200 }}
                        allowClear
                        placeholder={t('system:fileNameIdOrRelativePath')}
                      />
                    </Form.Item>
                    <Form.Item
                      name="issueType"
                      label={t('system:issueType')}
                    >
                      <Select
                        placeholder={t('system:allTypes')}
                        allowClear
                        style={{ width: 200 }}
                        options={issueTypeOptions}
                      />
                    </Form.Item>
                    <Form.Item
                      name="severity"
                      label={t('system:severity')}
                    >
                      <Select
                        placeholder={t('system:allSeverities')}
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
                      label={t('system:processingStatus')}
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
              label: t('system:taskHistory'),
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
                placeholder={t('system:mustMatchThePhysicalFileExtension')}
              />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label={t('system:processingReason')}
            rules={[
              { required: true, whitespace: true, message: t('system:enterAReasonForProcessing') },
            ]}
          >
            <Input.TextArea
              placeholder={t('system:enterTheReasonItWillBeRetainedInThe')}
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
