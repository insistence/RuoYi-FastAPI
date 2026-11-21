<template>
  <!-- 创建表 -->
  <el-dialog
    :title="$t('tools:createTable')"
    v-model="visible"
    width="800px"
    top="5vh"
    append-to-body
  >
    <el-form label-width="80px">
      <el-form-item
        :label="$t('tools:dataSource')"
        required
      >
        <el-select
          v-model="dataSourceName"
          :placeholder="$t('tools:selectADataSource')"
          filterable
          style="width: 260px"
        >
          <el-option
            v-for="source in props.dataSources"
            :key="source.name"
            :label="source.name + '（' + source.dbType + '）'"
            :value="source.name"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <span>{{ $t('tools:cREATETABLEStatementsMultipleStatementsSupported') }}</span>
    <el-input
      type="textarea"
      :rows="10"
      :placeholder="$t('tools:enterText')"
      v-model="content"
    ></el-input>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          type="primary"
          @click="handleImportTable"
          >{{ $t('system:confirm') }}</el-button
        >
        <el-button @click="visible = false">{{ $t('system:cancel') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { createTable } from '@/api/tool/gen'

const visible = ref(false)
const content = ref('')
const dataSourceName = ref('')
const { proxy } = getCurrentInstance()
const props = defineProps({
  dataSources: {
    type: Array,
    default: () => [],
  },
})
const emit = defineEmits(['ok'])

/** 显示弹框 */
function show() {
  visible.value = true
  const defaultSource = props.dataSources.find((source) => source.isDefault) || props.dataSources[0]
  dataSourceName.value = defaultSource?.name || ''
}

/** 导入按钮操作 */
function handleImportTable() {
  if (content.value === '') {
    proxy.$modal.msgError(t('tools:enterCREATETABLEStatements'))
    return
  }
  if (!dataSourceName.value) {
    proxy.$modal.msgError(t('tools:selectADataSource'))
    return
  }
  createTable({ sql: content.value, dataSourceName: dataSourceName.value }).then((res) => {
    proxy.$modal.msgSuccess(res.msg)
    if (res.code === 200) {
      visible.value = false
      emit('ok')
    }
  })
}

defineExpose({
  show,
})
</script>
