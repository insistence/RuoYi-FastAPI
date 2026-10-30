import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

  const [form] = Form.useForm(),
    { sys_common_status } = useDict('sys_common_status')
  useLocalizedFormErrors(form)
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
        all
          ? t('monitor:clearAllSignInLogs')
          : t('monitor:deleteTheValueSelectedSignInLogs', { length: selected.length })
      )
      await (all ? cleanLogininfor() : delLogininfor(selected.map((row) => row.infoId)))
      message.success(all ? t('common:clearSuccess') : t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  async function unlock() {
    const name = selected[0].userName
    try {
      await confirm(t('monitor:unlockUserValue', { name }))
      await unlockLogininfor(name)
      message.success(t('monitor:userValueUnlocked', { name }))
    } catch {}
  }
  const columns = [
    ['infoId', t('monitor:accessId')],
    ['userName', t('system:user.username')],
    ['ipaddr', t('common:address')],
    ['loginLocation', t('monitor:signInLocation')],
    ['os', t('monitor:server.os')],
    ['browser', t('monitor:browser')],
    ['status', t('monitor:signInStatus')],
    ['msg', t('monitor:description')],
    ['loginTime', t('monitor:accessedAt')],
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
            label={t('monitor:login.location')}
            name="ipaddr"
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('monitor:enterSignInAddress')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('system:user.username')}
            name="userName"
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:user.usernamePlaceholder')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('common:status')}
            name="status"
          >
            <Select
              style={{ width: 240 }}
              placeholder={t('monitor:signInStatus')}
              allowClear
              options={sys_common_status}
            />
          </Form.Item>
          <Form.Item
            label={t('monitor:login.time')}
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
        <HasPermi value={['monitor:logininfor:remove']}>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            disabled={!selected.length}
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
        <HasPermi value={['monitor:logininfor:unlock']}>
          <Button
            icon={<UnlockOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            disabled={selected.length !== 1}
            onClick={unlock}
          >
            {t('auth:lock.unlock')}
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
