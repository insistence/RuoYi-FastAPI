<template>
  <el-select
    :model-value="localeState.preference"
    :aria-label="t('common:language')"
    :disabled="busy"
    style="width: 150px"
    @change="handleLanguageChange"
  >
    <el-option
      value="auto"
      :label="t('common:followDevice')"
    />
    <el-option
      v-for="item in languages"
      :key="item.code"
      :value="item.code"
      :label="item.nativeName"
    />
  </el-select>
</template>

<script setup name="LanguageSelect">
import { i18n } from '@/i18n'
import { localeState, t } from '@/i18n/adapter'
import { saveLocale } from '@/i18n/preference'

const { proxy } = getCurrentInstance()
const busy = ref(false)
const languages = i18n.registry.entries

async function handleLanguageChange(value) {
  if (busy.value) return
  busy.value = true
  try {
    await saveLocale(value)
  } catch {
    proxy.$message.error(t('common:languageFailed'))
  } finally {
    busy.value = false
  }
}
</script>
