import OAuthTag from '@/components/OAuthWorkspace/OAuthTag'
import TagSummary from '@/components/OAuthWorkspace/TagSummary'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel'
import {
  SearchOutlined as QuerySearchIcon,
  ReloadOutlined as QueryResetIcon,
  PlusOutlined as AddIcon,
} from '@ant-design/icons'
import { checkPermi } from '@/utils/permission'
import { Dropdown } from 'antd'
import TableActions, { TableAction } from '@/components/TableActions'

import '@/components/OAuthWorkspace/entities.css'
import EntityCell from '@/components/OAuthWorkspace/EntityCell'
import { useCallback, useEffect, useState } from 'react'
import {
  Row,
  Col,
  Empty,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Tabs,
} from 'antd'
import Table from '@/components/Table'
import {
  addOAuthClient,
  changeOAuthClientStatus,
  deleteOAuthClients,
  getOAuthClient,
  listOAuthClients,
  rotateOAuthClientSecret,
  updateOAuthClient,
} from '@/api/system/oauthClient'
import { listOAuthResources, listOAuthScopes } from '@/api/system/oauthResource'
import { validateRegisteredUriList } from '@/utils/oauthUri'
import { parseTime } from '@/utils/ruoyi'
import { confirm, message } from '@/plugins/modal'
import PageFrame from '@/components/OAuthWorkspace/PageFrame'
import AccessMap from '@/components/OAuthWorkspace/AccessMap'
import StringListInput from '@/components/OAuthWorkspace/StringListInput'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import SecretDialog from './secret'
import { uriFields, toEditor, clientPayload } from './form'

