import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { UserOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import { Fragment } from 'react'
import TagSummary from '@/components/OAuthWorkspace/TagSummary'
import OAuthTag from '@/components/OAuthWorkspace/OAuthTag'
import { PoweroffOutlined } from '@ant-design/icons'
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
import { getOAuthSession, listOAuthSessions, revokeOAuthSessions } from '@/api/system/oauthSession'
import { parseTime } from '@/utils/ruoyi'
import { message } from '@/plugins/modal'
import PageFrame from '@/components/OAuthWorkspace/PageFrame'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'

const statuses = [
  {
    value: 'active',
    get label() {
      return t('system:online')
    },
  },
  {
    value: 'revoked',
    get label() {
      return t('system:signedOut')
    },
  },
  {
    value: 'expired',
    get label() {
      return t('common:expired')
    },
  },
]
const statusTag = (value) => (
  <OAuthTag type={{ active: 'success', revoked: 'danger', expired: 'info' }[value] || 'info'}>
    {statuses.find((item) => item.value === value)?.label || t('system:unknownStatus')}
  </OAuthTag>
)
function authMethod(methods = []) {
  const labels = {
    pwd: t('system:passwordSignIn'),
    password: t('system:passwordSignIn'),
    otp: t('system:oneTimeCode'),
    mfa: t('system:multiFactorAuthentication'),
    sms: t('system:smsVerification'),
  }
  return methods.length
    ? methods.map((value) => labels[value] || value).join(' + ')
    : t('system:unknownSignInMethod')
}
const initial = { pageNum: 1, pageSize: 10, status: 'active' }
export default function OAuthSession() {
  useI18n()

  const [queryForm] = Form.useForm(),
    [revokeForm] = Form.useForm(),
    [query, setQuery] = useState(initial),
    [rows, setRows] = useState([]),
    [ids, setIds] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [revokeIds, setRevokeIds] = useState(null),
    [revoking, setRevoking] = useState(false),
    [detail, setDetail] = useState(null)
  useLocalizedFormErrors(queryForm, revokeForm)
  const revokeReason = Form.useWatch('reason', revokeForm)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOAuthSessions(query)
      setRows(result.rows || [])
      setTotal(result.total || 0)
      setIds([])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  function openRevoke(values) {
    revokeForm.resetFields()
    setRevokeIds(values)
  }
  async function revoke() {
    try {
      const values = await revokeForm.validateFields()
      setRevoking(true)
      await revokeOAuthSessions(revokeIds, { reason: values.reason.trim() })
      message.success(t('system:sessionRevoked'))
      setRevokeIds(null)
      await getList()
    } catch {
    } finally {
      setRevoking(false)
    }
  }
  async function showDetail(row) {
    try {
      setDetail((await getOAuthSession(row.sid)).data)
    } catch {}
  }
  const columns = [
    {
      title: t('system:user.user'),
      width: 190,
      render: (_, row) => (
        <EntityCell
          name={row.userName || t('authCenter:userIdentifier', { id: row.userId })}
          detail={row.userId || row.subjectId?.slice(0, 12)}
          kind="person"
        />
      ),
    },
    {
      title: t('common:source'),
      width: 160,
      render: (_, row) => (
        <div className="oauth-stacked-cell">
          <strong>{row.ipAddress || t('system:unknownAddress')}</strong>
          <small>{authMethod(row.amr)}</small>
        </div>
      ),
    },
    {
      width: 210,
      title: t('system:associatedApplications'),
      dataIndex: 'clientIds',
      render: (values) => (
        <TagSummary
          effect="plain"
          values={values}
          limit={2}
          empty={t('system:noAssociatedApplications')}
        />
      ),
    },
    {
      title: t('system:lastActivity'),
      dataIndex: 'lastSeenAt',
      width: 170,
      render: (value) => parseTime(value) || '—',
    },
    {
      title: t('system:latestEndTime'),
      dataIndex: 'absoluteExpiresAt',
      width: 170,
      render: (value) => parseTime(value) || '—',
    },
    {
      align: 'center',
      title: t('common:status'),
      dataIndex: 'status',
      width: 105,
      render: statusTag,
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          <TableAction
            symbol="View"
            onClick={() => showDetail(row)}
          >
            {t('common:view')}
          </TableAction>
          {row.status !== 'revoked' && (
            <HasPermi value={['system:oauthSession:revoke']}>
              <TableAction
                tone="danger"
                symbol="SwitchButton"
                onClick={() => openRevoke([row.sid])}
              >
                {t('system:signOut')}
              </TableAction>
            </HasPermi>
          )}
        </TableActions>
      ),
    },
  ]
  return (
    <PageFrame
      className="oauth-session-page"
      title={t('system:signInSessions')}
      description={t('system:viewUsersOfUnifiedSignInTheirSourceLocations')}
      section={t('authCenter:accessControl')}
      filterHint={t('system:onlyActiveSessionsAreShownByDefault')}
      actions={
        <HasPermi value={['system:oauthSession:revoke']}>
          <Button
            icon={<PoweroffOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            disabled={!ids.length}
            onClick={() => openRevoke(ids)}
          >
            {t('system:forceSignOut')}
            {ids.length ? `（${ids.length}）` : ''}
          </Button>
        </HasPermi>
      }
      filters={
        showSearch && (
          <Form
            form={queryForm}
            initialValues={{ status: 'active' }}
            layout="inline"
            className="search-form"
            onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
          >
            <Form.Item
              label={t('system:user.user')}
              name="userId"
            >
              <Input
                placeholder={t('system:user.id')}
                allowClear
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item
              label={t('monitor:sourceAddress')}
              name="ipAddress"
            >
              <Input
                style={{ width: 200 }}
                placeholder={t('system:ipAddress')}
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
                options={statuses}
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
                    setQuery(initial)
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
            {t('layout:found')} <strong>{total}</strong> {t('system:sessions')}
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
        locale={{ emptyText: <Empty description={t('system:noMatchingSignInSessions')} /> }}
        rowKey="sid"
        dataSource={rows}
        columns={columns}
        loading={loading}
        pagination={false}
        scroll={{ x: 1200 }}
        rowSelection={{
          columnWidth: 48,
          selectedRowKeys: ids,
          onChange: setIds,
          getCheckboxProps: (row) => ({ disabled: row.status === 'revoked' }),
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
        title={t('system:forceSignInSessionsToEnd')}
        okText={t('system:confirmSignOut')}
        open={!!revokeIds}
        onCancel={() => setRevokeIds(null)}
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
              {t('system:endValueExternalSignInSessions', { arg0: revokeIds?.length || 0 })}
            </strong>
            <p>{t('system:thisEndsTheseSessionsAndTheirOfflineAccessCredentials')}</p>
          </div>
        </div>
        <Form
          form={revokeForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="reason"
            label={t('system:signOutReason')}
            rules={[{ required: true, whitespace: true, message: t('system:enterASignOutReason') }]}
          >
            <Input.TextArea
              placeholder={t('system:explainTheForcedSignOutForTheAuditTrail')}
              maxLength={200}
              showCount
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        rootClassName="oauth-dialog oauth-detail-drawer"
        title={t('system:signInSessionDetails')}
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
                  {detail.ipAddress || t('system:unknownSourceAddress')} · {authMethod(detail.amr)}
                </p>
              </div>
              {statusTag(detail.status)}
            </div>
            <section className="detail-section">
              <h4>{t('system:associatedApplications')}</h4>
              <div className="detail-tags">
                {detail.clientIds?.length ? (
                  detail.clientIds.map((value) => (
                    <OAuthTag
                      key={value}
                      effect="plain"
                    >
                      {value}
                    </OAuthTag>
                  ))
                ) : (
                  <span className="muted-value">{t('system:noAssociatedApplications')}</span>
                )}
              </div>
            </section>
            <Descriptions
              className="detail-descriptions"
              column={1}
              bordered
              items={[
                ...['authTime', 'lastSeenAt', 'idleExpiresAt', 'absoluteExpiresAt'].map(
                  (key, index) => ({
                    key,
                    label: [
                      t('monitor:login.time'),
                      t('system:lastActivity'),
                      t('system:expiresAfterInactivity'),
                      t('system:latestEndTime'),
                    ][index],
                    children: parseTime(detail[key]) || '—',
                  })
                ),
                {
                  key: 'reason',
                  label: t('system:signOutReason'),
                  children: detail.revokeReason || '—',
                },
              ]}
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
                        ['sid', t('monitor:sessionId')],
                        ['subjectId', t('authCenter:userPrincipal')],
                        ['authVersion', t('system:identityVersion')],
                        ['acr', t('system:authenticationLevel')],
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
    </PageFrame>
  )
}
