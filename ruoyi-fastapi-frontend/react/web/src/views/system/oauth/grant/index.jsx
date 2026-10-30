import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { UserOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import { Fragment } from 'react'
import TagSummary from '@/components/OAuthWorkspace/TagSummary'
import OAuthTag from '@/components/OAuthWorkspace/OAuthTag'
import { LockOutlined, UnlockOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { Empty } from 'antd'
import {
  SearchOutlined as QuerySearchIcon,
  ReloadOutlined as QueryResetIcon,
} from '@ant-design/icons'
import TableActions, { TableAction } from '@/components/TableActions'

import '@/components/OAuthWorkspace/entities.css'
import EntityCell from '@/components/OAuthWorkspace/EntityCell'
import { useCallback, useEffect, useState } from 'react'
import { Button, Collapse, Descriptions, Drawer, Form, Input, Modal, Select, Space } from 'antd'
import Table from '@/components/Table'
import {
  getOAuthGrant,
  listOAuthGrants,
  revokeOAuthGrants,
  setOAuthClientAccess,
} from '@/api/system/oauthSession'
import { parseTime } from '@/utils/ruoyi'
import { message } from '@/plugins/modal'
import PageFrame from '@/components/OAuthWorkspace/PageFrame'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import AccessPolicyDrawer from './AccessPolicyDrawer'

const statuses = [
    {
      value: 'active',
      get label() {
        return t('system:stillValid')
      },
    },
    {
      value: 'revoked',
      get label() {
        return t('system:revoked')
      },
    },
    {
      value: 'expired',
      get label() {
        return t('common:expired')
      },
    },
  ],
  accessOptions = [
    {
      value: 'allowed',
      get label() {
        return t('system:consentAllowed')
      },
    },
    {
      value: 'blocked',
      get label() {
        return t('system:blockAccess')
      },
    },
  ]
const statusTag = (value) => (
  <OAuthTag type={{ active: 'success', revoked: 'danger', expired: 'info' }[value] || 'info'}>
    {statuses.find((item) => item.value === value)?.label || t('system:unknownStatus')}
  </OAuthTag>
)
export default function OAuthGrant() {
  useI18n()

  const [queryForm] = Form.useForm(),
    [revokeForm] = Form.useForm(),
    [accessForm] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [selected, setSelected] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [revokeTargets, setRevokeTargets] = useState(null),
    [revoking, setRevoking] = useState(false),
    [detail, setDetail] = useState(null),
    [accessTarget, setAccessTarget] = useState(null),
    [savingAccess, setSavingAccess] = useState(false),
    [policyOpen, setPolicyOpen] = useState(false)
  useLocalizedFormErrors(queryForm, revokeForm, accessForm)
  const revokeReason = Form.useWatch('reason', revokeForm)
  const accessReason = Form.useWatch('reason', accessForm)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOAuthGrants(query)
      setRows(result.rows || [])
      setTotal(result.total || 0)
      setSelected([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  function openRevoke(targets) {
    revokeForm.resetFields()
    setRevokeTargets(targets)
  }
  async function revoke() {
    try {
      const values = await revokeForm.validateFields()
      setRevoking(true)
      await revokeOAuthGrants(
        revokeTargets.map((row) => row.grantId),
        { reason: values.reason.trim() }
      )
      message.success(t('system:grantRevoked'))
      setRevokeTargets(null)
      await getList()
    } catch {
    } finally {
      setRevoking(false)
    }
  }
  function openAccess(row) {
    accessForm.resetFields()
    setAccessTarget(row)
  }
  async function saveAccess() {
    try {
      const values = await accessForm.validateFields()
      setSavingAccess(true)
      const blocked = accessTarget.accessStatus !== 'blocked'
      await setOAuthClientAccess(accessTarget.userId, accessTarget.clientId, {
        blocked,
        reason: values.reason.trim(),
      })
      message.success(
        blocked
          ? t('system:accessToThisApplicationHasBeenBlocked')
          : t('system:restrictionRemovedGrantConsentAgain')
      )
      setAccessTarget(null)
      await getList()
    } catch {
    } finally {
      setSavingAccess(false)
    }
  }
  async function showDetail(row) {
    try {
      setDetail((await getOAuthGrant(row.grantId)).data)
    } catch {}
  }
  const columns = [
    {
      title: t('system:user.user'),
      width: 180,
      render: (_, row) => (
        <EntityCell
          name={row.userName || t('authCenter:userIdentifier', { id: row.userId })}
          detail={row.userId || row.subjectId?.slice(0, 12)}
          kind="person"
        />
      ),
    },
    {
      title: t('system:grantedToApplication'),
      width: 210,
      render: (_, row) => (
        <div className="oauth-stacked-cell">
          <strong>{row.clientName || row.clientId}</strong>
          <code>{row.clientId}</code>
        </div>
      ),
    },
    {
      width: 260,
      title: t('system:allowedPermissions'),
      dataIndex: 'grantedScopes',
      render: (values) => (
        <TagSummary
          effect="plain"
          values={values}
        />
      ),
    },
    {
      width: 170,
      title: t('pluginAdmin:accessibleServices'),
      dataIndex: 'grantedResources',
      ellipsis: true,
      render: (values) => values?.join('、') || t('common:identityInformationOnly'),
    },
    {
      title: t('system:lastUsed'),
      dataIndex: 'lastUsedAt',
      width: 170,
      render: (value) => parseTime(value) || t('system:notUsedYet'),
    },
    {
      align: 'center',
      title: t('common:status'),
      dataIndex: 'status',
      width: 105,
      render: statusTag,
    },
    {
      align: 'center',
      title: t('system:applicationAccess'),
      dataIndex: 'accessStatus',
      width: 110,
      render: (value) => (
        <OAuthTag
          effect="plain"
          type={value === 'blocked' ? 'danger' : 'info'}
        >
          {value === 'blocked' ? t('system:blockAccess') : t('system:consentAllowed')}
        </OAuthTag>
      ),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 260,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          <TableAction
            symbol="View"
            onClick={() => showDetail(row)}
          >
            {t('common:view')}
          </TableAction>
          <HasPermi value={['system:oauthGrant:revoke']}>
            {row.status === 'active' && (
              <TableAction
                tone="danger"
                symbol="CircleClose"
                onClick={() => openRevoke([row])}
              >
                {t('system:revoke')}
              </TableAction>
            )}
            <TableAction
              tone={row.accessStatus === 'blocked' ? 'primary' : 'danger'}
              icon={row.accessStatus === 'blocked' ? <UnlockOutlined /> : <LockOutlined />}
              onClick={() => openAccess(row)}
            >
              {row.accessStatus === 'blocked'
                ? t('system:removeRestriction')
                : t('system:blockAccess')}
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ]
  return (
    <PageFrame
      className="oauth-grant-page"
      title={t('system:userGrants')}
      description={t('system:manageUserAccessGrantsToApplicationsRevokeCurrentAccess')}
      section={t('authCenter:accessControl')}
      filterHint={t('system:grantStatusAndApplicationAccessPoliciesAreManagedSeparately')}
      actions={
        <>
          <Button
            className="ruoyi-plain-button"
            icon={<LockOutlined />}
            onClick={() => setPolicyOpen(true)}
          >
            {t('system:accessPolicies')}
          </Button>
          <HasPermi value={['system:oauthGrant:revoke']}>
            <Button
              className="ruoyi-plain-button ruoyi-plain-button--danger"
              icon={<CloseCircleOutlined />}
              disabled={!selected.length}
              onClick={() => openRevoke(selected)}
            >
              {t('system:revokeSelected')}
              {selected.length ? `（${selected.length}）` : ''}
            </Button>
          </HasPermi>
        </>
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
              name="userId"
              label={t('system:user.user')}
            >
              <Input
                placeholder={t('system:user.id')}
                allowClear
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item
              name="clientId"
              label={t('common:apply')}
            >
              <Input
                style={{ width: 200 }}
                placeholder={t('authCenter:appId')}
                allowClear
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
                options={statuses}
              />
            </Form.Item>
            <Form.Item
              name="accessStatus"
              label={t('system:applicationAccess')}
            >
              <Select
                style={{ width: 200 }}
                placeholder={t('system:allPolicies')}
                allowClear
                options={accessOptions}
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
            {t('layout:found')} <strong>{total}</strong> {t('system:grants')}
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
        locale={{ emptyText: <Empty description={t('system:noMatchingUserGrants')} /> }}
        rowKey="grantId"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ x: 1400 }}
        rowSelection={{
          columnWidth: 48,
          selectedRowKeys: selected.map((row) => row.grantId),
          onChange: (_, values) => setSelected(values),
          getCheckboxProps: (row) => ({ disabled: row.status !== 'active' }),
        }}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        width="min(540px, calc(100vw - 32px))"
        className="oauth-dialog oauth-impact-dialog"
        title={t('system:revokeUserGrants')}
        okText={t('system:confirmRevocation')}
        open={!!revokeTargets}
        onCancel={() => setRevokeTargets(null)}
        onOk={revoke}
        confirmLoading={revoking}
        mask={{ closable: false }}
        okButtonProps={{ danger: true, disabled: !revokeReason?.trim() }}
        forceRender
      >
        <div className="impact-summary">
          <ExclamationCircleFilled />
          <div>
            <strong>
              {t('system:revokeExistingGrantsForValueUserAndApplicationPairs', {
                size: new Set((revokeTargets || []).map((row) => `${row.userId}:${row.clientId}`))
                  .size,
              })}
            </strong>
            <p>{t('system:thisIncludesOneTimeRememberedAndOfflineAccessGrants')}</p>
          </div>
        </div>
        <Form
          form={revokeForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="reason"
            label={t('system:revocationReason')}
            rules={[
              { required: true, whitespace: true, message: t('system:enterARevocationReason') },
            ]}
          >
            <Input.TextArea
              placeholder={t('system:explainTheRevocationForTheAuditTrail')}
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        width="min(540px, calc(100vw - 32px))"
        className="oauth-dialog oauth-impact-dialog"
        title={
          accessTarget?.accessStatus === 'blocked'
            ? t('system:removeApplicationAccessRestriction')
            : t('system:blockUserAccessToApplication')
        }
        open={!!accessTarget}
        onCancel={() => setAccessTarget(null)}
        onOk={saveAccess}
        confirmLoading={savingAccess}
        mask={{ closable: false }}
        okText={
          accessTarget?.accessStatus === 'blocked'
            ? t('system:confirmRemoval')
            : t('system:confirmRestriction')
        }
        okButtonProps={{
          danger: accessTarget?.accessStatus !== 'blocked',
          disabled: !accessReason?.trim(),
        }}
        forceRender
      >
        <div className="impact-summary">
          <ExclamationCircleFilled />
          <div>
            <strong>
              {accessTarget?.userName || t('system:userValue', { arg0: accessTarget?.userId })} ·{' '}
              {accessTarget?.clientName || accessTarget?.clientId}
            </strong>
            <p>
              {accessTarget?.accessStatus === 'blocked'
                ? t('system:theUserMayGrantConsentAgainAfterTheRestriction')
                : t('system:grant.thisRevokesAllExistingGrantsForThisUserAnd')}
            </p>
          </div>
        </div>
        <Form
          form={accessForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="reason"
            label={t('common:operationReason')}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('system:enterAReasonForThisOperation'),
              },
            ]}
          >
            <Input.TextArea
              placeholder={t('system:explainTheOperationForTheAuditTrail')}
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        rootClassName="oauth-dialog oauth-detail-drawer"
        title={t('system:userGrantDetails')}
        open={!!detail}
        onClose={() => setDetail(null)}
        size="min(640px, 92vw)"
      >
        {detail && (
          <>
            <div className="detail-hero">
              <span className="person-mark">
                <UserOutlined />
              </span>
              <div>
                <strong>{detail.userName || detail.userId || t('system:user.user')}</strong>
                <p>
                  {t('system:grantedTo')} {detail.clientName || detail.clientId}
                </p>
              </div>
              {statusTag(detail.status)}
            </div>
            <section className="detail-section">
              <h4>{t('system:allowedPermissions')}</h4>
              <div className="detail-tags">
                {(detail.grantedScopes || []).map((value) => (
                  <OAuthTag
                    key={value}
                    effect="plain"
                  >
                    {value}
                  </OAuthTag>
                ))}
              </div>
            </section>
            <section className="detail-section">
              <h4>{t('pluginAdmin:accessibleServices')}</h4>
              <p>
                {detail.grantedResources?.join('、') ||
                  t('system:usedOnlyToObtainSignInIdentityInformation')}
              </p>
            </section>
            <Descriptions
              className="detail-descriptions"
              bordered
              column={1}
              items={[
                [t('system:grantedAt'), parseTime(detail.consentedAt) || '—'],
                [t('system:lastUsed'), parseTime(detail.lastUsedAt) || t('system:notUsedYet')],
                [
                  t('system:skipFutureConfirmation'),
                  detail.rememberedScopes?.join('、') ||
                    t('system:notRememberedFutureConfirmationFollowsThePolicy'),
                ],
                [
                  t('system:applicationAccess'),
                  detail.accessStatus === 'blocked'
                    ? t('system:accessBlockedAnAdministratorMustRemoveTheRestriction')
                    : t('system:newConsentAllowed'),
                ],
                [t('system:accessPolicyReason'), detail.accessReason || '—'],
                [t('system:revocationReason'), detail.revokeReason || '—'],
              ].map(([label, children]) => ({ key: label, label, children }))}
            />
            <Collapse
              className="technical-details"
              ghost
              expandIconPlacement="end"
              items={[
                {
                  key: 'diagnostics',
                  label: t('system:showTechnicalIdentifiers'),
                  children: (
                    <dl>
                      {[
                        ['grantId', t('monitor:authorizationId')],
                        ['subjectId', t('authCenter:userPrincipal')],
                        ['clientPolicyVersion', t('system:policyVersion')],
                      ].map(([key, label]) => (
                        <Fragment key={key}>
                          <dt>{label}</dt>
                          <dd>{String(detail[key] ?? '—')}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      <AccessPolicyDrawer
        open={policyOpen}
        onClose={() => setPolicyOpen(false)}
        onChanged={getList}
      />
    </PageFrame>
  )
}
