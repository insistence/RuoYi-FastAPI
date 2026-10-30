import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React from 'react'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
export default function Agreement() {
  usePageLocale()

  return (
    <View className="min-h-full bg-white px-5 py-8">
      <View className="mb-6 text-center">
        <Text className="text-xl font-bold text-gray-900">{t('mobile:userAgreement')}</Text>
      </View>

      <View className="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:1AcceptanceOfTheTermsOfService')}
          </Text>
          <Text>{t('mobile:welcomeToTheRuoyiFastapiMobileFrameworkTheProduct')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:2AccountsAndSecurity')}
          </Text>
          <Text>{t('mobile:provideTrueAccurateCurrentAndCompletePersonalInformationWhen')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">{t('mobile:3UserConduct')}</Text>
          <Text>{t('mobile:youMustComplyWithApplicableLawsAndRegulationsWhen')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:4ChangesInterruptionsAndTerminationOfServices')}
          </Text>
          <Text>{t('mobile:dueToTheNatureOfNetworkServicesWeMay')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:5IntellectualProperty')}
          </Text>
          <Text>{t('mobile:allContentInTheProductIncludingTextImagesAudio')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">{t('mobile:6Disclaimer')}</Text>
          <Text>{t('mobile:theProductIsProvidedAsIsWithoutExpressOr')}</Text>
        </View>
      </View>

      <View className="mt-10 text-center text-xs text-gray-400">
        <Text>{t('mobile:updatedJanuary12024')}</Text>
      </View>
    </View>
  )
}
