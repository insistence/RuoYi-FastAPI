import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import TagSummary from '@/components/OAuthWorkspace/TagSummary'
import OAuthTag from '@/components/OAuthWorkspace/OAuthTag'
import {
  SearchOutlined as QuerySearchIcon,
  ReloadOutlined as QueryResetIcon,
  PlusOutlined as AddIcon,
} from '@ant-design/icons'
import { checkPermi } from '@/utils/permission'
import { Dropdown } from 'antd'
import TableActions, { TableAction } from '@/components/TableActions'
import { PlusOutlined } from '@ant-design/icons'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel'
import '@/components/OAuthWorkspace/entities.css'
import EntityCell from '@/components/OAuthWorkspace/EntityCell'
import { useCallback, useEffect, useState } from 'react'
import { Empty, Button, Checkbox, Modal, Row, Col, Form, Input, Radio, Select, Space } from 'antd'
import Table from '@/components/Table'
import {
  addOAuthScope,
  changeOAuthScopeStatus,
  deleteOAuthScopes,
  getOAuthScope,
  listOAuthResources,
  listOAuthScopes,
  updateOAuthScope,
} from '@/api/system/oauthResource'
import { confirm, message } from '@/plugins/modal'
import PageFrame from '@/components/OAuthWorkspace/PageFrame'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'

const claimOptions = () =>
  [
    ['sub', t('system:uniqueUserIdentifier')],
    ['name', t('system:name')],
    ['email', t('system:user.email')],
    ['roles', t('system:user.role')],
    ['preferred_username', t('system:loginAccount')],
  ].map(([value, label]) => ({ value, label: `${label}（${value}）` }))
