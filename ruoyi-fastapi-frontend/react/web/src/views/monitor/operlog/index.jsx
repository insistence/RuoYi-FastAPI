import { TableAction } from '@/components/TableActions'
import { SearchOutlined, ReloadOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Select, Space } from 'antd'
import Table from '@/components/Table'
import { list, delOperlog, cleanOperlog } from '@/api/monitor/operlog'
import { useDict } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { getDisplayTimezone } from '@/utils/time'
import { confirm, message } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import Detail from './detail'

const initial = {
  pageNum: 1,
  pageSize: 10,
  orderByColumn: 'operTime',
  isAsc: 'descending',
}
export default function Operlog() {
  const [form] = Form.useForm(),
    { sys_oper_type, sys_common_status } = useDict('sys_oper_type', 'sys_common_status')
  const [query, setQuery] = useState(initial),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [ids, setIds] = useState([]),
    [showSearch, setShowSearch] = useState(true),
    [detail, setDetail] = useState(null)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await list(query)
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
      ...initial,
      pageSize: query.pageSize,
      ...values,
      beginTime: dateRange?.[0]?.format('YYYY-MM-DD'),
      endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
    })
  }
  async function remove(all) {
    try {
      await confirm(
        all ? '是否确认清空所有操作日志？' : `是否确认删除选中的 ${ids.length} 条操作日志？`
      )
      await (all ? cleanOperlog() : delOperlog(ids))
      message.success(all ? '清空成功' : '删除成功')
      await getList()
    } catch {}
  }
  const columns = [
    ['operId', '日志编号'],
    ['title', '系统模块'],
    ['businessType', '操作类型'],
    ['requestMethod', '请求方式'],
    ['operName', '操作人员'],
    ['operIp', '主机'],
    ['operLocation', '操作地点'],
    ['status', '操作状态'],
    ['operTime', '操作日期'],
    ['costTime', '消耗时间'],
  ].map(([dataIndex, title]) => ({
    align: 'center',
    title,
    dataIndex,
    ellipsis: true,
    width: dataIndex === 'operTime' ? 180 : undefined,
    sorter: ['operTime', 'costTime'].includes(dataIndex),
    sortOrder:
      query.orderByColumn === dataIndex
        ? query.isAsc === 'ascending'
          ? 'ascend'
          : 'descend'
        : null,
    render:
      dataIndex === 'operTime'
        ? (value) => parseTime(value)
        : dataIndex === 'businessType'
          ? (value) => (
              <DictTag
                value={value}
                options={sys_oper_type}
              />
            )
          : dataIndex === 'status'
            ? (value) => (
                <DictTag
                  value={value}
                  options={sys_common_status}
                />
              )
            : dataIndex === 'costTime'
              ? (value) => `${value ?? 0} 毫秒`
              : undefined,
  }))
  columns.push({
    className: 'ruoyi-actions-cell',
    align: 'center',
    title: '操作',
    width: 85,
    fixed: 'right',
    render: (_, row) => (
      <HasPermi value={['monitor:operlog:query']}>
        <TableAction
          symbol="View"
          onClick={() => setDetail(row)}
        >
          详细
        </TableAction>
      </HasPermi>
    ),
  })
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
            ['operIp', '操作地址'],
            ['title', '系统模块'],
            ['operName', '操作人员'],
          ].map(([name, label]) => (
            <Form.Item
              key={name}
              name={name}
              label={label}
            >
              <Input
                placeholder={`请输入${label}`}
                allowClear
              />
            </Form.Item>
          ))}
          <Form.Item
            label="类型"
            name="businessType"
          >
            <Select
              style={{ width: 240 }}
              placeholder="操作类型"
              allowClear
              options={sys_oper_type}
            />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
          >
            <Select
              style={{ width: 240 }}
              placeholder="操作状态"
              allowClear
              options={sys_common_status}
            />
          </Form.Item>
          <Form.Item
            label="操作时间"
            name="dateRange"
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              placeholder={['开始日期', '结束日期']}
              aria-label={`日期范围（${getDisplayTimezone()}）`}
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
        <HasPermi value={['monitor:operlog:remove']}>
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
        <HasPermi value={['monitor:operlog:export']}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download('/monitor/operlog/export', query, `operlog_${Date.now()}.xlsx`).catch(
                () => {}
              )
            }
          >
            导出
          </Button>
        </HasPermi>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="operId"
        dataSource={rows}
        loading={loading}
        columns={columns}
        pagination={false}
        scroll={{ x: 1400 }}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
        onChange={(_, __, sorter) =>
          setQuery({
            ...query,
            orderByColumn: sorter.field,
            isAsc: sorter.order === 'ascend' ? 'ascending' : 'descending',
          })
        }
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Detail
        open={!!detail}
        row={detail || {}}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}
