import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Spin } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import {
  cancelInteraction,
  getInteraction,
  getInteractionCaptcha,
  submitInteractionLogin,
} from '@/api/authCenter'
import AuthCenterShell from './AuthCenterShell'
import { useInteractionContext } from './useInteraction'
export default function AuthCenterLogin() {
  const context = useInteractionContext()
  const [form] = Form.useForm()
  const [interaction, setInteraction] = useState({})
  const [captcha, setCaptcha] = useState({})
  const [initializing, setInitializing] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  async function loadCaptcha() {
    const response = await getInteractionCaptcha(context.interactionId)
    setCaptcha(response.data || {})
    form.setFieldsValue({ uuid: response.data?.uuid || '', code: '' })
  }
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!context.interactionId || !context.csrfToken())
        return context.fatal('认证请求不完整，请返回应用重新登录')
      try {
        const response = await getInteraction(context.interactionId, context.csrfToken())
        if (!active) return
        const data = response.data || {}
        setInteraction(data)
        if (data.nextAction && data.nextAction !== 'login')
          await context.goToAction(data.nextAction)
        else if (data.captchaEnabled) await loadCaptcha()
      } catch (e) {
        if (active) context.fatal(e.message || '认证请求已失效，请返回应用重新登录')
      } finally {
        if (active) setInitializing(false)
      }
    })()
    return () => {
      active = false
    }
  }, [context])
  async function submit(values) {
    setSubmitting(true)
    setError('')
    try {
      const response = await submitInteractionLogin(context.interactionId, context.csrfToken(), {
        ...values,
        uuid: captcha.uuid || '',
        code: values.code || '',
        rememberMe: !!values.rememberMe,
      })
      form.setFieldValue('password', '')
      if (response.data?.nextAction === 'redirect')
        await context.followServerRedirect(response.data.redirectUrl)
      else await context.goToAction(response.data?.nextAction)
    } catch (e) {
      form.setFieldValue('password', '')
      setError(e.message || '身份验证失败')
      if (captcha.captchaEnabled) await loadCaptcha().catch(() => {})
    } finally {
      setSubmitting(false)
    }
  }
  async function cancel() {
    setSubmitting(true)
    try {
      const response = await cancelInteraction(context.interactionId, context.csrfToken())
      if (response.data?.redirectUrl) await context.followServerRedirect(response.data.redirectUrl)
    } catch (e) {
      setError(e.message || '暂时无法取消认证请求')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <AuthCenterShell
      expiresIn={interaction.expiresIn}
      applicationName={interaction.client?.clientName}
      applicationId={interaction.client?.clientId}
    >
      <Spin spinning={initializing}>
        <div className="auth-login-flow">
          <p className="panel-kicker">验证身份</p>
          <h2>使用你的账户继续</h2>
          <p className="panel-lead">
            登录成功后，你将返回{' '}
            <strong>{interaction.client?.clientName || '发起登录的应用'}</strong>{' '}
            完成访问。本次登录不会改变管理后台的登录状态。
          </p>
          {error && (
            <Alert
              type="error"
              showIcon
              title={error}
            />
          )}
          <Form
            form={form}
            layout="vertical"
            onFinish={submit}
            initialValues={{ rememberMe: false }}
            disabled={initializing || submitting}
          >
            <Form.Item
              label="账号"
              name="userName"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input
                placeholder="请输入你的账号"
                size="large"
                autoComplete="username"
                prefix={<UserOutlined />}
                autoFocus
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                placeholder="请输入登录密码"
                size="large"
                autoComplete="current-password"
                prefix={<LockOutlined />}
              />
            </Form.Item>
            {captcha.captchaEnabled && (
              <Form.Item
                label="安全验证码"
                required
              >
                <div className="captcha-row">
                  <Form.Item
                    name="code"
                    noStyle
                    rules={[{ required: true, message: '请输入安全验证码' }]}
                  >
                    <Input
                      placeholder="输入图中字符"
                      size="large"
                      autoComplete="off"
                    />
                  </Form.Item>
                  <Button
                    aria-label="看不清，换一张验证码"
                    onClick={loadCaptcha}
                    style={{ height: 40, padding: 0 }}
                  >
                    {captcha.img ? (
                      <img
                        src={`data:image/gif;base64,${captcha.img}`}
                        alt="安全验证码"
                      />
                    ) : (
                      '换一张'
                    )}
                  </Button>
                </div>
              </Form.Item>
            )}
            <div className="preference-row">
              <Form.Item
                name="rememberMe"
                valuePropName="checked"
                noStyle
              >
                <Checkbox>在这台设备上保持登录</Checkbox>
              </Form.Item>
              <small>仅在你信任的个人设备上勾选</small>
            </div>
            <Button
              className="primary-action"
              type="primary"
              htmlType="submit"
              size="large"
              loading={submitting}
              block
            >
              登录并继续
            </Button>
          </Form>
          <Button
            className="cancel-action"
            type="link"
            disabled={submitting || initializing}
            onClick={cancel}
          >
            取消并返回应用
          </Button>
        </div>
      </Spin>
    </AuthCenterShell>
  )
}
