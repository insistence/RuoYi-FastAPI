import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { PlusOutlined } from '@ant-design/icons'
import FileTag from './FileTag'
import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect, useState } from 'react'
import { Alert, Button, Drawer, Form, Input, InputNumber, Modal, Radio } from 'antd'
import Table from '@/components/Table'
import {
  addFileRetentionPolicy,
  delFileRetentionPolicy,
  listFileRetentionPolicy,
  updateFileRetentionPolicy,
} from '@/api/system/file'
import { confirm, message } from '@/plugins/modal'
import { parseTime } from '@/utils/ruoyi'

export default function FileRetentionPolicyDrawer({ open, onClose }) {
  useI18n()

  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false),
    [editing, setEditing] = useState(),
    [saving, setSaving] = useState(false),
    [form] = Form.useForm()
  useLocalizedFormErrors(form)
  async function load() {
    setLoading(true)
    try {
      const result = await listFileRetentionPolicy()
      setRows(result.data || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (open) load()
  }, [open])
  function edit(row) {
    setEditing(row || {})
    form.resetFields()
    form.setFieldsValue(row || { businessType: '', retentionDays: 30, status: '0', remark: '' })
  }
  async function save() {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await (editing.businessType ? updateFileRetentionPolicy : addFileRetentionPolicy)({
        businessType: values.businessType,
        retentionDays: values.retentionDays,
        status: values.status,
        remark: values.remark,
      })
      message.success(t('file:retentionPolicySaved'))
      setEditing(undefined)
      load()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Drawer
        rootClassName="file-drawer"
        title={t('system:fileRetentionPolicies')}
        open={open}
        onClose={onClose}
        size="900px"
      >
        <Alert
          title={t('system:policiesApplyOnlyToNewOrRecreatedBusinessReferences')}
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
        />
        <Button
          className="ruoyi-plain-button"
          icon={<PlusOutlined />}
          onClick={() => edit()}
          style={{ marginBottom: 8 }}
        >
          {t('common:add')}
        </Button>
        <Table
          rowKey="businessType"
          dataSource={rows}
          loading={loading}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            {
              minWidth: 140,
              align: 'center',
              title: t('monitor:log.businessType'),
              dataIndex: 'businessType',
            },
            {
              width: 100,
              align: 'center',
              title: t('system:retentionDays'),
              dataIndex: 'retentionDays',
            },
            {
              width: 90,
              align: 'center',
              title: t('common:status'),
              dataIndex: 'status',
              render: (value) => (
                <FileTag type={value === '0' ? 'success' : 'info'}>
                  {value === '0' ? t('common:enable') : t('common:disable')}
                </FileTag>
              ),
            },
            {
              minWidth: 160,
              title: t('common:remark'),
              dataIndex: 'remark',
              ellipsis: true,
              render: (value) => value || '-',
            },
            {
              width: 180,
              align: 'center',
              title: t('common:updatedTime'),
              dataIndex: 'updateTime',
              render: (value) => parseTime(value) || '-',
            },
            {
              width: 90,
              fixed: 'right',
              className: 'ruoyi-actions-cell',
              align: 'center',
              title: t('common:actions'),
              render: (_, row) => (
                <TableActions>
                  <TableAction
                    iconOnly={true}
                    symbol="Edit"
                    onClick={() => edit(row)}
                  >
                    {t('common:edit')}
                  </TableAction>
                  <TableAction
                    iconOnly={true}
                    tone="danger"
                    symbol="Delete"
                    onClick={async () => {
                      try {
                        await confirm(
                          t('file:deleteTheRetentionPolicyForBusinessTypeValue', {
                            businessType: row.businessType,
                          })
                        )
                        await delFileRetentionPolicy(row.businessType)
                        load()
                      } catch {}
                    }}
                  >
                    {t('common:delete')}
                  </TableAction>
                </TableActions>
              ),
            },
          ]}
        />
      </Drawer>
      <Modal
        className="file-dialog"
        footer={renderDialogFooter}
        width="520px"
        title={
          editing?.businessType
            ? t('system:editFileRetentionPolicy')
            : t('system:addFileRetentionPolicy')
        }
        open={!!editing}
        onCancel={() => setEditing(undefined)}
        onOk={save}
        confirmLoading={saving}
      >
        <Form
          name="src-views-system-file-components-FileRetentionPolicyDrawer-jsx-editor-8"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '90px' }}
          form={form}
          layout="horizontal"
        >
          <Form.Item
            name="businessType"
            label={t('monitor:log.businessType')}
            rules={[{ required: true, message: t('system:enterABusinessType') }]}
          >
            <Input
              placeholder={t('system:enterABusinessType')}
              maxLength={50}
              disabled={!!editing?.businessType}
            />
          </Form.Item>
          <Form.Item
            name="retentionDays"
            label={t('system:retentionDays')}
            rules={[{ required: true }]}
          >
            <InputNumber
              min={1}
              max={36500}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('common:status')}
          >
            <Radio.Group
              options={[
                { label: t('common:enable'), value: '0' },
                { label: t('common:disable'), value: '1' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="remark"
            label={t('common:remark')}
          >
            <Input.TextArea
              placeholder={t('system:dict.remarkPlaceholder')}
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
