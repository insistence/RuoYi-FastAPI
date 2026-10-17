import { TableAction } from '@/components/TableActions'
import './style.css'
import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Form,
  InputNumber,
  Modal,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import Table from '@/components/Table'
import { listJobExecutions, listJobSync, retryJobSync } from '@/api/monitor/job'
import { executionStates, syncStates, notifyJobMutation } from '@/utils/job'
import { parseTime } from '@/utils/ruoyi'
import modal from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'

const colors = {
  warning: 'warning',
  success: 'success',
  danger: 'error',
  info: 'default',
  primary: 'processing',
}
export function StateTag({ value, states }) {
  const state = states[value]
  return <Tag color={colors[state?.type]}>{state?.label || value || '待同步'}</Tag>
}
export default function JobRuntime({
  open,
  initialTab = 'executions',
  jobId,
  executionId,
  onClose,
  onSyncUpdated,
}) {
  const [form] = Form.useForm(),
    [tab, setTab] = useState(initialTab),
    [query, setQuery] = useState({
      pageNum: 1,
      pageSize: 10,
      jobId,
      executionId,
    }),
    [revision, setRevision] = useState(0)
  const [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [retrying, setRetrying] = useState(null)
  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setQuery({ pageNum: 1, pageSize: 10, jobId, executionId })
      form.setFieldsValue({ jobId })
      setRows([])
      setError('')
    }
  }, [open, initialTab, jobId, executionId, form])
  useEffect(() => {
    if (!open) return
    let timer,
      controller,
      disposed = false,
      version = 0
    async function load(silent = false) {
      clearTimeout(timer)
      controller?.abort()
      controller = new AbortController()
      const current = ++version
      if (!silent) setLoading(true)
      let needsRefresh = false
      try {
        const result = await (tab === 'executions' ? listJobExecutions : listJobSync)(
          {
            ...query,
            executionId: tab === 'executions' ? query.executionId : undefined,
          },
          { signal: controller.signal, skipErrorMessage: true }
        )
        if (disposed || current !== version) return
        setRows(result.rows || [])
        setTotal(result.total)
        setError('')
        needsRefresh = result.rows.some((row) =>
          tab === 'executions'
            ? ['pending', 'submitted', 'running'].includes(row.status)
            : ['pending', 'failed'].includes(row.syncStatus)
        )
      } catch (err) {
        if (disposed || current !== version || err.code === 'ERR_CANCELED') return
        setError('获取记录失败，请刷新重试。')
        needsRefresh = true
      } finally {
        if (!disposed && current === version) {
          setLoading(false)
          if (!document.hidden && needsRefresh) timer = setTimeout(() => load(true), 3000)
        }
      }
    }
    function visibility() {
      if (document.hidden) {
        version++
        clearTimeout(timer)
        controller?.abort()
        setLoading(false)
      } else void load(true)
    }
    void load()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [open, query, tab, revision])
  async function retry(row) {
    setRetrying(row.jobId)
    try {
      notifyJobMutation(modal, await retryJobSync(row.jobId))
      onSyncUpdated?.()
      setRevision((value) => value + 1)
    } catch {
    } finally {
      setRetrying(null)
    }
  }
  const executionColumns = [
    { title: '任务编号', dataIndex: 'jobId', width: 95 },
    { width: 150, title: '任务名称', dataIndex: 'jobName', ellipsis: true },
    {
      title: '来源',
      dataIndex: 'source',
      width: 75,
      render: (value) => (value === 'manual' ? '手动' : '定时'),
    },
    {
      title: '执行状态',
      dataIndex: 'status',
      width: 140,
      render: (value) => (
        <StateTag
          value={value}
          states={executionStates}
        />
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'createTime',
      width: 175,
      render: (value) => parseTime(value),
    },
    {
      title: '耗时',
      dataIndex: 'runDurationMs',
      width: 105,
      render: (value) => (value == null ? '—' : `${value} 毫秒`),
    },
    { width: 230, title: '执行结果', dataIndex: 'message', ellipsis: true },
  ]
  const syncColumns = [
    { title: '任务编号', dataIndex: 'jobId', width: 95 },
    {
      width: 100,
      title: '配置类型',
      dataIndex: 'deleted',
      render: (value) => (value ? '删除记录' : '任务配置'),
    },
    { width: 95, title: '最新版本', dataIndex: 'configVersion' },
    { width: 105, title: '已应用版本', dataIndex: 'appliedVersion' },
    {
      width: 115,
      title: '同步状态',
      dataIndex: 'syncStatus',
      render: (value) => (
        <StateTag
          value={value}
          states={syncStates}
        />
      ),
    },
    {
      title: '最近生效时间',
      dataIndex: 'appliedTime',
      width: 175,
      render: (value) => parseTime(value),
    },
    { width: 240, title: '同步错误', dataIndex: 'syncError', ellipsis: true },
    {
      className: 'ruoyi-actions-cell',
      title: '操作',
      width: 100,
      render: (_, row) =>
        row.syncStatus !== 'applied' && (
          <HasPermi value={['monitor:job:edit']}>
            <TableAction
              loading={retrying === row.jobId}
              disabled={retrying !== null && retrying !== row.jobId}
              onClick={() => retry(row)}
            >
              重试同步
            </TableAction>
          </HasPermi>
        ),
    },
  ]
  const processing = rows.filter((row) =>
    tab === 'executions'
      ? ['pending', 'submitted', 'running'].includes(row.status)
      : row.syncStatus === 'pending'
  ).length
  return (
    <Modal
      className="job-dialog"
      title="任务运行记录"
      open={open}
      width="min(1140px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <Tabs
        activeKey={tab}
        onChange={(value) => {
          setTab(value)
          setRows([])
          setQuery({ ...query, pageNum: 1 })
        }}
        items={[
          { key: 'executions', label: '执行记录' },
          { key: 'sync', label: '同步状态' },
        ]}
      />
      <Form
        form={form}
        layout="inline"
        className="search-form"
        onFinish={(values) => setQuery({ ...query, jobId: values.jobId || undefined, pageNum: 1 })}
      >
        <Form.Item
          label="任务编号"
          name="jobId"
        >
          <InputNumber
            min={1}
            precision={0}
            placeholder="全部任务"
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              htmlType="submit"
              type="primary"
            >
              查询
            </Button>
            <Button onClick={() => setRevision((value) => value + 1)}>刷新</Button>
          </Space>
        </Form.Item>
      </Form>
      {query.executionId && tab === 'executions' && (
        <p>
          本次执行 ID：
          <Typography.Text
            code
            copyable
          >
            {query.executionId}
          </Typography.Text>
          <Button
            type="link"
            onClick={() => setQuery({ ...query, pageNum: 1, executionId: undefined })}
          >
            查看该任务全部记录
          </Button>
        </p>
      )}
      {error && (
        <Alert
          type="error"
          title={error}
        />
      )}
      <p
        role="status"
        aria-live="polite"
      >
        {loading ? '正在获取记录…' : `共 ${total} 条记录，当前页 ${processing} 条处理中`}
      </p>
      <Table
        loading={loading}
        rowKey={tab === 'executions' ? 'executionId' : 'jobId'}
        dataSource={rows}
        columns={tab === 'executions' ? executionColumns : syncColumns}
        pagination={false}
        scroll={{ x: 1000, y: 460 }}
        expandable={
          tab === 'executions'
            ? {
                expandedRowRender: (row) => (
                  <Descriptions
                    column={1}
                    items={[
                      { key: 'id', label: '执行ID', children: row.executionId },
                      {
                        key: 'message',
                        label: '完整结果',
                        children: row.message || '尚无执行结果',
                      },
                      {
                        key: 'user',
                        label: '提交者',
                        children: row.requestedBy || '系统调度',
                      },
                      {
                        key: 'scheduled',
                        label: '计划时间',
                        children: parseTime(row.scheduledTime) || '等待派发',
                      },
                      {
                        key: 'end',
                        label: '结束时间',
                        children: parseTime(row.endTime) || '—',
                      },
                    ]}
                  />
                ),
              }
            : undefined
        }
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
    </Modal>
  )
}
