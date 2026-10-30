import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { SearchOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons'
import FileTag from './FileTag'
import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect, useState } from 'react'
import { Alert, Button, Drawer, Form, Input, Modal, Select, Space } from 'antd'
import Table from '@/components/Table'
import {
  disposeExpiredFile,
  extendFileRetention,
  listFileRetentionReminder,
  readFileRetentionReminder,
  scanFileRetentionReminder,
} from '@/api/system/file'
import BusinessDateTimePicker from '@/components/BusinessDateTimePicker'
import Pagination from '@/components/Pagination'
import HasPermi from '@/directive/permission/hasPermi'
import { serializeTimeFieldsForSubmit, toBusinessDateTimeInput } from '@/utils/time'
import { parseTime } from '@/utils/ruoyi'
import { message } from '@/plugins/modal'

export default function FileRetentionReminderDrawer({ open, onClose, onSuccess }) {
  useI18n()

  const [form] = Form.useForm(),
    [actionForm] = Form.useForm(),
    [query, setQuery] = useState({ pageNum: 1, pageSize: 10, status: '0' }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [loading, setLoading] = useState(false),
    [scanning, setScanning] = useState(false),
    [selected, setSelected] = useState([]),
    [action, setAction] = useState(),
    [saving, setSaving] = useState(false),
    [revision, setRevision] = useState(0)
  useLocalizedFormErrors(form, actionForm)
  const refresh = () => {
    setSelected([])
    setRevision((value) => value + 1)
  }
  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    listFileRetentionReminder(query)
      .then((result) => active && setData(result))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, query, revision])
  function openAction(type, row) {
    setAction({ type, row })
    actionForm.resetFields()
    if (type === 'extend')
      actionForm.setFieldValue(
        'expireTime',
        toBusinessDateTimeInput(
          new Date(Math.max(Date.now(), new Date(row.expireTime).getTime()) + 30 * 86400000)
        )
      )
  }
  async function submit() {
    const values = await actionForm.validateFields()
    const payload =
      action.type === 'extend' ? await serializeTimeFieldsForSubmit(values, ['expireTime']) : values
    if (!payload) return
    setSaving(true)
    try {
      await (action.type === 'extend' ? extendFileRetention : disposeExpiredFile)(
        action.row.noticeId,
        payload
      )
      message.success(
        action.type === 'extend'
          ? t('system:fileRetentionExtended')
          : t('system:expiredFileMovedToRecycleBin')
      )
      setAction(undefined)
      refresh()
      onSuccess()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title={t('system:fileRetentionReminders')}
        open={open}
        onClose={onClose}
        size="70%"
      >
        <Alert
          title={t('system:retentionCanBeExtendedBeforeExpiryAfterExpiryA')}
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
        />
        <Form
          form={form}
          initialValues={{ status: '0' }}
          layout="inline"
          className="search-form"
          colon={false}
          labelCol={{ flex: '68px' }}
          onFinish={(values) => {
            setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })
            setSelected([])
          }}
        >
          <Form.Item
            name="originalName"
            label={t('file:name')}
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('system:enterTheOriginalFileName')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="noticeType"
            label={t('system:reminderType')}
          >
            <Select
              placeholder={t('system:selectAReminderType')}
              allowClear
              style={{ width: 200 }}
              options={[
                { label: t('system:expiringSoon'), value: 'expiring' },
                { label: t('system:expired'), value: 'expired' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('system:reminderStatus')}
          >
            <Select
              placeholder={t('system:selectAReminderStatus')}
              allowClear
              style={{ width: 200 }}
              options={[
                { label: t('system:unread'), value: '0' },
                { label: t('system:read'), value: '1' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                icon={<SearchOutlined />}
                type="primary"
                htmlType="submit"
              >
                {t('common:search')}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  form.resetFields()
                  setQuery({ pageNum: 1, pageSize: 10, status: '0' })
                  setSelected([])
                }}
              >
                {t('common:reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
        <Space
          size={10}
          style={{ marginBottom: 8 }}
        >
          <HasPermi value={['system:file:edit']}>
            <Button
              className="ruoyi-plain-button"
              icon={<ReloadOutlined />}
              loading={scanning}
              onClick={async () => {
                setScanning(true)
                try {
                  const result = await scanFileRetentionReminder()
                  message.success(
                    t('system:scanCompleteValueNewUpcomingExpiryRemindersAndValue', {
                      expiringCount: result.data.expiringCount,
                      expiredCount: result.data.expiredCount,
                    })
                  )
                  refresh()
                  onSuccess()
                } catch {
                } finally {
                  setScanning(false)
                }
              }}
            >
              {t('system:scan')}
            </Button>
          </HasPermi>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--success"
            icon={<CheckOutlined />}
            disabled={!selected.length}
            onClick={async () => {
              try {
                await readFileRetentionReminder(selected.join(','))
                message.success(t('system:reminderMarkedAsRead'))
                refresh()
              } catch {}
            }}
          >
            {t('system:read')}
          </Button>
        </Space>
        <Table
          rowKey="noticeId"
          loading={loading}
          dataSource={data.rows}
          pagination={false}
          scroll={{ x: 1300 }}
          rowSelection={{
            columnWidth: 50,
            selectedRowKeys: selected,
            onChange: setSelected,
            getCheckboxProps: (row) => ({ disabled: row.status !== '0' }),
          }}
          columns={[
            { width: 180, title: t('file:name'), dataIndex: 'originalName', ellipsis: true },
            {
              width: 120,
              align: 'center',
              title: t('file:owner'),
              dataIndex: 'ownerName',
              ellipsis: true,
              render: (value) => value || '-',
            },
            {
              width: 140,
              align: 'center',
              title: t('system:user.department'),
              dataIndex: 'deptName',
              ellipsis: true,
              render: (value) => value || '-',
            },
            {
              align: 'center',
              title: t('system:reminderType'),
              width: 110,
              dataIndex: 'noticeType',
              render: (value) => (
                <FileTag type={value === 'expired' ? 'danger' : 'warning'}>
                  {value === 'expired' ? t('system:expired') : t('system:expiringSoon')}
                </FileTag>
              ),
            },
            {
              width: 180,
              align: 'center',
              title: t('system:expiryTime'),
              dataIndex: 'expireTime',
              render: (value) => parseTime(value),
            },
            {
              width: 90,
              align: 'center',
              title: t('common:status'),
              dataIndex: 'status',
              render: (value) => (
                <FileTag type={value === '0' ? 'warning' : 'success'}>
                  {value === '0' ? t('system:unread') : t('system:read')}
                </FileTag>
              ),
            },
            {
              width: 90,
              align: 'center',
              title: t('system:businessReferences'),
              dataIndex: 'referenceCount',
            },
            {
              width: 180,
              align: 'center',
              title: t('system:reminderTime'),
              dataIndex: 'createTime',
              render: (value) => parseTime(value),
            },
            {
              width: 110,
              align: 'center',
              title: t('system:readBy'),
              dataIndex: 'readBy',
              ellipsis: true,
              render: (value) => value || '-',
            },
            {
              className: 'ruoyi-actions-cell',
              align: 'center',
              title: t('common:actions'),
              fixed: 'right',
              width: 100,
              render: (_, row) => (
                <TableActions>
                  <HasPermi value={['system:file:edit']}>
                    <TableAction
                      iconOnly={true}
                      symbol="Clock"
                      onClick={() => openAction('extend', row)}
                    >
                      {t('system:extendRetention')}
                    </TableAction>
                  </HasPermi>
                  {new Date(row.expireTime).getTime() <= Date.now() && (
                    <HasPermi value={['system:file:remove']}>
                      <TableAction
                        iconOnly={true}
                        tone="danger"
                        symbol="Delete"
                        disabled={!row.canDispose}
                        onClick={() => openAction('dispose', row)}
                      >
                        {row.canDispose
                          ? t('system:moveToRecycleBin')
                          : t('file:permanentOrUnexpiredBusinessReferencesPreventDisposal')}
                      </TableAction>
                    </HasPermi>
                  )}
                </TableActions>
              ),
            },
          ]}
        />
        <Pagination
          total={data.total}
          page={query.pageNum}
          limit={query.pageSize}
          onChange={(page) => setQuery({ ...query, ...page })}
        />
      </Drawer>
      <Modal
        className="file-dialog"
        mask={{ closable: action?.type !== 'dispose' }}
        okText={
          action?.type === 'dispose' ? t('system:confirmDisposal') : t('system:components.ok')
        }
        footer={renderDialogFooter}
        width="520px"
        title={
          action?.type === 'extend'
            ? t('system:extendFileRetention')
            : t('system:disposeOfExpiredFile')
        }
        open={!!action}
        onCancel={() => setAction(undefined)}
        onOk={submit}
        confirmLoading={saving}
      >
        {action?.type === 'dispose' && (
          <Alert
            type="warning"
            showIcon
            title={t('file:valueWillBeMovedToTheRecycleBinAnd', {
              originalName: action.row.originalName,
              arg1: action.row.referenceCount || 0,
            })}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form
          name="src-views-system-file-components-FileRetentionReminderDrawer-jsx-editor-9"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '92px' }}
          form={actionForm}
          layout="horizontal"
        >
          {action?.type === 'extend' && (
            <>
              <Form.Item label={t('file:name')}>{action.row.originalName}</Form.Item>
              <Form.Item label={t('system:previousExpiryTime')}>
                {parseTime(action.row.expireTime)}
              </Form.Item>
            </>
          )}
          {action?.type === 'extend' && (
            <Form.Item
              name="expireTime"
              label={t('system:newExpiryTime')}
              rules={[{ required: true, message: t('file:chooseANewExpirationTime') }]}
            >
              <BusinessDateTimePicker label={t('system:newExpiryTime')} />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label={
              action?.type === 'extend' ? t('system:extensionReason') : t('file:dispositionReason')
            }
            rules={[
              { required: true, whitespace: true, message: t('file:enterAReasonForTheOperation') },
            ]}
          >
            <Input.TextArea
              placeholder={
                action?.type === 'extend'
                  ? t('system:enterAnExtensionReason')
                  : t('system:enterADisposalReason')
              }
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
