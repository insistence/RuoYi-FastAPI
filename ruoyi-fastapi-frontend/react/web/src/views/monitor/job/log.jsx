import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { TableAction } from '@/components/TableActions'
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, Select, Space } from 'antd'
import Table from '@/components/Table'
import { useLocation, useNavigate } from 'react-router-dom'
import { listJobLog, delJobLog, cleanJobLog } from '@/api/monitor/jobLog'
import { useDict } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { confirm, message } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import useTagsViewStore from '@/store/modules/tagsView'
import Detail from './detail'

export default function JobLog({ params }) {
  useI18n()

  const [form] = Form.useForm(),
    navigate = useNavigate(),
    location = useLocation(),
    { sys_common_status } = useDict('sys_common_status')
  useLocalizedFormErrors(form)
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [ids, setIds] = useState([]),
    [showSearch, setShowSearch] = useState(true),
    [detail, setDetail] = useState(null)
  const jobId = params.jobId && params.jobId !== '0' ? Number(params.jobId) : undefined,
    executionId = new URLSearchParams(location.search).get('executionId') || undefined
  useEffect(() => {
    form.resetFields()
    form.setFieldsValue({ jobId, executionId })
    setQuery({ pageNum: 1, pageSize: 10, jobId, executionId })
  }, [form, jobId, executionId])
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listJobLog(query)
      setRows(result.rows || [])
      setTotal(result.total)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  function search({ dateRange, ...values }) {
    setQuery({
      ...values,
      jobId: values.jobId || undefined,
      executionId: values.executionId || undefined,
      pageNum: 1,
      pageSize: query.pageSize,
      beginTime: dateRange?.[0]?.format('YYYY-MM-DD'),
      endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
    })
  }
  async function remove(all) {
    try {
      await confirm(
        all
          ? t('monitor:clearAllJobLogs')
          : t('monitor:deleteTheValueSelectedLogs', { length: ids.length })
      )
      await (all ? cleanJobLog() : delJobLog(ids))
      message.success(all ? t('common:clearSuccess') : t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  const columns = [
    ...[
      ['jobLogId', t('monitor:log.id')],
      ['jobId', t('monitor:job.id')],
      ['jobName', t('monitor:job.name')],
      ['jobGroup', t('monitor:businessGroup')],
      ['invokeTarget', t('monitor:callTarget')],
      ['jobMessage', t('monitor:logInformation')],
    ].map(([dataIndex, title]) => ({ align: 'center', dataIndex, title, ellipsis: true })),
    {
      align: 'center',
      title: t('monitor:job.executionStatus'),
      dataIndex: 'status',
      render: (value) => (
        <DictTag
          value={value}
          options={sys_common_status}
        />
      ),
    },
    {
      align: 'center',
      title: t('monitor:executionTime'),
      dataIndex: 'createTime',
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 80,
      render: (_, row) => (
        <HasPermi value={['monitor:job:query']}>
          <TableAction
            symbol="View"
            onClick={() => setDetail(row)}
          >
            {t('common:detail')}
          </TableAction>
        </HasPermi>
      ),
    },
  ]
  return (
    <div className="app-container">
      {showSearch && (
        <Form
          form={form}
          layout="inline"
          className="search-form"
          onFinish={search}
        >
          {[
            ['jobName', t('monitor:job.name'), t('monitor:job.namePlaceholder')],
            ['jobGroup', t('monitor:businessGroup'), t('monitor:enterBusinessGroup')],
            ['executionId', t('monitor:executionId'), t('monitor:exactExecutionId')],
          ].map(([name, label, placeholder]) => (
            <Form.Item
              key={name}
              name={name}
              label={label}
            >
              <Input
                placeholder={placeholder}
                allowClear
              />
            </Form.Item>
          ))}
          <Form.Item
            label={t('monitor:job.id')}
            name="jobId"
          >
            <InputNumber
              placeholder={t('monitor:exactTaskId')}
              min={1}
              precision={0}
            />
          </Form.Item>
          <Form.Item
            label={t('monitor:job.executionStatus')}
            name="status"
          >
            <Select
              style={{ width: 240 }}
              placeholder={t('monitor:selectExecutionStatus')}
              allowClear
              options={sys_common_status}
            />
          </Form.Item>
          <Form.Item
            label={t('monitor:executionTime')}
            name="dateRange"
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              placeholder={[t('common:startDate'), t('common:endDate')]}
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
                  search({})
                }}
              >
                {t('common:reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={['monitor:job:remove']}>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            disabled={!ids.length}
            onClick={() => remove(false)}
          >
            {t('common:delete')}
          </Button>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            onClick={() => remove(true)}
          >
            {t('common:clear')}
          </Button>
        </HasPermi>
        <HasPermi value={['monitor:job:export']}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download('/monitor/jobLog/export', query, `job_log_${Date.now()}.xlsx`).catch(
                () => {}
              )
            }
          >
            {t('common:export')}
          </Button>
        </HasPermi>
        <Button
          icon={<CloseOutlined />}
          className="ruoyi-plain-button ruoyi-plain-button--warning"
          onClick={() => {
            useTagsViewStore.getState().closeView(location.pathname)
            navigate('/monitor/job')
          }}
        >
          {t('layout:search.close')}
        </Button>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="jobLogId"
        loading={loading}
        dataSource={rows}
        columns={columns}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
        scroll={{ x: 1250 }}
        pagination={false}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Detail
        type="log"
        open={!!detail}
        row={detail || {}}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}
