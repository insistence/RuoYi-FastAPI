<template>
  <view class="flex h-full flex-col overflow-y-auto bg-gray-50 p-4 pb-24">
    <view
      v-for="(item, findex) in list"
      :key="findex"
      class="mb-6"
    >
      <view class="mb-3 ml-2 flex items-center text-base font-bold text-gray-800">
        <view :class="['mr-2 text-lg text-blue-500', item.icon]"></view>{{ item.title }}
      </view>
      <view class="overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-gray-100">
        <view
          v-for="(child, zindex) in item.childList"
          :key="zindex"
          class="relative"
          hover-class="bg-gray-50"
          @click="handleText(child)"
        >
          <view class="p-4 text-sm text-gray-600">{{ child.title }}</view>
          <view
            class="h-px w-full bg-gray-100"
            v-if="zindex !== item.childList.length - 1"
          ></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { t } from '@/i18n/adapter'

export default {
  computed: {
    list() {
      return [
        {
          icon: 'i-mdi-github',
          title: t('mobile:help.product'),
          childList: [
            {
              title: t('mobile:help.openSourceQuestion'),
              content: t('mobile:help.openSourceAnswer'),
            },
            {
              title: t('mobile:help.commercialQuestion'),
              content: t('mobile:help.commercialAnswer'),
            },
            {
              title: t('mobile:help.websiteQuestion'),
              content: 'https://vfadmin.insistence.tech',
            },
            {
              title: t('mobile:help.docsQuestion'),
              content: 'https://vfadmin.insistence.tech',
            },
          ],
        },
        {
          icon: 'i-mdi-help-circle-outline',
          title: t('mobile:help.other'),
          childList: [
            {
              title: t('mobile:help.logoutQuestion'),
              content: t('mobile:help.logoutAnswer'),
            },
            {
              title: t('mobile:help.avatarQuestion'),
              content: t('mobile:help.avatarAnswer'),
            },
            {
              title: t('mobile:help.passwordQuestion'),
              content: t('mobile:help.passwordAnswer'),
            },
          ],
        },
      ]
    },
  },
  methods: {
    handleText(item) {
      this.$tab.navigateTo(
        `/pages/common/textview/index?title=${encodeURIComponent(item.title)}&content=${encodeURIComponent(item.content)}`
      )
    },
  },
}
</script>

<style>
page {
  height: 100%;
  background-color: #f9fafb;
}
</style>
