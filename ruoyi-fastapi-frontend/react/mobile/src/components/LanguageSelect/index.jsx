import { Picker, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
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
      Taro.showToast({ title: t('common:languageFailed'), icon: 'none' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Picker
      range={options}
      rangeKey="label"
      value={index}
      disabled={busy}
      onChange={(event) => choose(options[Number(event.detail.value)].value)}
    >
      <View style={{ padding: 12 }}>
        {t('common:language')}:{' '}
        {options.find((item) => item.value === preference)?.label || preference}
      </View>
    </Picker>
  )
}
