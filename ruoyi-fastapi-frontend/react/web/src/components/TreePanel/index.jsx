import { useMemo, useRef, useState } from 'react'
import { Button, Input, Tree, Tooltip } from 'antd'
import {
  ApartmentOutlined,
  DownOutlined,
  UpOutlined,
  ReloadOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  FolderOutlined,
  FileOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import './style.css'
export default function TreePanel({
  data = [],
  selectedKeys,
  onSelect,
  title = '组织机构',
  searchPlaceholder = '请输入部门名称',
  onRefresh,
  actions,
  defaultWidth = 220,
  minWidth = 180,
  maxWidth = 400,
  collapsedWidth = 20,
  storageKey = 'react-tree-sidebar-width',
}) {
  const [search, setSearch] = useState(''),
    [collapsed, setCollapsed] = useState(false),
    [resizing, setResizing] = useState(false)
  const [width, setWidth] = useState(() => {
    try {
      return Math.max(
        minWidth,
        Math.min(maxWidth, Number(localStorage.getItem(storageKey)) || defaultWidth)
      )
    } catch {
      return defaultWidth
    }
  })
  const [expanded, setExpanded] = useState(null),
    start = useRef()
  const allKeys = useMemo(() => {
    const keys = []
    const visit = (nodes) =>
      nodes.forEach((node) => {
        keys.push(node.id)
        visit(node.children || [])
      })
    visit(data)
    return keys
  }, [data])
  function filter(nodes) {
    return nodes.flatMap((node) => {
      if (String(node.label).includes(search)) return [node]
      const children = filter(node.children || [])
      return children.length ? [{ ...node, children }] : []
    })
  }
  function resize(value) {
    const next = Math.max(minWidth, Math.min(maxWidth, value))
    setWidth(next)
    try {
      localStorage.setItem(storageKey, String(next))
    } catch {}
  }
  return (
    <aside
      className={
        'tree-panel' + (collapsed ? ' is-collapsed' : '') + (resizing ? ' is-resizing' : '')
      }
      style={{
        '--tree-panel-width': width + 'px',
        '--tree-panel-collapsed-width': collapsedWidth + 'px',
      }}
    >
      <div
        className="tree-panel-header"
        inert={collapsed}
      >
        <span className="tree-panel-title">
          <ApartmentOutlined />
          {title}
        </span>
        <div className="tree-panel-actions">
          <Tooltip title={expanded?.length === 0 ? '展开全部' : '收起全部'}>
            <Button
              type="text"
              size="small"
              aria-label={expanded?.length === 0 ? '展开全部' : '收起全部'}
              icon={expanded?.length === 0 ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setExpanded(expanded?.length === 0 ? allKeys : [])}
            />
          </Tooltip>
          {onRefresh && (
            <Button
              type="text"
              size="small"
              aria-label="刷新部门"
              icon={<ReloadOutlined />}
              onClick={onRefresh}
            />
          )}
          {actions}
        </div>
      </div>
      <Button
        className="tree-panel-collapse"
        type="text"
        aria-label={collapsed ? '展开部门面板' : '收起部门面板'}
        aria-expanded={!collapsed}
        icon={collapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
        onClick={() => setCollapsed(!collapsed)}
      />
      <div
        className="tree-panel-search"
        inert={collapsed}
      >
        <Input
          type="search"
          prefix={<SearchOutlined />}
          aria-label="搜索部门"
          placeholder={searchPlaceholder}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div
        className="tree-panel-content"
        inert={collapsed}
      >
        <Tree
          treeData={filter(data)}
          fieldNames={{ key: 'id', title: 'label', children: 'children' }}
          expandedKeys={search ? allKeys : (expanded ?? allKeys)}
          onExpand={setExpanded}
          selectedKeys={selectedKeys}
          onSelect={onSelect}
          blockNode
          titleRender={(node) => (
            <span className="tree-panel-node">
              {node.children?.length ? <FolderOutlined /> : <FileOutlined />}
              <span title={node.label}>{node.label}</span>
            </span>
          )}
        />
      </div>
      {!collapsed && (
        <div
          className="tree-panel-resizer"
          role="separator"
          aria-label="调整部门面板宽度"
          aria-orientation="vertical"
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          aria-valuenow={width}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault()
              resize(width + (e.key === 'ArrowRight' ? 10 : -10))
            }
          }}
          onPointerDown={(e) => {
            start.current = { x: e.clientX, width }
            e.currentTarget.setPointerCapture(e.pointerId)
            setResizing(true)
          }}
          onPointerMove={(e) => {
            if (start.current) resize(start.current.width + e.clientX - start.current.x)
          }}
          onPointerUp={() => {
            start.current = null
            setResizing(false)
          }}
          onLostPointerCapture={() => {
            start.current = null
            setResizing(false)
          }}
        />
      )}
    </aside>
  )
}
