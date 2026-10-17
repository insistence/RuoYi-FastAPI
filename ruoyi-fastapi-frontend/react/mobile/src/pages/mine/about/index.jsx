import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import config from '@/config'
import { usePageAuth } from '@/permission'
import logo from '@/assets/logo200.png'
export default function About() {
  const allowed = usePageAuth()
  if (!allowed) return null
  return (
    <View className="min-h-screen bg-gray-50 pb-10">
      <View className="flex flex-col items-center py-10">
        <Image
          src={logo}
          className="size-20 rounded-xl shadow-md"
          mode="widthFix"
        />
        <Text className="mt-4 text-xl font-bold">RuoYi-FastAPI移动端</Text>
      </View>
      <View className="bg-white">
        {[
          ['版本信息', `v${config.appInfo.version}`],
          ['官方邮箱', 'xxx@xxx.com'],
          ['服务热线', '400-999-9999'],
          ['公司网站', config.appInfo.site_url],
        ].map(([label, value], index) => (
          <View
            className={`flex items-center justify-between gap-3 px-5 py-4 ${index < 3 ? 'border-b border-gray-100' : ''}`}
            key={label}
          >
            <Text className="text-base text-gray-800 shrink-0">{label}</Text>
            <Text
              className={
                index === 3 ? 'text-sm text-blue-500 underline break-all' : 'text-sm text-gray-500'
              }
            >
              {value}
            </Text>
          </View>
        ))}
      </View>
      <Text className="block mt-10 text-center text-xs text-gray-400">
        Copyright © 2026 insistence.tech All Rights Reserved.
      </Text>
    </View>
  )
}
