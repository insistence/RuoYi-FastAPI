import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useState } from 'react'
import { Steps, theme } from 'antd'
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons'
import './style.css'
export default function AuthCenterShell({
  currentStep = 0,
  steps = [t('authCenter:verifyIdentity'), t('authCenter:confirmPermissions')],
  expiresIn = 0,
  applicationName = '',
  applicationId = '',
  showProgress = true,
  children,
}) {
  useI18n()

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
        aria-label={t('authCenter:authenticationCenter')}
      >
        <aside className="trust-panel">
          <div>
            <div className="brand-row">
              <span className="brand-mark">
                <LockOutlined />
              </span>
              <div>
                <strong>{title}</strong>
                <small>{t('authCenter:authenticationCenter')}</small>
              </div>
            </div>
            <div className="trust-copy">
              <p className="trust-kicker">{t('authCenter:secureConnection')}</p>
              <h1>{t('authCenter:verifyYourIdentityAndReturnSecurelyToTheApp')}</h1>
              <p>{t('authCenter:authenticationTakesPlaceHereYourPasswordVerificationCodeAnd')}</p>
            </div>
            {(applicationName || applicationId) && (
              <div className="application-card">
                <small>{t('authCenter:appRequestingAccess')}</small>
                <div className="application-identity">
                  <span>
                    {String(applicationName || applicationId || t('common:apply'))
                      .trim()
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <div>
                    <strong>{applicationName || t('authCenter:externalApplication')}</strong>
                    {applicationId && <code>{applicationId}</code>}
                  </div>
                </div>
              </div>
            )}
            <ul className="trust-points">
              <li>
                <CheckCircleOutlined />
                <span>{t('authCenter:onlyInformationYouExplicitlyApproveWillBeShared')}</span>
              </li>
              <li>
                <CheckCircleOutlined />
                <span>{t('authCenter:youCanCancelAndReturnToTheAppThat')}</span>
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
                ? t('authCenter:thisRequestExpiresInValueValue', {
                    arg0: Math.floor(remaining / 60),
                    arg1: String(remaining % 60).padStart(2, '0'),
                  })
                : t('authCenter:protectedAuthenticationConnection')}
            </span>
          </div>
        </aside>
        <div className="auth-main">
          {showProgress && (
            <div
              className="progress-wrap"
              aria-label={t('authCenter:authenticationProgress')}
            >
              <span>{t('authCenter:authenticationProgress')}</span>
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
            <LockOutlined /> {title}{' '}
            {t('authCenter:yourPasswordAndVerificationCodeWillNotBeShared')}
          </footer>
        </div>
      </section>
    </main>
  )
}
