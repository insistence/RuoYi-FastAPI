import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect } from 'react'
import { Form, Input, Modal, Select, Space } from 'antd'
export default function TreeNodeDialog({ open, onClose, onConfirm }) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (open) form.resetFields()
  }, [open])
  return (
    <Modal
      footer={renderDialogFooter}
      width="800px"
      title="添加选项"
      open={open}
      mask={{ closable: false }}
      onCancel={onClose}
      onOk={() =>
        form
          .validateFields()
          .then((values) => {
            const value = values.dataType === 'number' ? Number(values.value) : values.value
            if (values.dataType === 'number' && !Number.isFinite(value))
              return form.setFields([{ name: 'value', errors: ['请输入有效数字'] }])
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
          label="选项名"
          rules={[{ required: true, message: '请输入选项名' }]}
        >
          <Input placeholder="请输入选项名" />
        </Form.Item>
        <Form.Item
          label="选项值"
          required
        >
          <Space.Compact block>
            <Form.Item
              name="value"
              noStyle
              rules={[{ required: true, message: '请输入选项值' }]}
            >
              <Input
                aria-label="选项值"
                placeholder="请输入选项值"
              />
            </Form.Item>
            <Form.Item
              name="dataType"
              noStyle
            >
              <Select
                aria-label="值类型"
                style={{ width: 100, flexShrink: 0 }}
                options={[
                  { label: '字符串', value: 'string' },
                  { label: '数字', value: 'number' },
                ]}
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  )
}
