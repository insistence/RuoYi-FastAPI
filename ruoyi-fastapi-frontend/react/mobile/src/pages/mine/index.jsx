import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { useUserStore } from '@/store'
import { getToken } from '@/utils/auth'
import { usePageAuth } from '@/permission'
import { toast } from '@/utils/common'
export default function Mine() {
  usePageLocale()

  const allowed = usePageAuth()
  const name = useUserStore((state) => state.name)
  const avatar = useUserStore((state) => state.avatar)
  useDidShow(() => {
    if (getToken())
      useUserStore
        .getState()
        .getInfo()
        .catch(() => {})
  })
  const go = (url) => Taro.navigateTo({ url })
  if (!allowed) return null
  return (
    <View className="min-h-screen bg-gray-50">
      <View className="relative overflow-hidden bg-linear-to-r from-blue-500 to-indigo-600 px-6 pt-16 pb-20 text-white shadow-lg">
        <View className="absolute -right-10 -top-10 size-64 rounded-full bg-white/10 blur-3xl" />
        <View className="absolute -bottom-10 -left-10 size-40 rounded-full bg-white/10 blur-2xl" />
        <View className="relative z-10 flex items-center gap-4">
          <View className="shrink-0 overflow-hidden rounded-full border-4 border-white/30 bg-white/20 shadow-xl">
            <Image
              className="block size-20"
              mode="aspectFill"
              src={avatar}
              onClick={() => go('/pages/mine/avatar/index')}
            />
          </View>
          <View onClick={() => go('/pages/mine/info/index')}>
            <Text className="block text-xl font-bold">{name}</Text>
            <View className="flex items-center mt-1 text-sm text-blue-100">
              <Text>{t('mobile:viewProfile')}</Text>
              <View className="i-mdi-chevron-right ml-1 text-xs" />
            </View>
          </View>
        </View>
      </View>
      <View className="relative z-20 -mt-12 px-4 pb-8">
        <View className="mb-4 rounded-2xl bg-white p-4 shadow-lg grid grid-cols-4 gap-2">
          {[
            ['account-group', t('mobile:communityChat'), 'bg-pink-50 text-pink-500'],
            ['face-agent', t('mobile:onlineSupport'), 'bg-blue-50 text-blue-500'],
            ['forum', t('mobile:feedbackCommunity'), 'bg-purple-50 text-purple-500'],
            ['thumb-up', t('mobile:likeUs'), 'bg-green-50 text-green-500'],
          ].map(([icon, label, color]) => (
            <View
              key={label}
              className="flex flex-col items-center gap-2"
              onClick={() => toast(t('mobile:thisFeatureIsUnderDevelopment'))}
            >
              <View className={`size-12 rounded-full flex items-center justify-center ${color}`}>
                <View className={`i-mdi-${icon} text-2xl`} />
              </View>
              <Text className="text-xs font-medium text-gray-600">{label}</Text>
            </View>
          ))}
        </View>
        <View className="overflow-hidden rounded-2xl bg-white shadow-lg">
          {[
            ['account-edit', t('mobile:editProfile'), 'info/edit', 'text-blue-500'],
            ['help-circle', t('mobile:frequentlyAskedQuestions'), 'help/index', 'text-orange-500'],
            ['heart-outline', t('mobile:aboutUs'), 'about/index', 'text-red-500'],
            ['cog-outline', t('mobile:appSettings'), 'setting/index', 'text-gray-500'],
          ].map(([icon, label, path, color], index) => (
            <View
              key={path}
              className={`flex items-center justify-between p-4 ${index < 3 ? 'border-b border-gray-100' : ''}`}
              onClick={() => go(`/pages/mine/${path}`)}
            >
              <View className="flex items-center gap-3">
                <View className={`i-mdi-${icon} ${color} text-xl`} />
                <Text className="text-base text-gray-700">{label}</Text>
              </View>
              <View className="i-mdi-chevron-right text-gray-400" />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
