import { Select, message } from 'antd'
import { useState } from 'react'
import { useI18n } from '@/i18n/adapter'
import { saveLocale } from '@/i18n/preference'

export default function LanguageSelect() {
  const { t, i18n, preference } = useI18n()
  const [busy, setBusy] = useState(false)
  const options = [
    { value: 'auto', label: t('common:followDevice') },
    ...i18n.registry.entries.map((item) => ({ value: item.code, label: item.nativeName })),
  ]
  const index = Math.max(
    0,
    options.findIndex((item) => item.value === preference)
  )
  async function choose(value) {
    if (busy) return
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
    <Select
      aria-label={t('common:language')}
      value={preference}
      options={options}
      disabled={busy}
      onChange={choose}
      style={{ minWidth: 150 }}
    />
  )
}
