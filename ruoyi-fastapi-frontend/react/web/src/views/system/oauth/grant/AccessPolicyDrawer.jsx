import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  {
    value: 'blocked',
    get label() {
      return t('system:blockAccess')
    },
  },
  {
    value: 'allowed',
    get label() {
      return t('system:allowAccess')
    },
  },
]
export default function AccessPolicyDrawer({ open, onClose, onChanged }) {
  useI18n()

  const [queryForm] = Form.useForm(),
    [form] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10 }),
    [rows, setRows] = useState([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [target, setTarget] = useState(null),
    [blocked, setBlocked] = useState(true),
    [saving, setSaving] = useState(false)
  useLocalizedFormErrors(queryForm, form)
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
      message.success(
        blocked
          ? t('system:theUserHasBeenBlockedFromThisApplication')
          : t('system:accessRestrictionRemoved')
      )
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
      title={t('system:applicationAccessPolicies')}
      size="min(960px, 96vw)"
      open={open}
      onClose={onClose}
    >
      <Alert
        className="oauth-policy-note"
        type="info"
        showIcon
        title={t('system:blockAccessBeforeAUserFirstGrantsConsentAccess')}
      />
      <Form
        form={queryForm}
        name="oauth-access-policy-query"
        layout="inline"
        className="search-form"
        onFinish={(values) => setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })}
      >
        <Form.Item
          label={t('system:user.user')}
          name="userId"
        >
          <Input
            style={{ width: 200 }}
            placeholder={t('system:user.id')}
            allowClear
          />
        </Form.Item>
        <Form.Item
          label={t('common:apply')}
          name="clientId"
        >
          <Input
            style={{ width: 200 }}
            placeholder="Client ID"
            allowClear
          />
        </Form.Item>
        <Form.Item
          label={t('system:policies')}
          name="accessStatus"
        >
          <Select
            style={{ width: 200 }}
            placeholder={t('system:allPolicies')}
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
              {t('common:find')}
            </Button>
            <Button
              icon={<ReloadOutlined />}
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
      <div className="oauth-policy-toolbar">
        <span>
          {t('system:configured')} {total} {t('system:grant.policies')}
        </span>
        <HasPermi value={['system:oauthGrant:revoke']}>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => edit()}
          >
            {t('system:addAccessRestriction')}
          </Button>
        </HasPermi>
      </div>
      <Table
        locale={{ emptyText: <Empty description={t('system:noMatchingAccessPolicies')} /> }}
        rowKey={(row) => `${row.userId}:${row.clientId}`}
        dataSource={rows}
        loading={loading}
        pagination={false}
        scroll={{ x: 980 }}
        columns={[
          {
            width: 140,
            title: t('system:user.user'),
            render: (_, row) => (
              <div className="oauth-policy-target">
                <strong>{row.userName}</strong>
                <small>{row.userId}</small>
              </div>
            ),
          },
          {
            width: 160,
            title: t('common:apply'),
            render: (_, row) => (
              <div className="oauth-policy-target">
                <strong>{row.clientName}</strong>
                <small>{row.clientId}</small>
              </div>
            ),
          },
          {
            width: 110,
            title: t('system:policies'),
            dataIndex: 'accessStatus',
            render: (value) => (
              <OAuthTag type={value === 'blocked' ? 'danger' : 'success'}>
                {value === 'blocked' ? t('system:blockAccess') : t('system:allowAccess')}
              </OAuthTag>
            ),
          },
          { width: 180, title: t('common:operationReason'), dataIndex: 'reason', ellipsis: true },
          { width: 110, title: t('system:operator'), dataIndex: 'updateBy' },
          {
            title: t('system:lastOperation'),
            dataIndex: 'updateTime',
            width: 170,
            render: (value) => parseTime(value) || '—',
          },
          {
            className: 'ruoyi-actions-cell',
            align: 'center',
            title: t('common:actions'),
            width: 110,
            fixed: 'right',
            render: (_, row) => (
              <HasPermi value={['system:oauthGrant:revoke']}>
                <TableAction
                  tone={row.accessStatus === 'blocked' ? 'primary' : 'danger'}
                  onClick={() => edit(row)}
                >
                  {row.accessStatus === 'blocked'
                    ? t('system:removeRestriction')
                    : t('system:blockAccess')}
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
        title={
          blocked
            ? t('system:blockUserAccessToApplication')
            : t('system:removeApplicationAccessRestriction')
        }
        open={!!target}
        onCancel={() => setTarget(null)}
        onOk={save}
        confirmLoading={saving}
        mask={{ closable: false }}
        keyboard={!saving}
        closable={!saving}
        cancelButtonProps={{ disabled: saving }}
        okButtonProps={{ danger: blocked }}
        okText={blocked ? t('system:confirmRestriction') : t('system:confirmRemoval')}
        cancelText={t('common:cancel')}
        forceRender
      >
        <Alert
          className="oauth-policy-note"
          type={blocked ? 'warning' : 'info'}
          showIcon
          title={
            blocked
              ? t('system:thisRevokesAllExistingGrantsForThisUserAnd')
              : t('system:usersMayGrantConsentAgainAfterTheRestrictionIs')
          }
        />
        <Form
          form={form}
          layout="vertical"
          name="oauth-access-policy-editor"
        >
          <Form.Item
            name="userId"
            label={t('system:user.id')}
            rules={[
              {
                required: true,
                pattern: /^[1-9]\d{0,18}$/,
                message: t('system:enterAValidUserId'),
              },
            ]}
          >
            <Input
              placeholder={t('system:enterTheUserIdFromUserManagement')}
              disabled={!!target?.userId || saving}
              maxLength={19}
              inputMode="numeric"
            />
          </Form.Item>
          <Form.Item
            name="clientId"
            label={t('authCenter:appId')}
            rules={[{ required: true, whitespace: true, message: t('system:enterAClientId') }]}
          >
            <Input
              placeholder={t('system:enterTheClientIdFromClientManagement')}
              disabled={!!target?.clientId || saving}
              maxLength={128}
            />
          </Form.Item>
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
              placeholder={t('system:provideAReasonForTheAuditTrail')}
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
