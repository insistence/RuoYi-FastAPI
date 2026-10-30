<template>
  <view class="flex h-full flex-col overflow-y-auto bg-white p-4">
    <view class="space-y-5">
      <!-- Nickname -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('system:user.nickname')
        }}</text>
        <input
          v-model="user.nickName"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="text"
          :placeholder="$t('system:user.nicknamePlaceholder')"
        />
      </view>

      <!-- Phone -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('system:user.phone')
        }}</text>
        <input
          v-model="user.phonenumber"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="number"
          :placeholder="$t('system:user.phonePlaceholder')"
          maxlength="11"
        />
      </view>

      <!-- Email -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('system:user.email')
        }}</text>
        <input
          v-model="user.email"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="text"
          :placeholder="$t('system:user.emailPlaceholder')"
        />
      </view>

      <!-- Sex -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('system:user.sex')
        }}</text>
        <view class="flex space-x-4">
          <view
            v-for="item in sexs"
            :key="item.value"
            @click="user.sex = item.value"
            class="flex flex-1 items-center justify-center rounded-xl border py-2.5 transition-all active:scale-95"
            :class="
              user.sex === item.value
                ? 'bg-blue-50 border-blue-500 text-blue-600'
                : 'bg-gray-50 border-transparent text-gray-500'
            "
          >
            <text class="text-sm font-medium">{{ item.text }}</text>
          </view>
        </view>
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

import { getUserProfile, updateUserProfile } from '@/api/system/user'

export default {
  data() {
    return {
      user: {
        nickName: '',
        phonenumber: '',
        email: '',
        sex: '',
      },
    }
  },
  computed: {
    sexs() {
      return [
        {
          text: t('system:user.male'),
          value: '0',
        },
        {
          text: t('system:user.female'),
          value: '1',
        },
      ]
    },
  },
  onLoad() {
    this.getUser()
  },
  methods: {
    getUser() {
      getUserProfile().then((response) => {
        const { nickName, phonenumber, email, sex } = response.data
        this.user = { nickName, phonenumber, email, sex }
      })
    },
    submit() {
      if (!this.user.nickName) {
        this.$modal.msgError(t('system:user.nicknameRequired'))
        return
      }
      if (!this.user.phonenumber) {
        this.$modal.msgError(t('system:user.phoneRequired'))
        return
      }
      if (!/^1[3-9]\d{9}$/.test(this.user.phonenumber)) {
        this.$modal.msgError(t('system:user.phoneInvalid'))
        return
      }
      if (!this.user.email) {
        this.$modal.msgError(t('system:user.emailRequired'))
        return
      }
      if (!/^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(this.user.email)) {
        this.$modal.msgError(t('system:user.emailInvalid'))
        return
      }

      updateUserProfile(this.user).then((response) => {
        this.$modal.msgSuccess(t('common:updateSuccess'))
        setTimeout(() => {
          this.$tab.navigateBack()
        }, 1500)
      })
    },
  },
}
</script>

<style>
page {
  height: 100%;
  background-color: #ffffff;
}
</style>
