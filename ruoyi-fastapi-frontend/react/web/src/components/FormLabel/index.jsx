import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Tooltip } from 'antd'
import { QuestionCircleFilled } from '@ant-design/icons'
import './style.css'

export default function FormLabel({ label, help }) {
  useI18n()

  return (
    <span className="ruoyi-form-label">
      {help && (
        <Tooltip
          title={help}
          trigger={['hover', 'focus', 'click']}
        >
          <button
            type="button"
            className="ruoyi-form-label-help"
            aria-label={t('common:aboutValue', { label })}
            onClick={(event) => event.preventDefault()}
          >
            <QuestionCircleFilled />
          </button>
        </Tooltip>
      )}
      {label}
    </span>
  )
}
