import { useLocalizedText } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Space, Spin, Tag, Tooltip } from 'antd'
import { getInteraction, submitInteractionConsent } from '@/api/authCenter'
import { QuestionCircleFilled } from '@ant-design/icons'
import AuthCenterShell from './AuthCenterShell'
import { useInteractionContext } from './useInteraction'
export default function AuthCenterConsent() {
  useI18n()

  const context = useInteractionContext()
  const [interaction, setInteraction] = useState({})
  const [selected, setSelected] = useState([])
  const [remember, setRemember] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useLocalizedText('')
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
        if (data.nextAction !== 'consent') await context.goToAction(data.nextAction)
        else setSelected((data.requestedScopes || []).filter((s) => s.required).map((s) => s.scope))
      } catch (e) {
        if (active) context.fatal(e.message || t('authCenter:theAuthorizationRequestHasExpired'))
      } finally {
        if (active) setInitializing(false)
      }
    })()
    return () => {
      active = false
    }
  }, [context])
  const required = (interaction.requestedScopes || []).filter((s) => s.required)
  const optional = (interaction.requestedScopes || []).filter((s) => !s.required)
  let policyUri = ''
  try {
    const url = new URL(interaction.client?.policyUri)
    if (['http:', 'https:'].includes(url.protocol)) policyUri = url.href
  } catch {
    /* No public policy link. */
  }
  async function submit(approved) {
    setSubmitting(true)
    setError('')
    try {
      const response = await submitInteractionConsent(context.interactionId, context.csrfToken(), {
        approved,
        scopes: approved ? [...new Set([...required.map((s) => s.scope), ...selected])] : [],
        rememberConsent: approved && remember,
      })
      await context.followServerRedirect(response.data?.redirectUrl)
    } catch (e) {
      setError((t) => e.message || t('authCenter:couldNotSaveYourPermissionChoicesTryAgain'))
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <AuthCenterShell
      currentStep={1}
      expiresIn={interaction.expiresIn}
      applicationName={interaction.client?.clientName}
      applicationId={interaction.client?.clientId}
    >
      <Spin spinning={initializing}>
        <div className="auth-consent-flow">
          <p className="panel-kicker">{t('authCenter:confirmPermissions')}</p>
          <h2>{t('authCenter:confirmWhatToShare')}</h2>
          <p className="panel-lead">
            <strong>{interaction.client?.clientName || t('authCenter:appRequestingSignIn')}</strong>{' '}
            {t('authCenter:isRequestingTheInformationBelowRequiredInformationIsNeeded')}
          </p>
          {error && (
            <Alert
              type="error"
              showIcon
              title={error}
            />
          )}
          <Checkbox.Group
            className="scope-selection"
            value={selected}
            onChange={setSelected}
            disabled={submitting || initializing}
            style={{ width: '100%', display: 'block' }}
          >
            {[
              [
                required,
                t('authCenter:requiredForAccess'),
                t('authCenter:decliningThesePermissionsPreventsAccessToTheApp'),
              ],
              [
                optional,
                t('authCenter:yourChoice'),
                t('authCenter:youCanUseTheAppWithoutSelectingThese'),
              ],
            ].map(
              ([scopes, title, hint]) =>
                scopes.length > 0 && (
                  <section
                    className="scope-group"
                    key={title}
                  >
                    <div className="group-heading">
                      <div>
                        <h3>{title}</h3>
                        <p>{hint}</p>
                      </div>
                      <span>
                        {scopes === optional
                          ? t('authCenter:selectedValueValue', {
                              selected: optional.filter((scope) => selected.includes(scope.scope))
                                .length,
                              total: optional.length,
                            })
                          : t('authCenter:valueItems', { length: scopes.length })}
                      </span>
                    </div>
                    <div className="scope-list">
                      {scopes.map((scope) => (
                        <label
                          key={scope.scope}
                          className={`scope-item${scope.required ? ' is-required' : ''}`}
                        >
                          <Checkbox
                            value={scope.scope}
                            disabled={scope.required}
                            aria-label={scope.name || scope.scope}
                          />
                          <span className="scope-copy">
                            <span className="scope-title">
                              <strong>{scope.name || scope.scope}</strong>
                              {scope.name && scope.name !== scope.scope && (
                                <Tooltip
                                  title={t('authCenter:systemPermissionCodeValue', {
                                    scope: scope.scope,
                                  })}
                                >
                                  <QuestionCircleFilled
                                    className="scope-help"
                                    tabIndex={0}
                                    aria-label={t('authCenter:viewPermissionCodes')}
                                  />
                                </Tooltip>
                              )}
                            </span>
                            <small>
                              {scope.description ||
                                (scope.required
                                  ? t('authCenter:usedToCompleteSignInOrProvideTheApplication')
                                  : t(
                                      'authCenter:allowTheApplicationToUseThisInformationOrCapability'
                                    ))}
                            </small>
                          </span>
                          {scope.required ? (
                            <Tag>{t('authCenter:required')}</Tag>
                          ) : scope.sensitive ? (
                            <Tag color="warning">{t('authCenter:sensitiveInformation')}</Tag>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  </section>
                )
            )}
          </Checkbox.Group>
          <label className="remember-card">
            <Checkbox
              checked={remember}
              disabled={submitting}
              onChange={(e) => setRemember(e.target.checked)}
              aria-label={t('authCenter:rememberMyChoices')}
            />
            <span>
              <strong>{t('authCenter:rememberMyChoices')}</strong>
              <small>
                {t(
                  'authCenter:rememberingYourChoicesAvoidsRepeatedConfirmationForApprovedPermissions'
                )}
              </small>
              {selected.includes('offline_access') && (
                <small>{t('authCenter:offlineAccessAllowsTheAppToRenewAccessWhen')}</small>
              )}
            </span>
          </label>
          <div className="actions">
            <Button
              size="large"
              disabled={submitting || initializing}
              onClick={() => submit(false)}
            >
              {t('authCenter:declineAndReturn')}
            </Button>
            <Button
              type="primary"
              size="large"
              disabled={initializing}
              loading={submitting}
              onClick={() => submit(true)}
            >
              {t('authCenter:allow')} {selected.length} {t('authCenter:andContinue')}
            </Button>
          </div>
          {policyUri && (
            <p className="policy-link">
              <a
                href={policyUri}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('authCenter:viewThisAppSPrivacyPolicy')}
              </a>
            </p>
          )}
        </div>
      </Spin>
    </AuthCenterShell>
  )
}
