import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UnorderedListOutlined,
  ProfileOutlined,
  QuestionCircleFilled,
} from '@ant-design/icons'
import './style.css'
import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tooltip,
} from 'antd'
import Table from '@/components/Table'
import { useNavigate } from 'react-router-dom'
import {
  listJob,
  getJob,
  addJob,
  updateJob,
  delJob,
  runJob,
  changeJobStatus,
} from '@/api/monitor/job'
import { useDict } from '@/utils/dict'
import { buildJobPayload, parseJobParameter, syncStates, notifyJobMutation } from '@/utils/job'
import { checkPermi } from '@/utils/permission'
import { download } from '@/utils/request'
import useUserStore from '@/store/modules/user'
import modal, { confirm, message } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import JsonEditor from '@/components/JsonEditor'
import Crontab from '@/components/Crontab'
import Detail from './detail'
import Runtime, { StateTag } from './runtime'

export default function Job() {
  useI18n()

  const [zoneSearch, setZoneSearch] = useState('')
  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    navigate = useNavigate(),
    appTimezone = useUserStore((state) => state.appTimezone)
  useLocalizedFormErrors(queryForm, form)
  const { sys_job_status, sys_job_executor, sys_job_store } = useDict(
    'sys_job_status',
    'sys_job_executor',
    'sys_job_store'
  )
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [ids, setIds] = useState([]),
    [showSearch, setShowSearch] = useState(true)
  const [open, setOpen] = useState(false),
    [editingId, setEditingId] = useState(),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState({}),
    [detail, setDetail] = useState(null),
    [runtime, setRuntime] = useState(null),
    [cron, setCron] = useState(false)
  const grace = Form.useWatch('misfireGraceTime', form),
    timezone = Form.useWatch('timeZone', form)
  const timezones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [appTimezone]
  function refresh() {
    setRevision((value) => value + 1)
  }
  useEffect(() => {
    let disposed = false,
      timer,
      controller,
      version = 0
    async function load(silent = false) {
      clearTimeout(timer)
      controller?.abort()
      controller = new AbortController()
      const current = ++version
      if (!silent) setLoading(true)
      let needsRefresh = false
      try {
        const result = await listJob(query, {
          signal: controller.signal,
          skipErrorMessage: silent,
        })
        if (disposed || current !== version) return
        setRows(result.rows || [])
        setTotal(result.total)
        needsRefresh = result.rows.some((row) => ['pending', 'failed'].includes(row.syncStatus))
      } catch {
      } finally {
        if (!disposed && current === version) {
          setLoading(false)
          if (needsRefresh && !document.hidden) timer = setTimeout(() => load(true), 3000)
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
    setIds([])
    void load()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [query, revision])
  function showRuntime(tab, row, executionId) {
    if (checkPermi(['monitor:job:query']))
      setRuntime({ initialTab: tab, jobId: row?.jobId, executionId })
  }
  function mutation(result) {
    notifyJobMutation(modal, result)
    if (result.data?.syncStatus === 'failed')
      showRuntime('sync', result.data.jobs?.length === 1 ? result.data.jobs[0] : undefined)
    refresh()
  }
  function add() {
    setEditingId(undefined)
    form.resetFields()
    form.setFieldsValue({
      jobGroup: 'default',
      jobStore: 'default',
      jobExecutor: 'default',
      jobArgs: '[]',
      jobKwargs: '{}',
      timeZone: appTimezone,
      misfireGraceTime: 1,
      coalesce: false,
      maxInstances: 1,
      status: '1',
    })
    setOpen(true)
  }
  async function edit(id) {
    try {
      const result = await getJob(id)
      setEditingId(id)
      form.resetFields()
      form.setFieldsValue({
        ...result.data,
        jobArgs: JSON.stringify(result.data.jobArgs ?? [], null, 2),
        jobKwargs: JSON.stringify(result.data.jobKwargs ?? {}, null, 2),
      })
      setOpen(true)
    } catch {}
  }
  async function save() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const result = await (editingId !== undefined ? updateJob : addJob)(
        buildJobPayload({
          ...values,
          ...(editingId !== undefined ? { jobId: editingId } : {}),
        })
      )
      setOpen(false)
      mutation(result)
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function remove(values) {
    try {
      await confirm(t('monitor:deleteJobsWithIdsValue', { values }))
      mutation(await delJob(values))
    } catch {}
  }
  async function status(row, checked) {
    setBusy((previous) => ({ ...previous, [`status-${row.jobId}`]: true }))
    try {
      await confirm(
        t('monitor:valueJobValue', {
          arg0: checked ? t('common:enable') : t('monitor:pause'),
          jobName: row.jobName,
        })
      )
      mutation(await changeJobStatus(row.jobId, checked ? '0' : '1'))
    } catch {
    } finally {
      setBusy((previous) => ({ ...previous, [`status-${row.jobId}`]: false }))
    }
  }
  async function run(row) {
    setBusy((previous) => ({ ...previous, [`run-${row.jobId}`]: true }))
    try {
      await confirm(t('monitor:runJobValueOnceNow', { jobName: row.jobName }))
      const result = await runJob(row.jobId)
      message.info(result.msg)
      showRuntime('executions', row, result.data?.executionId)
    } catch {
    } finally {
      setBusy((previous) => ({ ...previous, [`run-${row.jobId}`]: false }))
    }
  }
  async function view(row) {
    try {
      setDetail((await getJob(row.jobId)).data)
    } catch {}
  }
  const columns = [
    { align: 'center', title: t('monitor:job.id'), dataIndex: 'jobId', width: 100 },
    {
      align: 'center',
      title: t('monitor:job.name'),
      dataIndex: 'jobName',
      width: 160,
      render: (value, row) => (
        <Button
          type="link"
          onClick={() => view(row)}
          disabled={!checkPermi(['monitor:job:query'])}
        >
          {value}
        </Button>
      ),
    },
    ...[
      ['jobGroup', t('monitor:businessGroup')],
      ['invokeTarget', t('monitor:callTarget')],
      ['cronExpression', t('monitor:job.cronExpression')],
      ['timeZone', t('monitor:job.timezone')],
    ].map(([dataIndex, title]) => ({
      align: 'center',
      dataIndex,
      title,
      ellipsis: true,
      width: 180,
    })),
    {
      align: 'center',
      title: t('monitor:schedulerSynchronization'),
      dataIndex: 'syncStatus',
      width: 115,
      render: (value, row) => (
        <Tooltip title={row.syncError}>
          <Button
            type="text"
            onClick={() => showRuntime('sync', row)}
          >
            <StateTag
              value={value}
              states={syncStates}
            />
          </Button>
        </Tooltip>
      ),
    },
    {
      align: 'center',
      title: t('common:status'),
      width: 85,
      render: (_, row) => (
        <Switch
          checked={row.status === '0'}
          aria-label={t('monitor:enabledStatusOfJobValue', { jobName: row.jobName })}
          disabled={!checkPermi(['monitor:job:changeStatus'])}
          loading={busy[`status-${row.jobId}`]}
          onChange={(checked) => status(row, checked)}
        />
      ),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      fixed: 'right',
      width: 200,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['monitor:job:edit']}>
            <TableAction
              iconOnly={true}
              symbol="Edit"
              onClick={() => edit(row.jobId)}
            >
              {t('common:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['monitor:job:remove']}>
            <TableAction
              iconOnly={true}
              symbol="Delete"
              onClick={() => remove([row.jobId])}
            >
              {t('common:delete')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['monitor:job:changeStatus']}>
            <TableAction
              iconOnly={true}
              symbol="CaretRight"
              loading={busy[`run-${row.jobId}`]}
              onClick={() => run(row)}
            >
              {t('common:runOnce')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['monitor:job:query']}>
            <TableAction
              iconOnly={true}
              symbol="Operation"
              onClick={() => navigate(`/monitor/job-log/index/${row.jobId}`)}
            >
              {t('layout:route.jobLog')}
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ]
  return (
    <div className="app-container job-page">
      {showSearch && (
        <Form
          form={queryForm}
          layout="inline"
          className="search-form"
          onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
        >
          <Form.Item
            label={t('monitor:job.name')}
            name="jobName"
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('monitor:job.namePlaceholder')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('monitor:businessGroup')}
            name="jobGroup"
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('monitor:enterBusinessGroup')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('monitor:taskStatus')}
            name="status"
          >
            <Select
              style={{ width: 200 }}
              placeholder={t('monitor:selectTaskStatus')}
              allowClear
              options={sys_job_status}
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
                  queryForm.resetFields()
                  setQuery({ pageNum: 1, pageSize: 10 })
                }}
              >
                {t('common:reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={['monitor:job:add']}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={add}
          >
            {t('common:add')}
          </Button>
        </HasPermi>
        <HasPermi value={['monitor:job:edit']}>
          <Button
            icon={<EditOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--success"
            type="default"
            disabled={ids.length !== 1}
            onClick={() => edit(ids[0])}
          >
            {t('common:edit')}
          </Button>
        </HasPermi>
        <HasPermi value={['monitor:job:remove']}>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            disabled={!ids.length}
            onClick={() => remove(ids)}
          >
            {t('common:delete')}
          </Button>
        </HasPermi>
        <HasPermi value={['monitor:job:export']}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download('/monitor/job/export', query, `job_${Date.now()}.xlsx`).catch(() => {})
            }
          >
            {t('common:export')}
          </Button>
        </HasPermi>
        <HasPermi value={['monitor:job:query']}>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--info"
            icon={<UnorderedListOutlined />}
            onClick={() => navigate('/monitor/job-log/index/0')}
          >
            {t('monitor:logs')}
          </Button>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--info"
            icon={<ProfileOutlined />}
            onClick={() => showRuntime('executions')}
          >
            {t('monitor:executionHistory')}
          </Button>
        </HasPermi>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={refresh}
        />
      </div>
      <Table
        rowKey="jobId"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1450 }}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        footer={renderDialogFooter}
        className="job-dialog"
        title={editingId !== undefined ? t('monitor:editTask') : t('monitor:addTask')}
        open={open}
        width="820px"
        onCancel={() => setOpen(false)}
        onOk={save}
        confirmLoading={saving}
        closable={!saving}
        keyboard={!saving}
        maskClosable={!saving}
        forceRender
      >
        <Form
          name="src-views-monitor-job-index-jsx-editor-2"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '120px' }}
          form={form}
          layout="horizontal"
        >
          <Form.Item
            label={t('monitor:job.name')}
            name="jobName"
            rules={[{ required: true, whitespace: true, message: t('monitor:taskNameIsRequired') }]}
          >
            <Input
              placeholder={t('monitor:namesMustBeUniqueWithinABusinessGroup')}
              maxLength={64}
            />
          </Form.Item>
          <Row>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                label={t('monitor:businessGroup')}
                name="jobGroup"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t('monitor:businessGroupIsRequired'),
                  },
                ]}
              >
                <Input
                  placeholder={t('monitor:forExampleDefaultReportsFileMaintenance')}
                  maxLength={64}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                label={
                  <span>
                    {t('monitor:job.executor')}{' '}
                    <Tooltip title={t('monitor:thisOptionHasNoEffectForAsynchronousFunctions')}>
                      <QuestionCircleFilled />
                    </Tooltip>
                  </span>
                }
                name="jobExecutor"
              >
                <Select
                  placeholder={t('monitor:selectTaskExecutor')}
                  options={sys_job_executor}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label={t('monitor:job.store')}
            name="jobStore"
            rules={[{ required: true }]}
            extra={t('monitor:theMemoryStoreRebuildsSchedulesAfterARestartDatabaseAnd')}
          >
            <Select
              placeholder={t('monitor:selectJobStore')}
              options={sys_job_store}
            />
          </Form.Item>
          <Form.Item
            label={
              <span>
                {t('monitor:callMethod')}{' '}
                <Tooltip title={t('monitor:exampleModuleTaskSchedulerTestJob')}>
                  <QuestionCircleFilled />
                </Tooltip>
              </span>
            }
            name="invokeTarget"
            rules={[{ required: true, message: t('monitor:invocationTargetIsRequired') }]}
          >
            <Input placeholder={t('monitor:enterCallTarget')} />
          </Form.Item>
          {[
            ['jobArgs', t('monitor:job.args')],
            ['jobKwargs', t('monitor:job.kwargs')],
          ].map(([name, label]) => (
            <Form.Item
              key={name}
              label={label}
              name={name}
              extra={
                name === 'jobArgs'
                  ? t('monitor:useForNoArgumentsArraysMayContainStringsNumbers')
                  : t('monitor:useForNoArgumentsPropertyNamesMustMatchThe')
              }
              rules={[
                {
                  validator: (_, value) => {
                    try {
                      parseJobParameter(value, name)
                      return Promise.resolve()
                    } catch (error) {
                      return Promise.reject(error)
                    }
                  },
                },
              ]}
            >
              <JsonEditor
                aria-label={label}
                valueType={name === 'jobArgs' ? 'array' : 'object'}
                validate={(value) => parseJobParameter(value, name)}
              />
            </Form.Item>
          ))}
          <Form.Item
            label={t('monitor:job.cronExpressionLabel')}
            required
          >
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="cronExpression"
                noStyle
                rules={[{ required: true, message: t('monitor:cronExpressionIsRequired') }]}
              >
                <Input placeholder={t('monitor:enterCronExpression')} />
              </Form.Item>
              <Button onClick={() => setCron(true)}>{t('monitor:generateExpression')}</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            label={t('monitor:job.timezone')}
            name="timeZone"
            rules={[{ required: true }]}
          >
            <Select
              placeholder={t('monitor:selectAnIanaTimeZone')}
              showSearch
              onSearch={setZoneSearch}
              options={[
                ...new Set([appTimezone, ...timezones, timezone, zoneSearch].filter(Boolean)),
              ].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
          {editingId !== undefined && (
            <Form.Item
              label={t('common:status')}
              name="status"
            >
              <Radio.Group options={sys_job_status} />
            </Form.Item>
          )}
          <Form.Item
            label={t('monitor:allowedDelay')}
            extra={t('monitor:measuredFromTheScheduledTimeRunsBeyondTheGracePeriod')}
          >
            <Space size={10}>
              <Form.Item
                noStyle
                name="misfireGraceTime"
                rules={[
                  {
                    validator: (_, value) =>
                      value === null ||
                      (Number.isInteger(value) && value >= 1 && value <= 2147483647)
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(t('monitor:allowedDelayMustBeAPositiveInteger'))
                          ),
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  max={2147483647}
                  precision={0}
                  aria-label={t('monitor:allowedDelayInSeconds')}
                  style={{ width: 150, display: grace === null ? 'none' : undefined }}
                />
              </Form.Item>
              {grace !== null && <span className="field-unit">{t('common:seconds')}</span>}
              <Switch
                aria-label={t('monitor:allowUnlimitedDelay')}
                checked={grace === null}
                onChange={(checked) => form.setFieldValue('misfireGraceTime', checked ? null : 1)}
              />
              <span>{t('monitor:unlimitedDelay')}</span>
            </Space>
          </Form.Item>
          <Form.Item
            label={t('monitor:missedRuns')}
            name="coalesce"
            extra={t('monitor:usedWhenMultipleDueRunsAreFoundInOneCheck')}
          >
            <Radio.Group
              optionType="button"
              options={[
                { label: t('monitor:runEachOccurrence'), value: false },
                { label: t('monitor:runOnlyTheLatestOccurrence'), value: true },
              ]}
            />
          </Form.Item>
          <Form.Item
            label={t('monitor:maximumConcurrency')}
            name="maxInstances"
            rules={[{ required: true, type: 'number', min: 1 }]}
            extra={t('monitor:scheduledAndManualRunsShareThisLimitExcessRunsAre')}
          >
            <InputNumber
              min={1}
              max={2147483647}
              precision={0}
              style={{ width: 150 }}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        className="cron-dialog"
        rootClassName="cron-dialog-root"
        title={t('monitor:cronExpressionGenerator')}
        open={cron}
        onCancel={() => setCron(false)}
        footer={null}
        width="50%"
        destroyOnHidden
      >
        {cron && (
          <Crontab
            expression={form.getFieldValue('cronExpression')}
            timeZone={timezone || appTimezone}
            onFill={(value) => form.setFieldValue('cronExpression', value)}
            onHide={() => setCron(false)}
          />
        )}
      </Modal>
      <Detail
        open={!!detail}
        row={detail || {}}
        onClose={() => setDetail(null)}
      />
      <Runtime
        open={!!runtime}
        {...runtime}
        onClose={() => setRuntime(null)}
        onSyncUpdated={refresh}
      />
    </div>
  )
}
