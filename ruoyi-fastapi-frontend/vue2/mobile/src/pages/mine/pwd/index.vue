<template>
  <view class="min-h-screen bg-white p-4">
    <view class="space-y-5">
      <!-- Old Password -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('auth:password.old')
        }}</text>
        <input
          v-model="user.oldPassword"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="password"
          :placeholder="$t('auth:password.oldPlaceholder')"
        />
      </view>
      <!-- New Password -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('auth:password.new')
        }}</text>
        <input
          v-model="user.newPassword"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="password"
          :placeholder="$t('auth:password.newPlaceholder')"
        />
      </view>
      <!-- Confirm Password -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('auth:password.confirm')
        }}</text>
        <input
          v-model="user.confirmPassword"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="password"
          :placeholder="$t('auth:password.confirmPlaceholder')"
        />
      </view>

      <!-- Submit Button -->
      <view class="pt-6">
        <button
          @click="submit"
          class="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition-all active:scale-95 active:bg-blue-600"
        >
          {{ $t('common:submit') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { t } from '@/i18n/adapter'

import { updateUserPwd } from '@/api/system/user'

export default {
  data() {
    return {
      user: {
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      },
    }
  },
  methods: {
    submit() {
      if (!this.user.oldPassword) {
        this.$modal.msgError(t('auth:password.oldRequired'))
        return
      }
      if (!this.user.newPassword) {
        this.$modal.msgError(t('auth:password.newRequired'))
        return
      }
      if (this.user.newPassword.length < 6 || this.user.newPassword.length > 20) {
        this.$modal.msgError(t('auth:password.length'))
        return
      }
      if (!this.user.confirmPassword) {
        this.$modal.msgError(t('auth:password.confirmRequired'))
        return
      }
      if (this.user.newPassword !== this.user.confirmPassword) {
        this.$modal.msgError(t('auth:password.mismatch'))
        return
      }

      updateUserPwd(this.user.oldPassword, this.user.newPassword).then((response) => {
        this.$modal.msgSuccess(t('common:updateSuccess'))
        setTimeout(() => {
          this.$tab.navigateBack()
        }, 1500)
      })
    },
  },
}
</script>
