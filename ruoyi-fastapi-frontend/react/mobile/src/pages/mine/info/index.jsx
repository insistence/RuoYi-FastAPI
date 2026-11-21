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
import { formatDisplayTime } from '@/utils/time'
import { usePageAuth } from '@/permission'
export default function UserInfo() {
  const locale = usePageLocale()

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
      setError(failure.message || (() => t('mobile:profile.loadFailed')))
    } finally {
      setLoading(false)
    }
  }
  useDidShow(load)
  if (!allowed) return null
  const fields = [
    [t('mobile:profile.shortNickname'), data.data.nickName, 'account', 'bg-blue-50 text-blue-500'],
    [t('mobile:profile.phone'), data.data.phonenumber, 'phone', 'bg-green-50 text-green-500'],
    [t('mobile:profile.email'), data.data.email, 'email', 'bg-indigo-50 text-indigo-500'],
    [t('mobile:profile.post'), data.postGroup, 'shield-account', 'bg-orange-50 text-orange-500'],
    [t('mobile:profile.role'), data.roleGroup, 'badge-account', 'bg-purple-50 text-purple-500'],
    [
      t('mobile:profile.createdAt'),
      formatDisplayTime(data.data.createTime, locale),
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
