import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React, { useState } from 'react'
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components'
import { usePageAuth } from '@/permission'
import { toast } from '@/utils/common'
import banner1 from '@/assets/images/banner/banner01.jpg'
import banner2 from '@/assets/images/banner/banner02.jpg'
import banner3 from '@/assets/images/banner/banner03.jpg'
const banners = [banner1, banner2, banner3]
export default function Work() {
  usePageLocale()
  const modules = [
    ['account', t('mobile:users'), 'bg-blue-50 text-blue-500'],
    ['badge-account', t('mobile:roles'), 'bg-orange-50 text-orange-500'],
    ['office-building', t('mobile:departments'), 'bg-green-50 text-green-500'],
    ['cog', t('mobile:configuration'), 'bg-red-50 text-red-500'],
    ['book-open-page-variant', t('mobile:dictionaries'), 'bg-cyan-50 text-cyan-500'],
    ['bullhorn', t('mobile:announcements'), 'bg-yellow-50 text-yellow-500'],
    ['file-document-outline', t('mobile:logs'), 'bg-pink-50 text-pink-500'],
    ['dots-horizontal', t('mobile:more'), 'bg-gray-50 text-gray-500'],
  ]

  const allowed = usePageAuth()
  const [current, setCurrent] = useState(0)
  if (!allowed) return null
  const building = () => toast(t('mobile:thisFeatureIsUnderDevelopment'))
  return (
    <View className="mobile-page bg-gray-50">
      <View className="relative overflow-hidden rounded-2xl mb-6 shadow-lg">
        <Swiper
          className="h-40 w-full"
          autoplay
          interval={3000}
          circular
          current={current}
          onChange={(event) => setCurrent(event.detail.current)}
        >
          {banners.map((src) => (
            <SwiperItem key={src}>
              <Image
                src={src}
                mode="scaleToFill"
                className="block h-full w-full"
              />
            </SwiperItem>
          ))}
        </Swiper>
        <View className="absolute z-10 bottom-3 left-0 right-0 flex justify-center gap-2">
          {banners.map((_, index) => (
            <View
              key={index}
              className={`h-1.5 rounded-full ${current === index ? 'bg-white w-4' : 'bg-white/50 w-1.5'}`}
            />
          ))}
        </View>
      </View>
      <View className="mb-4 flex items-center gap-2">
        <View className="h-4 w-1 rounded-full bg-indigo-500" />
        <Text className="text-base font-bold text-gray-800">{t('mobile:aiProductivity')}</Text>
      </View>
      <View className="grid grid-cols-2 gap-4 mb-6">
        {[
          ['chat', t('mobile:chat'), t('mobile:assistant'), 'bg-indigo-500', 'bg-indigo-50'],
          [
            'image-multiple',
            t('mobile:imageGeneration'),
            t('mobile:creativeStudio'),
            'bg-purple-500',
            'bg-purple-50',
          ],
        ].map(([icon, title, description, color, decoration]) => (
          <View
            key={title}
            className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm"
            onClick={building}
          >
            <View
              className={`absolute -right-4 -top-4 size-20 rounded-full opacity-50 ${decoration}`}
            />
            <View className="relative z-10 flex flex-col">
              <View
                className={`size-10 rounded-xl text-white flex items-center justify-center mb-3 shadow-md ${color}`}
              >
                <View className={`i-mdi-${icon} text-xl`} />
              </View>
              <Text className="block font-bold">{title}</Text>
              <Text className="block text-xs text-gray-500 mt-1">{description}</Text>
            </View>
          </View>
        ))}
      </View>
      <View className="mb-4 flex items-center gap-2">
        <View className="h-4 w-1 rounded-full bg-blue-500" />
        <Text className="text-base font-bold text-gray-800">{t('mobile:systemManagement')}</Text>
      </View>
      <View className="rounded-2xl bg-white p-5 shadow-sm grid grid-cols-4 gap-y-4 gap-x-2">
        {modules.map(([icon, label, color]) => (
          <View
            className="flex flex-col items-center gap-1.5"
            key={label}
            onClick={building}
          >
            <View className={`size-10 rounded-xl flex items-center justify-center ${color}`}>
              <View className={`i-mdi-${icon} text-xl`} />
            </View>
            <Text className="module-caption font-medium text-gray-600">{label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
