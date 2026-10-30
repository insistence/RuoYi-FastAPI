<template>
  <view class="flex h-full flex-col overflow-y-auto bg-white p-4">
    <view class="space-y-5">
      <!-- Nickname -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('mobile:profile.nickname')
        }}</text>
        <input
          v-model="user.nickName"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="text"
          :placeholder="$t('mobile:profile.nicknamePlaceholder')"
        />
      </view>

      <!-- Phone -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('mobile:profile.phone')
        }}</text>
        <input
          v-model="user.phonenumber"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="number"
          :placeholder="$t('mobile:profile.phonePlaceholder')"
          maxlength="11"
        />
      </view>

      <!-- Email -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('mobile:profile.email')
        }}</text>
        <input
          v-model="user.email"
          class="h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          type="text"
          :placeholder="$t('mobile:profile.emailPlaceholder')"
        />
      </view>

      <!-- Sex -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('mobile:profile.sex')
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
          {{ $t('mobile:actions.submit') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { getUserProfile, updateUserProfile } from '@/api/system/user'
import { computed, ref, getCurrentInstance } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const { proxy } = getCurrentInstance()
const user = ref({
  nickName: '',
  phonenumber: '',
  email: '',
  sex: '',
})
const sexs = computed(() => [
  {
    text: t('mobile:profile.male'),
    value: '0',
  },
  {
    text: t('mobile:profile.female'),
    value: '1',
  },
])

function getUser() {
  getUserProfile().then((response) => {
    const { nickName, phonenumber, email, sex } = response.data
    user.value = { nickName, phonenumber, email, sex }
  })
}

function submit() {
  if (!user.value.nickName) {
    proxy.$modal.msgError(t('mobile:profile.nicknameRequired'))
    return
  }
  if (!user.value.phonenumber) {
    proxy.$modal.msgError(t('mobile:profile.phoneRequired'))
    return
  }
  if (!/^1[3|4|5|6|7|8|9][0-9]\d{8}$/.test(user.value.phonenumber)) {
    proxy.$modal.msgError(t('mobile:profile.phoneInvalid'))
    return
  }
  if (!user.value.email) {
    proxy.$modal.msgError(t('mobile:profile.emailRequired'))
    return
  }
  if (!/^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(user.value.email)) {
    proxy.$modal.msgError(t('mobile:profile.emailInvalid'))
    return
  }

  updateUserProfile(user.value).then((response) => {
    proxy.$modal.msgSuccess(t('mobile:actions.updated'))
    setTimeout(() => {
      proxy.$tab.navigateBack()
    }, 1500)
  })
}

onLoad(() => {
  getUser()
})
</script>

<style>
page {
  height: 100%;
  background-color: #ffffff;
}
</style>
