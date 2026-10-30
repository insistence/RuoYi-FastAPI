<template>
  <a-config-provider :locale="componentLocale.ant">
    <el-config-provider :locale="componentLocale.element">
      <router-view />
    </el-config-provider>
  </a-config-provider>
</template>

<script setup>
import { componentLocales } from '@/i18n/components'
import { localeState, resolveRouteTitle } from '@/i18n/adapter'
import { ConfigProvider as AConfigProvider } from 'ant-design-vue'
import { computed } from 'vue'
import useSettingsStore from '@/store/modules/settings'
import { handleThemeStyle } from '@/utils/theme'
import { refreshDeviceTimezone } from '@/utils/time'

const componentLocale = computed(() => componentLocales[localeState.locale])
const route = useRoute()
const settingsStore = useSettingsStore()
watch(
  [() => resolveRouteTitle(route), () => settingsStore.dynamicTitle],
  ([title]) => settingsStore.setTitle(title),
  { immediate: true }
)

/** 页面重新可见时同步设备时区。 */
function refreshTimezoneOnVisible() {
  if (document.visibilityState === 'visible') {
    refreshDeviceTimezone()
  }
}

onMounted(() => {
  window.addEventListener('focus', refreshDeviceTimezone)
  document.addEventListener('visibilitychange', refreshTimezoneOnVisible)
  nextTick(() => {
    // 初始化主题样式
    handleThemeStyle(useSettingsStore().theme)
  })
})
onUnmounted(() => {
  window.removeEventListener('focus', refreshDeviceTimezone)
  document.removeEventListener('visibilitychange', refreshTimezoneOnVisible)
})
</script>
