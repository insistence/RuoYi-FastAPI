import { useLocalizedError } from '@/i18n/error'
import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React, { useState } from 'react'
import { useDidShow } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import Button from '@/components/ActionButton'
import { getUserProfile } from '@/api/system/user'
import { useUserStore } from '@/store'
import { getToken } from '@/utils/auth'
import { formatBusinessTime } from '@/utils/time'
import { usePageAuth } from '@/permission'
export default function UserInfo() {
  usePageLocale()

  const allowed = usePageAuth()
  const [data, setData] = useState({ data: {} })
  const [error, setError] = useLocalizedError()
  const [loading, setLoading] = useState(false)
  async function load() {
    if (!getToken()) return
    setLoading(true)
    setError('')
    try {
      const [, result] = await Promise.all([useUserStore.getState().getInfo(), getUserProfile()])
      setData(result)
    } catch (failure) {
      setError(failure.message || (() => t('mobile:failedToLoadPersonalInformation')))
    } finally {
      setLoading(false)
    }
  }
  useDidShow(load)
  if (!allowed) return null
  const fields = [
    [t('mobile:nicknameMineInfo'), data.data.nickName, 'account', 'bg-blue-50 text-blue-500'],
    [t('mobile:mobileNumber'), data.data.phonenumber, 'phone', 'bg-green-50 text-green-500'],
    [t('mobile:emailMineInfoEdit'), data.data.email, 'email', 'bg-indigo-50 text-indigo-500'],
    [t('mobile:position'), data.postGroup, 'shield-account', 'bg-orange-50 text-orange-500'],
    [t('mobile:role'), data.roleGroup, 'badge-account', 'bg-purple-50 text-purple-500'],
    [
      t('mobile:createdOn'),
      formatBusinessTime(data.data.createTime),
      'calendar',
      'bg-pink-50 text-pink-500',
    ],
  ]
  return (
    <View className="list-page">
      <View className="overflow-hidden bg-white shadow-sm">
        {fields.map(([label, value, icon, color], index) => (
          <View
            className={`flex items-center justify-between gap-3 px-5 py-4 ${index < fields.length - 1 ? 'border-b border-gray-100' : ''}`}
            key={label}
          >
            <View className="flex items-center shrink-0">
              <View className={`flex size-9 items-center justify-center rounded-full ${color}`}>
                <View className={`i-mdi-${icon} text-xl`} />
              </View>
              <Text className="ml-3 text-base font-medium text-gray-800">{label}</Text>
            </View>
            <Text className="text-sm text-gray-500 text-right break-all">{value || '-'}</Text>
          </View>
        ))}
      </View>
      {error && (
        <>
          <Text className="mobile-error">{error}</Text>
          <Button
            onClick={load}
            loading={loading}
          >
            {t('common:retry')}
          </Button>
        </>
      )}
    </View>
  )
}
