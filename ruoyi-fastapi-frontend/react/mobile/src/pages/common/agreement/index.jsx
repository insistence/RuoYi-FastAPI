import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React from 'react'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
export default function Agreement() {
  usePageLocale()

  return (
    <View className="min-h-full bg-white px-5 py-8">
      <View className="mb-6 text-center">
        <Text className="text-xl font-bold text-gray-900">{t('mobile:agreement.title')}</Text>
      </View>

      <View className="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:agreement.acceptance.title')}
          </Text>
          <Text>{t('mobile:agreement.acceptance.body')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:agreement.security.title')}
          </Text>
          <Text>{t('mobile:agreement.security.body')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:agreement.conduct.title')}
          </Text>
          <Text>{t('mobile:agreement.conduct.body')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:agreement.changes.title')}
          </Text>
          <Text>{t('mobile:agreement.changes.body')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:agreement.intellectualProperty.title')}
          </Text>
          <Text>{t('mobile:agreement.intellectualProperty.body')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:agreement.disclaimer.title')}
          </Text>
          <Text>{t('mobile:agreement.disclaimer.body')}</Text>
        </View>
      </View>

      <View className="mt-10 text-center text-xs text-gray-400">
        <Text>{t('mobile:agreement.updated')}</Text>
      </View>
    </View>
  )
}
