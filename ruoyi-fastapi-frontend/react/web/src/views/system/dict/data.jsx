import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Radio, Select, Space } from 'antd'
import Table from '@/components/Table'
import { useNavigate } from 'react-router-dom'
import { listData, getData, delData, addData, updateData } from '@/api/system/dict/data'
import { getType, optionselect } from '@/api/system/dict/type'
import { useDict, clearDictCache } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { download } from '@/utils/request'
import { message, confirm } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
const listClassOptions = [
  { value: 'default', label: '默认' },
  { value: 'primary', label: '主要' },
  { value: 'success', label: '成功' },
  { value: 'info', label: '信息' },
  { value: 'warning', label: '警告' },
  { value: 'danger', label: '危险' },
]

export default function DictData({ params }) {
  const { sys_normal_disable } = useDict('sys_normal_disable')
  const [queryRef] = Form.useForm(),
    [dataRef] = Form.useForm(),
    navigate = useNavigate()
  const [dataList, setDataList] = useState([]),
    [total, setTotal] = useState(0),
    [typeOptions, setTypeOptions] = useState([]),
    [defaultType, setDefaultType] = useState('')
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [ids, setIds] = useState([])
  const [open, setOpen] = useState(false),
    [dictCode, setDictCode] = useState(),
    [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 })
  useEffect(() => {
    getType(params.dictId)
      .then((result) => {
        setDefaultType(result.data.dictType)
        queryRef.setFieldValue('dictType', result.data.dictType)
        setQueryParams({
          pageNum: 1,
          pageSize: 10,
          dictType: result.data.dictType,
        })
      })
      .catch(() => {})
    optionselect()
      .then((result) =>
        setTypeOptions(
          result.data.map((item) => ({
            label: item.dictName,
            value: item.dictType,
          }))
        )
      )
      .catch(() => {})
  }, [params.dictId])
  const getList = useCallback(async () => {
    if (!queryParams.dictType) return
    setLoading(true)
    try {
      const result = await listData(queryParams)
      setDataList(result.rows)
      setTotal(result.total)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [queryParams])
  useEffect(() => {
    void getList()
  }, [getList])
  function handleQuery(values) {
    setQueryParams({ ...values, pageNum: 1, pageSize: queryParams.pageSize })
  }
  function handleAdd() {
    setDictCode(undefined)
    dataRef.resetFields()
    dataRef.setFieldsValue({
      dictType: queryParams.dictType,
      dictSort: 0,
      listClass: 'default',
      status: '0',
    })
    setOpen(true)
  }
  async function handleUpdate(id) {
    try {
      const result = await getData(id)
      setDictCode(id)
      dataRef.resetFields()
      dataRef.setFieldsValue(result.data)
      setOpen(true)
    } catch {}
  }
  async function handleDelete(values) {
    try {
      await confirm(`是否确认删除字典编码为“${values}”的数据项？`)
      await delData(values)
      clearDictCache()
      message.success('删除成功')
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await dataRef.validateFields()
      setSaving(true)
      await (dictCode !== undefined ? updateData({ ...values, dictCode }) : addData(values))
      clearDictCache()
      message.success(dictCode !== undefined ? '修改成功' : '新增成功')
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  const columns = [
    { align: 'center', title: '字典编码', dataIndex: 'dictCode' },
    {
      align: 'center',
      title: '字典标签',
      dataIndex: 'dictLabel',
      render: (value, row) => (
        <DictTag
          options={[{ label: value, value: row.dictValue, elTagType: row.listClass }]}
          value={row.dictValue}
        />
      ),
    },
    { align: 'center', title: '字典键值', dataIndex: 'dictValue' },
    { align: 'center', title: '字典排序', dataIndex: 'dictSort' },
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
    { align: 'center', title: '备注', dataIndex: 'remark' },
    {
      width: 180,
      align: 'center',
      title: '创建时间',
      dataIndex: 'createTime',
      render: (value) => parseTime(value),
    },
    {
      width: 160,
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:dict:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row.dictCode)}
            >
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:dict:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete([row.dictCode])}
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
          className="search-form"
          form={queryRef}
          layout="inline"
          onFinish={handleQuery}
        >
          <Form.Item
            name="dictType"
            label="字典名称"
          >
            <Select
              style={{ width: 200 }}
              options={typeOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item
            name="dictLabel"
            label="字典标签"
          >
            <Input
              style={{ width: 200 }}
              placeholder="请输入字典标签"
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
          >
            <Select
              style={{ width: 200 }}
              placeholder="数据状态"
              allowClear
              options={sys_normal_disable}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                icon={<SearchOutlined />}
                htmlType="submit"
                type="primary"
              >
                搜索
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryRef.resetFields()
                  queryRef.setFieldValue('dictType', defaultType)
                  handleQuery({ dictType: defaultType })
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
              download(
                '/system/dict/data/export',
                queryParams,
                `dict_data_${Date.now()}.xlsx`
              ).catch(() => {})
            }
          >
            导出
          </Button>
        </HasPermi>
        <Button
          icon={<CloseOutlined />}
          className="ruoyi-plain-button ruoyi-plain-button--warning"
          type="default"
          onClick={() => navigate('/system/dict')}
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
        rowKey="dictCode"
        loading={loading}
        dataSource={dataList}
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
        title={dictCode !== undefined ? '修改字典数据' : '添加字典数据'}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        forceRender
      >
        <Form
          name="src-views-system-dict-data-jsx-editor-5"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '80px' }}
          form={dataRef}
          layout="horizontal"
        >
          <Form.Item
            name="dictType"
            label="字典类型"
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="dictLabel"
            label="数据标签"
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入数据标签" />
          </Form.Item>
          <Form.Item
            name="dictValue"
            label="数据键值"
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入数据键值" />
          </Form.Item>
          <Form.Item
            name="dictSort"
            label="显示排序"
            rules={[{ required: true }]}
          >
            <InputNumber
              min={0}
              precision={0}
            />
          </Form.Item>
          <Form.Item
            name="cssClass"
            label="样式属性"
          >
            <Input placeholder="请输入样式属性" />
          </Form.Item>
          <Form.Item
            name="listClass"
            label="回显样式"
          >
            <Select options={listClassOptions} />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
          >
            <Radio.Group options={sys_normal_disable} />
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注"
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
