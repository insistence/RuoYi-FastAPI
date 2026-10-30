import { usePageLocale } from '@/i18n/navigation'
import { t } from '@/i18n'
import React from 'react'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
export default function Privacy() {
  usePageLocale()

  return (
    <View className="min-h-full bg-white px-5 py-8">
      <View className="mb-6 text-center">
        <Text className="text-xl font-bold text-gray-900">{t('mobile:privacyPolicy')}</Text>
      </View>

      <View className="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
        <View>
          <Text>{t('mobile:ruoyiFastapiTakesYourPrivacySeriouslyThisPolicyExplains')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:1CollectionAndUseOfPersonalInformation')}
          </Text>
          <Text>{t('mobile:toProvideBetterServicesWeMayCollectTheFollowing')}</Text>
          <Text className="mt-1 block pl-2">
            {t('mobile:accountInformationWhenYouRegisterOrSignInWe')}
          </Text>
          <Text className="mt-1 block pl-2">
            {t('mobile:deviceInformationToProtectAccountsAndImproveServicesWe')}
          </Text>
          <Text className="mt-1 block pl-2">
            {t('mobile:logInformationWeAutomaticallyCollectOperationLogsIpAddresses')}
          </Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:2SharingTransferAndDisclosureOfPersonalInformation')}
          </Text>
          <Text>{t('mobile:weDoNotShareTransferOrPubliclyDiscloseYour')}</Text>
          <Text className="mt-1 block pl-2">
            {t('mobile:withYourExplicitAuthorizationOrConsent')}
          </Text>
          <Text className="mt-1 block pl-2">
            {t('mobile:asRequiredByLawsRegulationsOrJudicialAuthorities')}
          </Text>
          <Text className="mt-1 block pl-2">
            {t('mobile:toProtectNationalSecurityPublicSafetyOrSubstantialPublic')}
          </Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:3ProtectionOfPersonalInformation')}
          </Text>
          <Text>{t('mobile:weUseMeasuresIncludingEncryptionAccessControlsAndSecurity')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">{t('mobile:4YourRights')}</Text>
          <Text>{t('mobile:youMayAccessCorrectOrDeleteYourPersonalInformation')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">
            {t('mobile:5UpdatesToThisPolicy')}
          </Text>
          <Text>{t('mobile:weMayUpdateThisPolicyAsLawsOrOur')}</Text>
        </View>

        <View>
          <Text className="mb-2 block font-bold text-gray-800">{t('mobile:6ContactUs')}</Text>
          <Text>{t('mobile:forQuestionsOrSuggestionsAboutThisPolicyPleaseContact')}</Text>
          <Text className="mt-1 block">{t('mobile:emailXxxXxxCom')}</Text>
        </View>
      </View>

      <View className="mt-10 text-center text-xs text-gray-400">
        <Text>{t('mobile:updatedJanuary12024')}</Text>
      </View>
    </View>
  )
}
