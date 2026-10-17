import './style.css'
import { Button, Col, Row } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { message } from '@/plugins/modal'

export function DetailCard({ title, icon, error = false, children }) {
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
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      message.success('已复制')
    } catch {
      message.error('复制失败，请手动复制')
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
              复制
            </Button>
          </div>
        )}
        <pre className="code-pre">{value}</pre>
      </div>
    </div>
  )
}
export function DetailError({ children }) {
  return (
    <div className="error-body">
      <div className="error-msg">{children}</div>
    </div>
  )
}
