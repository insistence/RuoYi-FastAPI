import { useLocalizedText } from '@/i18n/form'
import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Spin } from 'antd'
import { getInteraction, submitInteractionPasswordChange } from '@/api/authCenter'
import { usePasswordRule } from '@/utils/passwordRule'
import {
  LockOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import AuthCenterShell from './AuthCenterShell'
import { useInteractionContext } from './useInteraction'
export default function ChangePassword() {
  useI18n()

  const context = useInteractionContext()
  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const { pwdChrType, infoPwdValidator } = usePasswordRule()
  const [interaction, setInteraction] = useState({})
  const [initializing, setInitializing] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useLocalizedText('')
  const password = Form.useWatch('newPassword', form) || ''
  const strength =
    password.length < 6
      ? 0
      : Math.min(
          3,
          1 +
            Number(password.length >= 10) +
            Number([/[A-Za-z]/, /\d/, /[^A-Za-z\d]/].filter((p) => p.test(password)).length >= 2)
        )
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!context.interactionId || !context.csrfToken())
        return context.fatal(t('authCenter:theAuthenticationRequestIsIncompleteReturnToTheApp'))
      try {
        const response = await getInteraction(context.interactionId, context.csrfToken())
        if (!active) return
        setInteraction(response.data || {})
        if (response.data?.nextAction !== 'changePassword')
          await context.goToAction(response.data?.nextAction)
      } catch (e) {
        if (active) context.fatal(e.message || t('authCenter:theAuthenticationRequestHasExpired'))
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
      const response = await submitInteractionPasswordChange(
        context.interactionId,
        context.csrfToken(),
        values
      )
      form.resetFields()
      if (response.data?.nextAction === 'redirect')
        await context.followServerRedirect(response.data.redirectUrl)
      else await context.goToAction(response.data?.nextAction)
    } catch (e) {
      form.setFieldValue('oldPassword', '')
      setError((t) => e.message || t('authCenter:failedToUpdatePassword'))
    } finally {
      setSubmitting(false)
    }
  }
  const policy = {
    0: t('authCenter:use620CharactersExcludingQuotationMarksBackslashesAnd'),
    1: t('authCenter:use620Digits'),
    2: t('authCenter:use620LatinLetters'),
    3: t('authCenter:use620CharactersIncludingBothLettersAndNumbers'),
    4: t('authCenter:use620CharactersIncludingLettersNumbersAndSymbols'),
  }[pwdChrType]
  return (
    <AuthCenterShell
      steps={[t('authCenter:protectYourAccount'), t('authCenter:confirmPermissions')]}
      expiresIn={interaction.expiresIn}
      applicationName={interaction.client?.clientName}
      applicationId={interaction.client?.clientId}
    >
      <Spin spinning={initializing}>
        <div className="auth-password-flow">
          <p className="panel-kicker">{t('authCenter:accountProtection')}</p>
          <h2>{t('authCenter:setANewPasswordToContinue')}</h2>
          <p className="panel-lead">
            {t('authCenter:yourPasswordHasExpiredOrIsStillTheInitial')}{' '}
            <strong>{interaction.client?.clientName || t('authCenter:appRequestingSignIn')}</strong>
            。
          </p>
          <div className="security-impact">
            <ExclamationCircleOutlined />
            <span>
              <strong>{t('authCenter:protectYourEntireAccount')}</strong>
              <small>{t('authCenter:existingSessionsInOtherExternalAppsWillBeSigned')}</small>
            </span>
          </div>
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
            disabled={initializing || submitting}
          >
            <Form.Item
              label={t('authCenter:currentPassword')}
              name="oldPassword"
              rules={[{ required: true, message: t('authCenter:enterYourCurrentPassword') }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('authCenter:toVerifyYourIdentity')}
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>
            <Form.Item
              label={t('auth:password.new')}
              name="newPassword"
              dependencies={['oldPassword']}
              rules={[
                ...infoPwdValidator,
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    value && value === getFieldValue('oldPassword')
                      ? Promise.reject(
                          new Error(t('authCenter:theNewPasswordMustDifferFromTheCurrentPassword'))
                        )
                      : Promise.resolve(),
                }),
              ]}
            >
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder={t('authCenter:enterANewPassword')}
                size="large"
                autoComplete="new-password"
              />
            </Form.Item>
            <div
              className="password-meter password-meter-after-field"
              aria-live="polite"
            >
              <div className="meter-heading">
                <span>{t('authCenter:passwordStrength')}</span>
                <strong className={`is-${strength}`}>
                  {
                    [
                      t('authCenter:requirementsNotMet'),
                      t('authCenter:basic'),
                      t('authCenter:good'),
                      t('authCenter:strong'),
                    ][strength]
                  }
                </strong>
              </div>
              <div
                className="meter-bars"
                aria-hidden
              >
                {[1, 2, 3].map((i) => (
                  <i
                    key={i}
                    className={i <= strength ? 'active' : ''}
                  />
                ))}
              </div>
              <small>{policy}</small>
            </div>
            <Form.Item
              label={t('authCenter:repeatNewPassword')}
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: t('authCenter:enterTheNewPasswordAgain') },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    !value || value === getFieldValue('newPassword')
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('authCenter:theNewPasswordsDoNotMatch'))),
                }),
              ]}
            >
              <Input.Password
                prefix={<CheckCircleOutlined />}
                placeholder={t('authCenter:enterItAgainToAvoidMistakes')}
                size="large"
                autoComplete="new-password"
              />
            </Form.Item>
            <Button
              className="primary-action"
              type="primary"
              size="large"
              htmlType="submit"
              loading={submitting}
              block
            >
              {t('authCenter:updatePasswordAndContinue')}
            </Button>
          </Form>
        </div>
      </Spin>
    </AuthCenterShell>
  )
}
