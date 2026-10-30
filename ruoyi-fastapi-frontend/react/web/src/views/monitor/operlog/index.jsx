import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

  const [form] = Form.useForm(),
    { sys_oper_type, sys_common_status } = useDict('sys_oper_type', 'sys_common_status')
  useLocalizedFormErrors(form)
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
        all
          ? t('monitor:clearAllOperationLogs')
          : t('monitor:deleteTheValueSelectedOperationLogs', { length: ids.length })
      )
      await (all ? cleanOperlog() : delOperlog(ids))
      message.success(all ? t('common:clearSuccess') : t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  const columns = [
    ['operId', t('monitor:log.id')],
    ['title', t('monitor:systemModule')],
    ['businessType', t('monitor:log.operationType')],
    ['requestMethod', t('monitor:operlog.requestMethod')],
    ['operName', t('monitor:log.operator')],
    ['operIp', t('monitor:host')],
    ['operLocation', t('monitor:operationLocation')],
    ['status', t('monitor:operationStatus')],
    ['operTime', t('monitor:operationDate')],
    ['costTime', t('monitor:duration')],
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
              ? (value) => t('monitor:operlog.valueMs', { arg0: value ?? 0 })
              : undefined,
  }))
  columns.push({
    className: 'ruoyi-actions-cell',
    align: 'center',
    title: t('common:actions'),
    width: 85,
    fixed: 'right',
    render: (_, row) => (
      <HasPermi value={['monitor:operlog:query']}>
        <TableAction
          symbol="View"
          onClick={() => setDetail(row)}
        >
          {t('common:detail')}
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
            ['operIp', t('monitor:operationAddress')],
            ['title', t('monitor:systemModule')],
            ['operName', t('monitor:log.operator')],
          ].map(([name, label]) => (
            <Form.Item
              key={name}
              name={name}
              label={label}
            >
              <Input
                placeholder={t('monitor:enterValue', { label })}
                allowClear
              />
            </Form.Item>
          ))}
          <Form.Item
            label={t('common:type')}
            name="businessType"
          >
            <Select
              style={{ width: 240 }}
              placeholder={t('monitor:log.operationType')}
              allowClear
              options={sys_oper_type}
            />
          </Form.Item>
          <Form.Item
            label={t('common:status')}
            name="status"
          >
            <Select
              style={{ width: 240 }}
              placeholder={t('monitor:operationStatus')}
              allowClear
              options={sys_common_status}
            />
          </Form.Item>
          <Form.Item
            label={t('monitor:log.operationTime')}
            name="dateRange"
          >
            <DatePicker.RangePicker
              style={{ width: 308 }}
              placeholder={[t('common:startDate'), t('common:endDate')]}
              aria-label={t('monitor:dateRangeValue', { arg0: getDisplayTimezone() })}
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
        <HasPermi value={['monitor:operlog:remove']}>
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
            {t('common:export')}
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
