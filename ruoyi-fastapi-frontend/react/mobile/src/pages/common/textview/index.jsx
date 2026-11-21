import { helpTopics } from '@/i18n/help'
import { usePageLocale } from '@/i18n/navigation'
import React, { useState } from 'react'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { decodeRouteParam } from '@/utils/routeParams'
import { View, Text } from '@tarojs/components'
import { usePageAuth } from '@/permission'
export default function TextView() {
  usePageLocale()
  const allowed = usePageAuth()
  const [params, setParams] = useState({})
  useLoad((options) => {
    setParams({
      topic: decodeRouteParam(options.topic),
      title: decodeRouteParam(options.title),
      content: decodeRouteParam(options.content),
    })
  })
  const topic = Object.hasOwn(helpTopics, params.topic) ? helpTopics[params.topic] : null
  const title = topic ? topic.title() : params.title
  const content = topic ? topic.content() : params.content
  useDidShow(() => {
    if (title) Taro.setNavigationBarTitle({ title })
  })
  React.useEffect(() => {
    if (title) Taro.setNavigationBarTitle({ title })
  }, [title])
  if (!allowed) return null
  return (
    <View className="mobile-page">
      <View className="mobile-card">
        <Text className="block text-lg font-bold mb-3 border-b border-gray-100 pb-2">{title}</Text>
        <Text className="block text-sm text-gray-600 leading-relaxed">{content}</Text>
      </View>
    </View>
  )
}
