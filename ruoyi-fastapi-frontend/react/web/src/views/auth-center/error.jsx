import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Button } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CloseOutlined } from '@ant-design/icons'
import AuthCenterShell from './AuthCenterShell'
export default function AuthCenterError() {
  useI18n()

  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reason = params.get('reason')
  const unavailable = ['disabled', 'unavailable'].includes(reason)
  const title =
    reason === 'disabled'
      ? t('authCenter:authenticationServiceIsDisabled')
      : reason === 'unavailable'
        ? t('authCenter:authenticationServiceIsUnavailable')
        : t('authCenter:unableToContinue')
  const message =
    reason === 'disabled'
      ? t('authCenter:authenticationIsNotEnabledReturnToTheAppOr')
      : reason === 'unavailable'
        ? t('authCenter:theAuthenticationServiceCannotBeReachedTryAgainLater')
        : (params.get('message') || '').slice(0, 240) ||
          t('authCenter:theAuthenticationRequestMayHaveExpiredBeIncompleteOr')
  return (
    <AuthCenterShell showProgress={false}>
      <div className="error-flow">
        <span
          className="error-symbol"
          aria-hidden
        >
          <CloseOutlined />
        </span>
        <p className="panel-kicker">
          {unavailable ? t('authCenter:serviceUnavailable') : t('layout:route.authError')}
        </p>
        <h2>{title}</h2>
        <p
          className="panel-lead"
          role="alert"
        >
          {message}
        </p>
        <div className="next-steps">
          <strong>{t('authCenter:whatYouCanDo')}</strong>
          <ol>
            <li>
              {unavailable
                ? t('authCenter:returnToTheAppOrCloseThisPage')
                : t('authCenter:returnToTheAppAndStartSignInAgain')}
            </li>
            <li>
              {unavailable
                ? t('authCenter:askYourAdministratorToCheckTheServiceStatus')
                : t('authCenter:ifItStillFailsTellYourAdministratorTheApp')}
            </li>
          </ol>
        </div>
        {window.history.length > 1 ? (
          <Button
            className="return-action"
            type="primary"
            size="large"
            block
            onClick={() => navigate(-1)}
          >
            {t('authCenter:goBack')}
          </Button>
        ) : (
          <p className="close-help">
            {unavailable
              ? t('authCenter:youCanSafelyCloseThisPageAndReturnTo')
              : t('authCenter:youCanSafelyCloseThisPageAndRestartSign')}
          </p>
        )}
      </div>
    </AuthCenterShell>
  )
}
