import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  UnlockOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Select, Space } from 'antd'
import Table from '@/components/Table'
import { list, delLogininfor, cleanLogininfor, unlockLogininfor } from '@/api/monitor/logininfor'
import { useDict } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { getDisplayTimezone } from '@/utils/time'
import { confirm, message } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'

const initial = {
  pageNum: 1,
  pageSize: 10,
  orderByColumn: 'loginTime',
  isAsc: 'descending',
}
export default function Logininfor() {
  const [form] = Form.useForm(),
    { sys_common_status } = useDict('sys_common_status')
  const [query, setQuery] = useState(initial),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState([]),
    [showSearch, setShowSearch] = useState(true)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await list(query)
      setRows(result.rows || [])
      setTotal(result.total)
      setSelected([])
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
        all ? '是否确认清空所有登录日志？' : `是否确认删除选中的 ${selected.length} 条登录日志？`
      )
      await (all ? cleanLogininfor() : delLogininfor(selected.map((row) => row.infoId)))
      message.success(all ? '清空成功' : '删除成功')
      await getList()
    } catch {}
  }
  async function unlock() {
    const name = selected[0].userName
    try {
      await confirm(`是否确认解锁用户“${name}”？`)
      await unlockLogininfor(name)
      message.success(`用户 ${name} 解锁成功`)
    } catch {}
  }
  const columns = [
    ['infoId', '访问编号'],
    ['userName', '用户名称'],
    ['ipaddr', '地址'],
    ['loginLocation', '登录地点'],
    ['os', '操作系统'],
    ['browser', '浏览器'],
    ['status', '登录状态'],
    ['msg', '描述'],
    ['loginTime', '访问时间'],
  ].map(([dataIndex, title]) => ({
    align: 'center',
    title,
    dataIndex,
    ellipsis: true,
    width: dataIndex === 'loginTime' ? 180 : undefined,
    sorter: ['userName', 'loginTime'].includes(dataIndex),
    sortOrder:
      query.orderByColumn === dataIndex
        ? query.isAsc === 'ascending'
          ? 'ascend'
          : 'descend'
        : null,
    render:
      dataIndex === 'loginTime'
        ? (value) => parseTime(value)
        : dataIndex === 'status'
          ? (value) => (
              <DictTag
                value={value}
                options={sys_common_status}
              />
            )
          : undefined,
  }))
  return (
    <div className="app-container">
      {showSearch && (
        <Form
          form={form}
          layout="inline"
          className="search-form"
          onFinish={search}
        >
          <Form.Item
            label="登录地址"
            name="ipaddr"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入登录地址"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="用户名称"
            name="userName"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入用户名称"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
          >
            <Select
              style={{ width: 240 }}
              placeholder="登录状态"
              allowClear
              options={sys_common_status}
            />
          </Form.Item>
          <Form.Item
            label="登录时间"
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
        <HasPermi value={['monitor:logininfor:remove']}>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            disabled={!selected.length}
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
        <HasPermi value={['monitor:logininfor:unlock']}>
          <Button
            icon={<UnlockOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            disabled={selected.length !== 1}
            onClick={unlock}
          >
            解锁
          </Button>
        </HasPermi>
        <HasPermi value={['monitor:logininfor:export']}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download('/monitor/logininfor/export', query, `logininfor_${Date.now()}.xlsx`).catch(
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
        rowKey="infoId"
        dataSource={rows}
        loading={loading}
        columns={columns}
        pagination={false}
        scroll={{ x: 1200 }}
        rowSelection={{
          selectedRowKeys: selected.map((row) => row.infoId),
          onChange: (_, values) => setSelected(values),
        }}
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
    </div>
  )
}
