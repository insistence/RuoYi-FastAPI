import { GlobalOutlined } from '@ant-design/icons'
import { Button, Dropdown, message } from 'antd'
import { useState } from 'react'
import { useI18n } from '@/i18n/adapter'
import { saveLocale } from '@/i18n/preference'

export default function LanguageSelect() {
  const { t, i18n, preference } = useI18n()
  const [busy, setBusy] = useState(false)
  const items = [
    { key: 'auto', label: t('common:followDevice') },
    ...i18n.registry.entries.map((item) => ({ key: item.code, label: item.nativeName })),
  ]

  async function handleLanguageChange(value) {
    if (busy || (i18n.accountId !== null && value === preference)) return
    setBusy(true)
    try {
      await saveLocale(value)
    } catch {
      message.error(t('common:languageFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      disabled={busy}
      menu={{
        items,
        selectable: true,
        selectedKeys: [preference],
        onClick: ({ key }) => handleLanguageChange(key),
      }}
    >
      <Button
        type="text"
        aria-haspopup="menu"
        aria-label={t('common:language')}
        title={t('common:language')}
        icon={<GlobalOutlined />}
        disabled={busy}
      />
    </Dropdown>
  )
}
