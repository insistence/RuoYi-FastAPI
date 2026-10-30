import { useLocalizedText } from '@/i18n/form'
import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

  const context = useInteractionContext()
  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const [interaction, setInteraction] = useState({})
  const [captcha, setCaptcha] = useState({})
  const [initializing, setInitializing] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useLocalizedText('')
  async function loadCaptcha() {
    const response = await getInteractionCaptcha(context.interactionId)
    setCaptcha(response.data || {})
    form.setFieldsValue({ uuid: response.data?.uuid || '', code: '' })
  }
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!context.interactionId || !context.csrfToken())
        return context.fatal(t('authCenter:theAuthenticationRequestIsIncompleteReturnToTheApp'))
      try {
        const response = await getInteraction(context.interactionId, context.csrfToken())
        if (!active) return
        const data = response.data || {}
        setInteraction(data)
        if (data.nextAction && data.nextAction !== 'login')
          await context.goToAction(data.nextAction)
        else if (data.captchaEnabled) await loadCaptcha()
      } catch (e) {
        if (active)
          context.fatal(
            e.message || t('authCenter:theAuthenticationRequestHasExpiredReturnToTheApp')
          )
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
      setError((t) => e.message || t('authCenter:identityVerificationFailed'))
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
      setError((t) => e.message || t('authCenter:theAuthenticationRequestCouldNotBeCancelled'))
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
          <p className="panel-kicker">{t('authCenter:verifyIdentity')}</p>
          <h2>{t('authCenter:continueWithYourAccount')}</h2>
          <p className="panel-lead">
            {t('authCenter:afterSigningInYouWillReturnTo')}{' '}
            <strong>{interaction.client?.clientName || t('authCenter:appRequestingSignIn')}</strong>{' '}
            {t('authCenter:toContinueThisSignInDoesNotChangeYour')}
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
              label={t('common:login.username')}
              name="userName"
              rules={[{ required: true, message: t('authCenter:enterYourUsername') }]}
            >
              <Input
                placeholder={t('authCenter:auth-center.enterYourUsername')}
                size="large"
                autoComplete="username"
                prefix={<UserOutlined />}
                autoFocus
              />
            </Form.Item>
            <Form.Item
              label={t('common:login.password')}
              name="password"
              rules={[{ required: true, message: t('authCenter:auth-center.enterYourPassword') }]}
            >
              <Input.Password
                placeholder={t('auth:lock.password')}
                size="large"
                autoComplete="current-password"
                prefix={<LockOutlined />}
              />
            </Form.Item>
            {captcha.captchaEnabled && (
              <Form.Item
                label={t('authCenter:verificationCode')}
                required
              >
                <div className="captcha-row">
                  <Form.Item
                    name="code"
                    noStyle
                    rules={[{ required: true, message: t('authCenter:enterTheVerificationCode') }]}
                  >
                    <Input
                      placeholder={t('authCenter:enterTheCharactersInTheImage')}
                      size="large"
                      autoComplete="off"
                    />
                  </Form.Item>
                  <Button
                    aria-label={t('authCenter:getADifferentVerificationImage')}
                    onClick={loadCaptcha}
                    style={{ height: 40, padding: 0 }}
                  >
                    {captcha.img ? (
                      <img
                        src={`data:image/gif;base64,${captcha.img}`}
                        alt={t('authCenter:verificationCode')}
                      />
                    ) : (
                      t('authCenter:newImage')
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
                <Checkbox>{t('authCenter:staySignedInOnThisDevice')}</Checkbox>
              </Form.Item>
              <small>{t('authCenter:useThisOnlyOnAPersonalDeviceYouTrust')}</small>
            </div>
            <Button
              className="primary-action"
              type="primary"
              htmlType="submit"
              size="large"
              loading={submitting}
              block
            >
              {t('authCenter:signInAndContinue')}
            </Button>
          </Form>
          <Button
            className="cancel-action"
            type="link"
            disabled={submitting || initializing}
            onClick={cancel}
          >
            {t('authCenter:cancelAndReturnToTheApp')}
          </Button>
        </div>
      </Spin>
    </AuthCenterShell>
  )
}
