import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Button, Tooltip } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
export default function RuoYiDoc() {
  useI18n()

  return (
    <Tooltip title={t('common:documentation')}>
      <Button
        type="text"
        aria-label={t('common:documentation')}
        href="https://doc.ruoyi.vip/ruoyi-vue"
        target="_blank"
        rel="noopener noreferrer"
        icon={<QuestionCircleOutlined />}
      />
    </Tooltip>
  )
}
