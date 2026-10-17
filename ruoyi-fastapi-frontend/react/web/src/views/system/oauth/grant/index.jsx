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
    { value: 'active', label: '仍然有效' },
    { value: 'revoked', label: '已撤销' },
    { value: 'expired', label: '已过期' },
  ],
  accessOptions = [
    { value: 'allowed', label: '允许授权' },
    { value: 'blocked', label: '禁止访问' },
  ]
const statusTag = (value) => (
  <OAuthTag type={{ active: 'success', revoked: 'danger', expired: 'info' }[value] || 'info'}>
    {statuses.find((item) => item.value === value)?.label || '未知状态'}
  </OAuthTag>
)
export default function OAuthGrant() {
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
      message.success('授权已撤销')
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
      message.success(blocked ? '已禁止访问该应用' : '已解除禁止，请重新授权')
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
      title: '用户',
      width: 180,
      render: (_, row) => (
        <EntityCell
          name={row.userName || '用户 ' + row.userId}
          detail={row.userId || row.subjectId?.slice(0, 12)}
          kind="person"
        />
      ),
    },
    {
      title: '授权给应用',
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
      title: '允许的权限',
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
      title: '可访问服务',
      dataIndex: 'grantedResources',
      ellipsis: true,
      render: (values) => values?.join('、') || '仅身份信息',
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      width: 170,
      render: (value) => parseTime(value) || '尚未使用',
    },
    { align: 'center', title: '状态', dataIndex: 'status', width: 105, render: statusTag },
    {
      align: 'center',
      title: '应用访问',
      dataIndex: 'accessStatus',
      width: 110,
      render: (value) => (
        <OAuthTag
          effect="plain"
          type={value === 'blocked' ? 'danger' : 'info'}
        >
          {value === 'blocked' ? '禁止访问' : '允许授权'}
        </OAuthTag>
      ),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 260,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          <TableAction
            symbol="View"
            onClick={() => showDetail(row)}
          >
            查看
          </TableAction>
          <HasPermi value={['system:oauthGrant:revoke']}>
            {row.status === 'active' && (
              <TableAction
                tone="danger"
                symbol="CircleClose"
                onClick={() => openRevoke([row])}
              >
                撤销
              </TableAction>
            )}
            <TableAction
              tone={row.accessStatus === 'blocked' ? 'primary' : 'danger'}
              icon={row.accessStatus === 'blocked' ? <UnlockOutlined /> : <LockOutlined />}
              onClick={() => openAccess(row)}
            >
              {row.accessStatus === 'blocked' ? '解除禁止' : '禁止访问'}
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ]
  return (
    <PageFrame
      className="oauth-grant-page"
      title="用户授权"
      description="管理用户对应用的访问授权，撤销当前访问或禁止后续授权。"
      section="访问控制"
      filterHint="授权状态与应用访问策略分别管理；解除禁止后仍需重新授权"
      actions={
        <>
          <Button
            className="ruoyi-plain-button"
            icon={<LockOutlined />}
            onClick={() => setPolicyOpen(true)}
          >
            访问策略
          </Button>
          <HasPermi value={['system:oauthGrant:revoke']}>
            <Button
              className="ruoyi-plain-button ruoyi-plain-button--danger"
              icon={<CloseCircleOutlined />}
              disabled={!selected.length}
              onClick={() => openRevoke(selected)}
            >
              撤销选中{selected.length ? `（${selected.length}）` : ''}
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
              label="用户"
            >
              <Input
                placeholder="用户编号"
                allowClear
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item
              name="clientId"
              label="应用"
            >
              <Input
                style={{ width: 200 }}
                placeholder="应用编号"
                allowClear
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
                options={statuses}
              />
            </Form.Item>
            <Form.Item
              name="accessStatus"
              label="应用访问"
            >
              <Select
                style={{ width: 200 }}
                placeholder="全部策略"
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
            找到 <strong>{total}</strong> 条授权
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
        locale={{ emptyText: <Empty description="没有符合条件的用户授权" /> }}
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
        title="撤销用户授权"
        okText="确认撤销"
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
            <strong>{`将撤销 ${new Set((revokeTargets || []).map((row) => `${row.userId}:${row.clientId}`)).size} 组用户与应用的现有授权`}</strong>
            <p>
              包括一次性授权、已记住的授权和持续访问权限。在线校验的资源将在下次检查时拒绝旧凭据；仅本地验签或缓存校验结果的资源可能延迟生效。用户重新同意后可以再次访问。
            </p>
          </div>
        </div>
        <Form
          form={revokeForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="reason"
            label="撤销原因"
            rules={[{ required: true, whitespace: true, message: '请填写撤销原因' }]}
          >
            <Input.TextArea
              placeholder="说明为什么要撤销，便于后续审计"
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
        title={accessTarget?.accessStatus === 'blocked' ? '解除应用访问禁止' : '禁止用户访问应用'}
        open={!!accessTarget}
        onCancel={() => setAccessTarget(null)}
        onOk={saveAccess}
        confirmLoading={savingAccess}
        mask={{ closable: false }}
        okText={accessTarget?.accessStatus === 'blocked' ? '确认解除' : '确认禁止'}
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
              {accessTarget?.userName || `用户 ${accessTarget?.userId}`} ·{' '}
              {accessTarget?.clientName || accessTarget?.clientId}
            </strong>
            <p>
              {accessTarget?.accessStatus === 'blocked'
                ? '解除后用户可以重新授权。已撤销的授权和旧凭据保持失效。'
                : '将撤销该用户对应用的全部现有授权，并禁止再次授权。只有管理员解除禁止后，用户才能重新授权；其他应用不受影响。'}
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
            label="操作原因"
            rules={[{ required: true, whitespace: true, message: '请填写操作原因' }]}
          >
            <Input.TextArea
              placeholder="说明操作原因，便于后续审计"
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        rootClassName="oauth-dialog oauth-detail-drawer"
        title="用户授权详情"
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
                <strong>{detail.userName || detail.userId || '用户'}</strong>
                <p>已授权给 {detail.clientName || detail.clientId}</p>
              </div>
              {statusTag(detail.status)}
            </div>
            <section className="detail-section">
              <h4>允许的权限</h4>
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
              <h4>可访问服务</h4>
              <p>{detail.grantedResources?.join('、') || '仅用于获取登录身份信息'}</p>
            </section>
            <Descriptions
              className="detail-descriptions"
              bordered
              column={1}
              items={[
                ['授权时间', parseTime(detail.consentedAt) || '—'],
                ['最后使用', parseTime(detail.lastUsedAt) || '尚未使用'],
                ['后续免确认', detail.rememberedScopes?.join('、') || '未记住，下次仍需按策略确认'],
                [
                  '应用访问',
                  detail.accessStatus === 'blocked' ? '禁止访问，需管理员解除' : '允许重新授权',
                ],
                ['访问策略原因', detail.accessReason || '—'],
                ['撤销原因', detail.revokeReason || '—'],
              ].map(([label, children]) => ({ key: label, label, children }))}
            />
            <Collapse
              className="technical-details"
              ghost
              expandIconPlacement="end"
              items={[
                {
                  key: 'diagnostics',
                  label: '查看技术标识',
                  children: (
                    <dl>
                      {[
                        ['grantId', '授权 ID'],
                        ['subjectId', '用户主体'],
                        ['clientPolicyVersion', '策略版本'],
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
