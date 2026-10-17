import { useId, useRef, useState } from 'react'
import { Empty, Input, Popover } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import SvgIcon from '@/components/SvgIcon'
import './style.css'

const files = import.meta.glob('../../assets/icons/svg/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})
const icons = Object.keys(files).map((path) => path.split('/').at(-1).replace('.svg', ''))

export default function IconSelect({
  value,
  onChange,
  placeholder = '点击选择图标',
  inline = false,
  disabled = false,
  ...props
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef(null)
  const panelId = useId()
  function changeOpen(next) {
    if (disabled) return
    setOpen(next)
    if (next) setSearch('')
  }
  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }
  const filtered = icons.filter((icon) => icon.includes(search))
  const content = (
    <div
      className="icon-select-body"
      id={panelId}
      onKeyDown={(event) => {
        if (!inline && event.key === 'Escape') {
          event.stopPropagation()
          close()
        }
      }}
    >
      <Input
        aria-label="搜索图标"
        placeholder="请输入图标名称"
        allowClear
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div
        className="icon-select-list"
        aria-label="图标列表"
      >
        {filtered.length ? (
          <div className="icon-select-grid">
            {filtered.map((icon) => (
              <div
                className="icon-select-item-wrapper"
                key={icon}
              >
                <button
                  type="button"
                  className={`icon-select-item${icon === value ? ' is-active' : ''}`}
                  aria-label={`选择图标 ${icon}`}
                  aria-pressed={icon === value}
                  title={icon}
                  disabled={disabled}
                  onClick={() => {
                    onChange?.(icon)
                    if (!inline) close()
                  }}
                >
                  <SvgIcon
                    iconClass={icon}
                    style={{ fontSize: 16 }}
                  />
                  <span>{icon}</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无匹配图标"
          />
        )}
      </div>
    </div>
  )
  if (inline) return content
  return (
    <Popover
      open={open}
      onOpenChange={changeOpen}
      trigger="click"
      placement="bottomLeft"
      arrow
      classNames={{ root: 'icon-select-popup' }}
      content={content}
    >
      <Input
        {...props}
        ref={triggerRef}
        readOnly
        disabled={disabled}
        value={value || ''}
        placeholder={placeholder}
        prefix={
          value ? (
            <SvgIcon
              iconClass={value}
              style={{ fontSize: 16 }}
            />
          ) : (
            <SearchOutlined />
          )
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onKeyDown={(event) => {
          if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
            event.preventDefault()
            changeOpen(true)
          }
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            close()
          }
          props.onKeyDown?.(event)
        }}
      />
    </Popover>
  )
}
