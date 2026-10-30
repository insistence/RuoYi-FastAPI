<template>
  <picker
    :range="options"
    range-key="label"
    :value="selected"
    :disabled="busy"
    @change="choose(options[Number($event.detail.value)].value)"
  >
    <view style="padding: 12px 16px">{{ $t('common:language') }}: {{ currentLabel }}</view>
  </picker>
</template>
<script>
import { i18n } from '@/i18n'
import { saveLocale } from '@/i18n/preference'

export default {
  name: 'LanguageSelect',
  data: () => ({ busy: false, error: '', languages: i18n.registry.entries }),
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
    async choose(value) {
      if (this.busy) return
      this.busy = true
      try {
        await saveLocale(value)
      } catch {
        uni.showToast({ title: this.$t('common:languageFailed'), icon: 'none' })
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
