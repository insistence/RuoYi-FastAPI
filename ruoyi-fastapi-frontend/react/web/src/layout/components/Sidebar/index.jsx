import { ConfigProvider, Menu } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import usePermissionStore from '@/store/modules/permission'
import useSettingsStore from '@/store/modules/settings'
import useAppStore from '@/store/modules/app'
import { routeLocation } from '@/utils/router'
import SvgIcon from '@/components/SvgIcon'
import SidebarScrollbar from './Scrollbar'
import { findMenuPath, resolveOpenKeys } from './menuState'
export function menuItems(routes) {
  return routes
    .filter((route) => !route.hidden)
    .map((route) => {
      const children = route.children?.filter((item) => !item.hidden)
      if (!route.alwaysShow && children?.length === 1) return menuItems(children)[0]
      return {
        key: route.path,
        icon: route.meta?.icon ? <SvgIcon iconClass={route.meta.icon} /> : undefined,
        label: children?.length ? (
          route.meta?.title
        ) : /^https?:/.test(route.path) ? (
          <a
            href={route.path}
            target="_blank"
            rel="noreferrer"
          >
            {route.meta?.title}
          </a>
        ) : (
          <Link to={routeLocation(route)}>{route.meta?.title || route.name}</Link>
        ),
        children: children?.length ? menuItems(children) : undefined,
      }
    })
}
export default function Sidebar({ routes: suppliedRoutes, activeMenu }) {
  const allRoutes = usePermissionStore((state) => state.sidebarRouters)
  const theme = useSettingsStore((state) => state.sideTheme)
  const colorPrimary = useSettingsStore((state) => state.colorPrimary)
  const dark = useSettingsStore((state) => state.dark)
  const collapsed = useAppStore((state) => !state.sidebarOpened)
  const routes = suppliedRoutes || allRoutes
  const { pathname } = useLocation()
  const selectedKey = activeMenu || pathname
  const items = useMemo(
    () => [
      ...(!suppliedRoutes
        ? [
            {
              key: '/index',
              icon: <SvgIcon iconClass="dashboard" />,
              label: <Link to="/index">首页</Link>,
            },
          ]
        : []),
      ...menuItems(routes),
    ],
    [routes, suppliedRoutes]
  )
  const [openKeys, setOpenKeys] = useState([])
  useEffect(() => {
    setOpenKeys(collapsed ? [] : findMenuPath(items, selectedKey).slice(0, -1))
  }, [selectedKey, items, collapsed])
  return (
    <SidebarScrollbar>
      <ConfigProvider
        theme={{
          components: {
            Menu: {
              itemHeight: 44,
              itemMarginInline: 0,
              itemMarginBlock: 0,
              itemBorderRadius: 0,
              subMenuItemBorderRadius: 0,
              collapsedWidth: 54,
              collapsedIconSize: 14,
              iconSize: 14,
              iconMarginInlineEnd: 10,
              darkItemBg: '#1a1f2e',
              darkSubMenuItemBg: '#141824',
              darkItemColor: '#bfcbd9',
              darkItemHoverBg: '#263445',
              darkItemSelectedBg: `${colorPrimary}33`,
              darkItemSelectedColor: colorPrimary,
              itemColor: dark ? '#cfd3dc' : '#303133',
              itemSelectedColor: colorPrimary,
              itemSelectedBg: `${colorPrimary}1a`,
            },
          },
        }}
      >
        <Menu
          className="layout-sidebar-menu"
          theme={theme}
          mode="inline"
          inlineIndent={20}
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={(next) => setOpenKeys((previous) => resolveOpenKeys(items, previous, next))}
          items={items}
        />
      </ConfigProvider>
    </SidebarScrollbar>
  )
}
