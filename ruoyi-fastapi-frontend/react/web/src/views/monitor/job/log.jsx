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
  const [form] = Form.useForm(),
    navigate = useNavigate(),
    location = useLocation(),
    { sys_common_status } = useDict('sys_common_status')
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
        all ? '是否确认清空所有调度日志？' : `是否确认删除选中的 ${ids.length} 条日志？`
      )
      await (all ? cleanJobLog() : delJobLog(ids))
      message.success(all ? '清空成功' : '删除成功')
      await getList()
    } catch {}
  }
  const columns = [
    ...[
      ['jobLogId', '日志编号'],
      ['jobId', '任务编号'],
      ['jobName', '任务名称'],
      ['jobGroup', '业务分组'],
      ['invokeTarget', '调用目标字符串'],
      ['jobMessage', '日志信息'],
    ].map(([dataIndex, title]) => ({ align: 'center', dataIndex, title, ellipsis: true })),
    {
      align: 'center',
      title: '执行状态',
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
      title: '执行时间',
      dataIndex: 'createTime',
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 80,
      render: (_, row) => (
        <HasPermi value={['monitor:job:query']}>
          <TableAction
            symbol="View"
            onClick={() => setDetail(row)}
          >
            详细
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
            ['jobName', '任务名称', '请输入任务名称'],
            ['jobGroup', '业务分组', '请输入业务分组'],
            ['executionId', '执行编号', '精确匹配执行ID'],
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
            label="任务编号"
            name="jobId"
          >
            <InputNumber
              placeholder="精确匹配任务ID"
              min={1}
              precision={0}
            />
          </Form.Item>
          <Form.Item
            label="执行状态"
            name="status"
          >
            <Select
              style={{ width: 240 }}
              placeholder="请选择执行状态"
              allowClear
              options={sys_common_status}
            />
          </Form.Item>
          <Form.Item
            label="执行时间"
            name="dateRange"
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                icon={<SearchOutlined />}
                type="primary"
                htmlType="submit"
              >
                搜索
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  form.resetFields()
                  search({})
                }}
              >
                重置
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
            删除
          </Button>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            onClick={() => remove(true)}
          >
            清空
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
            导出
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
          关闭
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
