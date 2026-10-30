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
  useI18n()

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
  useLocalizedFormErrors(queryForm, form)
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
      message.success(t('plugin.ai:savedSuccessfully'))
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
      await confirm(t('plugin.ai:deleteTheModelWithIdValue', { arg0: ids.join(',') }))
      await delModel(ids.join(','))
      message.success(t('plugin.ai:deletedSuccessfully'))
      refresh()
    } catch {}
  }
  const columns = [
    { align: 'center', title: t('plugin.ai:modelId'), dataIndex: 'modelId' },
    { align: 'center', title: t('plugin.ai:modelCode'), dataIndex: 'modelCode' },
    {
      align: 'center',
      title: t('plugin.ai:provider'),
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
      title: t('plugin.ai:supportsReasoning'),
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
      title: t('plugin.ai:supportsImages'),
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
      title: t('plugin.ai:status'),
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
      title: t('plugin.ai:createdAt'),
      dataIndex: 'createTime',
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('plugin.ai:actions'),
      width: 180,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['ai:model:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => edit(row)}
            >
              {t('plugin.ai:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['ai:model:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => remove(row)}
            >
              {t('plugin.ai:delete')}
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
          label={t('plugin.ai:modelCode')}
        >
          <Input
            placeholder={t('plugin.ai:enterAModelCode')}
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="provider"
          label={t('plugin.ai:provider')}
        >
          <Select
            placeholder={t('plugin.ai:chooseAProvider')}
            allowClear
            options={ai_provider_type}
          />
        </Form.Item>
        <Form.Item
          name="status"
          label={t('plugin.ai:status')}
        >
          <Select
            placeholder={t('plugin.ai:modelStatus')}
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
              {t('plugin.ai:search')}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                queryForm.resetFields()
                setQuery({ pageNum: 1, pageSize: 10 })
                setSelected([])
              }}
            >
              {t('plugin.ai:reset')}
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
              {t('plugin.ai:add')}
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
              {t('plugin.ai:edit')}
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
              {t('plugin.ai:delete')}
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
        title={editing?.modelId ? t('plugin.ai:editModel') : t('plugin.ai:addModel')}
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
                label={t('plugin.ai:modelCode')}
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t('plugin.ai:modelCodeIsRequired'),
                  },
                ]}
              >
                <Input placeholder={t('plugin.ai:forExampleDeepseekR1')} />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="modelName"
                label={t('plugin.ai:modelName')}
              >
                <Input placeholder={t('plugin.ai:enterAModelName')} />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="provider"
                label={t('plugin.ai:provider')}
                rules={[{ required: true, message: t('plugin.ai:providerIsRequired') }]}
              >
                <Select
                  placeholder={t('plugin.ai:chooseAProvider')}
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
                label={t('plugin.ai:modelSortOrder')}
                rules={[{ required: true, message: t('plugin.ai:modelSortOrderIsRequired') }]}
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
            label={t('plugin.ai:model.apiKey')}
          >
            <Input.Password
              placeholder={t('plugin.ai:enterAnApiKey')}
              autoComplete="off"
            />
          </Form.Item>
          <Form.Item
            name="baseUrl"
            label={t('plugin.ai:model.baseUrl')}
          >
            <Input placeholder={t('plugin.ai:enterABaseUrl')} />
          </Form.Item>
          <Row gutter={20}>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="maxTokens"
                label={t('plugin.ai:maximumOutput')}
              >
                <InputNumber
                  placeholder={t('plugin.ai:maximumOutput')}
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
                label={t('plugin.ai:defaultTemperature')}
              >
                <InputNumber
                  placeholder={t('plugin.ai:defaultTemperature')}
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
                label={t('plugin.ai:supportsReasoning')}
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
                label={t('plugin.ai:supportsImages')}
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
                label={t('plugin.ai:modelType')}
              >
                <Input placeholder={t('plugin.ai:enterAModelTypeOptional')} />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="status"
                label={t('plugin.ai:status')}
              >
                <Radio.Group options={sys_normal_disable} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="remark"
            label={t('plugin.ai:remark')}
          >
            <Input.TextArea
              placeholder={t('plugin.ai:enterContent')}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
