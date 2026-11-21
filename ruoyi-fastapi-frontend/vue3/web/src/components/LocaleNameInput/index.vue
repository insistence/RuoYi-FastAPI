<template>
  <div
    v-if="locales.length"
    class="translation-fields"
  >
    <el-button
      link
      type="primary"
      :aria-expanded="expanded.toString()"
      @click="expanded = !expanded"
    >
      {{
        expanded
          ? $t('system:translations.hide')
          : hasTranslation
            ? $t('system:translations.show')
            : $t('system:translations.add')
      }}
    </el-button>
    <div
      v-if="expanded"
      class="translation-inputs"
    >
      <el-input
        v-for="entry in locales"
        :key="entry.code"
        :model-value="fieldValue(entry.code)"
        :aria-label="$t('system:translations.label', { language: entry.nativeName })"
        :maxlength="maxlength"
        :validate-event="false"
        show-word-limit
        clearable
        @update:model-value="update(entry.code, $event)"
      >
        <template #prepend>{{ entry.nativeName }}</template>
      </el-input>
      <small class="translation-hint">{{ $t('system:translations.optional') }}</small>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { updateTranslationPatch } from '@/i18n/names.mjs'
import { meta } from '@/i18n/registry'
import { DATA_SOURCE_LOCALE } from '@/i18n/runtime.mjs'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  original: { type: Object, default: () => ({}) },
  maxlength: { type: Number, required: true },
})
const emit = defineEmits(['update:modelValue'])
const locales = meta.locales.filter((entry) => entry.enabled && entry.code !== DATA_SOURCE_LOCALE)
const hasTranslation = computed(() => locales.some((entry) => fieldValue(entry.code)))
const expanded = ref(locales.some((entry) => props.original?.[entry.code]))

function fieldValue(locale) {
  return Object.prototype.hasOwnProperty.call(props.modelValue || {}, locale)
    ? props.modelValue[locale] || ''
    : props.original?.[locale] || ''
}

function update(locale, value) {
  emit('update:modelValue', updateTranslationPatch(props.modelValue, props.original, locale, value))
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
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
