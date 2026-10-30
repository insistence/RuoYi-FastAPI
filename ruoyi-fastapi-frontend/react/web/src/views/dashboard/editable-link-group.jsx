import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { Button, Form, Input, Modal, Space } from 'antd'
import { useState } from 'react'
import { PlusOutlined } from '@ant-design/icons'
const defaultLinks = [1, 2, 3, 4, 5, 6].map((preset) => ({
  preset,
  href: '',
}))
export default function EditableLinkGroup() {
  useI18n()

  const [links, setLinks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('react-dashboard-links'))
      return Array.isArray(saved) ? saved : defaultLinks
    } catch {
      return defaultLinks
    }
  })
  const [open, setOpen] = useState(false),
    [form] = Form.useForm()
  useLocalizedFormErrors(form)
  async function add() {
    try {
      const values = await form.validateFields()
      const next = [...links, values]
      setLinks(next)
      localStorage.setItem('react-dashboard-links', JSON.stringify(next))
      setOpen(false)
      form.resetFields()
    } catch {}
  }
  return (
    <>
      <div className="dashboard-links">
        {links.map((item, index) => (
          <a
            key={index}
            href={item.href}
            target="_blank"
            rel="noreferrer"
          >
            {item.preset ? t('common:actionValue', { number: item.preset }) : item.title}
          </a>
        ))}
        <Button
          size="small"
          type="primary"
          ghost
          icon={<PlusOutlined />}
          onClick={() => setOpen(true)}
        >
          {t('common:dashboard.add')}
        </Button>
      </div>
      <Modal
        title={t('common:addShortcut')}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={add}
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label={t('common:name')}
            name="title"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t('common:address')}
            name="href"
            rules={[
              { required: true },
              {
                pattern: /^(https?:\/\/|\/(?!\/))/,
                message: t('common:enterAnApplicationPathOrAnHttpSUrl'),
              },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
