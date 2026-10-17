import { useEffect, useRef, useState } from 'react'
import { Button, Empty, Input, Modal } from 'antd'
import { SearchOutlined, EnterOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import usePermissionStore from '@/store/modules/permission'
import { routeLocation } from '@/utils/router'
import SvgIcon from '@/components/SvgIcon'
import './style.css'

export default function HeaderSearch() {
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
        route.meta?.title &&
        !route.children?.length &&
        !route.hidden &&
        !/^https?:/.test(route.path)
    )
    .map((route) => ({
      path: routeLocation(route),
      title: route.meta.title,
      icon: route.meta.icon,
      label: [
        ...routes
          .filter((parent) => parent.meta?.title && route.path.startsWith(parent.path + '/'))
          .map((parent) => parent.meta.title),
        route.meta.title,
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
        aria-label="搜索菜单"
        onClick={() => {
          setQuery('')
          setActive(0)
          setOpen(true)
        }}
      />
      <Modal
        title="搜索菜单"
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
          placeholder="搜索菜单名称或路径"
          aria-label="菜单名称或路径"
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
          找到 <strong>{options.length}</strong> 个菜单
        </div>
        <div
          ref={results}
          className="result-wrap"
          id="menu-search-results"
          role="listbox"
          aria-label="菜单搜索结果"
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
              description={query ? '没有找到匹配菜单，请尝试其他关键词' : '暂无可用菜单'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 切换
          </span>
          <span>
            <kbd>Enter</kbd> 选择
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
        </div>
      </Modal>
    </>
  )
}
