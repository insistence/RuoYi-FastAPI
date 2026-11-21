<template>
  <!-- <i-frame :src="url" /> -->
  <div>
    <div>{{ $t('monitor:messages.dataMonitoring') }}</div>
  </div>
</template>
<script>
import iFrame from '@/components/iFrame/index'
export default {
  name: 'Druid',
  components: { iFrame },
  data() {
    return {
      url: process.env.VUE_APP_BASE_API + '/druid/login.html',
    }
  },
}
</script>
