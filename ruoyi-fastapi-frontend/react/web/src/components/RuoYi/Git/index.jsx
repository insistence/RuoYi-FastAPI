import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Button, Tooltip } from 'antd'
import { GithubOutlined } from '@ant-design/icons'
export default function RuoYiGit() {
  useI18n()

  return (
    <Tooltip title={t('common:sourceCode')}>
      <Button
        type="text"
        aria-label={t('common:sourceCode')}
        href="https://gitee.com/insistence2022/RuoYi-FastAPI"
        target="_blank"
        rel="noopener noreferrer"
        icon={<GithubOutlined />}
      />
    </Tooltip>
  )
}
