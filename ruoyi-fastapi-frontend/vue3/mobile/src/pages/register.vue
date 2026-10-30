<template>
  <view
    class="flex h-full flex-col items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 px-6 pb-20 overflow-hidden"
  >
    <!-- Logo Section -->
    <view class="mb-6 flex flex-col items-center">
      <view class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-white shadow-lg">
        <image
          class="size-10"
          :src="globalConfig.appInfo.logo"
          mode="widthFix"
        />
      </view>
      <text class="text-xl font-bold tracking-wide text-gray-800">{{
        $t('mobile:auth.registerTitle')
      }}</text>
    </view>

    <LanguageSelect />

    <!-- Form Section -->
    <view class="w-full rounded-3xl bg-white/80 p-6 shadow-xl backdrop-blur-md">
      <!-- Username -->
      <view class="group relative mb-5">
        <view
          class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500"
        >
          <view class="i-mdi-account text-xl"></view>
        </view>
        <input
          v-model="registerForm.username"
          class="h-12 w-full rounded-xl bg-gray-50 pl-12 pr-4 text-sm text-gray-700 outline-hidden transition-all focus:bg-white focus:ring-2 focus:ring-blue-400"
          type="text"
          :placeholder="$t('mobile:auth.usernamePlaceholder')"
          maxlength="30"
        />
      </view>

      <!-- Password -->
      <view class="group relative mb-5">
        <view
          class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500"
        >
          <view class="i-mdi-lock text-xl"></view>
        </view>
        <input
          v-model="registerForm.password"
          type="password"
          class="h-12 w-full rounded-xl bg-gray-50 pl-12 pr-4 text-sm text-gray-700 outline-hidden transition-all focus:bg-white focus:ring-2 focus:ring-blue-400"
          :placeholder="$t('mobile:auth.passwordPlaceholder')"
          maxlength="20"
        />
      </view>

      <!-- Confirm Password -->
      <view class="group relative mb-5">
        <view
          class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500"
        >
          <view class="i-mdi-lock text-xl"></view>
        </view>
        <input
          v-model="registerForm.confirmPassword"
          type="password"
          class="h-12 w-full rounded-xl bg-gray-50 pl-12 pr-4 text-sm text-gray-700 outline-hidden transition-all focus:bg-white focus:ring-2 focus:ring-blue-400"
          :placeholder="$t('mobile:auth.confirmPasswordPlaceholder')"
          maxlength="20"
        />
      </view>

      <!-- Captcha -->
      <view
        class="mb-8 flex items-center justify-between"
        v-if="captchaEnabled"
      >
        <view class="group relative mr-3 flex-1">
          <view
            class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500"
          >
            <view class="i-mdi-security text-xl"></view>
          </view>
          <input
            v-model="registerForm.code"
            type="number"
            class="h-12 w-full rounded-xl bg-gray-50 pl-12 pr-4 text-sm text-gray-700 outline-hidden transition-all focus:bg-white focus:ring-2 focus:ring-blue-400"
            :placeholder="$t('common:login.code')"
            maxlength="4"
          />
        </view>
        <view
          class="h-12 w-28 overflow-hidden rounded-xl bg-gray-100 shadow-xs transition-opacity active:opacity-80"
          @click="getCode"
        >
          <image
            :src="codeUrl"
            class="size-full object-cover"
          ></image>
        </view>
      </view>

      <!-- Register Button -->
      <button
        @click="handleRegister"
        class="flex h-12 w-full items-center justify-center rounded-xl bg-linear-to-r from-blue-500 to-indigo-600 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95"
      >
        {{ $t('mobile:auth.register') }}
      </button>

      <!-- Footer Links -->
      <view class="mt-6 flex flex-col items-center space-y-3">
        <view class="flex items-center text-sm text-gray-500">
          <text
            @click="handleUserLogin"
            class="ml-1 font-medium text-blue-600 active:opacity-70"
            >{{ $t('mobile:auth.existingAccount') }}</text
          >
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { getCodeImg, register } from '@/api/login'
import { ref, getCurrentInstance } from 'vue'
import { useConfigStore } from '@/store'

const { proxy } = getCurrentInstance()
const globalConfig = useConfigStore().config
const codeUrl = ref('')
// 验证码开关
const captchaEnabled = ref(true)
const registerForm = ref({
  username: '',
  password: '',
  confirmPassword: '',
  code: '',
  uuid: '',
})

// 用户登录
function handleUserLogin() {
  proxy.$tab.navigateTo(`/pages/login`)
}

// 获取图形验证码
function getCode() {
  getCodeImg().then((res) => {
    captchaEnabled.value = res.captchaEnabled === undefined ? true : res.captchaEnabled
    if (captchaEnabled.value) {
      codeUrl.value = 'data:image/gif;base64,' + res.img
      registerForm.value.uuid = res.uuid
    }
  })
}

// 注册方法
async function handleRegister() {
  if (registerForm.value.username === '') {
    proxy.$modal.msgError(t('common:login.usernameRequired'))
  } else if (registerForm.value.password === '') {
    proxy.$modal.msgError(t('common:login.passwordRequired'))
  } else if (registerForm.value.confirmPassword === '') {
    proxy.$modal.msgError(t('mobile:auth.confirmPasswordRequired'))
  } else if (registerForm.value.password !== registerForm.value.confirmPassword) {
    proxy.$modal.msgError(t('mobile:password.mismatch'))
  } else if (registerForm.value.code === '' && captchaEnabled.value) {
    proxy.$modal.msgError(t('common:login.codeRequired'))
  } else {
    proxy.$modal.loading(t('mobile:auth.registering'))
    userRegister()
  }
}

// 用户注册
async function userRegister() {
  register(registerForm.value)
    .then((res) => {
      proxy.$modal.closeLoading()
      uni.showModal({
        title: t('mobile:app.systemNotice'),
        content: t('mobile:auth.registerSuccess', { username: registerForm.value.username }),
        confirmText: t('common:confirm'),
        cancelText: t('common:cancel'),
        success: function (res) {
          if (res.confirm) {
            uni.redirectTo({ url: `/pages/login` })
          }
        },
      })
    })
    .catch(() => {
      if (captchaEnabled.value) {
        getCode()
      }
    })
}

getCode()
</script>

<style lang="scss" scoped>
page {
  background-color: #ffffff;
  height: 100%;
}
</style>
