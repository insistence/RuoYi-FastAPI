import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Radio, Select, Space } from 'antd'
import Table from '@/components/Table'
import {
  listConfig,
  getConfig,
  delConfig,
  addConfig,
  updateConfig,
  refreshCache,
} from '@/api/system/config'
import { useDict } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { getDisplayTimezone } from '@/utils/time'
import { message, confirm } from '@/plugins/modal'
import useUserStore from '@/store/modules/user'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'

export default function Config() {
  useI18n()

  const { sys_yes_no } = useDict('sys_yes_no')
  const timeZone = useUserStore((state) => state.timeZone)
  const [queryRef] = Form.useForm(),
    [configRef] = Form.useForm()
  useLocalizedFormErrors(queryRef, configRef)
  const [configList, setConfigList] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([])
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true)
  const [open, setOpen] = useState(false),
    [configId, setConfigId] = useState()
  const [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 })
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listConfig(queryParams)
      setConfigList(result.rows)
      setTotal(result.total)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [queryParams, timeZone])
  useEffect(() => {
    void getList()
  }, [getList])
  function handleQuery({ dateRange, ...values }) {
    setQueryParams({
      ...values,
      beginTime: dateRange?.[0]?.format('YYYY-MM-DD'),
      endTime: dateRange?.[1]?.format('YYYY-MM-DD'),
      pageNum: 1,
      pageSize: queryParams.pageSize,
    })
  }
  function handleAdd() {
    setConfigId(undefined)
    configRef.resetFields()
    configRef.setFieldsValue({ configType: 'Y' })
    setOpen(true)
  }
  async function handleUpdate(id) {
    try {
      const result = await getConfig(id)
      setConfigId(id)
      configRef.resetFields()
      configRef.setFieldsValue(result.data)
      setOpen(true)
    } catch {}
  }
  async function handleDelete(values) {
    try {
      await confirm(t('system:deleteConfigurationEntriesWithIdsValue', { values }))
      await delConfig(values)
      message.success(t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await configRef.validateFields()
      setSaving(true)
      await (configId !== undefined ? updateConfig({ ...values, configId }) : addConfig(values))
      message.success(configId !== undefined ? t('common:updateSuccess') : t('common:addSuccess'))
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { align: 'center', title: t('system:parameterID'), dataIndex: 'configId' },
    { align: 'center', title: t('system:config.name'), dataIndex: 'configName', ellipsis: true },
    { align: 'center', title: t('system:config.key'), dataIndex: 'configKey', ellipsis: true },
    { align: 'center', title: t('system:config.value'), dataIndex: 'configValue', ellipsis: true },
    {
      align: 'center',
      title: t('system:config.builtIn'),
      dataIndex: 'configType',
      render: (value) => (
        <DictTag
          options={sys_yes_no}
          value={value}
        />
      ),
    },
    { align: 'center', title: t('common:remark'), dataIndex: 'remark', ellipsis: true },
    {
      align: 'center',
      title: t('common:createdTime'),
      dataIndex: 'createTime',
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 150,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:config:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row.configId)}
            >
              {t('common:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:config:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete([row.configId])}
            >
              {t('common:delete')}
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ]
  return (
    <div className="app-container">
      {showSearch && (
        <Form
          form={queryRef}
          layout="inline"
          className="search-form"
          onFinish={handleQuery}
        >
          <Form.Item
            label={t('system:config.name')}
            name="configName"
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:enterParameterName')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('system:config.key')}
            name="configKey"
          >
            <Input
              style={{ width: 240 }}
              placeholder={t('system:enterParameterKey')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            label={t('system:config.builtIn')}
            name="configType"
          >
            <Select
              style={{ width: 240 }}
              placeholder={t('system:config.builtIn')}
              allowClear
              options={sys_yes_no}
            />
          </Form.Item>
          <Form.Item
            label={t('common:createdTime')}
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
                  queryRef.resetFields()
                  handleQuery({})
                }}
              >
                {t('common:reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={['system:config:add']}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={handleAdd}
          >
            {t('common:add')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:config:edit']}>
          <Button
            icon={<EditOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--success"
            type="default"
            disabled={ids.length !== 1}
            onClick={() => handleUpdate(ids[0])}
          >
            {t('common:edit')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:config:remove']}>
          <Button
            icon={<DeleteOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            disabled={!ids.length}
            onClick={() => handleDelete(ids)}
          >
            {t('common:delete')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:config:export']}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download('/system/config/export', queryParams, `config_${Date.now()}.xlsx`).catch(
                () => {}
              )
            }
          >
            {t('common:export')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:config:remove']}>
          <Button
            icon={<ReloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            onClick={() =>
              refreshCache()
                .then(() => message.success(t('system:cacheRefreshed')))
                .catch(() => {})
            }
          >
            {t('system:refreshCache')}
          </Button>
        </HasPermi>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        rowKey="configId"
        loading={loading}
        dataSource={configList}
        columns={columns}
        pagination={false}
        scroll={{ x: 1100 }}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
      />
      <Pagination
        total={total}
        page={queryParams.pageNum}
        limit={queryParams.pageSize}
        onChange={(page) => setQueryParams({ ...queryParams, ...page })}
      />
      <Modal
        footer={renderDialogFooter}
        width="500px"
        open={open}
        title={configId !== undefined ? t('system:editParameter') : t('system:addParameter')}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        forceRender
      >
        <Form
          name="src-views-system-config-index-jsx-editor-3"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '80px' }}
          form={configRef}
          layout="horizontal"
        >
          <Form.Item
            label={t('system:config.name')}
            name="configName"
            rules={[{ required: true, message: t('system:parameterNameIsRequired') }]}
          >
            <Input placeholder={t('system:enterParameterName')} />
          </Form.Item>
          <Form.Item
            label={t('system:config.key')}
            name="configKey"
            rules={[{ required: true, message: t('system:parameterKeyIsRequired') }]}
          >
            <Input placeholder={t('system:enterParameterKey')} />
          </Form.Item>
          <Form.Item
            label={t('system:config.value')}
            name="configValue"
            rules={[{ required: true, message: t('system:parameterValueIsRequired') }]}
          >
            <Input.TextArea
              placeholder={t('system:enterParameterValue')}
              rows={2}
            />
          </Form.Item>
          <Form.Item
            label={t('system:config.builtIn')}
            name="configType"
          >
            <Radio.Group options={sys_yes_no} />
          </Form.Item>
          <Form.Item
            label={t('common:remark')}
            name="remark"
          >
            <Input.TextArea
              placeholder={t('common:contentPlaceholder')}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
