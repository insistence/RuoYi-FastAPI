<template>
  <div>
    <el-form-item>
      <span class="text-muted">{{
        $t('common:translations.sourceHint', { locale: sourceLanguage })
      }}</span>
    </el-form-item>
    <el-form-item
      v-for="locale in locales"
      :key="locale.code"
      :label="$t('common:translations.locale', { locale: locale.nativeName })"
    >
      <el-input
        :value="fieldValue(locale.code)"
        :placeholder="$t('common:translations.fallback')"
        clearable
        @input="update(locale.code, $event)"
      />
    </el-form-item>
  </div>
</template>

<script>
import { meta } from '@/i18n/registry'

export default {
  name: 'LocaleTextFields',
  props: {
    value: { type: Object, default: () => ({}) },
    patch: { type: Object, default: () => ({}) },
  },
  computed: {
    sourceLanguage() {
      return (
        meta.locales.find((locale) => locale.code === meta.sourceLocale)?.nativeName ||
        meta.sourceLocale
      )
    },
    locales() {
      return meta.locales.filter((locale) => locale.enabled && locale.code !== meta.sourceLocale)
    },
  },
  methods: {
    fieldValue(locale) {
      return Object.prototype.hasOwnProperty.call(this.patch, locale)
        ? this.patch[locale] || ''
        : this.value?.[locale] || ''
    },
    update(locale, value) {
      // 只发送编辑过的语言；清空显式删除翻译，未编辑的条目交由服务端保留。
      this.$emit('input', { ...this.patch, [locale]: value.trim() ? value : null })
    },
  },
}
</script>
