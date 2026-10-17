import { Avatar, Button, Dropdown, Layout as AntLayout } from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { confirm } from '@/plugins/modal'
import useTagsViewStore from '@/store/modules/tagsView'
import useLockStore from '@/store/modules/lock'
import useSettingsStore from '@/store/modules/settings'
import { changeTheme } from '@/utils/themeTransition'
import TopNav from './TopNav'
import Logo from './Sidebar/Logo'
import HeaderNotice from './HeaderNotice'
import Breadcrumb from '@/components/Breadcrumb'
import Hamburger from '@/components/Hamburger'
import HeaderSearch from '@/components/HeaderSearch'
import Screenfull from '@/components/Screenfull'
import SizeSelect from '@/components/SizeSelect'
import RuoYiGit from '@/components/RuoYi/Git'
import RuoYiDoc from '@/components/RuoYi/Doc'
export default function Navbar({
  showSidebar,
  settings,
  permission,
  activeRoot,
  user,
  onSettings,
}) {
  const location = useLocation(),
    navigate = useNavigate()
  return (
    <AntLayout.Header className={`layout-header${settings.dark ? ' is-dark' : ''}`}>
      {showSidebar && <Hamburger />}
      {settings.navType === 3 && settings.sidebarLogo && <Logo top />}
      {settings.navType === 1 ? (
        <Breadcrumb />
      ) : (
        <TopNav
          routes={permission.sidebarRouters}
          mixed={settings.navType === 2}
          activeRoot={activeRoot}
        />
      )}
      <div className="header-actions">
        <div className="header-secondary">
          <HeaderSearch />
          <RuoYiGit />
          <RuoYiDoc />
          <Screenfull />
          <Button
            aria-label={settings.dark ? '切换浅色主题' : '切换深色主题'}
            type="text"
            icon={settings.dark ? <SunOutlined /> : <MoonOutlined />}
            onClick={(event) =>
              changeTheme(event, settings.dark, useSettingsStore.getState().update)
            }
          />
          <SizeSelect />
          <HeaderNotice />
        </div>
        <Dropdown
          arrow
          trigger={['hover', 'click']}
          placement="bottomRight"
          align={{ offset: [-4, 8] }}
          classNames={{ root: 'header-user-menu' }}
          styles={{ root: { minWidth: 0, width: 'max-content' } }}
          menu={{
            items: [
              { key: 'profile', label: '个人中心' },
              ...(settings.showSettings ? [{ key: 'settings', label: '布局设置' }] : []),
              { key: 'lock', label: '锁定屏幕' },
              { type: 'divider' },
              { key: 'logout', label: '退出登录' },
            ],
            onClick: async ({ key }) => {
              if (key === 'profile') navigate('/user/profile')
              else if (key === 'settings') onSettings()
              else if (key === 'lock') {
                useLockStore.getState().lockScreen(location.pathname + location.search)
                navigate('/lock')
              } else {
                try {
                  await confirm('确定注销并退出系统吗？')
                  await user.logOut()
                  useTagsViewStore.getState().reset()
                  permission.reset()
                  navigate('/login')
                } catch {}
              }
            },
          }}
        >
          <Button
            type="text"
            className="header-avatar"
            aria-label="用户菜单"
          >
            <Avatar
              size={30}
              src={user.avatar}
            />
            <span className="header-user-name">{user.nickName || user.name}</span>
          </Button>
        </Dropdown>
      </div>
    </AntLayout.Header>
  )
}
