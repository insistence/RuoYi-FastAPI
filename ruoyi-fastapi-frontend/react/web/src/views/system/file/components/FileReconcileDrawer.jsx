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
      message.success('文件存储异常处理成功')
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
      title: '级别',
      dataIndex: 'severity',
      width: 80,
      render: (value) => <FileTag type={severityTagType(value)}>{severityLabel(value)}</FileTag>,
    },
    {
      align: 'center',
      title: '异常类型',
      dataIndex: 'issueType',
      width: 130,
      render: issueTypeLabel,
    },
    {
      title: '文件',
      width: 170,
      render: (_, row) => (
        <>
          {row.originalName || '未登记文件'}
          <div className="cell-secondary">{row.fileId || '-'}</div>
        </>
      ),
    },
    {
      title: '存储位置',
      width: 230,
      render: (_, row) => (
        <>
          预期：{formatLocation(row.expectedRoot, row.expectedKey)}
          <div className="cell-secondary">
            实际：{formatLocation(row.actualRoot, row.actualKey)}
          </div>
        </>
      ),
    },
    {
      align: 'right',
      title: '大小',
      width: 130,
      render: (_, row) => (
        <>
          预期：{formatOptionalSize(row.expectedSize)}
          <div className="cell-secondary">实际：{formatOptionalSize(row.actualSize)}</div>
        </>
      ),
    },
    {
      align: 'center',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value) => <FileTag type={issueStatusType(value)}>{issueStatusLabel(value)}</FileTag>,
    },
    { title: '异常说明', dataIndex: 'detail', width: 180 },
    {
      align: 'center',
      title: '最近发现',
      dataIndex: 'lastSeenTime',
      width: 170,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
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
              处理异常
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
      title: '任务状态',
      dataIndex: 'status',
      render: (value) => <FileTag type={runStatusType(value)}>{runStatusLabel(value)}</FileTag>,
    },
    {
      width: 100,
      align: 'center',
      title: '触发方式',
      dataIndex: 'triggerType',
      render: (value) => (value === 'scheduled' ? '定时任务' : '手动'),
    },
    {
      width: 90,
      align: 'center',
      title: '摘要校验',
      dataIndex: 'checkHash',
      render: (value) => (value ? '是' : '否'),
    },
    ...Object.entries({
      scannedFileCount: '文件记录',
      scannedStorageCount: '物理文件',
      issueCount: '发现异常',
      newIssueCount: '新增异常',
      resolvedIssueCount: '自动恢复',
      startedBy: '发起人',
    }).map(([dataIndex, title]) => ({
      dataIndex,
      title,
      align: dataIndex === 'startedBy' ? 'center' : 'right',
    })),
    {
      width: 170,
      align: 'center',
      title: '开始时间',
      dataIndex: 'startedTime',
      render: (value) => parseTime(value),
    },
    {
      width: 170,
      align: 'center',
      title: '完成时间',
      dataIndex: 'finishedTime',
      render: (value) => parseTime(value),
    },
    { width: 180, title: '失败原因', dataIndex: 'errorMessage' },
  ]
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title="文件存储对账"
        open={open}
        onClose={onClose}
        size="88%"
      >
        <Alert
          title="对账会双向检查文件信息表与公开、受保护、回收站存储区；隔离区不对外提供静态访问。修复操作仅使用异常中已校验的相对路径。"
          type="info"
          showIcon
          style={{ marginBottom: 0 }}
        />
        <div className="file-reconcile-summary">
          {[
            ['待处理', 'openCount', 'danger', '需要确认或修复的异常'],
            ['严重异常', 'criticalCount', 'critical', '文件缺失、错位或内容不一致'],
            ['警告异常', 'warningCount', 'warning', '孤立文件或回收状态异常'],
            ['隔离文件', 'quarantinedCount', 'quarantine', '仅管理员可恢复或永久删除'],
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
            <div className="summary-card__label">最近任务</div>
            <div className="summary-card__status">
              <FileTag type={runStatusType(stats.latestRun?.status)}>
                {runStatusLabel(stats.latestRun?.status)}
              </FileTag>
            </div>
            <div className="summary-card__hint">
              {stats.latestRun ? parseTime(stats.latestRun.startedTime) : '尚未执行'}
            </div>
          </div>
        </div>
        <div className="file-reconcile-toolbar">
          <div className="reconcile-toolbar__tip">
            完整摘要校验会读取全部文件内容，建议在低峰期启用。
          </div>
          <Space>
            <span>校验 SHA-256</span>
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
                  message.success('文件存储对账任务已启动')
                  load()
                } catch {
                } finally {
                  setScanning(false)
                }
              }}
            >
              开始对账
            </Button>
          </Space>
        </div>
        <Tabs
          items={[
            {
              key: 'issues',
              label: '异常明细',
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
                      label="关键字"
                      name="keyword"
                    >
                      <Input
                        style={{ width: 200 }}
                        allowClear
                        placeholder="文件名、ID或相对路径"
                      />
                    </Form.Item>
                    <Form.Item
                      name="issueType"
                      label="异常类型"
                    >
                      <Select
                        placeholder="全部类型"
                        allowClear
                        style={{ width: 200 }}
                        options={issueTypeOptions}
                      />
                    </Form.Item>
                    <Form.Item
                      name="severity"
                      label="严重级别"
                    >
                      <Select
                        placeholder="全部级别"
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
                      label="处理状态"
                    >
                      <Select
                        placeholder="全部状态"
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
                          搜索
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
                          重置
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
              label: '任务记录',
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
              label="原始文件名"
              rules={[{ required: true, whitespace: true }]}
            >
              <Input
                maxLength={255}
                placeholder="需与物理文件扩展名一致"
              />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label="处理原因"
            rules={[{ required: true, whitespace: true, message: '处理原因不能为空' }]}
          >
            <Input.TextArea
              placeholder="请填写处理依据，内容会保留在对账记录中"
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
