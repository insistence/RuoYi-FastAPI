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
      :aria-label="$t('common:language')"
      :title="$t('common:language')"
      :disabled="busy"
      @keydown.enter.prevent
    >
      <svg-icon icon-class="international" />
    </button>
    <el-dropdown-menu slot="dropdown">
      <el-dropdown-item
        v-for="item in options"
        :key="item.value"
        class="language-option"
        :command="item.value"
        :aria-current="item.value === $locale.preference ? 'true' : undefined"
      >
        {{ item.label }}
        <i
          v-if="item.value === $locale.preference"
          class="el-icon-check"
          aria-hidden="true"
        />
      </el-dropdown-item>
    </el-dropdown-menu>
  </el-dropdown>
</template>

<script>
import { i18n } from '@/i18n'
import { saveLocale } from '@/i18n/preference'

export default {
  name: 'LanguageSelect',
  data() {
    return {
      busy: false,
    }
  },
  computed: {
    options() {
      return [
        { value: 'auto', label: this.$t('common:followDevice') },
        ...i18n.registry.entries.map((item) => ({ value: item.code, label: item.nativeName })),
      ]
    },
  },
  methods: {
    async handleLanguageChange(value) {
      if (this.busy || (i18n.accountId !== null && value === this.$locale.preference)) return
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

<style lang="scss" scoped>
.language-select {
  display: inline-flex;
  flex-shrink: 0;
  color: inherit;
}

.language-option {
  display: flex;
  align-items: center;
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
    background: rgba(64, 158, 255, 0.1);
    color: #409eff;
  }
}
</style>
