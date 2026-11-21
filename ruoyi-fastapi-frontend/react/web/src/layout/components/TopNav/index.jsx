import { resolveRouteTitle } from '@/i18n'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Menu } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import SvgIcon from '@/components/SvgIcon'
import { Link, useLocation } from 'react-router-dom'
import { menuItems } from '../Sidebar'
import { firstLeaf, routeLocation } from '@/utils/router'
export default function TopNav({ routes, mixed = false, activeRoot }) {
  useI18n()

  const { pathname } = useLocation()
  const items = mixed
    ? routes
        .filter((route) => !route.hidden)
        .map((route) => {
          const target = firstLeaf(route)
          return {
            key: route.path,
            icon: route.meta?.icon ? <SvgIcon iconClass={route.meta.icon} /> : undefined,
            label: /^https?:/.test(target.path) ? (
              <a
                href={target.path}
                target="_blank"
                rel="noreferrer"
              >
                {resolveRouteTitle(route)}
              </a>
            ) : (
              <Link to={routeLocation(target)}>{resolveRouteTitle(route) || route.name}</Link>
            ),
          }
        })
    : menuItems(routes)
  return (
    <Menu
      className="layout-top-nav"
      mode="horizontal"
      overflowedIndicator={
        <span>
          {t('layout:menu.more')} <DownOutlined />
        </span>
      }
      selectedKeys={[mixed ? activeRoot?.path : pathname]}
      items={[
        { key: '/index', label: <Link to="/index">{t('layout:route.home')}</Link> },
        ...items,
      ]}
    />
  )
}
