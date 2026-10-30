<template>
  <view class="flex h-full flex-col overflow-y-auto bg-gray-50 pt-4 pb-10">
    <view class="overflow-hidden bg-white shadow-xs">
      <!-- Nickname -->
      <view
        class="flex items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
      >
        <view class="flex items-center">
          <view
            class="flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-500"
          >
            <view class="i-mdi-account text-xl"></view>
          </view>
          <text class="ml-3 text-base font-medium text-gray-800">{{
            $t('mobile:profile.shortNickname')
          }}</text>
        </view>
        <text class="text-sm text-gray-500">{{ user.nickName }}</text>
      </view>

      <!-- Phone -->
      <view
        class="flex items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
      >
        <view class="flex items-center">
          <view
            class="flex size-9 items-center justify-center rounded-full bg-green-50 text-green-500"
          >
            <view class="i-mdi-phone text-xl"></view>
          </view>
          <text class="ml-3 text-base font-medium text-gray-800">{{
            $t('mobile:profile.phone')
          }}</text>
        </view>
        <text class="text-sm text-gray-500">{{ user.phonenumber }}</text>
      </view>

      <!-- Email -->
      <view
        class="flex items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
      >
        <view class="flex items-center">
          <view
            class="flex size-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"
          >
            <view class="i-mdi-email text-xl"></view>
          </view>
          <text class="ml-3 text-base font-medium text-gray-800">{{
            $t('mobile:profile.email')
          }}</text>
        </view>
        <text class="text-sm text-gray-500">{{ user.email }}</text>
      </view>

      <!-- Post -->
      <view
        class="flex items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
      >
        <view class="flex items-center">
          <view
            class="flex size-9 items-center justify-center rounded-full bg-orange-50 text-orange-500"
          >
            <view class="i-mdi-shield-account text-xl"></view>
          </view>
          <text class="ml-3 text-base font-medium text-gray-800">{{
            $t('mobile:profile.post')
          }}</text>
        </view>
        <text class="text-sm text-gray-500">{{ postGroup }}</text>
      </view>

      <!-- Role -->
      <view
        class="flex items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50"
      >
        <view class="flex items-center">
          <view
            class="flex size-9 items-center justify-center rounded-full bg-purple-50 text-purple-500"
          >
            <view class="i-mdi-badge-account text-xl"></view>
          </view>
          <text class="ml-3 text-base font-medium text-gray-800">{{
            $t('mobile:profile.role')
          }}</text>
        </view>
        <text class="text-sm text-gray-500">{{ roleGroup }}</text>
      </view>

      <!-- Create Time -->
      <view class="flex items-center justify-between px-5 py-4 active:bg-gray-50">
        <view class="flex items-center">
          <view
            class="flex size-9 items-center justify-center rounded-full bg-pink-50 text-pink-500"
          >
            <view class="i-mdi-calendar text-xl"></view>
          </view>
          <text class="ml-3 text-base font-medium text-gray-800">{{
            $t('mobile:profile.createdAt')
          }}</text>
        </view>
        <text class="text-sm text-gray-500">{{ formatBusinessTime(user.createTime) || '-' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { getUserProfile } from '@/api/system/user'
import { ref } from 'vue'
import { formatBusinessTime } from '@/utils/time'
import { useUserStore } from '@/store/modules/user'

const user = ref({})
const roleGroup = ref('')
const postGroup = ref('')

async function getUser() {
  try {
    // 冷启动或直接进入资料页时，先获取服务器业务时区再展示时间。
    const [, response] = await Promise.all([useUserStore().getInfo(), getUserProfile()])
    user.value = response.data
    roleGroup.value = response.roleGroup
    postGroup.value = response.postGroup
  } catch {
    // 请求工具已展示错误，保留空状态。
  }
}

getUser()
</script>

<style>
page {
  height: 100%;
  background-color: #f9fafb;
}
</style>