const grantLabels = {
  authorization_code: '用户登录',
  refresh_token: '保持登录',
  client_credentials: '服务间调用',
}
export default function OAuthClient() {
  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true)
  const [open, setOpen] = useState(false),
    [clientId, setClientId] = useState(),
    [tab, setTab] = useState('basic'),
    [saving, setSaving] = useState(false),
    [scopes, setScopes] = useState([]),
    [resources, setResources] = useState([]),
    [secret, setSecret] = useState(null)
  const type = Form.useWatch('clientType', form),
    grants = Form.useWatch('grantTypes', form) || [],
    scopeCodes = Form.useWatch('scopeCodes', form) || [],
    resourceIds = Form.useWatch('resourceIds', form) || [],
    clientName = Form.useWatch('clientName', form)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOAuthClients(query)
      setRows(result.rows || [])
      setTotal(result.total || 0)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  async function loadAccessOptions() {
    const result = await Promise.allSettled([
      listOAuthScopes({ pageNum: 1, pageSize: 200, status: '0' }),
      listOAuthResources({ pageNum: 1, pageSize: 200, status: '0' }),
    ])
    if (result[0].status === 'fulfilled') setScopes(result[0].value.rows || [])
    if (result[1].status === 'fulfilled') setResources(result[1].value.rows || [])
  }
  useEffect(() => {
    void getList()
  }, [getList])
  useEffect(() => {
    void loadAccessOptions()
  }, [])
  function add() {
    form.resetFields()
    form.setFieldsValue(toEditor())
    setClientId(undefined)
    setTab('basic')
    setOpen(true)
    void loadAccessOptions()
  }
  async function edit(row) {
    try {
      const result = await getOAuthClient(row.clientId)
      form.resetFields()
      form.setFieldsValue(toEditor(result.data))
      setClientId(row.clientId)
      setTab('basic')
      setOpen(true)
      void loadAccessOptions()
    } catch {}
  }
  function sync(values) {
    if ('clientType' in values) {
      const publicClient = values.clientType === 'public'
      form.setFieldsValue({
        tokenEndpointAuthMethod: publicClient ? 'none' : 'client_secret_basic',
        ...(publicClient
          ? {
              requirePkce: true,
              grantTypes: (form.getFieldValue('grantTypes') || []).filter(
                (value) => value !== 'client_credentials'
              ),
            }
          : {}),
      })
    }
    if ('grantTypes' in values) {
      const selected = values.grantTypes
      if (!selected.includes('authorization_code'))
        form.setFieldValue(
          'grantTypes',
          selected.filter((value) => value !== 'refresh_token')
        )
      else form.setFieldValue('requirePkce', true)
    }
    if ('scopeCodes' in values)
      form.setFieldValue(
        'preAuthorizedScopeCodes',
        (form.getFieldValue('preAuthorizedScopeCodes') || []).filter((value) =>
          values.scopeCodes.includes(value)
        )
      )
  }
  async function save() {
    try {
      await form.validateFields()
    } catch (error) {
      const name = error.errorFields?.[0]?.name?.[0]
      setTab(
        {
          clientName: 'basic',
          clientType: 'basic',
          grantTypes: 'login',
          scopeCodes: 'access',
          allowedRoleKeys: 'access',
          ...Object.fromEntries(uriFields.map(([name]) => [name, 'uri'])),
        }[name] || 'basic'
      )
      return
    }
    setSaving(true)
    try {
      const data = clientPayload(form.getFieldsValue(true), clientId)
      const result = await (clientId ? updateOAuthClient : addOAuthClient)(data)
      message.success('应用配置已保存')
      setOpen(false)
      if (result.data?.clientSecret) setSecret(result.data)
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
          ? `启用应用“${row.clientName}”？`
          : `停用“${row.clientName}”将同时撤销该应用的授权与刷新凭据，是否继续？`
      )
      await (enable
        ? changeOAuthClientStatus({ clientId: row.clientId, status: '0' })
        : deleteOAuthClients(row.clientId))
      message.success(enable ? '应用已启用' : '应用已停用')
      await getList()
    } catch {}
  }
  async function rotate(row) {
    try {
      await confirm(`为“${row.clientName}”生成新密钥？旧密钥将进入有界退役窗口。`)
      const result = await rotateOAuthClientSecret(row.clientId)
      setSecret(result.data)
      await getList()
    } catch {}
  }
  const scopeOptions = [
    ...new Map([
      ...scopes.map((row) => [row.scopeCode, { value: row.scopeCode, label: row.scopeName }]),
      ...scopeCodes
        .filter((value) => !scopes.some((row) => row.scopeCode === value))
        .map((value) => [value, { value, label: value }]),
    ]).values(),
  ]
  const resourceOptions = [
    ...new Map([
      ...resources.map((row) => [
        row.resourceId,
        { value: row.resourceId, label: row.resourceName },
      ]),
      ...resourceIds
        .filter((value) => !resources.some((row) => row.resourceId === value))
        .map((value) => [value, { value, label: value }]),
    ]).values(),
  ]
  const sections = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <>
          <Form.Item
            name="clientName"
            label={
              <FieldLabel
                label="应用名称"
                help="便于管理员识别这个应用，不影响登录流程。"
              />
            }
            rules={[{ required: true, whitespace: true, message: '请输入应用名称' }]}
          >
            <Input
              maxLength={100}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="clientType"
            label={
              <FieldLabel
                label="运行形态"
                help="网页或移动端无法安全保存密钥；后端服务可以在服务器中安全保存密钥。"
              />
            }
            rules={[{ required: true }]}
          >
            <Radio.Group
              className="oauth-choice-grid"
              disabled={!!clientId}
              options={[
                {
                  value: 'confidential',
                  label: (
                    <>
                      <strong>后端服务</strong>
                      <small>可以安全保存应用密钥</small>
                    </>
                  ),
                },
                {
                  value: 'public',
                  label: (
                    <>
                      <strong>网页或移动端</strong>
                      <small>不能在终端中保存密钥</small>
                    </>
                  ),
                },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="remark"
            label={
              <FieldLabel
                label="备注"
                help="仅供管理员记录用途，不会发送给外部应用。"
              />
            }
          >
            <Input.TextArea
              maxLength={500}
              rows={3}
              showCount
            />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'login',
      label: '登录方式',
      children: (
        <>
          <Form.Item
            name="grantTypes"
            label={
              <FieldLabel
                label="允许的方式"
                help="网页或移动端通常使用用户登录；没有具体用户的后台任务使用服务间调用。"
              />
            }
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: '至少选择一种登录或调用方式',
              },
            ]}
          >
            <Checkbox.Group
              className="oauth-option-stack"
              options={Object.entries(grantLabels).map(([value, label]) => ({
                value,
                label: (
                  <span>
                    {label}
                    <small>
                      {
                        {
                          authorization_code: '用户在统一认证中心输入账号后返回应用。',
                          refresh_token: '允许应用在用户离开后延长登录状态。',
                          client_credentials: '后台服务以自身身份调用其他服务，不代表具体用户。',
                        }[value]
                      }
                    </small>
                  </span>
                ),
                disabled:
                  (value === 'client_credentials' && type === 'public') ||
                  (value === 'refresh_token' && !grants.includes('authorization_code')),
              }))}
            />
          </Form.Item>
          <Form.Item
            label={
              <FieldLabel
                label="登录安全"
                help="系统自动启用登录安全保护；其余选项控制是否展示用户确认和是否信任该应用。"
              />
            }
          >
            <Space
              orientation="vertical"
              size={8}
            >
              <Form.Item
                noStyle
                name="requirePkce"
                valuePropName="checked"
              >
                <Checkbox disabled>登录安全保护（系统自动开启）</Checkbox>
              </Form.Item>
              <Form.Item
                noStyle
                name="requireConsent"
                valuePropName="checked"
              >
                <Checkbox>登录时让用户确认权限</Checkbox>
              </Form.Item>
              <Form.Item
                noStyle
                name="trustedClient"
                valuePropName="checked"
              >
                <Checkbox>标记为受信任应用</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>
        </>
      ),
    },
    {
      key: 'access',
      label: '权限与服务',
      children: (
        <>
          <Form.Item
            name="scopeCodes"
            label={
              <FieldLabel
                label="可申请权限"
                help="应用登录或访问服务时，只能申请这里列出的权限。"
              />
            }
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: '至少添加一项可申请权限',
              },
            ]}
          >
            <Select
              placeholder="选择应用可申请的权限"
              mode="multiple"
              optionFilterProp="label"
              options={scopeOptions}
            />
          </Form.Item>
          {scopeCodes.includes('roles') && (
            <Form.Item
              name="allowedRoleKeys"
              label={
                <FieldLabel
                  label="可公开角色"
                  help="只公开用户已拥有且列在此处的角色。留空时不公开任何角色。"
                />
              }
              rules={[
                {
                  validator: (_, values = []) =>
                    values.some((value) => !value || value.length > 100 || /\s|\*/.test(value))
                      ? Promise.reject(
                          new Error('角色标识不得包含通配符或空白字符，长度不能超过100')
                        )
                      : Promise.resolve(),
                },
              ]}
            >
              <Select
                placeholder="输入允许向此应用公开的角色标识"
                mode="tags"
                tokenSeparators={[',']}
              />
            </Form.Item>
          )}
          <Form.Item
            name="preAuthorizedScopeCodes"
            label={
              <FieldLabel
                label="免重复确认"
                help="这些权限可以减少用户重复确认，必须属于上面的可申请权限。"
              />
            }
          >
            <Select
              placeholder="从已选权限中选择"
              mode="multiple"
              optionFilterProp="label"
              options={scopeOptions.filter((item) => scopeCodes.includes(item.value))}
            />
          </Form.Item>
          <Form.Item
            name="resourceIds"
            label={
              <FieldLabel
                label="可访问服务"
                help="填写服务与权限页面中已创建服务的标识，不是网址。"
              />
            }
          >
            <Select
              placeholder="选择应用可访问的服务"
              mode="multiple"
              optionFilterProp="label"
              options={resourceOptions}
            />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'uri',
      label: '回调地址',
      children: uriFields.map(([name, label, uriType]) => (
        <Form.Item
          key={name}
          name={name}
          label={
            <FieldLabel
              label={label}
              help={
                {
                  redirectUris: '用户完成登录后，系统只会跳转到这里登记的地址。',
                  postLogoutRedirectUris: '用户退出登录后可以返回的地址。',
                  backchannelLogoutUris: '应用需要接收后台退出通知时填写，可以留空。',
                  corsOrigins: '允许哪些网页从浏览器直接发起调用，只填写协议、域名和端口。',
                }[name]
              }
            />
          }
          rules={[
            {
              validator: (_, values = []) => {
                try {
                  validateRegisteredUriList(
                    values.join('\n'),
                    uriType,
                    uriType === 'redirect' &&
                      (form.getFieldValue('grantTypes') || []).includes('authorization_code')
                  )
                  return Promise.resolve()
                } catch (error) {
                  return Promise.reject(error)
                }
              },
            },
          ]}
        >
          <StringListInput
            placeholder={
              {
                redirectUris: 'https://portal.example.com/callback',
                postLogoutRedirectUris: 'https://portal.example.com/signed-out',
                backchannelLogoutUris: 'https://portal.example.com/backchannel-logout',
                corsOrigins: 'https://portal.example.com',
              }[name]
            }
            addText={
              {
                redirectUris: '添加登录返回地址',
                postLogoutRedirectUris: '添加退出返回地址',
                backchannelLogoutUris: '添加后台通知地址',
                corsOrigins: '添加网页来源',
              }[name]
            }
          />
        </Form.Item>
      )),
    },
    {
      key: 'duration',
      label: '有效时长',
      children: (
        <>
          <Row gutter={18}>
            {[
              ['accessTokenTtlSeconds', '访问凭据', '应用访问服务时使用的短期凭据有效多久。'],
              ['refreshTokenIdleSeconds', '闲置后失效', '保持登录凭据连续多久未使用后自动失效。'],
              [
                'refreshTokenAbsoluteSeconds',
                '最长有效时间',
                '保持登录凭据从签发起最长可以使用多久。',
              ],
            ].map(([name, label, help]) => (
              <Col
                key={name}
                xs={24}
                sm={12}
              >
                <Form.Item
                  label={
                    <FieldLabel
                      label={label}
                      help={help}
                    />
                  }
                >
                  <div className="ttl-input">
                    <Form.Item
                      name={name}
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
            ))}
          </Row>
        </>
      ),
    },
  ].map((item) => ({
    ...item,
    forceRender: true,
    children: (
      <>
        <div className="section-heading">
          <h3>
            {
              {
                basic: '这个应用是谁',
                login: '应用怎样完成登录或调用',
                access: '应用能够申请什么',
                uri: '登录完成后可以去哪里',
                duration: '登录凭据可以使用多久',
              }[item.key]
            }
          </h3>
          <p>
            {
              {
                basic: '名称用于后台识别，运行形态决定它是否能够安全保存应用密钥。',
                login: '只选择应用实际需要的方式，减少不必要的访问能力。',
                access: '从已经启用的权限和服务中选择，避免保存后才发现标识不存在。',
                uri: '每个地址单独填写并校验。正式环境应使用 HTTPS 完整地址。',
                duration: '留空时使用平台默认值。只有确有业务需要时才延长有效时间。',
              }[item.key]
            }
          </p>
        </div>
        {item.children}
      </>
    ),
  }))
  const columns = [
    {
      title: '应用',
      width: 250,
      render: (_, row) => (
        <EntityCell
          name={row.clientName}
          detail={row.clientId}
          kind="application"
          copyable
        />
      ),
    },
    {
      width: 130,
      title: '运行形态',
      dataIndex: 'clientType',
      render: (value) => (
        <OAuthTag
          effect="plain"
          type={value === 'confidential' ? 'primary' : 'info'}
        >
          {value === 'confidential' ? '后端服务' : '网页/移动端'}
        </OAuthTag>
      ),
    },
    {
      width: 240,
      title: '登录与调用方式',
      dataIndex: 'grantTypes',
      render: (values) =>
        (values || []).map((value) => grantLabels[value] || value).join(' · ') || '尚未配置',
    },
    {
      width: 200,
      title: '可访问服务',
      dataIndex: 'resourceIds',
      render: (values) => (
        <TagSummary
          effect="plain"
          values={values}
          limit={2}
          empty="仅身份信息"
        />
      ),
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
      title: '最近更新',
      dataIndex: 'updateTime',
      width: 170,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:oauthClient:edit']}>
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
                row.clientType === 'confidential' &&
                  checkPermi(['system:oauthClient:rotateSecret']) && {
                    key: 'rotate',
                    label: '轮换应用密钥',
                    onClick: () => rotate(row),
                  },
                row.status !== '0' &&
                  checkPermi(['system:oauthClient:edit']) && {
                    key: 'enable',
                    label: '重新启用',
                    onClick: () => change(row, true),
                  },
                row.status === '0' &&
                  checkPermi(['system:oauthClient:remove']) && {
                    key: 'disable',
                    label: '停用应用',
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
      className="oauth-client-page"
      title="应用"
      description="管理哪些网站、移动端和后端服务可以使用统一登录或访问受保护服务。"
      section="接入管理"
      filterHint="按应用名称、运行形态或当前状态查找"
      actions={
        <HasPermi value={['system:oauthClient:add']}>
          <Button
            icon={<AddIcon />}
            type="primary"
            onClick={add}
          >
            注册应用
          </Button>
        </HasPermi>
      }
      filters={
        showSearch && (
          <Form
            form={queryForm}
            layout="inline"
            className="search-form"
            onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
          >
            <Form.Item
              name="clientName"
              label="应用名称"
            >
              <Input
                style={{ width: 200 }}
                placeholder="输入应用名称"
                allowClear
              />
            </Form.Item>
            <Form.Item
              name="clientType"
              label="运行形态"
            >
              <Select
                style={{ width: 200 }}
                placeholder="全部形态"
                allowClear
                options={[
                  { value: 'confidential', label: '后端服务' },
                  { value: 'public', label: '网页或移动端' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="status"
              label="状态"
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
                  type="primary"
                  htmlType="submit"
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
            已登记 <strong>{total}</strong> 个应用
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
            <Empty description="还没有符合条件的应用">
              <HasPermi value={['system:oauthClient:add']}>
                <Button
                  type="primary"
                  onClick={add}
                >
                  注册第一个应用
                </Button>
              </HasPermi>
            </Empty>
          ),
        }}
        rowKey="clientId"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1350 }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        className="oauth-dialog oauth-client-editor"
        title={clientId ? '编辑应用' : '注册应用'}
        width="min(960px, calc(100vw - 48px))"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText="保存应用"
        mask={{ closable: false }}
        confirmLoading={saving}
        forceRender
      >
        <div className="oauth-editor-map">
          <span>访问关系预览</span>
          <AccessMap
            application={clientName}
            type={type}
            permissions={scopeCodes.map(
              (value) => scopeOptions.find((item) => item.value === value)?.label || value
            )}
            resources={resourceIds.map(
              (value) => resourceOptions.find((item) => item.value === value)?.label || value
            )}
          />
        </div>
        <Form
          name="src-views-system-oauth-client-index-jsx-editor-13"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '160px' }}
          form={form}
          layout="horizontal"
          onValuesChange={sync}
        >
          <Tabs
            tabPlacement="start"
            activeKey={tab}
            onChange={setTab}
            items={sections}
          />
        </Form>
      </Modal>
      <SecretDialog
        open={!!secret}
        secret={secret || {}}
        onClose={() => setSecret(null)}
      />
    </PageFrame>
  )
}
