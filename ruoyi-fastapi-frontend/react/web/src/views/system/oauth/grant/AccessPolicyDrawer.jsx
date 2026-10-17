import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons'
import { Empty } from 'antd'
import { TableAction } from '@/components/TableActions'
import '@/components/OAuthWorkspace/entities.css'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Drawer, Form, Input, Modal, Select, Space } from 'antd'
import OAuthTag from '@/components/OAuthWorkspace/OAuthTag'
import Table from '@/components/Table'
import { listOAuthAccessPolicies, setOAuthClientAccess } from '@/api/system/oauthSession'
import { parseTime } from '@/utils/ruoyi'
import { message } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'

const policyOptions = [
  { value: 'blocked', label: '禁止访问' },
  { value: 'allowed', label: '允许访问' },
]
export default function AccessPolicyDrawer({ open, onClose, onChanged }) {
  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [target, setTarget] = useState(null),
    [blocked, setBlocked] = useState(true),
    [saving, setSaving] = useState(false)
  const getList = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const result = await listOAuthAccessPolicies(query)
      setRows(result.rows || [])
      setTotal(result.total || 0)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [open, query])
  useEffect(() => {
    void getList()
  }, [getList])
  function edit(row) {
    form.resetFields()
    form.setFieldsValue({
      userId: row ? String(row.userId) : '',
      clientId: row?.clientId || '',
      reason: '',
    })
    setBlocked(!row || row.accessStatus !== 'blocked')
    setTarget(row || {})
  }
  async function save() {
    if (saving) return
    try {
      const values = await form.validateFields()
      setSaving(true)
      await setOAuthClientAccess(values.userId.trim(), values.clientId.trim(), {
        blocked,
        reason: values.reason.trim(),
      })
      message.success(blocked ? '已禁止用户访问应用' : '已解除访问禁止')
      setTarget(null)
      onChanged?.()
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <Drawer
      rootClassName="oauth-dialog oauth-access-policy-drawer"
      closable={{ placement: 'end' }}
      title="应用访问策略"
      size="min(960px, 96vw)"
      open={open}
      onClose={onClose}
    >
      <Alert
        className="oauth-policy-note"
        type="info"
        showIcon
        title="可在用户首次授权前禁止访问应用。未配置策略时默认允许；解除禁止后，已撤销的授权不会恢复。"
      />
      <Form
        form={queryForm}
        name="oauth-access-policy-query"
        layout="inline"
        className="search-form"
        onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
      >
        <Form.Item
          label="用户"
          name="userId"
        >
          <Input
            style={{ width: 200 }}
            placeholder="用户编号"
            allowClear
          />
        </Form.Item>
        <Form.Item
          label="应用"
          name="clientId"
        >
          <Input
            style={{ width: 200 }}
            placeholder="Client ID"
            allowClear
          />
        </Form.Item>
        <Form.Item
          label="策略"
          name="accessStatus"
        >
          <Select
            style={{ width: 200 }}
            placeholder="全部策略"
            allowClear
            options={policyOptions}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              icon={<SearchOutlined />}
              type="primary"
              htmlType="submit"
            >
              查找
            </Button>
            <Button
              icon={<ReloadOutlined />}
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
      <div className="oauth-policy-toolbar">
        <span>已配置 {total} 条策略</span>
        <HasPermi value={['system:oauthGrant:revoke']}>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => edit()}
          >
            新增禁止策略
          </Button>
        </HasPermi>
      </div>
      <Table
        locale={{ emptyText: <Empty description="没有符合条件的访问策略" /> }}
        rowKey={(row) => `${row.userId}:${row.clientId}`}
        dataSource={rows}
        loading={loading}
        pagination={false}
        scroll={{ x: 980 }}
        columns={[
          {
            width: 140,
            title: '用户',
            render: (_, row) => (
              <div className="oauth-policy-target">
                <strong>{row.userName}</strong>
                <small>{row.userId}</small>
              </div>
            ),
          },
          {
            width: 160,
            title: '应用',
            render: (_, row) => (
              <div className="oauth-policy-target">
                <strong>{row.clientName}</strong>
                <small>{row.clientId}</small>
              </div>
            ),
          },
          {
            width: 110,
            title: '策略',
            dataIndex: 'accessStatus',
            render: (value) => (
              <OAuthTag type={value === 'blocked' ? 'danger' : 'success'}>
                {value === 'blocked' ? '禁止访问' : '允许访问'}
              </OAuthTag>
            ),
          },
          { width: 180, title: '操作原因', dataIndex: 'reason', ellipsis: true },
          { width: 110, title: '操作人', dataIndex: 'updateBy' },
          {
            title: '最近操作',
            dataIndex: 'updateTime',
            width: 170,
            render: (value) => parseTime(value) || '—',
          },
          {
            className: 'ruoyi-actions-cell',
            align: 'center',
            title: '操作',
            width: 110,
            fixed: 'right',
            render: (_, row) => (
              <HasPermi value={['system:oauthGrant:revoke']}>
                <TableAction
                  tone={row.accessStatus === 'blocked' ? 'primary' : 'danger'}
                  onClick={() => edit(row)}
                >
                  {row.accessStatus === 'blocked' ? '解除禁止' : '禁止访问'}
                </TableAction>
              </HasPermi>
            ),
          },
        ]}
      />
      <Pagination
        total={total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => setQuery({ ...query, ...page })}
      />
      <Modal
        width="min(540px, calc(100vw - 32px))"
        className="oauth-dialog oauth-access-policy-editor"
        title={blocked ? '禁止用户访问应用' : '解除应用访问禁止'}
        open={!!target}
        onCancel={() => setTarget(null)}
        onOk={save}
        confirmLoading={saving}
        mask={{ closable: false }}
        keyboard={!saving}
        closable={!saving}
        cancelButtonProps={{ disabled: saving }}
        okButtonProps={{ danger: blocked }}
        okText={blocked ? '确认禁止' : '确认解除'}
        cancelText="取消"
        forceRender
      >
        <Alert
          className="oauth-policy-note"
          type={blocked ? 'warning' : 'info'}
          showIcon
          title={
            blocked
              ? '将撤销该用户对应用的全部现有授权，并阻止后续授权。'
              : '解除后允许重新授权，已有授权和令牌不会恢复。'
          }
        />
        <Form
          form={form}
          layout="vertical"
          name="oauth-access-policy-editor"
        >
          <Form.Item
            name="userId"
            label="用户编号"
            rules={[
              {
                required: true,
                pattern: /^[1-9]\d{0,18}$/,
                message: '请输入有效的用户编号',
              },
            ]}
          >
            <Input
              placeholder="输入用户管理中的用户编号"
              disabled={!!target?.userId || saving}
              maxLength={19}
              inputMode="numeric"
            />
          </Form.Item>
          <Form.Item
            name="clientId"
            label="Client ID"
            rules={[{ required: true, whitespace: true, message: '请输入 Client ID' }]}
          >
            <Input
              placeholder="输入客户端管理中的 Client ID"
              disabled={!!target?.clientId || saving}
              maxLength={128}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="操作原因"
            rules={[{ required: true, whitespace: true, message: '请填写操作原因' }]}
          >
            <Input.TextArea
              placeholder="填写原因，便于后续审计"
              rows={3}
              disabled={saving}
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  )
}
