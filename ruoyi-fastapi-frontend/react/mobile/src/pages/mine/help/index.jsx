import { helpTopics } from '@/i18n/help'
import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { usePageAuth } from '@/permission'
export default function Help() {
  usePageLocale()
  const groups = [
    {
      get title() {
        return t('mobile:aboutRuoyiFastapi')
      },
      icon: 'github',
      items: ['openSource', 'commercial', 'website', 'documentation'],
    },
    {
      get title() {
        return t('mobile:otherQuestions')
      },
      icon: 'help-circle-outline',
      items: ['signOut', 'avatar', 'password'],
    },
  ]

  const allowed = usePageAuth()
  if (!allowed) return null
  return (
    <View className="mobile-page bg-gray-50">
      {groups.map((group) => (
        <View
          key={group.title}
          className="mb-6"
        >
          <View className="mb-3 ml-2 flex items-center text-base font-bold text-gray-800">
            <View className={`i-mdi-${group.icon} mr-2 text-lg text-blue-500`} />
            <Text>{group.title}</Text>
          </View>
          <View className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
            {group.items.map((topic, index) => (
              <View
                className={`p-4 text-sm text-gray-600 ${index < group.items.length - 1 ? 'border-b border-gray-100' : ''}`}
                key={topic}
                onClick={() =>
                  Taro.navigateTo({
                    url: `/pages/common/textview/index?topic=${topic}`,
                  })
                }
              >
                <Text>{helpTopics[topic].title()}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}
