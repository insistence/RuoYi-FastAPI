import './style.css'
import PluginTag from './PluginTag'
import { Space, Typography } from 'antd'
import { getPluginReleaseView } from '@/utils/pluginReleaseFormatter'
export const tagColors = {
  primary: 'processing',
  info: 'default',
  danger: 'error',
  success: 'success',
  warning: 'warning',
}
export default function PluginReleaseStatus({ plugin }) {
  const view = getPluginReleaseView(plugin)
  return (
    <Space
      className="plugin-release-status"
      orientation="vertical"
      size={4}
    >
      <PluginTag type={view.tagType}>{view.label}</PluginTag>
      <Typography.Text type="secondary">{view.workerSummary}</Typography.Text>
    </Space>
  )
}
