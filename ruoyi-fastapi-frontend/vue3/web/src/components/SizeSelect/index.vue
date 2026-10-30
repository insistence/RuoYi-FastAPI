<template>
  <div>
    <el-dropdown
      trigger="click"
      @command="handleSetSize"
    >
      <div class="size-icon--style">
        <svg-icon
          class-name="size-icon"
          icon-class="size"
        />
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="item of sizeOptions"
            :key="item.value"
            :disabled="size === item.value"
            :command="item.value"
          >
            {{ item.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import useAppStore from '@/store/modules/app'

const appStore = useAppStore()
const size = computed(() => appStore.size)
const { proxy } = getCurrentInstance()
const sizeOptions = computed(() => [
  { label: t('layout:size.large'), value: 'large' },
  { label: t('layout:size.default'), value: 'default' },
  { label: t('layout:size.small'), value: 'small' },
])

function handleSetSize(size) {
  proxy.$modal.loading(t('layout:size.applying'))
  appStore.setSize(size)
  setTimeout('window.location.reload()', 1000)
}
</script>

<style lang="scss" scoped>
.size-icon--style {
  font-size: 18px;
  line-height: 50px;
  padding-right: 7px;
}
</style>
