<template>
  <picker
    :range="options"
    range-key="label"
    :value="selected"
    :disabled="busy"
    @change="choose"
  >
    <button
      class="after:border-0"
      :class="
        settings
          ? 'flex w-full items-center justify-between gap-3 rounded-none border-b border-gray-100 bg-white px-5 py-4 leading-normal active:bg-gray-50'
          : 'flex h-11 items-center justify-center gap-1 rounded-full bg-transparent px-2 text-gray-600 active:bg-white/60'
      "
      :aria-label="$t('common:language') + ' · ' + currentLabel"
      :disabled="busy"
    >
      <view class="flex items-center">
        <view
          class="i-mdi-translate text-xl text-gray-600"
          aria-hidden="true"
        ></view>
        <text
          v-if="settings"
          class="ml-3 text-base text-gray-800"
          >{{ $t('common:language') }}</text
        >
      </view>
      <view class="flex items-center gap-1">
        <text
          v-if="settings"
          class="text-sm text-gray-500"
          >{{ currentLabel }}</text
        >
        <view
          :class="
            settings ? 'i-mdi-chevron-right text-base text-gray-400' : 'i-mdi-chevron-down text-sm'
          "
          aria-hidden="true"
        ></view>
      </view>
    </button>
  </picker>
</template>
<script>
import { i18n } from '@/i18n'
import { saveLocale } from '@/i18n/preference'

export default {
  name: 'LanguageSelect',
  props: {
    settings: Boolean,
  },
  data: () => ({ busy: false, languages: i18n.registry.entries }),
  computed: {
    currentLabel() {
      return (
        this.options.find((item) => item.value === this.$locale.preference)?.label ||
        this.$locale.preference
      )
    },
    options() {
      return [
        { value: 'auto', label: this.$t('common:followDevice') },
        ...this.languages.map((item) => ({ value: item.code, label: item.nativeName })),
      ]
    },
    selected() {
      return Math.max(
        0,
        this.options.findIndex((item) => item.value === this.$locale.preference)
      )
    },
  },
  methods: {
    async choose(event) {
      if (this.busy) return
      this.busy = true
      try {
        await saveLocale(this.options[event.detail.value].value)
      } catch {
        uni.showToast({
          title: this.$t('common:languageFailed'),
          icon: 'none',
        })
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
