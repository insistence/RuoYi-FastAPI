import { resolveRouteTitle } from '@/i18n'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useState } from 'react'
import { Alert, Button, Layout as AntLayout, Result } from 'antd'
import { Link, Navigate, useLocation } from 'react-router-dom'
import useUserStore from '@/store/modules/user'
import usePermissionStore from '@/store/modules/permission'
import useSettingsStore from '@/store/modules/settings'
import useAppStore from '@/store/modules/app'
import { getToken } from '@/utils/auth'
import { findRoute } from '@/router'
import useTagsViewStore from '@/store/modules/tagsView'
import { routeLocation, firstLeaf } from '@/utils/router'
import AppMain from './components/AppMain'
import Sidebar from './components/Sidebar'
import TagsView from './components/TagsView'
import Settings from './components/Settings'
import Navbar from './components/Navbar'
import Copyright from './components/Copyright'
import useLockStore from '@/store/modules/lock'
import Redirect from '@/views/redirect'
import Logo from './components/Sidebar/Logo'
import SystemLoading, { PageReady } from '@/components/SystemLoading'

export default function Layout() {
  useI18n()

  const locked = useLockStore((state) => state.isLock)
  const user = useUserStore(),
    permission = usePermissionStore(),
    settings = useSettingsStore(),
    app = useAppStore()
  const [error, setError] = useState(''),
    [settingsOpen, setSettingsOpen] = useState(false)
  const location = useLocation()
  const route = findRoute(location.pathname, permission.routes)
  const title = resolveRouteTitle(route)
  const activeRoot = permission.sidebarRouters.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  )
  const showSidebar =
    settings.navType !== 3 && (settings.navType !== 2 || activeRoot?.children?.length)
  const sidebarRoutes = settings.navType === 2 ? activeRoot?.children : undefined
  useEffect(() => {
    if (route && title)
      useTagsViewStore.getState().addView({
        key: location.pathname,
        fullPath: location.pathname + location.search + location.hash,
        closable: !route.meta?.affix,
        icon: route.meta?.icon,
      })
  }, [location.pathname, location.search, location.hash, route, title])
  useEffect(() => {
    document.title =
      settings.dynamicTitle && title
        ? `${title} - ${import.meta.env.VITE_APP_TITLE}`
        : import.meta.env.VITE_APP_TITLE
  }, [title, settings.dynamicTitle])
  useEffect(() => {
    let active = true
    if (getToken())
      user
        .getInfo()
        .then(() => permission.generateRoutes())
        .catch((error) => {
          if (active) setError(error.message)
        })
    return () => {
      active = false
    }
  }, [])
  if (!getToken())
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search + location.hash)}`}
        replace
      />
    )
  if (locked)
    return (
      <Navigate
        to="/lock"
        replace
      />
    )
  if (location.pathname === '/')
    return (
      <Navigate
        to="/index"
        replace
      />
    )
  if (error)
    return (
      <PageReady>
        <Result
          status="error"
          title={t('layout:failedToLoadUserInformation')}
          subTitle={error}
          extra={<Button onClick={() => window.location.reload()}>{t('common:reload')}</Button>}
        />
      </PageReady>
    )
  if (!user.loaded || !permission.ready) return <SystemLoading />
  if (location.pathname.startsWith('/redirect/')) return <Redirect />
  const directory = permission.routes.find(
    (item) => item.path === location.pathname && item.children?.length
  )
  if (directory) {
    const target = firstLeaf(directory)
    if (target?.path !== location.pathname)
      return (
        <Navigate
          replace
          to={routeLocation(target)}
        />
      )
  }
  return (
    <AntLayout
      className={`app-layout${settings.tagsView ? ' has-tags-view' : ''}${settings.fixedHeader ? ' has-fixed-header' : ''}`}
    >
      {showSidebar && app.sidebarOpened && (
        <button
          className="layout-sidebar-mask"
          aria-label={t('layout:closeSidebarNavigation')}
          onClick={app.toggleSidebar}
        />
      )}
      {showSidebar && (
        <AntLayout.Sider
          theme={settings.sideTheme}
          width={200}
          collapsedWidth={54}
          collapsed={!app.sidebarOpened}
          breakpoint="lg"
          onBreakpoint={(broken) => {
            if (broken && useAppStore.getState().sidebarOpened) app.toggleSidebar()
          }}
        >
          {settings.sidebarLogo && <Logo collapsed={!app.sidebarOpened} />}
          <Sidebar
            routes={sidebarRoutes}
            activeMenu={route?.meta?.activeMenu}
          />
        </AntLayout.Sider>
      )}
      <AntLayout style={{ minWidth: 0 }}>
        <div className={settings.fixedHeader ? 'layout-fixed-header' : undefined}>
          <Navbar
            showSidebar={showSidebar}
            settings={settings}
            permission={permission}
            activeRoot={activeRoot}
            user={user}
            onSettings={() => setSettingsOpen(true)}
          />
          {settings.tagsView && <TagsView />}
        </div>
        <AntLayout.Content
          className={`layout-content${/^\/tool\/gen(?:$|-edit\/)/.test(location.pathname) || location.pathname === '/system/user' ? ' layout-content-flush' : ''}`}
        >
          {user.passwordWarning && (
            <Alert
              closable
              type="warning"
              title={
                user.passwordWarning === 'initial-password'
                  ? t('auth:password.defaultWarning')
                  : user.passwordWarning === 'expired-password'
                    ? t('auth:password.expiredWarning')
                    : user.passwordWarning
              }
              action={<Link to="/user/profile/resetPwd">{t('layout:changePassword')}</Link>}
              style={{ marginBottom: 16 }}
            />
          )}
          <AppMain />
          <Copyright />
        </AntLayout.Content>
      </AntLayout>
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </AntLayout>
  )
}
