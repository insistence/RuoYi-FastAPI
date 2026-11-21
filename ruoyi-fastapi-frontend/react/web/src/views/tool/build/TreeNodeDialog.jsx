import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useLocalizedFormErrors } from '@/i18n/form'
import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect } from 'react'
import { Form, Input, Modal, Select, Space } from 'antd'
export default function TreeNodeDialog({ open, onClose, onConfirm }) {
  useI18n()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  useEffect(() => {
    if (open) form.resetFields()
  }, [open])
  return (
    <Modal
      footer={renderDialogFooter}
      width="800px"
      title={t('tool:addOption')}
      open={open}
      mask={{ closable: false }}
      onCancel={onClose}
      onOk={() =>
        form
          .validateFields()
          .then((values) => {
            const value = values.dataType === 'number' ? Number(values.value) : values.value
            if (values.dataType === 'number' && !Number.isFinite(value))
              return form.setFields([{ name: 'value', errors: [t('tool:enterAValidNumber')] }])
            onConfirm({ label: values.label, value })
          })
          .catch(() => {})
      }
      forceRender
    >
      <Form
        name="src-views-tool-build-TreeNodeDialog-jsx-editor-22"
        className="ruoyi-dialog-form"
        colon={false}
        wrapperCol={{ flex: '1 1 0' }}
        labelCol={{ flex: '100px' }}
        form={form}
        layout="horizontal"
        initialValues={{ dataType: 'string' }}
      >
        <Form.Item
          name="label"
          label={t('tool:optionLabel')}
          rules={[{ required: true, message: t('tool:enterAnOptionLabel') }]}
        >
          <Input placeholder={t('tool:enterAnOptionLabel')} />
        </Form.Item>
        <Form.Item
          label={t('tool:optionValue')}
          required
        >
          <Space.Compact block>
            <Form.Item
              name="value"
              noStyle
              rules={[{ required: true, message: t('tool:enterAnOptionValue') }]}
            >
              <Input
                aria-label={t('tool:optionValue')}
                placeholder={t('tool:enterAnOptionValue')}
              />
            </Form.Item>
            <Form.Item
              name="dataType"
              noStyle
            >
              <Select
                aria-label={t('tool:valueType')}
                style={{ width: 100, flexShrink: 0 }}
                options={[
                  { label: t('tool:string'), value: 'string' },
                  { label: t('tool:number'), value: 'number' },
                ]}
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  )
}
