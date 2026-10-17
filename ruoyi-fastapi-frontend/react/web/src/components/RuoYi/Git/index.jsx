import { Button, Tooltip } from 'antd'
import { GithubOutlined } from '@ant-design/icons'
export default function RuoYiGit() {
  return (
    <Tooltip title="项目源码">
      <Button
        type="text"
        aria-label="项目源码"
        href="https://gitee.com/insistence2022/RuoYi-FastAPI"
        target="_blank"
        rel="noopener noreferrer"
        icon={<GithubOutlined />}
      />
    </Tooltip>
  )
}
