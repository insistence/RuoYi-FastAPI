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
  { value: 'active', label: '在线' },
  { value: 'revoked', label: '已下线' },
  { value: 'expired', label: '已过期' },
]
const statusTag = (value) => (
  <OAuthTag type={{ active: 'success', revoked: 'danger', expired: 'info' }[value] || 'info'}>
    {statuses.find((item) => item.value === value)?.label || '未知状态'}
  </OAuthTag>
)
function authMethod(methods = []) {
  const labels = {
    pwd: '密码登录',
    password: '密码登录',
    otp: '动态验证码',
    mfa: '多重验证',
    sms: '短信验证',
  }
  return methods.length
    ? methods.map((value) => labels[value] || value).join(' + ')
    : '登录方式未知'
}
const initial = { pageNum: 1, pageSize: 10, status: 'active' }
export default function OAuthSession() {
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
      message.success('会话已撤销')
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
      title: '用户',
      width: 190,
      render: (_, row) => (
        <EntityCell
          name={row.userName || '用户 ' + row.userId}
          detail={row.userId || row.subjectId?.slice(0, 12)}
          kind="person"
        />
      ),
    },
    {
      title: '来源',
      width: 160,
      render: (_, row) => (
        <div className="oauth-stacked-cell">
          <strong>{row.ipAddress || '未知地址'}</strong>
          <small>{authMethod(row.amr)}</small>
        </div>
      ),
    },
    {
      width: 210,
      title: '关联应用',
      dataIndex: 'clientIds',
      render: (values) => (
        <TagSummary
          effect="plain"
          values={values}
          limit={2}
          empty="尚无关联应用"
        />
      ),
    },
    {
      title: '最近活动',
      dataIndex: 'lastSeenAt',
      width: 170,
      render: (value) => parseTime(value) || '—',
    },
    {
      title: '最晚结束时间',
      dataIndex: 'absoluteExpiresAt',
      width: 170,
      render: (value) => parseTime(value) || '—',
    },
    { align: 'center', title: '状态', dataIndex: 'status', width: 105, render: statusTag },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: '操作',
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <TableActions>
          <TableAction
            symbol="View"
            onClick={() => showDetail(row)}
          >
            查看
          </TableAction>
          {row.status !== 'revoked' && (
            <HasPermi value={['system:oauthSession:revoke']}>
              <TableAction
                tone="danger"
                symbol="SwitchButton"
                onClick={() => openRevoke([row.sid])}
              >
                下线
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
      title="登录会话"
      description="查看正在使用统一登录的用户、来源位置和关联应用，并强制结束异常会话。"
      section="访问控制"
      filterHint="默认只显示仍然在线的会话"
      actions={
        <HasPermi value={['system:oauthSession:revoke']}>
          <Button
            icon={<PoweroffOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            disabled={!ids.length}
            onClick={() => openRevoke(ids)}
          >
            强制下线{ids.length ? `（${ids.length}）` : ''}
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
              label="用户"
              name="userId"
            >
              <Input
                placeholder="用户编号"
                allowClear
                style={{ width: 200 }}
              />
            </Form.Item>
            <Form.Item
              label="来源地址"
              name="ipAddress"
            >
              <Input
                style={{ width: 200 }}
                placeholder="IP 地址"
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
                  查找
                </Button>
                <Button
                  icon={<QueryResetIcon />}
                  onClick={() => {
                    queryForm.resetFields()
                    setQuery(initial)
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
            找到 <strong>{total}</strong> 个会话
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
        locale={{ emptyText: <Empty description="没有符合条件的登录会话" /> }}
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
        title="强制结束登录会话"
        okText="确认下线"
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
            <strong>{`将结束 ${revokeIds?.length || 0} 个外部登录会话`}</strong>
            <p>
              将终止这些会话的登录状态及离线访问凭据。资源服务通过在线校验感知失效；应用本地登录状态由应用负责清理。
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
            label="下线原因"
            rules={[{ required: true, whitespace: true, message: '请填写下线原因' }]}
          >
            <Input.TextArea
              placeholder="说明为什么要强制下线，便于后续审计"
              maxLength={200}
              showCount
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer
        rootClassName="oauth-dialog oauth-detail-drawer"
        title="登录会话详情"
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
                <p>
                  {detail.ipAddress || '未知来源地址'} · {authMethod(detail.amr)}
                </p>
              </div>
              {statusTag(detail.status)}
            </div>
            <section className="detail-section">
              <h4>关联应用</h4>
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
                  <span className="muted-value">尚无关联应用</span>
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
                    label: ['登录时间', '最近活动', '闲置后过期', '最晚结束时间'][index],
                    children: parseTime(detail[key]) || '—',
                  })
                ),
                {
                  key: 'reason',
                  label: '下线原因',
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
                  label: '查看技术标识',
                  children: (
                    <dl>
                      {[
                        ['sid', '会话 ID'],
                        ['subjectId', '用户主体'],
                        ['authVersion', '身份版本'],
                        ['acr', '认证级别'],
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
