import OAuthTag from '@/components/OAuthWorkspace/OAuthTag'
import TagSummary from '@/components/OAuthWorkspace/TagSummary'
import {
  SearchOutlined as QuerySearchIcon,
  ReloadOutlined as QueryResetIcon,
} from '@ant-design/icons'
import { checkPermi } from '@/utils/permission'
import { Dropdown } from 'antd'
import TableActions, { TableAction } from '@/components/TableActions'
import { PlusOutlined } from '@ant-design/icons'
import '@/components/OAuthWorkspace/entities.css'
import EntityCell from '@/components/OAuthWorkspace/EntityCell'
import { useCallback, useEffect, useState } from 'react'
import { Empty, Button, Modal, Row, Col, Form, Input, InputNumber, Select, Space } from 'antd'
import Table from '@/components/Table'
import {
  addOAuthResource,
  changeOAuthResourceStatus,
  deleteOAuthResources,
  getOAuthResource,
  listOAuthResources,
  updateOAuthResource,
} from '@/api/system/oauthResource'
import { confirm, message } from '@/plugins/modal'
import PageFrame from '@/components/OAuthWorkspace/PageFrame'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'

const claimOptions = [
  ['sub', '用户唯一标识'],
  ['name', '姓名'],
  ['email', '邮箱'],
  ['roles', '角色'],
  ['client_id', '应用编号'],
  ['scope', '已获权限'],
  ['sid', '会话标识'],
].map(([value, label]) => ({ value, label: `${label}（${value}）` }))
const defaults = {
  resourceId: '',
  resourceName: '',
  audience: '',
  tokenFormat: 'jwt',
  signingAlg: 'RS256',
  accessTokenTtlSeconds: null,
  introspectionClientId: null,
  allowedClaims: ['sub', 'client_id', 'scope', 'sid'],
  status: '0',
  remark: '',
}
function duration(value) {
  if (!value) return '使用系统默认'
  return value % 3600 === 0
    ? `${value / 3600} 小时`
    : value % 60 === 0
      ? `${value / 60} 分钟`
      : `${value} 秒`
}
export default function OAuthResource() {
  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOAuthResources(query)
      setRows(result.rows || [])
      setTotal(result.total || 0)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  function add() {
    form.resetFields()
    form.setFieldsValue(defaults)
    setEditing(false)
    setOpen(true)
  }
  async function edit(row) {
    try {
      const result = await getOAuthResource(row.resourceId)
      form.resetFields()
      form.setFieldsValue({ ...defaults, ...result.data })
      setEditing(true)
      setOpen(true)
    } catch {}
  }
  async function save() {
    try {
      await form.validateFields()
      const values = form.getFieldsValue(true),
        data = Object.fromEntries(
          Object.keys(defaults).map((key) => [key, values[key] ?? defaults[key]])
        )
      if (!editing) delete data.status
      setSaving(true)
      await (editing ? updateOAuthResource : addOAuthResource)(data)
      message.success('资源配置已保存')
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function change(row, enable) {
    try {
      await confirm(
        enable
          ? `启用资源“${row.resourceName}”？`
          : `停用“${row.resourceName}”后将停止为该服务签发和刷新访问令牌，是否继续？`
      )
      await (enable
        ? changeOAuthResourceStatus({ resourceId: row.resourceId, status: '0' })
        : deleteOAuthResources(row.resourceId))
      message.success(enable ? '资源已启用' : '资源已停用')
      await getList()
    } catch {}
  }
  const columns = [
    {
      title: '服务',
      width: 230,
      render: (_, row) => (
        <EntityCell
          name={row.resourceName}
          detail={row.resourceId}
          kind="resource"
          copyable
        />
      ),
    },
    {
      width: 250,
      title: '令牌目标',
      dataIndex: 'audience',
      ellipsis: true,
      render: (value) => <code className="resource-audience">{value}</code>,
    },
    {
      width: 240,
      title: '返回的用户信息',
      render: (_, row) => (
        <TagSummary
          effect="plain"
          values={row.allowedClaims}
          label={(value) =>
            claimOptions.find((item) => item.value === value)?.label.split('（')[0] || value
          }
          empty="不返回额外信息"
        />
      ),
    },
    {
      width: 120,
      align: 'center',
      title: '有效时长',
      dataIndex: 'accessTokenTtlSeconds',
      render: duration,
    },
    {
      width: 105,
      align: 'center',
      title: '状态',
      dataIndex: 'status',
      render: (value) => (
        <OAuthTag type={value === '0' ? 'success' : 'info'}>
          {value === '0' ? '使用中' : '已停用'}
        </OAuthTag>
      ),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      fixed: 'right',
      width: 180,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:oauthResource:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => edit(row)}
            >
              编辑
            </TableAction>
          </HasPermi>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                row.status !== '0' &&
                  checkPermi(['system:oauthResource:edit']) && {
                    key: 'enable',
                    label: '重新启用',
                    onClick: () => change(row, true),
                  },
                row.status === '0' &&
                  checkPermi(['system:oauthResource:remove']) && {
                    key: 'disable',
                    label: '停用服务',
                    onClick: () => change(row, false),
                  },
              ].filter(Boolean),
            }}
          >
            <TableAction symbol="ArrowDown">更多</TableAction>
          </Dropdown>
        </TableActions>
      ),
    },
  ]
  return (
    <PageFrame
      className="oauth-resource-page"
      title="服务"
      description="登记接收访问凭据的接口服务，并限制每个服务能够获得的用户信息。"
      section="接入管理"
      filterHint="按服务名称或当前状态查找"
      actions={
        <HasPermi value={['system:oauthResource:add']}>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={add}
          >
            新增服务
          </Button>
        </HasPermi>
      }
      filters={
        showSearch && (
          <Form
            form={queryForm}
            name="oauth-resource-query"
            layout="inline"
            className="search-form"
            onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
          >
            <Form.Item
              label="服务名称"
              name="resourceName"
            >
              <Input
                style={{ width: 200 }}
                placeholder="输入服务名称"
                allowClear
              />
            </Form.Item>
            <Form.Item
              label="状态"
              name="status"
            >
              <Select
                style={{ width: 200 }}
                placeholder="全部状态"
                allowClear
                options={[
                  { value: '0', label: '使用中' },
                  { value: '1', label: '已停用' },
                ]}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  icon={<QuerySearchIcon />}
                  htmlType="submit"
                  type="primary"
                >
                  查找
                </Button>
                <Button
                  icon={<QueryResetIcon />}
                  onClick={() => {
                    queryForm.resetFields()
                    setQuery({ pageNum: 1, pageSize: 10 })
                  }}
                >
                  清空
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )
      }
      toolbar={
        <>
          <span className="result-count">
            已登记 <strong>{total}</strong> 个服务
          </span>
          <RightToolbar
            showSearch={showSearch}
            onShowSearch={setShowSearch}
            onQuery={getList}
          />
        </>
      }
    >
      <Table
        locale={{
          emptyText: (
            <Empty description="还没有符合条件的服务">
              <HasPermi value={['system:oauthResource:add']}>
                <Button
                  type="primary"
                  onClick={add}
                >
                  新增第一个服务
                </Button>
              </HasPermi>
            </Empty>
          ),
        }}
        rowKey="resourceId"
        dataSource={rows}
        columns={columns}
        loading={loading}
        pagination={false}
        scroll={{ x: 1100 }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        className="oauth-dialog oauth-resource-editor"
        title={editing ? '编辑服务' : '新增服务'}
        open={open}
        width="min(820px, calc(100vw - 48px))"
        onCancel={() => setOpen(false)}
        mask={{ closable: false }}
        forceRender
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={saving}
              onClick={save}
            >
              保存服务
            </Button>
          </Space>
        }
      >
        <Form
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          layout="horizontal"
          form={form}
          name="oauth-resource-editor"
          labelCol={{ flex: '160px' }}
          className="resource-form ruoyi-dialog-form"
        >
          <section className="form-section">
            <div className="section-heading">
              <h3>服务身份</h3>
              <p>应用通过服务标识申请访问，服务通过令牌目标判断凭据是否发给自己。</p>
            </div>
            <Row gutter={18}>
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="resourceName"
                  label={
                    <FieldLabel
                      label="服务名称"
                      help="管理端展示名称，便于管理员识别这个服务。"
                    />
                  }
                  rules={[{ required: true, whitespace: true }]}
                >
                  <Input
                    maxLength={100}
                    placeholder="例如：订单服务"
                  />
                </Form.Item>
              </Col>
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="resourceId"
                  label={
                    <FieldLabel
                      label="服务标识"
                      help="应用通过这个唯一标识关联服务，保存后不能修改。"
                    />
                  }
                  rules={[{ required: true, whitespace: true }]}
                >
                  <Input
                    disabled={editing}
                    maxLength={100}
                    placeholder="例如：orders-api"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="audience"
              label={
                <FieldLabel
                  label="令牌目标"
                  help="服务校验访问凭据时使用的唯一值，必须与服务端配置完全一致。"
                />
              }
              rules={[{ required: true, whitespace: true }]}
            >
              <Input
                disabled={editing}
                maxLength={500}
                placeholder="例如：https://api.example.com"
              />
            </Form.Item>
          </section>
          <section className="form-section">
            <div className="section-heading">
              <h3>凭据和用户信息</h3>
              <p>控制访问凭据的寿命，以及这个服务最多可以获得哪些用户信息。</p>
            </div>
            <Row gutter={18}>
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  label={
                    <FieldLabel
                      label="有效时长"
                      help="服务收到的访问凭据最多可以使用多久，留空使用平台默认值。"
                    />
                  }
                >
                  <div className="ttl-input">
                    <Form.Item
                      name="accessTokenTtlSeconds"
                      noStyle
                    >
                      <InputNumber
                        min={1}
                        precision={0}
                        placeholder="平台默认"
                      />
                    </Form.Item>
                    <span className="input-unit">秒</span>
                  </div>
                </Form.Item>
              </Col>
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="introspectionClientId"
                  label={
                    <FieldLabel
                      label="令牌检查应用"
                      help="可选。填写一个后端应用编号，用于检查凭据是否仍然有效。"
                    />
                  }
                >
                  <Input
                    allowClear
                    placeholder="可选：后端应用编号"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="allowedClaims"
              label={
                <FieldLabel
                  label="可返回用户信息"
                  help="限制这个服务最多能收到哪些用户信息，最终结果仍会受权限项限制。"
                />
              }
              rules={[
                { required: true, type: 'array', min: 1, message: '至少选择一项可返回的用户信息' },
              ]}
            >
              <Select
                mode="tags"
                options={claimOptions}
                placeholder="选择或输入用户字段"
              />
            </Form.Item>
            <Form.Item
              name="remark"
              label={
                <FieldLabel
                  label="备注"
                  help="仅供管理员记录，不会发送给外部应用或服务。"
                />
              }
            >
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
              />
            </Form.Item>
          </section>
        </Form>
      </Modal>
    </PageFrame>
  )
}
