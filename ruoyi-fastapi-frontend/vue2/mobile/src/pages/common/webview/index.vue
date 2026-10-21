<template>
  <view v-if="params.url">
    <web-view
      :webview-styles="webviewStyles"
      :src="`${params.url}`"
    ></web-view>
  </view>
</template>

<script>
import { resolveWebviewUrl } from '@/utils/webview'
export default {
  data() {
    return {
      params: {},
      webviewStyles: {
        progress: {
          color: '#FF3333',
        },
      },
    }
  },
  props: {
    src: {
      type: [String],
      default: null,
    },
  },
  onLoad(event) {
    this.params = { ...event, url: resolveWebviewUrl(event.url) }
    if (event.title) {
      uni.setNavigationBarTitle({
        title: event.title,
      })
    }
  },
}
</script>
