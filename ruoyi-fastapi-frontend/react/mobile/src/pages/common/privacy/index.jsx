import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React from 'react'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
export default function Privacy() {
  usePageLocale()

  return (
    <View className="min-h-full bg-white px-5 py-8">
      <View className="mb-6 text-center">
        <Text className="text-xl font-bold text-gray-900">{t('mobile:privacy.title')}</Text>
      </View>

      <View className="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
        <View>
          <Text>{t('mobile:privacy.intro')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:privacy.collection.title')}
          </Text>
          <Text>{t('mobile:privacy.collection.body')}</Text>
          <Text className="mt-1 block pl-2">{t('mobile:privacy.collection.account')}</Text>
          <Text className="mt-1 block pl-2">{t('mobile:privacy.collection.device')}</Text>
          <Text className="mt-1 block pl-2">{t('mobile:privacy.collection.log')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:privacy.sharing.title')}
          </Text>
          <Text>{t('mobile:privacy.sharing.body')}</Text>
          <Text className="mt-1 block pl-2">{t('mobile:privacy.sharing.consent')}</Text>
          <Text className="mt-1 block pl-2">{t('mobile:privacy.sharing.law')}</Text>
          <Text className="mt-1 block pl-2">{t('mobile:privacy.sharing.publicInterest')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:privacy.protection.title')}
          </Text>
          <Text>{t('mobile:privacy.protection.body')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:privacy.rights.title')}
          </Text>
          <Text>{t('mobile:privacy.rights.body')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:privacy.updates.title')}
          </Text>
          <Text>{t('mobile:privacy.updates.body')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:privacy.contact.title')}
          </Text>
          <Text>{t('mobile:privacy.contact.body')}</Text>
          <Text className="mt-1 block">{t('mobile:privacy.contact.email')}</Text>
        </View>
      </View>

      <View className="mt-10 text-center text-xs text-gray-400">
        <Text>{t('mobile:privacy.updated')}</Text>
      </View>
    </View>
  )
}
