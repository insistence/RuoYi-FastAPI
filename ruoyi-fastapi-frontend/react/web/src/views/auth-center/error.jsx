import { Button } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CloseOutlined } from '@ant-design/icons'
import AuthCenterShell from './AuthCenterShell'
export default function AuthCenterError() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reason = params.get('reason')
  const unavailable = ['disabled', 'unavailable'].includes(reason)
  const title =
    reason === 'disabled'
      ? '统一认证服务未启用'
      : reason === 'unavailable'
        ? '统一认证服务暂不可用'
        : '这次访问无法继续'
  const message =
    reason === 'disabled'
      ? '当前未开放统一认证服务，请返回原应用或联系管理员。'
      : reason === 'unavailable'
        ? '暂时无法连接认证服务，请稍后从原应用重试。'
        : (params.get('message') || '').slice(0, 240) ||
          '认证请求可能已经过期、内容不完整，或应用的接入配置已经变更。'
  return (
    <AuthCenterShell showProgress={false}>
      <div className="error-flow">
        <span
          className="error-symbol"
          aria-hidden
        >
          <CloseOutlined />
        </span>
        <p className="panel-kicker">{unavailable ? '服务不可用' : '认证未完成'}</p>
        <h2>{title}</h2>
        <p
          className="panel-lead"
          role="alert"
        >
          {message}
        </p>
        <div className="next-steps">
          <strong>你可以这样处理</strong>
          <ol>
            <li>
              {unavailable ? '返回刚才的应用，或关闭当前页面。' : '返回刚才的应用，重新发起登录。'}
            </li>
            <li>
              {unavailable
                ? '联系管理员确认服务状态。'
                : '如果仍然失败，把出现问题的时间和应用名称告诉管理员。'}
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
            返回上一页
          </Button>
        ) : (
          <p className="close-help">
            {unavailable
              ? '可以安全关闭此页面，返回原应用。'
              : '可以安全关闭此页面，再回到应用重新登录。'}
          </p>
        )}
      </div>
    </AuthCenterShell>
  )
}
