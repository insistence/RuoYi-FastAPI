import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Button, Col, Form, Input, InputNumber, Modal, Radio, Row, Select, Space } from 'antd'
import Table from '@/components/Table'
import { addModel, delModel, getModel, listModel, updateModel } from '../../api/model'
import { useDict } from '@/utils/dict'
import { parseTime } from '@/utils/ruoyi'
import { confirm, message } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'

const defaults = {
  modelCode: undefined,
  modelName: undefined,
  provider: undefined,
  modelSort: 0,
  apiKey: undefined,
  baseUrl: undefined,
  maxTokens: undefined,
  temperature: undefined,
  supportReasoning: 'N',
  supportImages: 'N',
  modelType: undefined,
  status: '0',
  remark: undefined,
}
export default function AiModel() {
  const { ai_provider_type, sys_normal_disable, sys_yes_no } = useDict(
      'ai_provider_type',
      'sys_normal_disable',
      'sys_yes_no'
    ),
    [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(false),
    [selected, setSelected] = useState([]),
    [showSearch, setShowSearch] = useState(true),
    [editing, setEditing] = useState(),
    [saving, setSaving] = useState(false),
    [revision, setRevision] = useState(0)
  const refresh = () => {
    setSelected([])
    setRevision((value) => value + 1)
  }
  useEffect(() => {
    let active = true
    setLoading(true)
    listModel(query)
      .then((result) => active && setData(result))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query, revision])
  async function edit(row) {
    try {
      const item = row ? (await getModel(row.modelId)).data : {}
      setEditing(item)
      form.resetFields()
      form.setFieldsValue({ ...defaults, ...item })
    } catch {}
  }
  async function save() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        ...(editing.modelId ? { modelId: editing.modelId } : {}),
      }
      await (editing.modelId ? updateModel : addModel)(payload)
      message.success('保存成功')
      setEditing(undefined)
      refresh()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function remove(row) {
    const ids = row ? [row.modelId] : selected
    try {
      await confirm(`是否删除模型编号为「${ids.join(',')}」的数据项？`)
      await delModel(ids.join(','))
      message.success('删除成功')
      refresh()
    } catch {}
  }
  const columns = [
    { align: 'center', title: '模型 ID', dataIndex: 'modelId' },
    { align: 'center', title: '模型编码', dataIndex: 'modelCode' },
    {
      align: 'center',
      title: '提供商',
      dataIndex: 'provider',
      render: (value) => (
        <DictTag
          options={ai_provider_type}
          value={value}
        />
      ),
    },
    {
      align: 'center',
      title: '支持推理',
      dataIndex: 'supportReasoning',
      render: (value) => (
        <DictTag
          options={sys_yes_no}
          value={value}
        />
      ),
    },
    {
      align: 'center',
      title: '支持图片',
      dataIndex: 'supportImages',
      render: (value) => (
        <DictTag
          options={sys_yes_no}
          value={value}
        />
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
    {
      align: 'center',
      title: '创建时间',
      dataIndex: 'createTime',
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 180,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['ai:model:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => edit(row)}
            >
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={['ai:model:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => remove(row)}
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
      <Form
        form={queryForm}
        layout="inline"
        className="search-form"
        style={{ display: showSearch ? undefined : 'none' }}
        onFinish={(values) => {
          setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })
          setSelected([])
        }}
      >
        <Form.Item
          name="modelCode"
          label="模型编码"
        >
          <Input
            placeholder="请输入模型编码"
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="provider"
          label="提供商"
        >
          <Select
            placeholder="请选择提供商"
            allowClear
            options={ai_provider_type}
          />
        </Form.Item>
        <Form.Item
          name="status"
          label="状态"
        >
          <Select
            placeholder="模型状态"
            allowClear
            options={sys_normal_disable}
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
                queryForm.resetFields()
                setQuery({ pageNum: 1, pageSize: 10 })
                setSelected([])
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
      <div className="table-toolbar">
        <Space>
          <HasPermi value={['ai:model:add']}>
            <Button
              icon={<PlusOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--primary"
              type="default"
              onClick={() => edit()}
            >
              新增
            </Button>
          </HasPermi>
          <HasPermi value={['ai:model:edit']}>
            <Button
              icon={<EditOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--success"
              type="default"
              disabled={selected.length !== 1}
              onClick={() => edit({ modelId: selected[0] })}
            >
              修改
            </Button>
          </HasPermi>
          <HasPermi value={['ai:model:remove']}>
            <Button
              icon={<DeleteOutlined />}
              className="ruoyi-plain-button ruoyi-plain-button--danger"
              type="default"
              disabled={!selected.length}
              onClick={() => remove()}
            >
              删除
            </Button>
          </HasPermi>
        </Space>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={refresh}
        />
      </div>
      <Table
        rowKey="modelId"
        dataSource={data.rows}
        columns={columns}
        loading={loading}
        pagination={false}
        scroll={{ x: 1100 }}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
      />
      <Pagination
        total={data.total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => {
          setQuery({ ...query, ...page })
          setSelected([])
        }}
      />
      <Modal
        footer={renderDialogFooter}
        title={editing?.modelId ? '修改模型' : '添加模型'}
        open={!!editing}
        width="700px"
        onCancel={() => setEditing(undefined)}
        onOk={save}
        confirmLoading={saving}
        forceRender
      >
        <Form
          name="plugins-ai-views-model-index-jsx-editor-1"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '100px' }}
          form={form}
          layout="horizontal"
        >
          <Row gutter={20}>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="modelCode"
                label="模型编码"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: '模型编码不能为空',
                  },
                ]}
              >
                <Input placeholder="如 deepseek-r1" />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="modelName"
                label="模型名称"
              >
                <Input placeholder="请输入模型名称" />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="provider"
                label="提供商"
                rules={[{ required: true, message: '提供商不能为空' }]}
              >
                <Select
                  placeholder="请选择提供商"
                  options={ai_provider_type}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="modelSort"
                label="模型排序"
                rules={[{ required: true, message: '模型排序不能为空' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="apiKey"
            label="API Key"
          >
            <Input.Password
              placeholder="请输入API Key"
              autoComplete="off"
            />
          </Form.Item>
          <Form.Item
            name="baseUrl"
            label="Base URL"
          >
            <Input placeholder="请输入Base URL" />
          </Form.Item>
          <Row gutter={20}>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="maxTokens"
                label="最大输出"
              >
                <InputNumber
                  placeholder="最大输出"
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="temperature"
                label="默认温度"
              >
                <InputNumber
                  placeholder="默认温度"
                  min={0}
                  max={2}
                  step={0.1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="supportReasoning"
                label="支持推理"
              >
                <Radio.Group options={sys_yes_no} />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="supportImages"
                label="支持图片"
              >
                <Radio.Group options={sys_yes_no} />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="modelType"
                label="模型类型"
              >
                <Input placeholder="请输入模型类型 (可选)" />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="status"
                label="状态"
              >
                <Radio.Group options={sys_normal_disable} />
              </Form.Item>
            </Col>
          </Row>
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
