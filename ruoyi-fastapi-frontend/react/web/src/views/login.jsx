import defaultSettings from '@/settings'
import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input } from 'antd'
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Cookies from 'js-cookie'
import { getCodeImg } from '@/api/login'
import { encrypt, decrypt } from '@/utils/jsencrypt'
import useUserStore from '@/store/modules/user'
import { getLoginRedirect } from '@/utils/router'

export default function Login() {
  const [form] = Form.useForm()
  const [captcha, setCaptcha] = useState({
    captchaEnabled: true,
    registerEnabled: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const [params] = useSearchParams()
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
  async function handleLogin(values) {
    setLoading(true)
    setError('')
    try {
      await useUserStore.getState().login({ ...values, uuid: captcha.uuid })
      if (values.rememberMe) {
        Cookies.set('username', values.username, { expires: 30 })
        Cookies.set('password', encrypt(values.password), { expires: 30 })
        Cookies.set('rememberMe', 'true', { expires: 30 })
      } else {
        ;['username', 'password', 'rememberMe'].forEach((key) => Cookies.remove(key))
      }
      navigate(getLoginRedirect(params.get('redirect')), {
        replace: true,
      })
    } catch (error) {
      setError(error.message)
      if (captcha.captchaEnabled !== false) void getCode()
    } finally {
      setLoading(false)
    }
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <h1>{import.meta.env.VITE_APP_TITLE}</h1>
        {error && (
          <Alert
            type="error"
            title={error}
            showIcon
          />
        )}
        <Form
          form={form}
          layout="vertical"
          size="large"
          initialValues={{
            username: Cookies.get('username') || '',
            password: Cookies.get('password') ? decrypt(Cookies.get('password')) : '',
            rememberMe: Cookies.get('rememberMe') === 'true',
          }}
          onFinish={handleLogin}
        >
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入您的账号' }]}
          >
            <Input
              placeholder="账号"
              prefix={<UserOutlined />}
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入您的密码' }]}
          >
            <Input.Password
              placeholder="密码"
              prefix={<LockOutlined />}
              autoComplete="current-password"
            />
          </Form.Item>
          {captcha.captchaEnabled !== false && (
            <div className="captcha-row">
              <Form.Item
                name="code"
                label="验证码"
                rules={[{ required: true, message: '请输入验证码' }]}
              >
                <Input
                  placeholder="验证码"
                  prefix={<SafetyOutlined />}
                  maxLength={8}
                  autoComplete="off"
                />
              </Form.Item>
              <button
                type="button"
                aria-label="刷新验证码"
                onClick={getCode}
              >
                {captcha.img && (
                  <img
                    alt="登录验证码"
                    src={`data:image/gif;base64,${captcha.img}`}
                  />
                )}
              </button>
            </div>
          )}
          <Form.Item
            name="rememberMe"
            valuePropName="checked"
            className="login-remember"
          >
            <Checkbox>记住密码</Checkbox>
          </Form.Item>
          <Form.Item className="login-submit">
            <Button
              block
              type="primary"
              htmlType="submit"
              loading={loading}
            >
              登录
            </Button>
            {captcha.registerEnabled && (
              <div className="login-link">
                <Link to="/register">立即注册</Link>
              </div>
            )}
          </Form.Item>
        </Form>
      </section>
      <footer className="login-footer">{defaultSettings.footerContent}</footer>
    </main>
  )
}
