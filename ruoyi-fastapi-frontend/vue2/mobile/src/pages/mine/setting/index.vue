<template>
  <view class="flex h-full flex-col overflow-y-auto bg-gray-50 pt-4 pb-10">
    <LanguageSelect />
    <view class="bg-white">
      <!-- Change Password -->
      <view
        class="flex items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
        @click="handleToPwd"
      >
        <view class="flex items-center">
          <view class="i-mdi-lock text-xl text-gray-600 mr-3"></view>
          <text class="text-base text-gray-800">{{ $t('mobile:settings.password') }}</text>
        </view>
        <view class="i-mdi-chevron-right text-base text-gray-400"></view>
      </view>

      <!-- 时区设置 -->
      <view
        class="flex items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
        @click="handleToTimezone"
      >
        <view class="flex items-center">
          <view class="i-mdi-earth text-xl text-gray-600 mr-3"></view>
          <text class="text-base text-gray-800">{{ $t('mobile:settings.timezone') }}</text>
        </view>
        <view class="i-mdi-chevron-right text-base text-gray-400"></view>
      </view>

      <!-- Check Update -->
      <view
        class="flex items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
        @click="handleToUpgrade"
      >
        <view class="flex items-center">
          <view class="i-mdi-refresh text-xl text-gray-600 mr-3"></view>
          <text class="text-base text-gray-800">{{ $t('mobile:settings.checkUpdate') }}</text>
        </view>
        <view class="i-mdi-chevron-right text-base text-gray-400"></view>
      </view>

      <!-- Clean Cache -->
      <view
        class="flex items-center justify-between px-5 py-4 active:bg-gray-50"
        @click="handleCleanTmp"
      >
        <view class="flex items-center">
          <view class="i-mdi-delete text-xl text-gray-600 mr-3"></view>
          <text class="text-base text-gray-800">{{ $t('mobile:settings.clearCache') }}</text>
        </view>
        <view class="i-mdi-chevron-right text-base text-gray-400"></view>
      </view>
    </view>

    <!-- Logout -->
    <view class="mt-8 px-4">
      <view
        class="flex h-12 w-full items-center justify-center rounded-xl bg-red-50 text-base font-semibold text-red-600 transition-colors active:bg-red-100"
        @click="handleLogout"
        >{{ $t('mobile:settings.logout') }}</view
      >
    </view>
  </view>
</template>

<script>
import { t } from '@/i18n/adapter'

export default {
  methods: {
    handleToTimezone() {
      this.$tab.navigateTo('/pages/mine/setting/timezone')
    },
    handleToPwd() {
      this.$tab.navigateTo('/pages/mine/pwd/index')
    },
    handleToUpgrade() {
      this.$modal.showToast(t('mobile:comingSoon'))
    },
    handleCleanTmp() {
      this.$modal.showToast(t('mobile:comingSoon'))
    },
    handleLogout() {
      this.$modal.confirm(t('mobile:settings.logoutConfirm')).then(() => {
        this.$store
          .dispatch('LogOut')
          .then(() => {})
          .finally(() => {
            this.$tab.reLaunch('/pages/index')
          })
      })
    },
  },
}
</script>

<style>
page {
  height: 100%;
  background-color: #f9fafb;
}
</style>
