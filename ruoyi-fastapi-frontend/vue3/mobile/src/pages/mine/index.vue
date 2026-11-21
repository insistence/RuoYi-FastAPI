<template>
  <view class="flex h-full flex-col bg-gray-50 overflow-hidden">
    <!-- Header Section -->
    <view
      class="relative overflow-hidden bg-linear-to-r from-blue-500 to-indigo-600 pb-20 pt-16 text-white shadow-lg"
    >
      <view class="absolute -right-10 -top-10 size-64 rounded-full bg-white/10 blur-3xl"></view>
      <view class="absolute -bottom-10 -left-10 size-40 rounded-full bg-white/10 blur-2xl"></view>

      <view class="relative z-10 flex items-center justify-between px-6">
        <view class="flex items-center space-x-4">
          <!-- Avatar -->
          <view
            class="relative overflow-hidden rounded-full border-4 border-white/30 bg-white/20 shadow-xl transition-transform active:scale-95"
          >
            <image
              v-if="avatar"
              @click="handleToAvatar"
              :src="avatar"
              class="size-20 object-cover"
            />
            <view
              v-else
              class="flex size-20 items-center justify-center bg-white text-gray-400"
            >
              <view class="i-mdi-account text-5xl"></view>
            </view>
          </view>

          <!-- User Info -->
          <view class="flex flex-col">
            <template v-if="name">
              <view
                class="text-xl font-bold tracking-wide"
                @click="handleToInfo"
              >
                {{ name }}
              </view>
              <view
                class="mt-1 flex items-center text-sm text-blue-100"
                @click="handleToInfo"
              >
                <text>{{ $t('mobile:profile.view') }}</text>
                <view class="i-mdi-chevron-right ml-1 text-xs"></view>
              </view>
            </template>
            <view
              v-else
              class="text-xl font-bold"
              @click="handleToLogin"
            >
              {{ $t('mobile:profile.signIn') }}</view
            >
          </view>
        </view>
      </view>
    </view>

    <!-- Content Section -->
    <view class="relative z-20 -mt-12 flex-1 px-4 overflow-y-auto">
      <!-- Quick Actions -->
      <view
        class="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow-lg shadow-gray-200/50"
      >
        <view
          class="flex flex-1 flex-col items-center justify-center space-y-2 active:opacity-70"
          @click="handleJiaoLiuQun"
        >
          <view
            class="flex size-12 items-center justify-center rounded-full bg-pink-50 text-pink-500"
          >
            <view class="i-mdi-account-group text-2xl"></view>
          </view>
          <text class="text-xs font-medium text-gray-600">{{
            $t('mobile:profile.community')
          }}</text>
        </view>
        <view
          class="flex flex-1 flex-col items-center justify-center space-y-2 active:opacity-70"
          @click="handleBuilding"
        >
          <view
            class="flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-500"
          >
            <view class="i-mdi-face-agent text-2xl"></view>
          </view>
          <text class="text-xs font-medium text-gray-600">{{ $t('mobile:profile.support') }}</text>
        </view>
        <view
          class="flex flex-1 flex-col items-center justify-center space-y-2 active:opacity-70"
          @click="handleBuilding"
        >
          <view
            class="flex size-12 items-center justify-center rounded-full bg-purple-50 text-purple-500"
          >
            <view class="i-mdi-forum text-2xl"></view>
          </view>
          <text class="text-xs font-medium text-gray-600">{{ $t('mobile:profile.feedback') }}</text>
        </view>
        <view
          class="flex flex-1 flex-col items-center justify-center space-y-2 active:opacity-70"
          @click="handleBuilding"
        >
          <view
            class="flex size-12 items-center justify-center rounded-full bg-green-50 text-green-500"
          >
            <view class="i-mdi-thumb-up text-2xl"></view>
          </view>
          <text class="text-xs font-medium text-gray-600">{{ $t('mobile:profile.like') }}</text>
        </view>
      </view>

      <!-- Menu List -->
      <view class="overflow-hidden rounded-2xl bg-white shadow-lg shadow-gray-200/50">
        <view
          class="group flex items-center justify-between border-b border-gray-100 p-4 transition-colors active:bg-gray-50"
          @click="handleToEditInfo"
        >
          <view class="flex items-center space-x-3">
            <view class="i-mdi-account-edit text-xl text-blue-500"></view>
            <text class="text-base text-gray-700">{{ $t('mobile:profile.edit') }}</text>
          </view>
          <view class="i-mdi-chevron-right text-gray-400"></view>
        </view>

        <view
          class="group flex items-center justify-between border-b border-gray-100 p-4 transition-colors active:bg-gray-50"
          @click="handleHelp"
        >
          <view class="flex items-center space-x-3">
            <view class="i-mdi-help-circle text-xl text-orange-500"></view>
            <text class="text-base text-gray-700">{{ $t('mobile:help.title') }}</text>
          </view>
          <view class="i-mdi-chevron-right text-gray-400"></view>
        </view>

        <view
          class="group flex items-center justify-between border-b border-gray-100 p-4 transition-colors active:bg-gray-50"
          @click="handleAbout"
        >
          <view class="flex items-center space-x-3">
            <view class="i-mdi-heart-outline text-xl text-red-500"></view>
            <text class="text-base text-gray-700">{{ $t('mobile:about.title') }}</text>
          </view>
          <view class="i-mdi-chevron-right text-gray-400"></view>
        </view>

        <view
          class="group flex items-center justify-between p-4 transition-colors active:bg-gray-50"
          @click="handleToSetting"
        >
          <view class="flex items-center space-x-3">
            <view class="i-mdi-cog-outline text-xl text-gray-500"></view>
            <text class="text-base text-gray-700">{{ $t('mobile:settings.title') }}</text>
          </view>
          <view class="i-mdi-chevron-right text-gray-400"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { useUserStore } from '@/store'
import { computed, getCurrentInstance } from 'vue'

const { proxy } = getCurrentInstance()
const userStore = useUserStore()

const name = computed(() => userStore.name)
const avatar = computed(() => userStore.avatar)
const windowHeight = computed(() => uni.getSystemInfoSync().windowHeight - 50)

function handleToInfo() {
  proxy.$tab.navigateTo('/pages/mine/info/index')
}

function handleToEditInfo() {
  proxy.$tab.navigateTo('/pages/mine/info/edit')
}

function handleToSetting() {
  proxy.$tab.navigateTo('/pages/mine/setting/index')
}

function handleToLogin() {
  proxy.$tab.reLaunch('/pages/login')
}

function handleToAvatar() {
  proxy.$tab.navigateTo('/pages/mine/avatar/index')
}

function handleHelp() {
  proxy.$tab.navigateTo('/pages/mine/help/index')
}

function handleAbout() {
  proxy.$tab.navigateTo('/pages/mine/about/index')
}

function handleJiaoLiuQun() {
  proxy.$modal.showToast(t('mobile:app.comingSoon'))
}

function handleBuilding() {
  proxy.$modal.showToast(t('mobile:app.comingSoon'))
}
</script>
