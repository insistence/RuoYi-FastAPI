<template>
  <el-form-item>
    <el-text type="info">{{
      $t('system:translations.sourceHint', { language: sourceLanguage })
    }}</el-text>
  </el-form-item>
  <el-form-item
    v-for="entry in translationLocales"
    :key="entry.code"
    :label="$t('system:translations.label', { language: entry.nativeName })"
    label-width="auto"
  >
    <el-input
      :model-value="valueFor(entry.code)"
      :placeholder="$t('system:translations.optional')"
      clearable
      @update:model-value="update(entry.code, $event)"
    />
  </el-form-item>
</template>

<script setup>
import { computed } from 'vue'
import { updateTranslationPatch } from '@/i18n/names.mjs'
import { meta } from '@/i18n/registry'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  original: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])
const sourceLanguage =
  meta.locales.find((entry) => entry.code === meta.sourceLocale)?.nativeName || meta.sourceLocale
const translationLocales = computed(() =>
  meta.locales.filter((entry) => entry.enabled && entry.code !== meta.sourceLocale)
)

function valueFor(code) {
  return Object.prototype.hasOwnProperty.call(props.modelValue || {}, code)
    ? props.modelValue[code] || ''
    : props.original?.[code] || ''
}

function update(code, value) {
  emit('update:modelValue', updateTranslationPatch(props.modelValue, props.original, code, value))
}
</script>
