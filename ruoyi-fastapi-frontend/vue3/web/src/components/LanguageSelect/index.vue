<template>
  <el-dropdown
    class="language-select"
    trigger="click"
    placement="bottom-end"
    @command="handleLanguageChange"
  >
    <button
      type="button"
      class="language-trigger"
      :aria-label="t('common:language')"
      :title="t('common:language')"
      :disabled="busy"
    >
      <svg-icon icon-class="international" />
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="item in options"
          :key="item.value"
          class="language-option"
          :command="item.value"
          :aria-current="item.value === localeState.preference ? 'true' : undefined"
        >
          {{ item.label }}
          <el-icon v-if="item.value === localeState.preference"><Check /></el-icon>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup name="LanguageSelect">
import { i18n } from '@/i18n'
import { localeState, t } from '@/i18n/adapter'
import { saveLocale } from '@/i18n/preference'

const { proxy } = getCurrentInstance()
const busy = ref(false)
const options = computed(() => [
  { value: 'auto', label: t('common:followDevice') },
  ...i18n.registry.entries.map((item) => ({ value: item.code, label: item.nativeName })),
])

async function handleLanguageChange(value) {
  if (busy.value || value === localeState.preference) return
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

<style lang="scss" scoped>
.language-select {
  display: inline-flex;
  flex-shrink: 0;
  color: inherit;
}

.language-option {
  justify-content: space-between;
  gap: 12px;
}

.language-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 18px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }
}
</style>
