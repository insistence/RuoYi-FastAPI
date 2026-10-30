<template>
  <el-select
    :value="$locale.preference"
    :model-value="$locale.preference"
    :aria-label="$t('common:language')"
    :disabled="busy"
    style="width: 150px"
    @change="choose"
  >
    <el-option
      :value="'auto'"
      :label="$t('common:followDevice')"
    />
    <el-option
      v-for="item in languages"
      :key="item.code"
      :value="item.code"
      :label="item.nativeName"
    />
  </el-select>
</template>
<script>
import { i18n } from '@/i18n'
import { saveLocale } from '@/i18n/preference'

export default {
  name: 'LanguageSelect',
  data: () => ({ busy: false, error: '', languages: i18n.registry.entries }),
  computed: {
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
        this.$message.error(this.$t('common:languageFailed'))
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
