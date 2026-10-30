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
          <text class="text-base text-gray-800">{{ $t('mobile:password.title') }}</text>
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
          <text class="text-base text-gray-800">{{ $t('mobile:timezone.title') }}</text>
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
          <text class="text-base text-gray-800">{{ $t('mobile:settings.checkUpdates') }}</text>
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
        >{{ $t('mobile:settings.signOut') }}</view
      >
    </view>
  </view>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { useUserStore } from '@/store'
import { getCurrentInstance } from 'vue'

const { proxy } = getCurrentInstance()

function handleToPwd() {
  proxy.$tab.navigateTo('/pages/mine/pwd/index')
}

function handleToTimezone() {
  proxy.$tab.navigateTo('/pages/mine/setting/timezone')
}

function handleToUpgrade() {
  proxy.$modal.showToast(t('mobile:app.comingSoon'))
}

function handleCleanTmp() {
  proxy.$modal.showToast(t('mobile:app.comingSoon'))
}

function handleLogout() {
  proxy.$modal.confirm(t('mobile:settings.signOutConfirm')).then(() => {
    useUserStore()
      .logOut()
      .then(() => {})
      .finally(() => {
        proxy.$tab.reLaunch('/pages/index')
      })
  })
}
</script>

<style>
page {
  height: 100%;
  background-color: #f9fafb;
}
</style>
