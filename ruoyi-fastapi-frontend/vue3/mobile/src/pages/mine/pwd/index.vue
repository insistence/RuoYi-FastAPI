<template>
  <view class="min-h-screen bg-white p-4">
    <view class="space-y-5">
      <!-- Old Password -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('mobile:password.old')
        }}</text>
        <input
          v-model="user.oldPassword"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="password"
          :placeholder="$t('mobile:password.oldPlaceholder')"
        />
      </view>
      <!-- New Password -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('mobile:password.new')
        }}</text>
        <input
          v-model="user.newPassword"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="password"
          :placeholder="$t('mobile:password.newPlaceholder')"
        />
      </view>
      <!-- Confirm Password -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('mobile:password.confirm')
        }}</text>
        <input
          v-model="user.confirmPassword"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="password"
          :placeholder="$t('mobile:password.confirmPlaceholder')"
        />
      </view>

      <!-- Submit Button -->
      <view class="pt-6">
        <button
          @click="submit"
          class="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition-all active:scale-95 active:bg-blue-600"
        >
          {{ $t('mobile:actions.submit') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { updateUserPwd } from '@/api/system/user'
import { ref, reactive, getCurrentInstance } from 'vue'

const { proxy } = getCurrentInstance()
const user = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

function submit() {
  if (!user.oldPassword) {
    proxy.$modal.msgError(t('mobile:password.oldRequired'))
    return
  }
  if (!user.newPassword) {
    proxy.$modal.msgError(t('mobile:password.newRequired'))
    return
  }
  if (user.newPassword.length < 6 || user.newPassword.length > 20) {
    proxy.$modal.msgError(t('mobile:password.length'))
    return
  }
  if (!user.confirmPassword) {
    proxy.$modal.msgError(t('mobile:password.confirmRequired'))
    return
  }
  if (user.newPassword !== user.confirmPassword) {
    proxy.$modal.msgError(t('mobile:password.mismatch'))
    return
  }

  updateUserPwd(user.oldPassword, user.newPassword).then((response) => {
    proxy.$modal.msgSuccess(t('mobile:actions.updated'))
    setTimeout(() => {
      proxy.$tab.navigateBack()
    }, 1500)
  })
}
</script>
