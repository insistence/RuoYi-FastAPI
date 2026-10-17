import '@/assets/styles/components.css'
import { Button } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import useAppStore from '@/store/modules/app'
export default function Hamburger() {
  const { sidebarOpened, toggleSidebar } = useAppStore()
  return (
    <Button
      className="header-icon-button layout-hamburger"
      type="text"
      aria-label="切换侧边栏"
      aria-expanded={sidebarOpened}
      icon={sidebarOpened ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
      onClick={toggleSidebar}
    />
  )
}
