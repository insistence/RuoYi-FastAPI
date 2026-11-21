import { Picker, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import Button from '@/components/ActionButton'
import { useI18n } from '@/i18n/adapter'
import { saveLocale } from '@/i18n/preference'

export default function LanguageSelect({ settings = false }) {
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
      Taro.showToast({
        title: t('common:languageFailed'),
        icon: 'none',
      })
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
      <Button
        className={
          settings
            ? 'flex w-full items-center justify-between gap-3 rounded-none border-b border-gray-100 bg-white px-5 py-4 leading-normal'
            : 'flex h-11 items-center justify-center gap-1 rounded-full bg-transparent px-2 text-gray-600'
        }
        aria-label={`${t('common:language')} · ${options[index].label}`}
        disabled={busy}
      >
        <View className="flex items-center">
          <View
            className="i-mdi-translate text-xl text-gray-600"
            aria-hidden="true"
          />
          {settings && <Text className="ml-3 text-base text-gray-800">{t('common:language')}</Text>}
        </View>
        <View className="flex items-center gap-1">
          {settings && <Text className="text-sm text-gray-500">{options[index].label}</Text>}
          <View
            className={
              settings
                ? 'i-mdi-chevron-right text-base text-gray-400'
                : 'i-mdi-chevron-down text-sm'
            }
            aria-hidden="true"
          />
        </View>
      </Button>
    </Picker>
  )
}
