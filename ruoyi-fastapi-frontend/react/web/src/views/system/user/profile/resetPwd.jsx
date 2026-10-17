import { useState } from 'react'
import { Button, Form, Input, Space } from 'antd'
import tab from '@/plugins/tab'
import { updateUserPwd } from '@/api/system/user'
import { usePasswordRule } from '@/utils/passwordRule'
import { message } from '@/plugins/modal'
import useUserStore from '@/store/modules/user'
export default function ResetPwd() {
  const [form] = Form.useForm(),
    [saving, setSaving] = useState(false)
  async function submit(values) {
    setSaving(true)
    try {
      await updateUserPwd(values.oldPassword, values.newPassword)
      message.success('修改成功')
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
        label="旧密码"
        name="oldPassword"
        rules={[{ required: true, message: '旧密码不能为空' }]}
      >
        <Input.Password
          placeholder="请输入旧密码"
          autoComplete="current-password"
        />
      </Form.Item>
      <Form.Item
        label="新密码"
        name="newPassword"
        rules={usePasswordRule().infoPwdValidator}
      >
        <Input.Password
          placeholder="请输入新密码"
          autoComplete="new-password"
        />
      </Form.Item>
      <Form.Item
        label="确认密码"
        name="confirmPassword"
        dependencies={['newPassword']}
        rules={[
          { required: true, message: '确认密码不能为空' },
          ({ getFieldValue }) => ({
            validator: (_, value) =>
              value === getFieldValue('newPassword')
                ? Promise.resolve()
                : Promise.reject(new Error('两次输入的密码不一致')),
          }),
        ]}
      >
        <Input.Password
          placeholder="请确认新密码"
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
            保存
          </Button>
          <Button
            type="primary"
            danger
            onClick={() => tab.closePage()}
          >
            关闭
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
