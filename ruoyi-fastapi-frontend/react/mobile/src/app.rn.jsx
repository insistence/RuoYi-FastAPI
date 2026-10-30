import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { I18nextProvider } from 'react-i18next'
import { i18n, refreshDeviceLocale } from '@/i18n'
import { getToken } from '@/utils/auth'
import React, { useEffect, useState } from 'react'
import { View, Text, Button } from 'react-native'
import { useDidShow } from '@tarojs/taro'
import { hydrateStorage } from '@/utils/platformStorage'
import { refreshDeviceTimezone } from '@/utils/time'
import { useConfigStore, useUserStore } from '@/store'
import config from './config'
export default function App({ children }) {
  useI18n()

  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const start = async () => {
    try {
      setError(false)
      await hydrateStorage()
      i18n.initialize(Boolean(getToken()))
      useConfigStore.getState().setConfig(config)
      useUserStore.getState().restoreStorage()
      setReady(true)
    } catch {
      setError(true)
    }
  }
  useEffect(() => {
    start()
  }, [])
  useDidShow(() => {
    refreshDeviceTimezone()
    refreshDeviceLocale()
  })
  if (error)
    return (
      <View style={{ padding: 24 }}>
        <Text>{t('mobile:unableToReadLocalAccountInformationPleaseTryAgain')}</Text>
        <Button
          title={t('common:retry')}
          onPress={start}
        />
      </View>
    )
  return ready ? <I18nextProvider i18n={i18n.engine}>{children}</I18nextProvider> : null
}
