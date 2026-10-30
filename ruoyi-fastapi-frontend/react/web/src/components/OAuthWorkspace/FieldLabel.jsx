import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import './style.css'
export default function FieldLabel({ label, help, children }) {
  useI18n()

  return (
    <span className="oauth-field-label">
      {label || children}
      {help && (
        <Tooltip
          title={help}
          trigger={['hover', 'focus', 'click']}
        >
          <span
            className="oauth-field-help"
            tabIndex={0}
            role="img"
            aria-label={t('common:valueDetailsValue', { arg0: label || t('common:field'), help })}
          >
            <QuestionCircleOutlined />
          </span>
        </Tooltip>
      )}
    </span>
  )
}
