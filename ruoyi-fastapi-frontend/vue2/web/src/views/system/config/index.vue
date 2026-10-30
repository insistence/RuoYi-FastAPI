<template>
  <div class="app-container">
    <el-form
      :validate-on-rule-change="false"
      :model="queryParams"
      ref="queryForm"
      size="small"
      :inline="true"
      v-show="showSearch"
      label-width="68px"
    >
      <el-form-item
        :label="$t('system:config.name')"
        prop="configName"
      >
        <el-input
          v-model="queryParams.configName"
          :placeholder="$t('system:enterParameterName')"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:config.key')"
        prop="configKey"
      >
        <el-input
          v-model="queryParams.configKey"
          :placeholder="$t('system:enterParameterKey')"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:config.builtIn')"
        prop="configType"
      >
        <el-select
          v-model="queryParams.configType"
          :placeholder="$t('system:config.builtIn')"
          clearable
        >
          <el-option
            v-for="dict in dict.type.sys_yes_no"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="$t('common:createdTime')">
        <el-date-picker
          v-model="dateRange"
          style="width: 240px"
          value-format="yyyy-MM-dd"
          type="daterange"
          :aria-label="$t('common:time.dateRangeInZone', { zone: getDisplayTimezone() })"
          range-separator="-"
          :start-placeholder="$t('common:startDate')"
          :end-placeholder="$t('common:endDate')"
        ></el-date-picker>
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

    <el-row
      :gutter="10"
      class="mb8"
    >
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="el-icon-plus"
          size="mini"
          @click="handleAdd"
          v-hasPermi="['system:config:add']"
          >{{ $t('common:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="el-icon-edit"
          size="mini"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['system:config:edit']"
          >{{ $t('common:edit') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="el-icon-delete"
          size="mini"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['system:config:remove']"
          >{{ $t('common:delete') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="el-icon-download"
          size="mini"
          @click="handleExport"
          v-hasPermi="['system:config:export']"
          >{{ $t('common:export') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="el-icon-refresh"
          size="mini"
          @click="handleRefreshCache"
          v-hasPermi="['system:config:remove']"
          >{{ $t('system:config.refreshCache') }}</el-button
        >
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-loading="loading"
      :data="configList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('system:parameterID')"
        align="center"
        prop="configId"
      />
      <el-table-column
        :label="$t('system:config.name')"
        align="center"
        prop="configName"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:config.key')"
        align="center"
        prop="configKey"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:config.value')"
        align="center"
        prop="configValue"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:config.builtIn')"
        align="center"
        prop="configType"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.sys_yes_no"
            :value="scope.row.configType"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('common:remark')"
        align="center"
        prop="remark"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('common:createdTime')"
        align="center"
        prop="createTime"
        width="180"
      >
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('common:actions')"
        align="center"
        class-name="small-padding fixed-width"
      >
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:config:edit']"
            >{{ $t('common:edit') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:config:remove']"
            >{{ $t('common:delete') }}</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="queryParams.pageNum"
      :limit.sync="queryParams.pageSize"
      @pagination="getList"
    />

    <!-- 添加或修改参数配置对话框 -->
    <el-dialog
      :title="$t(titleKey)"
      :visible.sync="open"
      width="500px"
      append-to-body
    >
      <el-form
        :validate-on-rule-change="false"
        ref="form"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <el-form-item
          :label="$t('system:config.name')"
          prop="configName"
        >
          <el-input
            v-model="form.configName"
            :placeholder="$t('system:enterParameterName')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:config.key')"
          prop="configKey"
        >
          <el-input
            v-model="form.configKey"
            :placeholder="$t('system:enterParameterKey')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:config.value')"
          prop="configValue"
        >
          <el-input
            v-model="form.configValue"
            type="textarea"
            :placeholder="$t('system:enterParameterValue')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:config.builtIn')"
          prop="configType"
        >
          <el-radio-group v-model="form.configType">
            <el-radio
              v-for="dict in dict.type.sys_yes_no"
              :key="dict.value"
              :label="dict.value"
              >{{ dict.label }}</el-radio
            >
          </el-radio-group>
        </el-form-item>
        <el-form-item
          :label="$t('common:remark')"
          prop="remark"
        >
          <el-input
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('common:contentPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <div
        slot="footer"
        class="dialog-footer"
      >
        <el-button
          type="primary"
          @click="submitForm"
          >{{ $t('common:confirm') }}</el-button
        >
        <el-button @click="cancel">{{ $t('common:cancel') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getDisplayTimezone } from '@/utils/time'
import {
  listConfig,
  getConfig,
  delConfig,
  addConfig,
  updateConfig,
  refreshCache,
} from '@/api/system/config'

export default {
  name: 'Config',
  dicts: ['sys_yes_no'],
  data() {
    return {
      // 遮罩层
      loading: true,
      // 选中数组
      ids: [],
      // 非单个禁用
      single: true,
      // 非多个禁用
      multiple: true,
      // 显示搜索条件
      showSearch: true,
      // 总条数
      total: 0,
      // 参数表格数据
      configList: [],
      // 弹出层标题
      titleKey: '',
      // 是否显示弹出层
      open: false,
      // 日期范围
      dateRange: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        configName: undefined,
        configKey: undefined,
        configType: undefined,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        configName: [
          { required: true, message: () => t('system:parameterNameIsRequired'), trigger: 'blur' },
        ],
        configKey: [
          { required: true, message: () => t('system:parameterKeyIsRequired'), trigger: 'blur' },
        ],
        configValue: [
          { required: true, message: () => t('system:parameterValueIsRequired'), trigger: 'blur' },
        ],
      },
    }
  },
  created() {
    // 时区切换后重新解释日期筛选，保留当前表单。
    this.$watch(getDisplayTimezone, () => {
      if (this.dateRange && this.dateRange.length) this.handleQuery()
    })
    this.getList()
  },
  methods: {
    getDisplayTimezone,
    /** 查询参数列表 */
    getList() {
      this.loading = true
      listConfig(this.addDateRange(this.queryParams, this.dateRange)).then((response) => {
        this.configList = response.rows
        this.total = response.total
        this.loading = false
      })
    },
    // 取消按钮
    cancel() {
      this.open = false
      this.reset()
    },
    // 表单重置
    reset() {
      this.form = {
        configId: undefined,
        configName: undefined,
        configKey: undefined,
        configValue: undefined,
        configType: 'Y',
        remark: undefined,
      }
      this.resetForm('form')
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.dateRange = []
      this.resetForm('queryForm')
      this.handleQuery()
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset()
      this.open = true
      this.titleKey = 'system:addParameter'
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map((item) => item.configId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      const configId = row.configId || this.ids
      getConfig(configId).then((response) => {
        this.form = response.data
        this.open = true
        this.titleKey = 'system:editParameter'
      })
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          if (this.form.configId != undefined) {
            updateConfig(this.form).then(() => {
              this.$modal.msgSuccess(t('common:updateSuccess'))
              this.open = false
              this.getList()
            })
          } else {
            addConfig(this.form).then(() => {
              this.$modal.msgSuccess(t('common:addSuccess'))
              this.open = false
              this.getList()
            })
          }
        }
      })
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      const configIds = row.configId || this.ids
      this.$modal
        .confirm(t('system:confirmation.deleteParametersWithIDsValue', { value0: configIds }))
        .then(function () {
          return delConfig(configIds)
        })
        .then(() => {
          this.getList()
          this.$modal.msgSuccess(t('common:deleteSuccess'))
        })
        .catch(() => {})
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download(
        'system/config/export',
        {
          ...this.queryParams,
        },
        `config_${new Date().getTime()}.xlsx`
      )
    },
    /** 刷新缓存按钮操作 */
    handleRefreshCache() {
      refreshCache().then(() => {
        this.$modal.msgSuccess(t('system:refreshedSuccessfully'))
      })
    },
  },
}
</script>
