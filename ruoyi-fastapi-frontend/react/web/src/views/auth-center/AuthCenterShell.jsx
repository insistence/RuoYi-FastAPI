import { useEffect, useState } from 'react'
import { Steps, theme } from 'antd'
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons'
import './style.css'
export default function AuthCenterShell({
  currentStep = 0,
  steps = ['验证身份', '确认权限'],
  expiresIn = 0,
  applicationName = '',
  applicationId = '',
  showProgress = true,
  children,
}) {
  const { token } = theme.useToken()
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const deadline = Date.now() + Math.max(0, expiresIn) * 1000
    const update = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [expiresIn])
  const title = import.meta.env.VITE_APP_TITLE
  return (
    <main
      className="auth-center"
      style={{
        '--auth-bg': token.colorBgContainer,
        '--auth-border': token.colorBorderSecondary,
        '--auth-muted': token.colorTextSecondary,
        '--auth-page-bg': token.colorBgContainer === '#141414' ? '#0a0a0a' : '#f2f3f5',
      }}
    >
      <section
        className={`auth-shell${showProgress ? '' : ' is-compact'}`}
        aria-label="统一认证中心"
      >
        <aside className="trust-panel">
          <div>
            <div className="brand-row">
              <span className="brand-mark">
                <LockOutlined />
              </span>
              <div>
                <strong>{title}</strong>
                <small>统一认证中心</small>
              </div>
            </div>
            <div className="trust-copy">
              <p className="trust-kicker">安全连接</p>
              <h1>确认身份后，安全返回应用</h1>
              <p>认证过程在这里完成。你的密码、验证码和登录会话不会交给接入应用。</p>
            </div>
            {(applicationName || applicationId) && (
              <div className="application-card">
                <small>正在请求访问的应用</small>
                <div className="application-identity">
                  <span>
                    {String(applicationName || applicationId || '应用')
                      .trim()
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <div>
                    <strong>{applicationName || '外部应用'}</strong>
                    {applicationId && <code>{applicationId}</code>}
                  </div>
                </div>
              </div>
            )}
            <ul className="trust-points">
              <li>
                <CheckCircleOutlined />
                <span>只会分享你明确确认的信息</span>
              </li>
              <li>
                <CheckCircleOutlined />
                <span>你可以取消，并返回发起登录的应用</span>
              </li>
            </ul>
          </div>
          <div className="request-status">
            <span
              className="status-dot"
              aria-hidden
            />
            <span>
              {expiresIn > 0
                ? `本次请求将在 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} 后失效`
                : '受保护的认证连接'}
            </span>
          </div>
        </aside>
        <div className="auth-main">
          {showProgress && (
            <div
              className="progress-wrap"
              aria-label="认证进度"
            >
              <span>认证进度</span>
              <Steps
                titlePlacement="vertical"
                size="small"
                current={currentStep}
                items={steps.map((title) => ({ title }))}
              />
            </div>
          )}
          <div className="auth-content">{children}</div>
          <footer className="mobile-security-note">
            <LockOutlined /> {title} 不会向应用提供密码或验证码
          </footer>
        </div>
      </section>
    </main>
  )
}
