import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import FormLabel from '@/components/FormLabel'
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import DictDataDrawer from './detail'
import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Radio, Select, Space } from 'antd'
import Table from '@/components/Table'
import {
  listType,
  getType,
  delType,
  addType,
  updateType,
  refreshCache,
} from '@/api/system/dict/type'
import { useDict, clearDictCache } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { getDisplayTimezone } from '@/utils/time'
import { message, confirm } from '@/plugins/modal'
import useUserStore from '@/store/modules/user'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'

export default function Dict() {
  const navigate = useNavigate()
  const { sys_normal_disable } = useDict('sys_normal_disable')
  const [drawerRow, setDrawerRow] = useState(null)
  const timeZone = useUserStore((state) => state.timeZone)
  const [queryRef] = Form.useForm(),
    [dictRef] = Form.useForm()
  const [dictList, setDictList] = useState([]),
    [total, setTotal] = useState(0),
    [ids, setIds] = useState([])
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true)
  const [open, setOpen] = useState(false),
    [dictId, setDictId] = useState()
  const [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 })
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listType(queryParams)
      setDictList(result.rows)
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
    setDictId(undefined)
    dictRef.resetFields()
    dictRef.setFieldsValue({ status: '0' })
    setOpen(true)
  }
  async function handleUpdate(id) {
    try {
      const result = await getType(id)
      setDictId(id)
      dictRef.resetFields()
      dictRef.setFieldsValue(result.data)
      setOpen(true)
    } catch {}
  }
  async function handleDelete(values) {
    try {
      await confirm(`是否确认删除字典编号为“${values}”的数据项？`)
      await delType(values)
      message.success('删除成功')
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await dictRef.validateFields()
      setSaving(true)
      await (dictId !== undefined ? updateType({ ...values, dictId }) : addType(values))
      message.success(dictId !== undefined ? '修改成功' : '新增成功')
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { align: 'center', title: '字典编号', dataIndex: 'dictId' },
    { align: 'center', title: '字典名称', dataIndex: 'dictName', ellipsis: true },
    {
      align: 'center',
      title: '字典类型',
      dataIndex: 'dictType',
      render: (value, row) => (
        <Button
          type="link"
          className="ruoyi-table-action"
          onClick={() => setDrawerRow(row)}
        >
          {value}
        </Button>
      ),
    },
    {
      align: 'center',
      title: '状态',
      dataIndex: 'status',
      render: (value) => (
        <DictTag
          options={sys_normal_disable}
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
      width: 280,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:dict:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row.dictId)}
            >
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:dict:edit']}>
            <TableAction
              symbol="Operation"
              onClick={() => navigate(`/system/dict-data/index/${row.dictId}`)}
            >
              列表
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:dict:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete([row.dictId])}
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
            label="字典名称"
            name="dictName"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入字典名称"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="字典类型"
            name="dictType"
          >
            <Input
              style={{ width: 240 }}
              placeholder="请输入字典类型"
              allowClear
            />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
          >
            <Select
              style={{ width: 240 }}
              placeholder="字典状态"
              allowClear
              options={sys_normal_disable}
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
        <HasPermi value={['system:dict:add']}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={handleAdd}
          >
            新增
          </Button>
        </HasPermi>
        <HasPermi value={['system:dict:edit']}>
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
        <HasPermi value={['system:dict:remove']}>
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
        <HasPermi value={['system:dict:export']}>
          <Button
            icon={<DownloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={() =>
              download('/system/dict/type/export', queryParams, `dict_${Date.now()}.xlsx`).catch(
                () => {}
              )
            }
          >
            导出
          </Button>
        </HasPermi>
        <HasPermi value={['system:dict:remove']}>
          <Button
            icon={<ReloadOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            onClick={() =>
              refreshCache()
                .then(() => {
                  clearDictCache()
                  message.success('刷新缓存成功')
                })
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
        rowKey="dictId"
        loading={loading}
        dataSource={dictList}
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
        title={dictId !== undefined ? '修改字典类型' : '添加字典类型'}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        forceRender
      >
        <Form
          name="src-views-system-dict-index-jsx-editor-6"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '100px' }}
          form={dictRef}
          layout="horizontal"
        >
          <Form.Item
            label="字典名称"
            name="dictName"
            rules={[{ required: true, message: '字典名称不能为空' }]}
          >
            <Input placeholder="请输入字典名称" />
          </Form.Item>
          <Form.Item
            label={
              <FormLabel
                label="字典类型"
                help="数据存储中的Key值，如：sys_user_sex"
              />
            }
            name="dictType"
            rules={[{ required: true, message: '字典类型不能为空' }]}
          >
            <Input placeholder="请输入字典类型" />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
          >
            <Radio.Group options={sys_normal_disable} />
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
      <DictDataDrawer
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
      />
    </div>
  )
}
