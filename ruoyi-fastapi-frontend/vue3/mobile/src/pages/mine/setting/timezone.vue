<template>
  <view class="flex h-full flex-col overflow-y-auto bg-white p-4">
    <view class="space-y-5">
      <!-- 跟随设备 -->
      <label class="flex min-h-11 items-center justify-between gap-4">
        <text class="text-sm font-medium text-gray-700">{{ $t('mobile:timezone.automatic') }}</text>
        <switch
          :checked="followDevice"
          :disabled="saving || initializing"
          color="#3b82f6"
          :aria-label="$t('mobile:timezone.automatic')"
          @change="followDevice = $event.detail.value"
        />
      </label>
      <!-- 显示时区 -->
      <view
        v-if="!followDevice"
        class="group relative"
      >
        <label
          for="timezone-search"
          class="mb-2 block text-sm font-medium text-gray-700"
          >{{ $t('mobile:timezone.display') }}</label
        >
        <input
          id="timezone-search"
          v-model="zoneSearch"
          :disabled="saving || initializing"
          class="mb-3 h-11 w-full rounded-xl bg-gray-50 px-4 text-sm text-gray-800 outline-hidden ring-1 ring-gray-200 transition-all focus:bg-white focus:ring-2 focus:ring-blue-500"
          :placeholder="$t('mobile:timezone.searchPlaceholder')"
          :aria-label="$t('mobile:timezone.search')"
        />
        <picker
          :range="filteredTimezones"
          :value="selectedIndex"
          :disabled="saving || initializing || loading || !filteredTimezones.length"
          @change="selectTimezone"
        >
          <button
            class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-2.5 text-left leading-normal ring-1 ring-gray-200 transition-all active:bg-gray-100"
            :disabled="saving || initializing || loading || !filteredTimezones.length"
            :aria-label="$t('mobile:timezone.choose')"
          >
            <text class="break-all text-sm text-gray-800">{{ selectedZone }}</text>
            <view
              class="i-mdi-chevron-down shrink-0 text-base text-gray-400"
              aria-hidden="true"
            ></view>
          </button>
        </picker>
        <text
          v-if="!filteredTimezones.length"
          class="mt-2 block text-sm text-gray-500"
          >{{ $t('mobile:timezone.noResults') }}</text
        >
      </view>
      <view
        v-if="loadError"
        class="space-y-3 text-sm text-gray-500"
      >
        <text>{{ $t('mobile:timezone.loadFailed') }}</text>
        <button
          size="mini"
          class="flex h-11 items-center justify-center rounded-xl bg-blue-50 px-4 text-sm font-medium text-blue-600 active:bg-blue-100"
          :loading="loading"
          :disabled="loading"
          @click="loadOptions"
        >
          {{ $t('common:retry') }}
        </button>
      </view>
      <!-- 时间预览 -->
      <view class="group relative">
        <text class="mb-2 block text-sm font-medium text-gray-700">{{
          $t('mobile:timezone.preview')
        }}</text>
        <view
          class="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-800 ring-1 ring-gray-200"
          aria-live="polite"
        >
          <text class="block break-all"
            >{{ $t('mobile:timezone.previewZone') }}{{ previewZone }}</text
          >
          <text class="block">{{ $t('mobile:timezone.previewTime') }}{{ previewTime }}</text>
          <text
            v-if="followDevice && !deviceZone"
            class="mt-2 block text-gray-500"
            >{{ $t('mobile:timezone.deviceFallback') }}</text
          >
        </view>
        <text class="mt-2 block text-xs leading-5 text-gray-500">{{
          $t('mobile:timezone.hint')
        }}</text>
      </view>
      <text
        v-if="saveError"
        class="block text-sm text-red-500"
        role="alert"
        >{{ saveError }}</text
      >
      <!-- 保存按钮 -->
      <view class="pt-6">
        <button
          @click="saveTimezone"
          class="flex h-12 w-full items-center justify-center rounded-xl bg-blue-500 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition-all active:scale-95 active:bg-blue-600"
          :loading="saving"
          :disabled="saving || initializing"
        >
          {{ $t('mobile:timezone.save') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { useUserStore } from '@/store'
import { computed, getCurrentInstance, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getTimezoneOptions, updateUserTimezone } from '@/api/system/user'
import {
  formatBusinessTime,
  getBusinessTimezone,
  getDeviceTimezone,
  getDisplayTimezone,
  getSupportedTimezones,
} from '@/utils/time'

const { proxy } = getCurrentInstance()
const userStore = useUserStore()
const followDevice = ref(userStore.timeZone === 'auto')
const selectedZone = ref(getDisplayTimezone())
const timezones = ref(getSupportedTimezones())
const zoneSearch = ref('')
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)
const initializing = ref(true)
const saveError = ref('')
const now = ref(new Date())
const deviceZone = computed(getDeviceTimezone)
const previewZone = computed(() =>
  followDevice.value ? deviceZone.value || getBusinessTimezone() : selectedZone.value
)
const previewTime = computed(() =>
  formatBusinessTime(now.value, 'YYYY-MM-DD HH:mm:ss', previewZone.value)
)
const filteredTimezones = computed(() =>
  timezones.value.filter((zone) =>
    zone.toLowerCase().includes(zoneSearch.value.trim().toLowerCase())
  )
)
const selectedIndex = computed(() =>
  Math.max(0, filteredTimezones.value.indexOf(selectedZone.value))
)

/** 选择筛选结果中的时区。 */
function selectTimezone(event) {
  selectedZone.value = filteredTimezones.value[Number(event.detail.value)]
}

/** 加载当前运行时支持的时区选项。 */
async function loadOptions() {
  loading.value = true
  loadError.value = false
  try {
    const response = await getTimezoneOptions()
    timezones.value = getSupportedTimezones(response.data)
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

/** 保存账号时区，并同步当前页面展示。 */
async function saveTimezone() {
  if (saving.value || initializing.value) {
    return
  }
  saving.value = true
  saveError.value = ''
  const preference = followDevice.value ? 'auto' : selectedZone.value
  try {
    await updateUserTimezone(preference)
    userStore.applyTimezone(preference)
    now.value = new Date()
    proxy.$modal.showToast(t('mobile:timezone.saved'))
  } catch (error) {
    saveError.value = error.message || t('mobile:actions.saveFailed')
  } finally {
    saving.value = false
  }
}

onLoad(async () => {
  await Promise.all([
    loadOptions(),
    userStore
      .getInfo()
      .then(() => {
        followDevice.value = userStore.timeZone === 'auto'
        selectedZone.value = getDisplayTimezone()
      })
      .catch(() => {
        saveError.value = t('mobile:timezone.profileFailed')
      }),
  ])
  initializing.value = false
})
</script>

<style>
page {
  height: 100%;
  background-color: #ffffff;
}
</style>
