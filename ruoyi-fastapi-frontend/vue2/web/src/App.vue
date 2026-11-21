<template>
  <div id="app">
    <a-config-provider :locale="componentLocale.ant"><router-view /></a-config-provider>
    <theme-picker />
  </div>
</template>

<script>
import { componentLocales } from '@/i18n/components'
import { localeState, resolveRouteTitle } from '@/i18n/adapter'
import { ConfigProvider as AConfigProvider } from 'ant-design-vue'

import { refreshDeviceTimezone } from '@/utils/time'
import ThemePicker from '@/components/ThemePicker'

export default {
  name: 'App',
  computed: {
    pageTitle() {
      return resolveRouteTitle(this.$route)
    },
    componentLocale() {
      return componentLocales[localeState.locale]
    },
  },
  watch: {
    pageTitle: {
      immediate: true,
      handler(title) {
        this.$store.dispatch('settings/setTitle', title)
      },
    },
  },
  components: { ThemePicker, AConfigProvider },
  mounted() {
    window.addEventListener('focus', refreshDeviceTimezone)
    document.addEventListener('visibilitychange', this.refreshTimezoneOnVisible)
  },
  beforeDestroy() {
    window.removeEventListener('focus', refreshDeviceTimezone)
    document.removeEventListener('visibilitychange', this.refreshTimezoneOnVisible)
  },
  methods: {
    refreshTimezoneOnVisible() {
      if (document.visibilityState === 'visible') refreshDeviceTimezone()
    },
  },
}
</script>
<style scoped>
#app .theme-picker {
  display: none;
}
</style>