const defaults = {
  scopeCode: '',
  scopeName: '',
  scopeType: 'identity',
  resourceId: null,
  claims: [],
  consentRequired: true,
  sensitive: false,
  status: '0',
  remark: '',
}
const scopeTypes = [
  {
    value: 'identity',
    get label() {
      return t('system:signInIdentityInformation')
    },
  },
  {
    value: 'resource',
    get label() {
      return t('system:serviceAccess')
    },
  },
]
export default function OAuthScope() {
  useI18n()

  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    type = Form.useWatch('scopeType', form),
    scopeCode = Form.useWatch('scopeCode', form)
  useLocalizedFormErrors(queryForm, form)
  const [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [resources, setResources] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOAuthScopes(query)
      setRows(result.rows || [])
      setTotal(result.total || 0)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  async function loadResources() {
    try {
      setResources(
        (await listOAuthResources({ pageNum: 1, pageSize: 200, status: '0' })).rows || []
      )
    } catch {}
  }
  useEffect(() => {
    void getList()
  }, [getList])
  useEffect(() => {
    void loadResources()
  }, [])
  function add() {
    form.resetFields()
    form.setFieldsValue(defaults)
    setEditing(false)
    setOpen(true)
    void loadResources()
  }
  async function edit(row) {
    try {
      const result = await getOAuthScope(row.scopeCode)
      form.resetFields()
      form.setFieldsValue({ ...defaults, ...result.data })
      setEditing(true)
      setOpen(true)
      void loadResources()
    } catch {}
  }
  async function save() {
    try {
      await form.validateFields()
      const values = form.getFieldsValue(true),
        data = Object.fromEntries(
          Object.keys(defaults).map((key) => [key, values[key] ?? defaults[key]])
        )
      if (data.scopeType === 'identity') data.resourceId = null
      setSaving(true)
      await (editing ? updateOAuthScope : addOAuthScope)(data)
      message.success(t('system:permissionSaved'))
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
          ? t('system:enablePermissionValue', { scopeName: row.scopeName })
          : t('system:disablingPermissionValuePreventsApplicationsFromRequestingItContinue', {
              scopeName: row.scopeName,
            })
      )
      await (enable
        ? changeOAuthScopeStatus({ scopeCode: row.scopeCode, status: '0' })
        : deleteOAuthScopes(row.scopeCode))
      message.success(enable ? t('system:permissionEnabled') : t('system:permissionDisabled'))
      await getList()
    } catch {}
  }
  const columns = [
    {
      title: t('system:permission.title'),
      width: 230,
      render: (_, row) => (
        <EntityCell
          name={row.scopeName}
          detail={row.scopeCode}
          kind="scope"
          copyable
        />
      ),
    },
    {
      width: 135,
      title: t('system:purpose'),
      dataIndex: 'scopeType',
      render: (value) => (
        <OAuthTag
          effect="plain"
          type={value === 'identity' ? 'primary' : 'success'}
        >
          {scopeTypes.find((item) => item.value === value)?.label || value}
        </OAuthTag>
      ),
    },
    {
      width: 180,
      title: t('system:service'),
      dataIndex: 'resourceId',
      render: (value) =>
        value
          ? resources.find((item) => item.resourceId === value)?.resourceName || value
          : t('system:unifiedIdentityInformation'),
    },
    {
      width: 230,
      title: t('system:returnedUserInformation'),
      render: (_, row) => (
        <TagSummary
          effect="plain"
          values={row.claims}
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
      width: 145,
      title: t('system:userConfirmation'),
      dataIndex: 'consentRequired',
      render: (value, row) => (
        <div className="oauth-policy-cell">
          {row.sensitive && (
            <OAuthTag
              size="small"
              type="warning"
            >
              {t('system:sensitivePermission')}
            </OAuthTag>
          )}
          <span>
            {value ? t('system:confirmationRequired') : t('system:scope.skipRepeatedConfirmation')}
          </span>
        </div>
      ),
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
      width: 180,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:oauthScope:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => edit(row)}
            >
              {t('common:editAction')}
            </TableAction>
          </HasPermi>
          {row.scopeCode !== 'openid' && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  row.status !== '0' &&
                    checkPermi(['system:oauthScope:edit']) && {
                      key: 'enable',
                      label: t('system:reEnable'),
                      onClick: () => change(row, true),
                    },
                  row.status === '0' &&
                    checkPermi(['system:oauthScope:remove']) && {
                      key: 'disable',
                      label: t('system:disablePermission'),
                      onClick: () => change(row, false),
                    },
                ].filter(Boolean),
              }}
            >
              <TableAction symbol="ArrowDown">{t('common:more')}</TableAction>
            </Dropdown>
          )}
        </TableActions>
      ),
    },
  ]
  return (
    <PageFrame
      className="oauth-scope-page"
      title={t('system:permission.title')}
      description={t('system:describeTheIdentityInformationAndServiceOperationsApplicationsMay')}
      section={t('authCenter:integrationManagement')}
      filterHint={t('system:protocolCodesAppearAsSecondaryInformationSearchByName')}
      actions={
        <HasPermi value={['system:oauthScope:add']}>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={add}
          >
            {t('system:scope.addPermission')}
          </Button>
        </HasPermi>
      }
      filters={
        showSearch && (
          <Form
            form={queryForm}
            name="oauth-scope-query"
            layout="inline"
            className="search-form"
            onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
          >
            <Form.Item
              label={t('system:permissionName')}
              name="scopeName"
            >
              <Input
                style={{ width: 200 }}
                placeholder={t('system:enterPermissionName')}
                allowClear
              />
            </Form.Item>
            <Form.Item
              label={t('system:purpose')}
              name="scopeType"
            >
              <Select
                style={{ width: 200 }}
                placeholder={t('system:allPurposes')}
                allowClear
                options={scopeTypes}
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
            {t('system:defined')} <strong>{total}</strong> {t('system:scope.permissions')}
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
            <Empty description={t('system:noMatchingPermissions')}>
              <HasPermi value={['system:oauthScope:add']}>
                <Button
                  type="primary"
                  onClick={add}
                >
                  {t('system:addYourFirstPermission')}
                </Button>
              </HasPermi>
            </Empty>
          ),
        }}
        rowKey="scopeCode"
        dataSource={rows}
        columns={columns}
        loading={loading}
        pagination={false}
        scroll={{ x: 1150 }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        className="oauth-dialog oauth-scope-editor"
        title={editing ? t('system:editPermission') : t('system:scope.addPermission')}
        open={open}
        width="min(780px, calc(100vw - 48px))"
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
              {t('system:savePermission')}
            </Button>
          </Space>
        }
      >
        <Form
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          layout="horizontal"
          form={form}
          name="oauth-scope-editor"
          labelCol={{ flex: '160px' }}
          className="permission-form ruoyi-dialog-form"
        >
          <div className="section-heading">
            <h3>{t('system:permissionMeaning')}</h3>
            <p>{t('system:chooseWhetherThisPermissionProvidesSignInInformationOr')}</p>
          </div>
          <Form.Item
            name="scopeType"
            label={
              <FieldLabel
                label={t('system:permissionPurpose')}
                help={t(
                  'authCenter:identityPermissionsReturnUserProfileInformationServiceAccessPermissionsAllow'
                )}
              />
            }
            rules={[{ required: true }]}
          >
            <Radio.Group
              className="choice-grid"
              disabled={scopeCode === 'openid'}
            >
              <Radio value="identity">
                <strong>{t('system:signInIdentityInformation')}</strong>
                <small>{t('system:forExampleNameEmailAndRoles')}</small>
              </Radio>
              <Radio value="resource">
                <strong>{t('system:serviceAccess')}</strong>
                <small>{t('system:forExampleViewingOrdersOrUpdatingInventory')}</small>
              </Radio>
            </Radio.Group>
          </Form.Item>
          <Row gutter={18}>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="scopeName"
                label={
                  <FieldLabel
                    label={t('system:displayName')}
                    help={t('authCenter:theNameShownToUsersDuringConsentAndInAdmin')}
                  />
                }
                rules={[{ required: true, whitespace: true }]}
              >
                <Input
                  maxLength={100}
                  placeholder={t('system:forExampleViewOrders')}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="scopeCode"
                label={
                  <FieldLabel
                    label={t('system:permissionCode')}
                    help={t('authCenter:theProtocolCodeTheApplicationUsesInSignInRequests')}
                  />
                }
                rules={[{ required: true, whitespace: true }]}
              >
                <Input
                  disabled={editing}
                  maxLength={100}
                  placeholder={t('system:forExampleOrdersRead')}
                />
              </Form.Item>
            </Col>
          </Row>
          {type === 'resource' && (
            <Form.Item
              name="resourceId"
              label={
                <FieldLabel
                  label={t('system:service')}
                  help={t('authCenter:chooseTheServiceTheApplicationCanAccessWithThisPermission')}
                />
              }
              rules={[
                { required: true, message: t('system:chooseTheServiceThisPermissionBelongsTo') },
              ]}
            >
              <Select
                showSearch={{ optionFilterProp: 'label' }}
                placeholder={t('system:chooseAService')}
                options={resources.map((row) => ({
                  value: row.resourceId,
                  label: row.resourceName,
                }))}
                optionRender={({ data }) => (
                  <>
                    <span>{data.label}</span>
                    <code className="option-code">{data.value}</code>
                  </>
                )}
              />
            </Form.Item>
          )}
          <Form.Item
            name="claims"
            label={
              <FieldLabel
                label={t('system:returnUserInformation')}
                help={t('authCenter:theUserInformationAnApplicationCanReceiveWithThisPermission')}
              />
            }
          >
            <Select
              mode="tags"
              options={claimOptions()}
              placeholder={t('system:selectOrEnterUserFields')}
            />
          </Form.Item>
          <Form.Item
            label={
              <FieldLabel
                label={t('system:userConfirmation')}
                help={t(
                  'authCenter:sensitivePermissionsShouldRequireExplicitUserConfirmationAndBeEmphasized'
                )}
              />
            }
          >
            <div className="policy-options">
              <Form.Item
                name="consentRequired"
                valuePropName="checked"
                noStyle
              >
                <Checkbox>{t('system:askTheUserToConfirmBeforeUse')}</Checkbox>
              </Form.Item>
              <Form.Item
                name="sensitive"
                valuePropName="checked"
                noStyle
              >
                <Checkbox>{t('system:markAsSensitivePermission')}</Checkbox>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item
            name="remark"
            label={
              <FieldLabel
                label={t('common:remark')}
                help={t('authCenter:forAdministratorsRecordsOnlyThisIsNotShownToExternal')}
              />
            }
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageFrame>
  )
}
