<template>
  <el-form
    class="timezone-settings"
    label-position="top"
    @submit.prevent="save"
  >
    <el-form-item :label="$t('system:timeDisplayMode')">
      <el-radio-group
        v-model="mode"
        :disabled="saving"
      >
        <el-radio value="auto">{{ $t('system:followDeviceAutomatically') }}</el-radio>
        <el-radio value="custom">{{ $t('system:chooseManually') }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item
      v-if="mode === 'custom'"
      :label="$t('system:displayTimeZone')"
      :error="fieldError"
    >
      <el-select
        v-model="selectedZone"
        filterable
        :disabled="saving"
        :loading="loading"
        :placeholder="$t('system:searchTimeZonesEGAsiaShanghai')"
        :aria-label="$t('system:displayTimeZone')"
        class="timezone-settings__select"
        @change="fieldError = ''"
      >
        <el-option
          v-for="zone in timezones"
          :key="zone"
          :label="zone"
          :value="zone"
        />
      </el-select>
    </el-form-item>
    <el-alert
      v-if="loadError"
      type="warning"
      :closable="false"
      class="timezone-settings__notice"
    >
      <template #title>
        {{ $t('system:couldNotLoadTimeZonesYouCanStillUseYour')
        }}<el-button
          link
          type="primary"
          :loading="loading"
          @click="loadOptions"
          >{{ $t('common:retry') }}</el-button
        >
      </template>
    </el-alert>
    <div
      class="timezone-settings__preview"
      aria-live="polite"
    >
      <div>
        {{ $t('system:previewTimeZone') }}<strong>{{ previewZone }}</strong>
      </div>
      <div>{{ $t('system:timePreview') }}{{ previewTime }}</div>
      <div
        v-if="mode === 'auto' && !deviceZone"
        class="timezone-settings__fallback"
      >
        {{ $t('system:theDeviceTimeZoneCouldNotBeDetectedTheSystem') }}
      </div>
    </div>
    <p class="timezone-settings__hint">
      {{ $t('system:usedForDisplayedTimesDateFiltersAndExportsScheduledTasks') }}
    </p>
    <p
      v-if="saveError"
      role="alert"
      class="timezone-settings__error"
    >
      {{ saveError }}
    </p>
    <el-button
      type="primary"
      native-type="submit"
      :loading="saving"
      >{{ $t('system:saveTimeZone') }}</el-button
    >
  </el-form>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { getTimezoneOptions, updateUserTimezone } from '@/api/system/user'
import useUserStore from '@/store/modules/user'
import {
  formatBusinessTime,
  getBusinessTimezone,
  getDeviceTimezone,
  getDisplayTimezone,
  getSupportedTimezones,
} from '@/utils/time'

const props = defineProps({ user: Object })
const emit = defineEmits(['saved'])
const { proxy } = getCurrentInstance()
const userStore = useUserStore()
const mode = ref(userStore.timeZone === 'auto' ? 'auto' : 'custom')
const selectedZone = ref(getDisplayTimezone())
const timezones = ref(getSupportedTimezones())
const loading = ref(false)
const loadError = ref(false)
const saving = ref(false)
const saveError = ref('')
const fieldError = ref('')
const now = ref(new Date())
const deviceZone = computed(getDeviceTimezone)
const previewZone = computed(() =>
  mode.value === 'auto' ? deviceZone.value || getBusinessTimezone() : selectedZone.value
)
const previewTime = computed(() =>
  formatBusinessTime(now.value, 'YYYY-MM-DD HH:mm:ss', previewZone.value)
)

watch(
  () => props.user?.timeZone,
  (value) => {
    if (!value) {
      return
    }
    mode.value = value === 'auto' ? 'auto' : 'custom'
    selectedZone.value = value === 'auto' ? getDisplayTimezone() : value
  }
)

/** 加载当前浏览器支持的时区选项。 */
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
async function save() {
  if (saving.value) {
    return
  }
  if (mode.value === 'custom' && !selectedZone.value) {
    fieldError.value = t('system:selectDisplayTimeZone')
    return
  }
  saving.value = true
  saveError.value = ''
  const preference = mode.value === 'auto' ? 'auto' : selectedZone.value
  try {
    await updateUserTimezone(preference)
    userStore.applyTimezone(preference)
    emit('saved', preference)
    now.value = new Date()
    proxy.$modal.msgSuccess(t('system:timeZoneSaved'))
  } catch (error) {
    saveError.value = error.message || t('system:couldNotSavePleaseTryAgain')
  } finally {
    saving.value = false
  }
}

onMounted(loadOptions)
</script>

<style scoped>
.timezone-settings {
  max-width: 560px;
}
.timezone-settings__select {
  width: 100%;
}
.timezone-settings__preview {
  padding: 12px 16px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.timezone-settings__hint,
.timezone-settings__fallback {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}
.timezone-settings__notice {
  margin-bottom: 16px;
}
.timezone-settings__error {
  color: var(--el-color-danger);
}
</style>
