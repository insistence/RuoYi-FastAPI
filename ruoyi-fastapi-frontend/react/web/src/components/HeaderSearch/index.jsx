import { resolveRouteTitle } from '@/i18n'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useRef, useState } from 'react'
import { Button, Empty, Input, Modal } from 'antd'
import { SearchOutlined, EnterOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import usePermissionStore from '@/store/modules/permission'
import { routeLocation } from '@/utils/router'
import SvgIcon from '@/components/SvgIcon'
import './style.css'

export default function HeaderSearch() {
  useI18n()

  const routes = usePermissionStore((state) => state.routes),
    navigate = useNavigate()
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [active, setActive] = useState(0)
  const input = useRef(null),
    results = useRef(null)
  const options = routes
    .filter(
      (route) =>
        resolveRouteTitle(route) &&
        !route.children?.length &&
        !route.hidden &&
        !/^https?:/.test(route.path)
    )
    .map((route) => ({
      path: routeLocation(route),
      title: resolveRouteTitle(route),
      icon: route.meta.icon,
      label: [
        ...routes
          .filter((parent) => resolveRouteTitle(parent) && route.path.startsWith(parent.path + '/'))
          .map((parent) => resolveRouteTitle(parent)),
        resolveRouteTitle(route),
      ].join(' / '),
    }))
    .filter(
      (item) =>
        !query.trim() ||
        (item.label + ' ' + item.path).toLowerCase().includes(query.trim().toLowerCase())
    )
  const selected = Math.min(active, Math.max(0, options.length - 1))
  useEffect(() => {
    results.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected, query])
  function choose(item) {
    if (!item) return
    setOpen(false)
    navigate(item.path)
  }
  return (
    <>
      <Button
        type="text"
        className="header-search"
        icon={<SearchOutlined />}
        aria-label={t('layout:searchMenus')}
        onClick={() => {
          setQuery('')
          setActive(0)
          setOpen(true)
        }}
      />
      <Modal
        title={t('layout:searchMenus')}
        open={open}
        footer={null}
        onCancel={() => setOpen(false)}
        className="header-search-dialog"
        width={600}
        afterOpenChange={(visible) => visible && input.current?.focus()}
      >
        <Input
          ref={input}
          prefix={<SearchOutlined />}
          allowClear
          size="large"
          placeholder={t('layout:searchByMenuNameOrPath')}
          aria-label={t('layout:menuNameOrPath')}
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls="menu-search-results"
          aria-activedescendant={options.length ? 'menu-search-' + selected : undefined}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setActive(
                (selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
                  Math.max(1, options.length)
              )
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              choose(options[selected])
            }
          }}
        />
        <div className="result-count">
          {t('layout:found')} <strong>{options.length}</strong> {t('layout:menus')}
        </div>
        <div
          ref={results}
          className="result-wrap"
          id="menu-search-results"
          role="listbox"
          aria-label={t('layout:menuSearchResults')}
        >
          {options.length ? (
            options.map((item, index) => (
              <button
                id={'menu-search-' + index}
                key={item.path}
                type="button"
                role="option"
                aria-selected={index === selected}
                className={'search-item' + (index === selected ? ' is-active' : '')}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
              >
                <span className="search-menu-icon">
                  <SvgIcon iconClass={item.icon || 'component'} />
                </span>
                <span className="search-info">
                  <span className="menu-title">{item.label}</span>
                  <span className="menu-path">{item.path}</span>
                </span>
                <EnterOutlined />
              </button>
            ))
          ) : (
            <Empty
              className="search-empty"
              description={
                query ? t('layout:noMatchingMenusTryAnotherKeyword') : t('layout:noAvailableMenus')
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t('layout:search.navigate')}
          </span>
          <span>
            <kbd>Enter</kbd> {t('layout:search.select')}
          </span>
          <span>
            <kbd>Esc</kbd> {t('layout:search.close')}
          </span>
        </div>
      </Modal>
    </>
  )
}
