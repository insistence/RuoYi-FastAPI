import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  get authorization_code() {
    return t('system:userSignIn')
  },
  get refresh_token() {
    return t('system:staySignedIn')
  },
  get client_credentials() {
    return t('system:serviceToServiceCalls')
  },
}
export default function OAuthClient() {
  useI18n()

  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true)
  useLocalizedFormErrors(queryForm, form)
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
          ...Object.fromEntries(uriFields().map(([name]) => [name, 'uri'])),
        }[name] || 'basic'
      )
      return
    }
    setSaving(true)
    try {
      const data = clientPayload(form.getFieldsValue(true), clientId)
      const result = await (clientId ? updateOAuthClient : addOAuthClient)(data)
      message.success(t('system:applicationSettingsSaved'))
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
          ? t('system:enableApplicationValue', { clientName: row.clientName })
          : t('system:disablingValueAlsoRevokesItsGrantsAndRefreshCredentials', {
              clientName: row.clientName,
            })
      )
      await (enable
        ? changeOAuthClientStatus({ clientId: row.clientId, status: '0' })
        : deleteOAuthClients(row.clientId))
      message.success(enable ? t('system:applicationEnabled') : t('monitor:appDisabled'))
      await getList()
    } catch {}
  }
  async function rotate(row) {
    try {
      await confirm(
        t('system:generateANewSecretForValueTheOldSecret', { clientName: row.clientName })
      )
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
      label: t('common:basicInfo'),
      children: (
        <>
          <Form.Item
            name="clientName"
            label={
              <FieldLabel
                label={t('system:applicationName')}
                help={t(
                  'authCenter:helpsAdministratorsIdentifyThisApplicationWithoutAffectingTheSignIn'
                )}
              />
            }
            rules={[
              { required: true, whitespace: true, message: t('system:enterAnApplicationName') },
            ]}
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
                label={t('system:applicationType')}
                help={t(
                  'authCenter:webAndMobileApplicationsCannotKeepSecretsSecurelyBackendServices'
                )}
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
                      <strong>{t('system:backendService')}</strong>
                      <small>{t('system:canSafelyStoreAnApplicationSecret')}</small>
                    </>
                  ),
                },
                {
                  value: 'public',
                  label: (
                    <>
                      <strong>{t('system:webOrMobileApplication')}</strong>
                      <small>{t('system:cannotStoreASecretSecurelyOnTheDevice')}</small>
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
                label={t('common:remark')}
                help={t('authCenter:forAdministratorsRecordsOnlyThisIsNotSentToExternal')}
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
      label: t('system:signInMethods'),
      children: (
        <>
          <Form.Item
            name="grantTypes"
            label={
              <FieldLabel
                label={t('system:allowedMethods')}
                help={t('authCenter:webAndMobileApplicationsUsuallyUseUserSignInBackground')}
              />
            }
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: t('system:selectAtLeastOneSignInOrServiceAccess'),
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
                          authorization_code: t(
                            'system:usersSignInAtTheAuthenticationCenterThenReturn'
                          ),
                          refresh_token: t('system:allowTheApplicationToExtendASessionAfterThe'),
                          client_credentials: t(
                            'system:aBackendServiceCallsOtherServicesAsItselfWithout'
                          ),
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
                label={t('system:signInSecurity')}
                help={t(
                  'authCenter:signInSecurityProtectionIsEnabledAutomaticallyTheRemainingOptions'
                )}
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
                <Checkbox disabled>{t('system:signInProtectionEnabledAutomatically')}</Checkbox>
              </Form.Item>
              <Form.Item
                noStyle
                name="requireConsent"
                valuePropName="checked"
              >
                <Checkbox>{t('system:askUsersToConfirmPermissionsAtSignIn')}</Checkbox>
              </Form.Item>
              <Form.Item
                noStyle
                name="trustedClient"
                valuePropName="checked"
              >
                <Checkbox>{t('system:markAsATrustedApplication')}</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>
        </>
      ),
    },
    {
      key: 'access',
      label: t('system:permissionsAndServices'),
      children: (
        <>
          <Form.Item
            name="scopeCodes"
            label={
              <FieldLabel
                label={t('system:availablePermissions')}
                help={t('authCenter:theApplicationCanRequestOnlyThePermissionsListedHereWhen')}
              />
            }
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: t('system:addAtLeastOneAvailablePermission'),
              },
            ]}
          >
            <Select
              placeholder={t('system:selectPermissionsTheApplicationMayRequest')}
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
                  label={t('system:disclosableRoles')}
                  help={t('authCenter:onlyTheRolesTheUserAlreadyHasAndThatAppear')}
                />
              }
              rules={[
                {
                  validator: (_, values = []) =>
                    values.some((value) => !value || value.length > 100 || /\s|\*/.test(value))
                      ? Promise.reject(
                          new Error(
                            t('system:roleIdentifiersMustNotContainWildcardsOrWhitespaceAnd')
                          )
                        )
                      : Promise.resolve(),
                },
              ]}
            >
              <Select
                placeholder={t('system:enterRoleIdentifiersThatMayBeDisclosedToThis')}
                mode="tags"
                tokenSeparators={[',']}
              />
            </Form.Item>
          )}
          <Form.Item
            name="preAuthorizedScopeCodes"
            label={
              <FieldLabel
                label={t('system:skipRepeatedConfirmation')}
                help={t(
                  'authCenter:thesePermissionsReduceRepeatedUserConfirmationsAndMustBeIncluded'
                )}
              />
            }
          >
            <Select
              placeholder={t('system:chooseFromSelectedPermissions')}
              mode="multiple"
              optionFilterProp="label"
              options={scopeOptions.filter((item) => scopeCodes.includes(item.value))}
            />
          </Form.Item>
          <Form.Item
            name="resourceIds"
            label={
              <FieldLabel
                label={t('pluginAdmin:accessibleServices')}
                help={t('authCenter:enterTheIdentifierOfAServiceCreatedOnTheServices')}
              />
            }
          >
            <Select
              placeholder={t('system:selectServicesTheApplicationMayAccess')}
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
      label: t('system:callbackUrls'),
      children: uriFields().map(([name, label, uriType]) => (
        <Form.Item
          key={name}
          name={name}
          label={
            <FieldLabel
              label={label}
              help={
                {
                  redirectUris: t('system:afterSignInTheSystemRedirectsUsersOnlyTo'),
                  postLogoutRedirectUris: t('system:urlsUsersMayReturnToAfterSigningOut'),
                  backchannelLogoutUris: t('system:enterAUrlIfTheApplicationNeedsBackChannel'),
                  corsOrigins: t('system:webOriginsAllowedToCallDirectlyFromABrowser'),
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
                redirectUris: t('system:addSignInReturnUrl'),
                postLogoutRedirectUris: t('system:addSignOutReturnUrl'),
                backchannelLogoutUris: t('system:addBackChannelNotificationUrl'),
                corsOrigins: t('system:addWebOrigin'),
              }[name]
            }
          />
        </Form.Item>
      )),
    },
    {
      key: 'duration',
      label: t('system:validityPeriods'),
      children: (
        <>
          <Row gutter={18}>
            {[
              [
                'accessTokenTtlSeconds',
                t('system:accessCredentials'),
                t('system:howLongShortLivedCredentialsRemainValidWhenThe'),
              ],
              [
                'refreshTokenIdleSeconds',
                t('system:expireAfterInactivity'),
                t('system:howLongPersistentSignInCredentialsMayRemainUnused'),
              ],
              [
                'refreshTokenAbsoluteSeconds',
                t('system:maximumLifetime'),
                t('system:theMaximumTimePersistentSignInCredentialsMayBe'),
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
                        placeholder={t('pluginAdmin:platformDefault')}
                      />
                    </Form.Item>
                    <span className="input-unit">{t('common:seconds')}</span>
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
                basic: t('system:applicationIdentity'),
                login: t('system:howTheApplicationSignsInOrCallsServices'),
                access: t('system:whatTheApplicationMayRequest'),
                uri: t('system:whereUsersMayGoAfterSignIn'),
                duration: t('system:howLongSignInCredentialsRemainValid'),
              }[item.key]
            }
          </h3>
          <p>
            {
              {
                basic: t('system:theNameIdentifiesTheApplicationInTheConsoleIts'),
                login: t('system:selectOnlyTheMethodsTheApplicationNeedsToLimit'),
                access: t('system:chooseEnabledPermissionsAndServicesToAvoidSavingUnknown'),
                uri: t('system:enterAndValidateEachUrlSeparatelyUseCompleteHttps'),
                duration: t('system:leaveBlankToUsePlatformDefaultsExtendLifetimesOnly'),
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
      title: t('common:apply'),
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
      title: t('system:applicationType'),
      dataIndex: 'clientType',
      render: (value) => (
        <OAuthTag
          effect="plain"
          type={value === 'confidential' ? 'primary' : 'info'}
        >
          {value === 'confidential' ? t('system:backendService') : t('system:webMobile')}
        </OAuthTag>
      ),
    },
    {
      width: 240,
      title: t('system:signInAndAccessMethods'),
      dataIndex: 'grantTypes',
      render: (values) =>
        (values || []).map((value) => grantLabels[value] || value).join(' · ') ||
        t('system:notConfigured'),
    },
    {
      width: 200,
      title: t('pluginAdmin:accessibleServices'),
      dataIndex: 'resourceIds',
      render: (values) => (
        <TagSummary
          effect="plain"
          values={values}
          limit={2}
          empty={t('common:identityInformationOnly')}
        />
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
      title: t('system:recentUpdates'),
      dataIndex: 'updateTime',
      width: 170,
      render: (value) => parseTime(value),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 180,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:oauthClient:edit']}>
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
                row.clientType === 'confidential' &&
                  checkPermi(['system:oauthClient:rotateSecret']) && {
                    key: 'rotate',
                    label: t('system:rotateApplicationSecret'),
                    onClick: () => rotate(row),
                  },
                row.status !== '0' &&
                  checkPermi(['system:oauthClient:edit']) && {
                    key: 'enable',
                    label: t('system:reEnable'),
                    onClick: () => change(row, true),
                  },
                row.status === '0' &&
                  checkPermi(['system:oauthClient:remove']) && {
                    key: 'disable',
                    label: t('system:disableApplication'),
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
      className="oauth-client-page"
      title={t('common:apply')}
      description={t('system:manageWhichWebsitesMobileApplicationsAndBackendServicesMay')}
      section={t('authCenter:integrationManagement')}
      filterHint={t('system:findApplicationsByNameTypeOrStatus')}
      actions={
        <HasPermi value={['system:oauthClient:add']}>
          <Button
            icon={<AddIcon />}
            type="primary"
            onClick={add}
          >
            {t('system:registerApplication')}
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
              label={t('system:applicationName')}
            >
              <Input
                style={{ width: 200 }}
                placeholder={t('system:enterApplicationName')}
                allowClear
              />
            </Form.Item>
            <Form.Item
              name="clientType"
              label={t('system:applicationType')}
            >
              <Select
                style={{ width: 200 }}
                placeholder={t('system:client.allTypes')}
                allowClear
                options={[
                  { value: 'confidential', label: t('system:backendService') },
                  { value: 'public', label: t('system:webOrMobileApplication') },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="status"
              label={t('common:status')}
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
                  type="primary"
                  htmlType="submit"
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
            {t('system:registered')} <strong>{total}</strong> {t('system:applications')}
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
            <Empty description={t('system:noMatchingApplications')}>
              <HasPermi value={['system:oauthClient:add']}>
                <Button
                  type="primary"
                  onClick={add}
                >
                  {t('system:registerYourFirstApplication')}
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
        title={clientId ? t('system:editApplication') : t('system:registerApplication')}
        width="min(960px, calc(100vw - 48px))"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText={t('system:saveApplication')}
        mask={{ closable: false }}
        confirmLoading={saving}
        forceRender
      >
        <div className="oauth-editor-map">
          <span>{t('system:accessRelationshipPreview')}</span>
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
