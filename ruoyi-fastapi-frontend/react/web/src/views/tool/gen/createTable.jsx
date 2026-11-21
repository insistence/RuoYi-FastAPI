import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect, useState } from 'react'
import { Form, Input, Modal, Select } from 'antd'
import { createTable } from '@/api/tool/gen'
import { message } from '@/plugins/modal'
export default function CreateTable({ open, dataSources, onClose, onSuccess }) {
  useI18n()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open)
      form.setFieldValue(
        'dataSourceName',
        (dataSources.find((s) => s.isDefault) || dataSources[0])?.name
      )
  }, [open])
  async function submit() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await createTable(values)
      message.success(t('tool:createdSuccessfully'))
      form.resetFields()
      onClose()
      onSuccess()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      footer={renderDialogFooter}
      title={t('tool:createTable')}
      style={{ top: '6vh' }}
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      width={800}
      forceRender
    >
      <Form
        name="src-views-tool-gen-createTable-jsx-editor-23"
        className="ruoyi-dialog-form"
        colon={false}
        wrapperCol={{ flex: '1 1 0' }}
        labelCol={{ flex: '80px' }}
        form={form}
        layout="horizontal"
      >
        <Form.Item
          label={t('tool:datasource.title')}
          name="dataSourceName"
          rules={[{ required: true, message: t('tool:datasource.select') }]}
        >
          <Select
            placeholder={t('tool:datasource.select')}
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            options={dataSources.map((s) => ({
              label: `${s.name}（${s.dbType}）`,
              value: s.name,
            }))}
          />
        </Form.Item>
        <Form.Item
          label={t('tool:createTableStatementsMultipleStatementsSupported')}
          className="gen-sql-field"
          layout="vertical"
          labelCol={{ flex: 'none' }}
          wrapperCol={{ flex: 'none' }}
          name="sql"
          rules={[
            { required: true, whitespace: true, message: t('tool:enterCreateTableStatements') },
          ]}
        >
          <Input.TextArea
            placeholder={t('tool:enterText')}
            rows={10}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
