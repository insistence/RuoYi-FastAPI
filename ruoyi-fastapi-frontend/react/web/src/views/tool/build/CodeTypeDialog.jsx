import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useLocalizedFormErrors } from '@/i18n/form'
import { useEffect } from 'react'
import { Form, Input, Modal, Radio } from 'antd'
export default function CodeTypeDialog({ open, onClose, onConfirm, showFileName }) {
  useI18n()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  useEffect(() => {
    if (open) form.setFieldsValue({ type: 'file', fileName: `form-${Date.now()}.jsx` })
  }, [open])
  return (
    <Modal
      width="500px"
      title={t('tool:chooseOutputType')}
      open={open}
      onCancel={onClose}
      onOk={() =>
        form
          .validateFields()
          .then(onConfirm)
          .catch(() => {})
      }
      forceRender
    >
      <Form
        name="src-views-tool-build-CodeTypeDialog-jsx-editor-21"
        className="ruoyi-dialog-form"
        colon={false}
        wrapperCol={{ flex: '1 1 0' }}
        labelCol={{ flex: '100px' }}
        form={form}
        layout="horizontal"
      >
        <Form.Item
          name="type"
          label={t('tool:outputType')}
          rules={[{ required: true, message: t('tool:selectAnOutputType') }]}
        >
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: t('tool:page'), value: 'file' },
              { label: t('tool:dialog'), value: 'dialog' },
            ]}
          />
        </Form.Item>
        {showFileName && (
          <Form.Item
            name="fileName"
            label={t('tool:fileName')}
            rules={[
              { required: true, message: t('tool:enterAFileName') },
              {
                pattern: /^[^\\/:*?"<>|]+\.jsx$/,
                message: t('tool:enterAValidJsxFileName'),
              },
            ]}
          >
            <Input
              allowClear
              placeholder={t('tool:enterAFileName')}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
