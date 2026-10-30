import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import defaultSettings from '@/settings'
import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { getCodeImg, register } from '@/api/login'
import { usePasswordRule } from '@/utils/passwordRule'
import { message } from '@/plugins/modal'

export default function Register() {
  useI18n()
  const { registerPwdValidator } = usePasswordRule()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const [captcha, setCaptcha] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  async function getCode() {
    try {
      setCaptcha(await getCodeImg())
      form.setFieldValue('code', '')
    } catch (error) {
      setError(error.message)
    }
  }
  useEffect(() => {
    void getCode()
  }, [])
  async function handleRegister(values) {
    if (!captcha?.registerEnabled) return
    setLoading(true)
    setError('')
    try {
      await register({ ...values, uuid: captcha.uuid })
      message.success(t('auth:accountValueCreatedSuccessfully', { username: values.username }))
      navigate('/login')
    } catch (error) {
      setError(error.message)
      void getCode()
    } finally {
      setLoading(false)
    }
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <h1>{import.meta.env.VITE_APP_TITLE}</h1>
        {captcha && !captcha.registerEnabled && (
          <Alert
            type="info"
            title={t('auth:registrationIsCurrentlyUnavailable')}
          />
        )}
        {error && (
          <Alert
            type="error"
            title={error}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          size="large"
          onFinish={handleRegister}
          disabled={!captcha?.registerEnabled}
        >
          <Form.Item
            label={t('common:login.username')}
            name="username"
            rules={[
              { required: true, message: t('common:login.usernameRequired') },
              {
                min: 2,
                max: 20,
                message: t('auth:usernameMustBeBetween2And20Characters'),
              },
            ]}
          >
            <Input
              placeholder={t('common:login.username')}
              prefix={<UserOutlined />}
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item
            label={t('common:login.password')}
            name="password"
            rules={registerPwdValidator}
          >
            <Input.Password
              placeholder={t('common:login.password')}
              prefix={<LockOutlined />}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            label={t('auth:register.confirmPassword')}
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: t('auth:register.confirmRequired') },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  value === getFieldValue('password')
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('auth:register.passwordMismatch'))),
              }),
            ]}
          >
            <Input.Password
              placeholder={t('auth:register.confirmPassword')}
              prefix={<LockOutlined />}
              autoComplete="new-password"
            />
          </Form.Item>
          {captcha?.captchaEnabled !== false && (
            <div className="captcha-row">
              <Form.Item
                name="code"
                label={t('common:login.code')}
                rules={[{ required: true, message: t('common:login.codeRequired') }]}
              >
                <Input
                  placeholder={t('common:login.code')}
                  prefix={<SafetyOutlined />}
                  autoComplete="off"
                />
              </Form.Item>
              <button
                type="button"
                aria-label={t('auth:refreshVerificationCode')}
                onClick={getCode}
              >
                {captcha?.img && (
                  <img
                    alt={t('auth:registrationVerificationCode')}
                    src={`data:image/gif;base64,${captcha.img}`}
                  />
                )}
              </button>
            </div>
          )}
          <Form.Item className="login-submit">
            <Button
              type="primary"
              block
              htmlType="submit"
              loading={loading}
            >
              {t('layout:routes.register')}
            </Button>
            <div className="login-link">
              <Link to="/login">{t('auth:register.signIn')}</Link>
            </div>
          </Form.Item>
        </Form>
      </section>
      <footer className="login-footer">{defaultSettings.footerContent}</footer>
    </main>
  )
}
