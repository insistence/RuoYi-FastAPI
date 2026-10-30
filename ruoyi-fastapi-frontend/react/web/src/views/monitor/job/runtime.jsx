import { useLocalizedText } from '@/i18n/form'
import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

  const state = states[value]
  return (
    <Tag color={colors[state?.type]}>
      {state?.label || value || t('common:pendingSynchronization')}
    </Tag>
  )
}
export default function JobRuntime({
  open,
  initialTab = 'executions',
  jobId,
  executionId,
  onClose,
  onSyncUpdated,
}) {
  useI18n()

  const [form] = Form.useForm(),
    [tab, setTab] = useState(initialTab),
    [query, setQuery] = useState({
      pageNum: 1,
      pageSize: 10,
      jobId,
      executionId,
    }),
    [revision, setRevision] = useState(0)
  useLocalizedFormErrors(form)
  const [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useLocalizedText(''),
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
        setError((t) => t('monitor:couldNotLoadRecordsRefreshAndTryAgain'))
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
    { title: t('monitor:job.id'), dataIndex: 'jobId', width: 95 },
    { width: 150, title: t('monitor:job.name'), dataIndex: 'jobName', ellipsis: true },
    {
      title: t('common:source'),
      dataIndex: 'source',
      width: 75,
      render: (value) => (value === 'manual' ? t('monitor:manual') : t('monitor:scheduled')),
    },
    {
      title: t('monitor:job.executionStatus'),
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
      title: t('monitor:submittedAt'),
      dataIndex: 'createTime',
      width: 175,
      render: (value) => parseTime(value),
    },
    {
      title: t('monitor:job.duration'),
      dataIndex: 'runDurationMs',
      width: 105,
      render: (value) => (value == null ? '—' : t('monitor:job.valueMs', { value })),
    },
    { width: 230, title: t('monitor:executionResult'), dataIndex: 'message', ellipsis: true },
  ]
  const syncColumns = [
    { title: t('monitor:job.id'), dataIndex: 'jobId', width: 95 },
    {
      width: 100,
      title: t('monitor:configurationType'),
      dataIndex: 'deleted',
      render: (value) => (value ? t('monitor:deleteRecord') : t('monitor:taskConfiguration')),
    },
    { width: 95, title: t('monitor:latestVersion'), dataIndex: 'configVersion' },
    { width: 105, title: t('monitor:appliedVersion'), dataIndex: 'appliedVersion' },
    {
      width: 115,
      title: t('common:syncStatus'),
      dataIndex: 'syncStatus',
      render: (value) => (
        <StateTag
          value={value}
          states={syncStates}
        />
      ),
    },
    {
      title: t('monitor:lastAppliedAt'),
      dataIndex: 'appliedTime',
      width: 175,
      render: (value) => parseTime(value),
    },
    {
      width: 240,
      title: t('monitor:synchronizationError'),
      dataIndex: 'syncError',
      ellipsis: true,
    },
    {
      className: 'ruoyi-actions-cell',
      title: t('common:actions'),
      width: 100,
      render: (_, row) =>
        row.syncStatus !== 'applied' && (
          <HasPermi value={['monitor:job:edit']}>
            <TableAction
              loading={retrying === row.jobId}
              disabled={retrying !== null && retrying !== row.jobId}
              onClick={() => retry(row)}
            >
              {t('monitor:retrySynchronization')}
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
      title={t('monitor:taskExecutionHistory')}
      open={open}
      width="min(1140px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('layout:search.close')}</Button>}
    >
      <Tabs
        activeKey={tab}
        onChange={(value) => {
          setTab(value)
          setRows([])
          setQuery({ ...query, pageNum: 1 })
        }}
        items={[
          { key: 'executions', label: t('monitor:job.history') },
          { key: 'sync', label: t('common:syncStatus') },
        ]}
      />
      <Form
        form={form}
        layout="inline"
        className="search-form"
        onFinish={(values) => setQuery({ ...query, jobId: values.jobId || undefined, pageNum: 1 })}
      >
        <Form.Item
          label={t('monitor:job.id')}
          name="jobId"
        >
          <InputNumber
            min={1}
            precision={0}
            placeholder={t('monitor:allTasks')}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              htmlType="submit"
              type="primary"
            >
              {t('monitor:search')}
            </Button>
            <Button onClick={() => setRevision((value) => value + 1)}>
              {t('layout:tags.refresh')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
      {query.executionId && tab === 'executions' && (
        <p>
          {t('monitor:currentExecutionId')}
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
            {t('monitor:viewAllExecutionsOfThisTask')}
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
        {loading
          ? t('monitor:loadingRecords')
          : t('monitor:valueRecordsInTotalValueOnThisPageAre', { total, processing })}
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
                      { key: 'id', label: t('monitor:job.executionId'), children: row.executionId },
                      {
                        key: 'message',
                        label: t('monitor:fullResult'),
                        children: row.message || t('monitor:noExecutionResultsYet'),
                      },
                      {
                        key: 'user',
                        label: t('monitor:submittedBy'),
                        children: row.requestedBy || t('monitor:systemScheduler'),
                      },
                      {
                        key: 'scheduled',
                        label: t('monitor:scheduledTime'),
                        children: parseTime(row.scheduledTime) || t('common:waitingForDispatch'),
                      },
                      {
                        key: 'end',
                        label: t('common:endTime'),
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
