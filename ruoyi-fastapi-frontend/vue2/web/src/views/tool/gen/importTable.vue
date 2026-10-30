<template>
  <!-- 导入表 -->
  <el-dialog
    :title="$t('tool:messages.importTables')"
    :visible.sync="visible"
    width="800px"
    top="5vh"
    append-to-body
  >
    <el-form
      :validate-on-rule-change="false"
      :model="queryParams"
      ref="queryForm"
      size="small"
      :inline="true"
    >
      <el-form-item
        :label="$t('tool:datasource.title')"
        prop="dataSourceName"
        required
      >
        <el-select
          v-model="queryParams.dataSourceName"
          :placeholder="$t('tool:datasource.select')"
          filterable
          style="width: 220px"
          @change="handleSourceChange"
        >
          <el-option
            v-for="source in dataSources"
            :key="source.name"
            :label="source.name + '（' + source.dbType + '）'"
            :value="source.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('tool:gen.tableName')"
        prop="tableName"
      >
        <el-input
          v-model="queryParams.tableName"
          :placeholder="$t('tool:messages.enterTableName')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('tool:gen.tableComment')"
        prop="tableComment"
      >
        <el-input
          v-model="queryParams.tableComment"
          :placeholder="$t('tool:messages.enterTableDescription')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          icon="el-icon-search"
          size="mini"
          @click="handleQuery"
          >{{ $t('common:search') }}</el-button
        >
        <el-button
          icon="el-icon-refresh"
          size="mini"
          @click="resetQuery"
          >{{ $t('common:reset') }}</el-button
        >
      </el-form-item>
    </el-form>
    <el-row>
      <el-table
        @row-click="clickRow"
        ref="table"
        :data="dbTableList"
        @selection-change="handleSelectionChange"
        height="260px"
      >
        <el-table-column
          type="selection"
          width="55"
        ></el-table-column>
        <el-table-column
          prop="tableName"
          :label="$t('tool:gen.tableName')"
          :show-overflow-tooltip="true"
        ></el-table-column>
        <el-table-column
          prop="tableComment"
          :label="$t('tool:gen.tableComment')"
          :show-overflow-tooltip="true"
        ></el-table-column>
        <el-table-column
          prop="createTime"
          :label="$t('common:createdTime')"
        >
          <template slot-scope="scope">{{ parseTime(scope.row.createTime) || '-' }}</template>
        </el-table-column>
        <el-table-column
          prop="updateTime"
          :label="$t('common:updatedTime')"
        ></el-table-column>
      </el-table>
      <pagination
        v-show="total > 0"
        :total="total"
        :page.sync="queryParams.pageNum"
        :limit.sync="queryParams.pageSize"
        @pagination="getList"
      />
    </el-row>
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button
        type="primary"
        @click="handleImportTable"
        >{{ $t('common:confirm') }}</el-button
      >
      <el-button @click="visible = false">{{ $t('common:cancel') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'

import { listDbTable, importTable } from '@/api/tool/gen'
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
      // 选中数组值
      tables: [],
      // 总条数
      total: 0,
      // 表数据
      dbTableList: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        tableName: undefined,
        tableComment: undefined,
        dataSourceName: undefined,
      },
    }
  },
  methods: {
    // 显示弹框
    show() {
      this.visible = true
      this.tables = []
      this.clearSelection()
      this.queryParams.dataSourceName = this.getDefaultSourceName()
      this.getList()
    },
    getDefaultSourceName() {
      const defaultSource =
        this.dataSources.find((source) => source.isDefault) || this.dataSources[0]
      return defaultSource ? defaultSource.name : undefined
    },
    clearSelection() {
      this.$nextTick(() => {
        if (this.$refs.table) {
          this.$refs.table.clearSelection()
        }
      })
    },
    /** 切换数据源后重新查询可导入表 */
    handleSourceChange() {
      this.tables = []
      this.clearSelection()
      this.queryParams.pageNum = 1
      this.getList()
    },
    clickRow(row) {
      this.$refs.table.toggleRowSelection(row)
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.tables = selection.map((item) => item.tableName)
    },
    // 查询表数据
    getList() {
      if (!this.queryParams.dataSourceName) {
        this.dbTableList = []
        this.total = 0
        return
      }
      listDbTable(this.queryParams).then((res) => {
        if (res.code === 200) {
          this.dbTableList = res.rows
          this.total = res.total
        }
      })
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm('queryForm')
      this.queryParams.dataSourceName = this.getDefaultSourceName()
      this.handleQuery()
    },
    /** 导入按钮操作 */
    handleImportTable() {
      const tableNames = this.tables.join(',')
      if (tableNames == '') {
        this.$modal.msgError(t('tool:messages.selectTablesToImport'))
        return
      }
      if (!this.queryParams.dataSourceName) {
        this.$modal.msgError(t('tool:datasource.select'))
        return
      }
      importTable({ tables: tableNames, dataSourceName: this.queryParams.dataSourceName }).then(
        (res) => {
          this.$modal.msgSuccess(res.msg)
          if (res.code === 200) {
            this.visible = false
            this.$emit('ok')
          }
        }
      )
    },
  },
}
</script>
