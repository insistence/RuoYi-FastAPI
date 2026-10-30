<template>
  <view class="min-h-full bg-white px-5 py-8">
    <view class="mb-6 text-center">
      <text class="text-xl font-bold text-gray-900">{{ $t('mobile:privacy.title') }}</text>
    </view>

    <view class="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
      <view>
        <text>{{ $t('mobile:privacy.intro') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.collection.title')
        }}</text>
        <text>{{ $t('mobile:privacy.collection.body') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.collection.account') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.collection.device') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.collection.log') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.sharing.title')
        }}</text>
        <text>{{ $t('mobile:privacy.sharing.body') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.sharing.consent') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.sharing.law') }}</text>
        <text class="mt-1 block pl-2">{{ $t('mobile:privacy.sharing.publicInterest') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.protection.title')
        }}</text>
        <text>{{ $t('mobile:privacy.protection.body') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.rights.title')
        }}</text>
        <text>{{ $t('mobile:privacy.rights.body') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.updates.title')
        }}</text>
        <text>{{ $t('mobile:privacy.updates.body') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:privacy.contact.title')
        }}</text>
        <text>{{ $t('mobile:privacy.contact.body') }}</text>
        <text class="mt-1 block">{{ $t('mobile:privacy.contact.email') }}</text>
      </view>
    </view>

    <view class="mt-10 text-center text-xs text-gray-400">
      <text>{{ $t('mobile:privacy.updated') }}</text>
    </view>
  </view>
</template>

<script setup></script>
