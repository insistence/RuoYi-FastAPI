<template>
  <!-- 创建表 -->
  <el-dialog
    :title="$t('tool:messages.createTable')"
    :visible.sync="visible"
    width="800px"
    top="5vh"
    append-to-body
  >
    <el-form
      :validate-on-rule-change="false"
      label-width="80px"
    >
      <el-form-item
        :label="$t('tool:datasource.title')"
        required
      >
        <el-select
          v-model="dataSourceName"
          :placeholder="$t('tool:datasource.select')"
          filterable
          style="width: 260px"
        >
          <el-option
            v-for="source in dataSources"
            :key="source.name"
            :label="source.name + '（' + source.dbType + '）'"
            :value="source.name"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <span>{{ $t('tool:messages.cREATETABLEStatementsMultipleStatementsSupported') }}</span>
    <el-input
      type="textarea"
      :rows="10"
      :placeholder="$t('tool:messages.enterText')"
      v-model="content"
    ></el-input>
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button
        type="primary"
        @click="handleCreateTable"
        >{{ $t('common:confirm') }}</el-button
      >
      <el-button @click="visible = false">{{ $t('common:cancel') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'

import { createTable } from '@/api/tool/gen'
export default {
  props: {
    dataSources: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      // 遮罩层
      visible: false,
      // 文本内容
      content: '',
      // 目标数据源
      dataSourceName: '',
    }
  },
  methods: {
    // 显示弹框
    show() {
      this.visible = true
      const defaultSource =
        this.dataSources.find((source) => source.isDefault) || this.dataSources[0]
      this.dataSourceName = defaultSource ? defaultSource.name : ''
    },
    /** 创建按钮操作 */
    handleCreateTable() {
      if (this.content === '') {
        this.$modal.msgError(t('tool:messages.enterCREATETABLEStatements'))
        return
      }
      if (!this.dataSourceName) {
        this.$modal.msgError(t('tool:datasource.select'))
        return
      }
      createTable({ sql: this.content, dataSourceName: this.dataSourceName }).then((res) => {
        this.$modal.msgSuccess(res.msg)
        if (res.code === 200) {
          this.visible = false
          this.$emit('ok')
        }
      })
    },
  },
}
</script>
