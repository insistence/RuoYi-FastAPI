<template>
  <div
    v-if="locales.length"
    class="translation-fields"
  >
    <el-button
      type="text"
      :aria-expanded="expanded.toString()"
      @click="expanded = !expanded"
    >
      {{
        expanded
          ? $t('common:translations.hide')
          : hasTranslation
            ? $t('common:translations.show')
            : $t('common:translations.add')
      }}
    </el-button>
    <div
      v-if="expanded"
      class="translation-inputs"
    >
      <el-input
        v-for="entry in locales"
        :key="entry.code"
        :value="fieldValue(entry.code)"
        :label="$t('common:translations.locale', { locale: entry.nativeName })"
        :maxlength="maxlength"
        :validate-event="false"
        show-word-limit
        clearable
        @input="update(entry.code, $event)"
      >
        <template slot="prepend">{{ entry.nativeName }}</template>
      </el-input>
      <small class="translation-hint">{{ $t('common:translations.fallback') }}</small>
    </div>
  </div>
</template>

<script>
import { meta } from '@/i18n/registry'
import { DATA_SOURCE_LOCALE } from '@/i18n/runtime.mjs'

const locales = meta.locales.filter((entry) => entry.enabled && entry.code !== DATA_SOURCE_LOCALE)

export default {
  name: 'LocaleTextFields',
  props: {
    value: { type: Object, default: () => ({}) },
    patch: { type: Object, default: () => ({}) },
    maxlength: { type: Number, required: true },
  },
  data() {
    return { locales, expanded: locales.some((entry) => this.value?.[entry.code]) }
  },
  computed: {
    hasTranslation() {
      return this.locales.some((entry) => this.fieldValue(entry.code))
    },
  },
  methods: {
    fieldValue(locale) {
      return Object.prototype.hasOwnProperty.call(this.patch, locale)
        ? this.patch[locale] || ''
        : this.value?.[locale] || ''
    },
    update(locale, value) {
      const next = { ...this.patch }
      const translation = value.trim() ? value : ''
      if (translation === (this.value?.[locale] || '')) delete next[locale]
      else next[locale] = translation || null
      this.$emit('input', next)
    },
  },
}
</script>

<style scoped>
.translation-fields {
  width: 100%;
  line-height: 1.5;
}
.translation-fields .el-button {
  min-height: 28px;
  padding: 0;
}
.translation-inputs {
  display: grid;
  gap: 6px;
}
.translation-hint {
  color: #909399;
  font-size: 12px;
}
</style>
