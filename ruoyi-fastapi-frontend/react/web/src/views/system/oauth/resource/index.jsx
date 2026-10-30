import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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

const claimOptions = () =>
  [
    ['sub', t('system:uniqueUserIdentifier')],
    ['name', t('system:name')],
    ['email', t('system:user.email')],
    ['roles', t('system:user.role')],
    ['client_id', t('authCenter:appId')],
    ['scope', t('system:grantedPermissions')],
    ['sid', t('system:sessionIdentifier')],
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
  if (!value) return t('system:useSystemDefault')
  return value % 3600 === 0
    ? t('system:valueHours', { arg0: value / 3600 })
    : value % 60 === 0
      ? t('system:valueMinutes', { arg0: value / 60 })
      : t('system:valueSeconds', { value })
}
export default function OAuthResource() {
  useI18n()

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
  useLocalizedFormErrors(queryForm, form)
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
      message.success(t('system:resourceSettingsSaved'))
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
          ? t('system:enableResourceValue', { resourceName: row.resourceName })
          : t('system:disablingValueStopsIssuanceAndRefreshOfAccessTokens', {
              resourceName: row.resourceName,
            })
      )
      await (enable
        ? changeOAuthResourceStatus({ resourceId: row.resourceId, status: '0' })
        : deleteOAuthResources(row.resourceId))
      message.success(enable ? t('system:resourceEnabled') : t('system:resourceDisabled'))
      await getList()
    } catch {}
  }
  const columns = [
    {
      title: t('common:service'),
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
      title: t('system:tokenAudience'),
      dataIndex: 'audience',
      ellipsis: true,
      render: (value) => <code className="resource-audience">{value}</code>,
    },
    {
      width: 240,
      title: t('system:returnedUserInformation'),
      render: (_, row) => (
        <TagSummary
          effect="plain"
          values={row.allowedClaims}
          label={(value) =>
            claimOptions()
              .find((item) => item.value === value)
              ?.label.split('（')[0] || value
          }
          empty={t('authCenter:returnNoAdditionalInformation')}
        />
      ),
    },
    {
      width: 120,
      align: 'center',
      title: t('system:validityPeriods'),
      dataIndex: 'accessTokenTtlSeconds',
      render: duration,
    },
    {
      width: 105,
      align: 'center',
      title: t('common:status'),
      dataIndex: 'status',
      render: (value) => (
        <OAuthTag type={value === '0' ? 'success' : 'info'}>
          {value === '0' ? t('system:inUse') : t('common:disabled')}
        </OAuthTag>
      ),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      fixed: 'right',
      width: 180,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:oauthResource:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => edit(row)}
            >
              {t('common:editAction')}
            </TableAction>
          </HasPermi>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                row.status !== '0' &&
                  checkPermi(['system:oauthResource:edit']) && {
                    key: 'enable',
                    label: t('system:reEnable'),
                    onClick: () => change(row, true),
                  },
                row.status === '0' &&
                  checkPermi(['system:oauthResource:remove']) && {
                    key: 'disable',
                    label: t('system:disableService'),
                    onClick: () => change(row, false),
                  },
              ].filter(Boolean),
            }}
          >
            <TableAction symbol="ArrowDown">{t('common:more')}</TableAction>
          </Dropdown>
        </TableActions>
      ),
    },
  ]
  return (
    <PageFrame
      className="oauth-resource-page"
      title={t('common:service')}
      description={t('system:registerApiServicesThatReceiveAccessCredentialsAndLimit')}
      section={t('authCenter:integrationManagement')}
      filterHint={t('system:findServicesByNameOrStatus')}
      actions={
        <HasPermi value={['system:oauthResource:add']}>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={add}
          >
            {t('system:addService')}
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
              label={t('system:serviceName')}
              name="resourceName"
            >
              <Input
                style={{ width: 200 }}
                placeholder={t('system:enterServiceName')}
                allowClear
              />
            </Form.Item>
            <Form.Item
              label={t('common:status')}
              name="status"
            >
              <Select
                style={{ width: 200 }}
                placeholder={t('common:allStatuses')}
                allowClear
                options={[
                  { value: '0', label: t('system:inUse') },
                  { value: '1', label: t('common:disabled') },
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
                  {t('common:find')}
                </Button>
                <Button
                  icon={<QueryResetIcon />}
                  onClick={() => {
                    queryForm.resetFields()
                    setQuery({ pageNum: 1, pageSize: 10 })
                  }}
                >
                  {t('common:clear')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )
      }
      toolbar={
        <>
          <span className="result-count">
            {t('system:registered')} <strong>{total}</strong> {t('system:services')}
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
            <Empty description={t('system:noMatchingServices')}>
              <HasPermi value={['system:oauthResource:add']}>
                <Button
                  type="primary"
                  onClick={add}
                >
                  {t('system:addYourFirstService')}
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
        title={editing ? t('system:editService') : t('system:addService')}
        open={open}
        width="min(820px, calc(100vw - 48px))"
        onCancel={() => setOpen(false)}
        mask={{ closable: false }}
        forceRender
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>{t('common:cancel')}</Button>
            <Button
              type="primary"
              loading={saving}
              onClick={save}
            >
              {t('system:saveService')}
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
              <h3>{t('system:serviceIdentity')}</h3>
              <p>{t('system:applicationsRequestAccessUsingTheServiceIdentifierServicesUse')}</p>
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
                      label={t('system:serviceName')}
                      help={t('authCenter:aDisplayNameThatHelpsAdministratorsIdentifyThisService')}
                    />
                  }
                  rules={[{ required: true, whitespace: true }]}
                >
                  <Input
                    maxLength={100}
                    placeholder={t('system:forExampleOrderService')}
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
                      label={t('system:serviceIdentifier')}
                      help={t(
                        'authCenter:applicationsAssociateThisServiceWithItsUniqueIdentifierWhichCannot'
                      )}
                    />
                  }
                  rules={[{ required: true, whitespace: true }]}
                >
                  <Input
                    disabled={editing}
                    maxLength={100}
                    placeholder={t('system:forExampleOrdersApi')}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="audience"
              label={
                <FieldLabel
                  label={t('system:tokenAudience')}
                  help={t('authCenter:theUniqueValueUsedByTheServiceToValidateAccess')}
                />
              }
              rules={[{ required: true, whitespace: true }]}
            >
              <Input
                disabled={editing}
                maxLength={500}
                placeholder={t('system:forExampleHttpsApiExampleCom')}
              />
            </Form.Item>
          </section>
          <section className="form-section">
            <div className="section-heading">
              <h3>{t('system:credentialsAndUserInformation')}</h3>
              <p>{t('system:controlAccessCredentialLifetimesAndTheMaximumUserInformation')}</p>
            </div>
            <Row gutter={18}>
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  label={
                    <FieldLabel
                      label={t('system:validityPeriods')}
                      help={t('authCenter:theMaximumLifetimeOfAccessTokensReceivedByTheService')}
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
                        placeholder={t('pluginAdmin:platformDefault')}
                      />
                    </Form.Item>
                    <span className="input-unit">{t('common:seconds')}</span>
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
                      label={t('system:tokenIntrospectionApplication')}
                      help={t('authCenter:optionalEnterABackendApplicationIdToCheckWhetherTokens')}
                    />
                  }
                >
                  <Input
                    allowClear
                    placeholder={t('system:optionalBackendApplicationId')}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="allowedClaims"
              label={
                <FieldLabel
                  label={t('system:allowedUserInformation')}
                  help={t('authCenter:limitsTheUserInformationThisServiceCanReceiveTheFinal')}
                />
              }
              rules={[
                {
                  required: true,
                  type: 'array',
                  min: 1,
                  message: t('system:selectAtLeastOneAllowedUserInformationField'),
                },
              ]}
            >
              <Select
                mode="tags"
                options={claimOptions()}
                placeholder={t('system:selectOrEnterUserFields')}
              />
            </Form.Item>
            <Form.Item
              name="remark"
              label={
                <FieldLabel
                  label={t('common:remark')}
                  help={t('authCenter:builder.forAdministratorsRecordsOnlyThisIsNotSentToExternal')}
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
