<template>
  <view class="min-h-full bg-white px-5 py-8">
    <view class="mb-6 text-center">
      <text class="text-xl font-bold text-gray-900">{{ $t('mobile:agreement.title') }}</text>
    </view>

    <view class="space-y-6 text-justify text-sm leading-relaxed text-gray-600">
      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.acceptance.title')
        }}</text>
        <text>{{ $t('mobile:agreement.acceptance.body') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.security.title')
        }}</text>
        <text>{{ $t('mobile:agreement.security.body') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.conduct.title')
        }}</text>
        <text>{{ $t('mobile:agreement.conduct.body') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.changes.title')
        }}</text>
        <text>{{ $t('mobile:agreement.changes.body') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.intellectualProperty.title')
        }}</text>
        <text>{{ $t('mobile:agreement.intellectualProperty.body') }}</text>
      </view>

      <view>
        <text class="mb-2 block font-bold text-gray-800">{{
          $t('mobile:agreement.disclaimer.title')
        }}</text>
        <text>{{ $t('mobile:agreement.disclaimer.body') }}</text>
      </view>
    </view>

    <view class="mt-10 text-center text-xs text-gray-400">
      <text>{{ $t('mobile:agreement.updated') }}</text>
    </view>
  </view>
</template>

<script setup></script>
