<template>
  <view class="min-h-full bg-white px-5 py-8">
    <view class="mb-6 text-center">
      <text class="text-xl font-bold text-gray-900">{{ $t('mobile:privacy.title') }}</text>
    </view>

    <view class="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
      <view>
        <text>{{ $t('mobile:privacy.introduction') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.collectionTitle')
        }}</text>
        <text>{{ $t('mobile:privacy.collection') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.account') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.device') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.logs') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.sharingTitle')
        }}</text>
        <text>{{ $t('mobile:privacy.sharing') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.consent') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.law') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.publicInterest') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.securityTitle')
        }}</text>
        <text>{{ $t('mobile:privacy.security') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.rightsTitle')
        }}</text>
        <text>{{ $t('mobile:privacy.rights') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.updatesTitle')
        }}</text>
        <text>{{ $t('mobile:privacy.updates') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.contactTitle')
        }}</text>
        <text>{{ $t('mobile:privacy.contact') }}</text>
        <text class="mt-1 block">{{ $t('mobile:privacy.email') }}</text>
      </view>
    </view>

    <view class="mt-10 text-center text-xs text-gray-400">
      <text>{{ $t('mobile:privacy.updated') }}</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {}
  },
}
</script>
