<template>
  <view class="min-h-full bg-white px-5 py-8">
    <view class="mb-6 text-center">
      <text class="text-xl font-bold text-gray-900">{{ $t('mobile:agreement.title') }}</text>
    </view>

    <view class="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.acceptanceTitle')
        }}</text>
        <text>{{ $t('mobile:agreement.acceptance') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.accountTitle')
        }}</text>
        <text>{{ $t('mobile:agreement.account') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.conductTitle')
        }}</text>
        <text>{{ $t('mobile:agreement.conduct') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.serviceTitle')
        }}</text>
        <text>{{ $t('mobile:agreement.service') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.ownershipTitle')
        }}</text>
        <text>{{ $t('mobile:agreement.ownership') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.disclaimerTitle')
        }}</text>
        <text>{{ $t('mobile:agreement.disclaimer') }}</text>
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
