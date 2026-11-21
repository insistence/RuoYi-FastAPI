import { resolveRouteTitle } from '@/i18n'
import { findRoute } from '@/router'
import usePermissionStore from '@/store/modules/permission'
import { checkPermi } from '@/utils/permission'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dropdown } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  DownOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  ColumnWidthOutlined,
} from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useTagsViewStore from '@/store/modules/tagsView'
import useSettingsStore from '@/store/modules/settings'
import SvgIcon from '@/components/SvgIcon'

export default function TagsView() {
  const { locale } = useI18n()
  const permission = usePermissionStore()

  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tags = useTagsViewStore()
  const settings = useSettingsStore()
  const scrollRef = useRef(null)
  const [arrows, setArrows] = useState({ left: false, right: false })
  const [fullscreen, setFullscreen] = useState(false)
  const tagTitle = (item) =>
    item.customTitle ?? (resolveRouteTitle(findRoute(item.key, permission.routes)) || item.key)
  useEffect(() => {
    if (permission.ready)
      tags.reconcileViews((key) => {
        const route = findRoute(key, permission.routes)
        return route && (!route.permissions || checkPermi(route.permissions))
      })
  }, [permission.ready, permission.routes])
  const current = tags.visitedViews.find((tag) => tag.key === pathname)
  const measure = useCallback(() => {
    const el = scrollRef.current
    if (el)
      setArrows({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      })
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    const active = el?.querySelector('[aria-current="page"]')?.parentElement
    if (active) {
      const left = active.offsetLeft
      if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left - 6)
      else if (left + active.offsetWidth > el.scrollLeft + el.clientWidth)
        el.scrollLeft = left + active.offsetWidth - el.clientWidth + 15
    }
    measure()
  }, [pathname, tags.visitedViews, settings.tagsViewStyle, settings.tagsIcon, measure, locale])

  useEffect(() => {
    const el = scrollRef.current
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    const wheel = (event) => {
      if (el.scrollWidth <= el.clientWidth) return
      event.preventDefault()
      el.scrollLeft += event.deltaX || event.deltaY
    }
    const onFullscreen = () => setFullscreen(!!document.fullscreenElement)
    el.addEventListener('wheel', wheel, { passive: false })
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      observer.disconnect()
      el.removeEventListener('wheel', wheel)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [measure])

  function close(key) {
    tags.closeView(key)
    if (pathname === key)
      navigate(useTagsViewStore.getState().visitedViews.at(-1)?.fullPath || '/index')
  }
  function action(key, item = current) {
    if (key === 'fullscreen') {
      const result = document.fullscreenElement
        ? document.exitFullscreen?.()
        : document.querySelector('.app-main')?.requestFullscreen?.()
      result?.catch(() => {})
      return
    }
    if (!item) return
    if (key === 'refresh') {
      tags.refresh(item.key)
      navigate(item.fullPath)
    } else if (key === 'current') close(item.key)
    else {
      tags.closeViews(item.key, key)
      const remaining = useTagsViewStore.getState().visitedViews
      if (key === 'others') navigate(item.fullPath)
      else if (!remaining.some((tag) => tag.key === pathname))
        navigate(remaining.at(-1)?.fullPath || '/index')
    }
  }
  function menu(item, context = false) {
    const index = tags.visitedViews.indexOf(item)
    const left = tags.visitedViews.slice(0, index).some((tag) => tag.closable)
    const right = tags.visitedViews.slice(index + 1).some((tag) => tag.closable)
    return {
      items: [
        ...(context
          ? [{ key: 'refresh', icon: <ReloadOutlined />, label: t('layout:tags.refreshPage') }]
          : []),
        ...(item?.closable
          ? [{ key: 'current', icon: <CloseOutlined />, label: t('layout:tags.close') }]
          : []),
        {
          key: 'others',
          icon: <ColumnWidthOutlined />,
          label: t('layout:tags.closeOthers'),
          disabled: !item,
        },
        ...(!context || left
          ? [
              {
                key: 'left',
                icon: <LeftOutlined />,
                label: t('layout:tags.closeLeft'),
                disabled: !left,
              },
            ]
          : []),
        ...(!context || right
          ? [
              {
                key: 'right',
                icon: <RightOutlined />,
                label: t('layout:tags.closeRight'),
                disabled: !right,
              },
            ]
          : []),
        { key: 'all', icon: <CloseCircleOutlined />, label: t('layout:tags.closeAll') },
        ...(!context
          ? [
              { type: 'divider' },
              {
                key: 'fullscreen',
                icon: fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />,
                label: fullscreen ? t('common:exitFullScreen') : t('layout:tags.fullscreen'),
              },
            ]
          : []),
      ],
      onClick: ({ key }) => action(key, item),
    }
  }
  function scroll(end) {
    scrollRef.current?.scrollTo({
      left: end ? scrollRef.current.scrollWidth : 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }
  return (
    <nav
      aria-label={t('layout:pageTabs')}
      className={`layout-tags tags-${settings.tagsViewStyle}`}
    >
      <button
        className="tags-nav-btn tags-nav-left"
        aria-label={t('layout:scrollToTheStart')}
        disabled={!arrows.left}
        onClick={() => scroll(false)}
      >
        <LeftOutlined />
      </button>
      <div
        className="tags-scroll"
        ref={scrollRef}
        onScroll={measure}
      >
        {tags.visitedViews.map((item) => (
          <Dropdown
            key={item.key}
            trigger={['contextMenu']}
            menu={menu(item, true)}
          >
            <div
              className={`tags-item${item.key === pathname ? ' active' : ''}${settings.tagsIcon && item.icon ? ' has-icon' : ''}`}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  if (item.closable) close(item.key)
                }
              }}
            >
              <Link
                to={item.fullPath}
                aria-current={item.key === pathname ? 'page' : undefined}
              >
                {settings.tagsIcon && item.icon && <SvgIcon iconClass={item.icon} />}
                {tagTitle(item)}
              </Link>
              {item.closable && (
                <button
                  className="tags-close"
                  aria-label={t('layout:closeValue', { label: tagTitle(item) })}
                  onClick={() => close(item.key)}
                >
                  <CloseOutlined />
                </button>
              )}
            </div>
          </Dropdown>
        ))}
      </div>
      <button
        className="tags-nav-btn tags-nav-right"
        aria-label={t('layout:scrollToTheEnd')}
        disabled={!arrows.right}
        onClick={() => scroll(true)}
      >
        <RightOutlined />
      </button>
      <Dropdown
        trigger={['click']}
        menu={menu(current)}
        placement="bottomRight"
      >
        <button
          className="tags-nav-btn tags-actions"
          aria-label={t('layout:tabActions')}
        >
          <DownOutlined />
        </button>
      </Dropdown>
      <button
        className="tags-nav-btn tags-refresh"
        disabled={!current}
        onClick={() => action('refresh')}
      >
        <ReloadOutlined />
        {t('layout:tags.refresh')}
      </button>
    </nav>
  )
}
