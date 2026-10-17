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
  const { sys_yes_no } = useDict('sys_yes_no')
  const timeZone = useUserStore((state) => state.timeZone)
  const [queryRef] = Form.useForm(),
    [configRef] = Form.useForm()
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
      await confirm(`是否确认删除参数编号为“${values}”的数据项？`)
      await delConfig(values)
      message.success('删除成功')
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await configRef.validateFields()
      setSaving(true)
      await (configId !== undefined ? updateConfig({ ...values, configId }) : addConfig(values))
      message.success(configId !== undefined ? '修改成功' : '新增成功')
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { align: 'center', title: '参数主键', dataIndex: 'configId' },
    { align: 'center', title: '参数名称', dataIndex: 'configName', ellipsis: true },
    { align: 'center', title: '参数键名', dataIndex: 'configKey', ellipsis: true },
    { align: 'center', title: '参数键值', dataIndex: 'configValue', ellipsis: true },
    {
      align: 'center',
      title: '系统内置',
      dataIndex: 'configType',
      render: (value) => (
        <DictTag
          options={sys_yes_no}
          value={value}
        />
      ),
    },
    { align: 'center', title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      align: 'center',
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 150,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:config:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row.configId)}
            >
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:config:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete([row.configId])}
            >
              删除
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
            label="参数名称"
            name="configName"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入参数名称"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="参数键名"
            name="configKey"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入参数键名"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="系统内置"
            name="configType"
          >
            <Select
              style={{ width: 240 }}
              placeholder="系统内置"
              allowClear
              options={sys_yes_no}
            />
          </Form.Item>
          <Form.Item
            label="创建时间"
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
                  queryRef.resetFields()
                  handleQuery({})
                }}
              >
                重置
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
            新增
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
            修改
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
            删除
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
            导出
          </Button>
        </HasPermi>
        <HasPermi value={['system:config:remove']}>
          <Button
            icon={<ReloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            onClick={() =>
              refreshCache()
                .then(() => message.success('刷新缓存成功'))
                .catch(() => {})
            }
          >
            刷新缓存
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
        title={configId !== undefined ? '修改参数' : '添加参数'}
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
            label="参数名称"
            name="configName"
            rules={[{ required: true, message: '参数名称不能为空' }]}
          >
            <Input placeholder="请输入参数名称" />
          </Form.Item>
          <Form.Item
            label="参数键名"
            name="configKey"
            rules={[{ required: true, message: '参数键名不能为空' }]}
          >
            <Input placeholder="请输入参数键名" />
          </Form.Item>
          <Form.Item
            label="参数键值"
            name="configValue"
            rules={[{ required: true, message: '参数键值不能为空' }]}
          >
            <Input.TextArea
              placeholder="请输入参数键值"
              rows={2}
            />
          </Form.Item>
          <Form.Item
            label="系统内置"
            name="configType"
          >
            <Radio.Group options={sys_yes_no} />
          </Form.Item>
          <Form.Item
            label="备注"
            name="remark"
          >
            <Input.TextArea
              placeholder="请输入内容"
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
