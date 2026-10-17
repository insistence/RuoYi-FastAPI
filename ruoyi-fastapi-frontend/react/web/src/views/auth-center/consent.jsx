import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Space, Spin, Tag, Tooltip } from 'antd'
import { getInteraction, submitInteractionConsent } from '@/api/authCenter'
import { QuestionCircleFilled } from '@ant-design/icons'
import AuthCenterShell from './AuthCenterShell'
import { useInteractionContext } from './useInteraction'
export default function AuthCenterConsent() {
  const context = useInteractionContext()
  const [interaction, setInteraction] = useState({})
  const [selected, setSelected] = useState([])
  const [remember, setRemember] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
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
        if (data.nextAction !== 'consent') await context.goToAction(data.nextAction)
        else setSelected((data.requestedScopes || []).filter((s) => s.required).map((s) => s.scope))
      } catch (e) {
        if (active) context.fatal(e.message || '授权请求已失效')
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
      setError(e.message || '未能保存本次权限选择，请重试')
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
          <p className="panel-kicker">确认权限</p>
          <h2>确认要分享的信息</h2>
          <p className="panel-lead">
            <strong>{interaction.client?.clientName || '发起登录的应用'}</strong>{' '}
            正在请求以下信息。必需信息用于完成本次访问，可选信息由你决定。
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
              [required, '完成访问所需', '拒绝这些权限将无法继续进入应用'],
              [optional, '由你选择', '不勾选也可以继续使用应用'],
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
                        {title === '由你选择'
                          ? `已选 ${optional.filter((scope) => selected.includes(scope.scope)).length}/${optional.length}`
                          : `${scopes.length} 项`}
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
                                <Tooltip title={`系统权限代码：${scope.scope}`}>
                                  <QuestionCircleFilled
                                    className="scope-help"
                                    tabIndex={0}
                                    aria-label="查看系统权限代码"
                                  />
                                </Tooltip>
                              )}
                            </span>
                            <small>
                              {scope.description ||
                                (scope.required
                                  ? '用于完成登录或提供应用的核心功能'
                                  : '允许应用使用这项信息或能力')}
                            </small>
                          </span>
                          {scope.required ? (
                            <Tag>必需</Tag>
                          ) : scope.sensitive ? (
                            <Tag color="warning">敏感信息</Tag>
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
              aria-label="记住本次选择"
            />
            <span>
              <strong>记住本次选择</strong>
              <small>记住后可在已同意的范围内免于重复确认；不勾选也会保存可撤销的授权记录。</small>
              {selected.includes('offline_access') && (
                <small>持续访问允许应用在你不在线时续期，与是否记住本次选择无关。</small>
              )}
            </span>
          </label>
          <div className="actions">
            <Button
              size="large"
              disabled={submitting || initializing}
              onClick={() => submit(false)}
            >
              不允许并返回
            </Button>
            <Button
              type="primary"
              size="large"
              disabled={initializing}
              loading={submitting}
              onClick={() => submit(true)}
            >
              允许 {selected.length} 项并继续
            </Button>
          </div>
          {policyUri && (
            <p className="policy-link">
              <a
                href={policyUri}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看该应用的隐私说明
              </a>
            </p>
          )}
        </div>
      </Spin>
    </AuthCenterShell>
  )
}
