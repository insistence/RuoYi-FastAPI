import React, { useState } from 'react'
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components'
import { usePageAuth } from '@/permission'
import { toast } from '@/utils/common'
import banner1 from '@/assets/images/banner/banner01.jpg'
import banner2 from '@/assets/images/banner/banner02.jpg'
import banner3 from '@/assets/images/banner/banner03.jpg'
const banners = [banner1, banner2, banner3]
const modules = [
  ['account', '用户管理', 'bg-blue-50 text-blue-500'],
  ['badge-account', '角色管理', 'bg-orange-50 text-orange-500'],
  ['office-building', '部门管理', 'bg-green-50 text-green-500'],
  ['cog', '配置管理', 'bg-red-50 text-red-500'],
  ['book-open-page-variant', '字典管理', 'bg-cyan-50 text-cyan-500'],
  ['bullhorn', '通知公告', 'bg-yellow-50 text-yellow-500'],
  ['file-document-outline', '日志管理', 'bg-pink-50 text-pink-500'],
  ['dots-horizontal', '更多', 'bg-gray-50 text-gray-500'],
]
export default function Work() {
  const allowed = usePageAuth()
  const [current, setCurrent] = useState(0)
  if (!allowed) return null
  const building = () => toast('模块建设中~')
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
        <Text className="text-base font-bold text-gray-800">AI 生产力</Text>
      </View>
      <View className="grid grid-cols-2 gap-4 mb-6">
        {[
          ['chat', '智能对话', '智能助手', 'bg-indigo-500', 'bg-indigo-50'],
          ['image-multiple', '图像生成', '创意工坊', 'bg-purple-500', 'bg-purple-50'],
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
        <Text className="text-base font-bold text-gray-800">系统管理</Text>
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
