import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useState } from 'react'
import { Button, Form, Input, Space } from 'antd'
import tab from '@/plugins/tab'
import { updateUserPwd } from '@/api/system/user'
import { usePasswordRule } from '@/utils/passwordRule'
import { message } from '@/plugins/modal'
import useUserStore from '@/store/modules/user'
export default function ResetPwd() {
  useI18n()
  const { infoPwdValidator } = usePasswordRule()

  const [form] = Form.useForm(),
    [saving, setSaving] = useState(false)
  useLocalizedFormErrors(form)
  async function submit(values) {
    setSaving(true)
    try {
      await updateUserPwd(values.oldPassword, values.newPassword)
      message.success(t('common:updateSuccess'))
      form.resetFields()
      useUserStore.setState({ passwordWarning: '' })
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
        label={t('auth:password.old')}
        name="oldPassword"
        rules={[{ required: true, message: t('auth:password.oldRequired') }]}
      >
        <Input.Password
          placeholder={t('auth:password.oldPlaceholder')}
          autoComplete="current-password"
        />
      </Form.Item>
      <Form.Item
        label={t('auth:password.new')}
        name="newPassword"
        rules={infoPwdValidator}
      >
        <Input.Password
          placeholder={t('auth:password.newPlaceholder')}
          autoComplete="new-password"
        />
      </Form.Item>
      <Form.Item
        label={t('auth:register.confirmPassword')}
        name="confirmPassword"
        dependencies={['newPassword']}
        rules={[
          { required: true, message: t('auth:password.confirmRequired') },
          ({ getFieldValue }) => ({
            validator: (_, value) =>
              value === getFieldValue('newPassword')
                ? Promise.resolve()
                : Promise.reject(new Error(t('auth:register.passwordMismatch'))),
          }),
        ]}
      >
        <Input.Password
          placeholder={t('auth:password.confirmPlaceholder')}
          autoComplete="new-password"
        />
      </Form.Item>
      <Form.Item className="profile-form-actions">
        <Space>
          <Button
            htmlType="submit"
            type="primary"
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
