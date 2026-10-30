import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import '@/assets/styles/components.css'
import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Divider, Modal, Popover, Space, Tooltip, Transfer } from 'antd'
import { SearchOutlined, ReloadOutlined, MenuOutlined } from '@ant-design/icons'

const noColumns = {}
export default function RightToolbar({
  showSearch = true,
  onShowSearch,
  onQuery,
  search = true,
  columns = noColumns,
  onColumnsChange,
  showColumnsType = 'checkbox',
  gutter = 10,
  storageKey = '',
}) {
  useI18n()

  const [open, setOpen] = useState(false)
  const restoredKey = useRef()
  const entries = Object.entries(columns)
  const hidden = entries.filter(([, column]) => column.visible === false).map(([key]) => key)
  function change(hiddenKeys) {
    const next = Object.fromEntries(
      entries.map(([key, column]) => [key, { ...column, visible: !hiddenKeys.includes(key) }])
    )
    onColumnsChange?.(Array.isArray(columns) ? Object.values(next) : next)
    if (storageKey) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(
            Object.fromEntries(Object.entries(next).map(([key, col]) => [key, col.visible]))
          )
        )
      } catch {}
    }
  }
  useEffect(() => {
    if (!storageKey || restoredKey.current === storageKey || !entries.length) return
    restoredKey.current = storageKey
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey))
      if (saved && typeof saved === 'object') {
        const next = Object.fromEntries(
          entries.map(([key, column]) => [
            key,
            { ...column, visible: typeof saved[key] === 'boolean' ? saved[key] : column.visible },
          ])
        )
        onColumnsChange?.(Array.isArray(columns) ? Object.values(next) : next)
      }
    } catch {}
  }, [storageKey, columns, onColumnsChange, entries.length])
  const columnButton = (
    <Button
      aria-label={t('common:columnVisibility')}
      icon={<MenuOutlined />}
      onClick={showColumnsType === 'transfer' ? () => setOpen(true) : undefined}
    />
  )
  return (
    <>
      <Space
        className="right-toolbar"
        style={{ marginRight: gutter / 2 }}
      >
        {search && (
          <Tooltip title={showSearch ? t('common:hideSearch') : t('common:showSearch')}>
            <Button
              aria-label={t('common:toggleSearch')}
              icon={<SearchOutlined />}
              onClick={() => onShowSearch?.(!showSearch)}
            />
          </Tooltip>
        )}
        <Tooltip title={t('layout:tags.refresh')}>
          <Button
            aria-label={t('common:refreshList')}
            icon={<ReloadOutlined />}
            onClick={onQuery}
          />
        </Tooltip>
        {!!entries.length && (
          <Tooltip title={t('common:columnVisibility')}>
            {showColumnsType === 'transfer' ? (
              columnButton
            ) : (
              <Popover
                trigger="click"
                content={
                  <div className="column-choices">
                    <Checkbox
                      checked={!hidden.length}
                      indeterminate={hidden.length > 0 && hidden.length < entries.length}
                      onChange={(event) =>
                        change(event.target.checked ? [] : entries.map(([key]) => key))
                      }
                    >
                      {t('common:columns')}
                    </Checkbox>
                    <Divider style={{ margin: '8px 0' }} />
                    <Space orientation="vertical">
                      {entries.map(([key, column]) => (
                        <Checkbox
                          key={key}
                          checked={column.visible !== false}
                          onChange={(event) =>
                            change(
                              event.target.checked
                                ? hidden.filter((item) => item !== key)
                                : [...hidden, key]
                            )
                          }
                        >
                          {column.label}
                        </Checkbox>
                      ))}
                    </Space>
                  </div>
                }
              >
                {columnButton}
              </Popover>
            )}
          </Tooltip>
        )}
      </Space>
      <Modal
        width="50%"
        title={t('common:showHide')}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
      >
        <Transfer
          titles={[t('common:show'), t('common:hide')]}
          dataSource={entries.map(([key, column]) => ({ key, title: column.label }))}
          targetKeys={hidden}
          render={(item) => item.title}
          onChange={change}
        />
      </Modal>
    </>
  )
}
