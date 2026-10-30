import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { Button, Col, Row } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { message } from '@/plugins/modal'

export function DetailCard({ title, icon, error = false, children }) {
  useI18n()

  return (
    <section className="detail-card">
      <div className={`detail-card-title${error ? ' error-title' : ''}`}>
        {icon} {title}
      </div>
      {children}
    </section>
  )
}
export function DetailFields({ items }) {
  useI18n()

  return (
    <Row className="detail-row">
      {items.filter(Boolean).map(({ label, value, full, mono }) => (
        <Col
          span={full ? 24 : 12}
          key={label}
        >
          <div className="detail-item">
            <span className="detail-label">{label}</span>
            <span className={`detail-value${mono ? ' mono' : ''}`}>{value ?? '-'}</span>
          </div>
        </Col>
      ))}
    </Row>
  )
}
export function DetailCode({ value, copyable = false }) {
  useI18n()

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      message.success(t('common:copied'))
    } catch {
      message.error(t('common:copyFailedPleaseCopyManually'))
    }
  }
  return (
    <div className="code-body">
      <div className="code-wrap">
        {copyable && (
          <div className="code-action">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={copy}
            >
              {t('common:copy')}
            </Button>
          </div>
        )}
        <pre className="code-pre">{value}</pre>
      </div>
    </div>
  )
}
export function DetailError({ children }) {
  useI18n()

  return (
    <div className="error-body">
      <div className="error-msg">{children}</div>
    </div>
  )
}
