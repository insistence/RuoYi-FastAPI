import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import '@/assets/styles/components.css'
import { Button } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import useAppStore from '@/store/modules/app'
export default function Hamburger() {
  useI18n()

  const { sidebarOpened, toggleSidebar } = useAppStore()
  return (
    <Button
      className="header-icon-button layout-hamburger"
      type="text"
      aria-label={t('common:toggleSidebar')}
      aria-expanded={sidebarOpened}
      icon={sidebarOpened ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
      onClick={toggleSidebar}
    />
  )
}
