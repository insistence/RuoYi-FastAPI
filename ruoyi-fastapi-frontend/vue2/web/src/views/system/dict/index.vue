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
        :label="$t('system:dict.name')"
        prop="dictName"
      >
        <el-input
          v-model="queryParams.dictName"
          :placeholder="$t('system:dict.namePlaceholder')"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:dict.type')"
        prop="dictType"
      >
        <el-input
          v-model="queryParams.dictType"
          :placeholder="$t('system:dict.typePlaceholder')"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('common:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('system:dict.dictionaryStatus')"
          clearable
          style="width: 240px"
        >
          <el-option
            v-for="dict in dict.type.sys_normal_disable"
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
          v-hasPermi="['system:dict:add']"
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
          v-hasPermi="['system:dict:edit']"
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
          v-hasPermi="['system:dict:remove']"
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
          v-hasPermi="['system:dict:export']"
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
          v-hasPermi="['system:dict:remove']"
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
      :data="typeList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('system:dict.dictionaryID')"
        align="center"
        prop="dictId"
      />
      <el-table-column
        :label="$t('system:dict.name')"
        align="center"
        prop="dictName"
        :show-overflow-tooltip="true"
      >
        <template slot-scope="scope">{{
          $resolveText(scope.row.dictName, scope.row.dictNameI18n)
        }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('system:dict.type')"
        align="center"
        :show-overflow-tooltip="true"
      >
        <template slot-scope="scope">
          <a
            class="link-type"
            style="cursor: pointer"
            @click="handleViewData(scope.row)"
            >{{ scope.row.dictType }}</a
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('common:status')"
        align="center"
        prop="status"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.sys_normal_disable"
            :value="scope.row.status"
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
            v-hasPermi="['system:dict:edit']"
            >{{ $t('common:edit') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-s-operation"
            @click="handleDataList(scope.row)"
            v-hasPermi="['system:dict:edit']"
            >{{ $t('system:dict.list') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:dict:remove']"
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
          :label="$t('system:dict.name')"
          prop="dictName"
        >
          <el-input
            v-model="form.dictName"
            :placeholder="$t('system:dict.namePlaceholder')"
          />
        </el-form-item>
        <locale-text-fields
          :value="form.dictNameI18n"
          :patch="form.dictNameI18nPatch"
          @input="$set(form, 'dictNameI18nPatch', $event)"
        />
        <el-form-item prop="dictType">
          <el-input
            v-model="form.dictType"
            :placeholder="$t('system:dict.typePlaceholder')"
            maxlength="100"
          />
          <span slot="label">
            <el-tooltip
              :content="$t('system:storageKeyForExampleSysUserSex')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
            {{ $t('system:dict.type') }}
          </span>
        </el-form-item>
        <el-form-item
          :label="$t('common:status')"
          prop="status"
        >
          <el-radio-group v-model="form.status">
            <el-radio
              v-for="dict in dict.type.sys_normal_disable"
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
          ></el-input>
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

    <dict-data-drawer
      :visible.sync="drawerVisible"
      :row="drawerRow"
    />
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getDisplayTimezone } from '@/utils/time'
import DictDataDrawer from './detail'
import {
  listType,
  getType,
  delType,
  addType,
  updateType,
  refreshCache,
} from '@/api/system/dict/type'

export default {
  name: 'Dict',
  components: { DictDataDrawer },
  dicts: ['sys_normal_disable'],
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
      // 字典表格数据
      typeList: [],
      // 弹出层标题
      titleKey: '',
      // 是否显示弹出层
      open: false,
      // 字典数据抽屉状态
      drawerVisible: false,
      // 字典数据信息
      drawerRow: {},
      // 日期范围
      dateRange: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        dictName: undefined,
        dictType: undefined,
        status: undefined,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        dictName: [
          { required: true, message: () => t('system:dict.nameRequired'), trigger: 'blur' },
        ],
        dictType: [
          { required: true, message: () => t('system:dict.typeRequired'), trigger: 'blur' },
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
    /** 查询字典类型列表 */
    getList() {
      this.loading = true
      listType(this.addDateRange(this.queryParams, this.dateRange)).then((response) => {
        this.typeList = response.rows
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
        dictId: undefined,
        dictName: undefined,
        dictType: undefined,
        status: '0',
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
      this.titleKey = 'system:dict.addType'
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map((item) => item.dictId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    /** 字典数据抽屉显示信息 */
    handleViewData(row) {
      this.drawerRow = row
      this.drawerVisible = true
    },
    /** 字典数据列表页面 */
    handleDataList(row) {
      this.$tab.openPage(t('layout:routes.dictData'), '/system/dict-data/index/' + row.dictId)
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      const dictId = row.dictId || this.ids
      getType(dictId).then((response) => {
        this.form = response.data
        this.open = true
        this.titleKey = 'system:dict.editType'
      })
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          if (this.form.dictId != undefined) {
            updateType(this.form).then(() => {
              this.$modal.msgSuccess(t('common:updateSuccess'))
              this.open = false
              this.getList()
            })
          } else {
            addType(this.form).then(() => {
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
      const dictIds = row.dictId || this.ids
      this.$modal
        .confirm(t('system:confirmation.deleteDictionariesWithIDsValue', { value0: dictIds }))
        .then(function () {
          return delType(dictIds)
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
        'system/dict/type/export',
        {
          ...this.queryParams,
        },
        `type_${new Date().getTime()}.xlsx`
      )
    },
    /** 刷新缓存按钮操作 */
    handleRefreshCache() {
      refreshCache().then(() => {
        this.$modal.msgSuccess(t('system:refreshedSuccessfully'))
        this.$store.dispatch('dict/cleanDict')
      })
    },
  },
}
</script>
