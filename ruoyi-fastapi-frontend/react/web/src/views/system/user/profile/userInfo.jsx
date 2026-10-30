import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useState } from 'react'
import { Button, Form, Input, Radio, Space } from 'antd'
import tab from '@/plugins/tab'
import { updateUserProfile } from '@/api/system/user'
import useUserStore from '@/store/modules/user'
import { message } from '@/plugins/modal'
export default function UserInfo({ user, onSaved }) {
  useI18n()

  const [form] = Form.useForm(),
    [saving, setSaving] = useState(false)
  useLocalizedFormErrors(form)
  useEffect(() => {
    form.setFieldsValue(user)
  }, [user])
  async function submit(values) {
    setSaving(true)
    try {
      await updateUserProfile(values)
      useUserStore.setState({ nickName: values.nickName })
      message.success(t('common:updateSuccess'))
      onSaved?.()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <Form
      form={form}
      className="profile-form"
      labelCol={{ flex: '80px' }}
      wrapperCol={{ flex: 'auto' }}
      colon={false}
      onFinish={submit}
    >
      <Form.Item
        name="nickName"
        label={t('system:user.nickname')}
        rules={[{ required: true, message: t('system:user.nicknameRequired') }]}
      >
        <Input maxLength={30} />
      </Form.Item>
      <Form.Item
        name="phonenumber"
        label={t('system:user.phone')}
        rules={[
          { required: true, message: t('system:user.phoneRequired') },
          { pattern: /^1[3-9]\d{9}$/, message: t('system:user.phoneInvalid') },
        ]}
      >
        <Input maxLength={11} />
      </Form.Item>
      <Form.Item
        name="email"
        label={t('system:user.email')}
        rules={[
          { required: true, message: t('system:emailAddressIsRequired') },
          { type: 'email', message: t('system:enterAValidEmailAddress') },
        ]}
      >
        <Input maxLength={50} />
      </Form.Item>
      <Form.Item
        name="sex"
        label={t('system:user.sex')}
      >
        <Radio.Group
          options={[
            { label: t('system:user.male'), value: '0' },
            { label: t('system:user.female'), value: '1' },
          ]}
        />
      </Form.Item>
      <Form.Item className="profile-form-actions">
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
          >
            {t('common:save')}
          </Button>
          <Button
            type="primary"
            danger
            onClick={() => tab.closePage()}
          >
            {t('layout:search.close')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
