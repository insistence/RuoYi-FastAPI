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
        prop="dictType"
      >
        <el-select v-model="queryParams.dictType">
          <el-option
            v-for="item in typeOptions"
            :key="item.dictId"
            :label="$resolveText(item.dictName, item.dictNameI18n)"
            :value="item.dictType"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('system:dict.dictionaryLabel')"
        prop="dictLabel"
      >
        <el-input
          v-model="queryParams.dictLabel"
          :placeholder="$t('system:dict.enterADictionaryLabel')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('common:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('system:dict.dataStatus')"
          clearable
        >
          <el-option
            v-for="dict in dict.type.sys_normal_disable"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
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
          type="warning"
          plain
          icon="el-icon-close"
          size="mini"
          @click="handleClose"
          >{{ $t('layout:search.close') }}</el-button
        >
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-loading="loading"
      :data="dataList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('system:dict.dictionaryCode')"
        align="center"
        prop="dictCode"
      />
      <el-table-column
        :label="$t('system:dict.dictionaryLabel')"
        align="center"
        prop="dictLabel"
      >
        <template slot-scope="scope">
          <span
            v-if="
              (scope.row.listClass == '' || scope.row.listClass == 'default') &&
              (scope.row.cssClass == '' || scope.row.cssClass == null)
            "
            >{{ $resolveText(scope.row.dictLabel, scope.row.dictLabelI18n) }}</span
          >
          <el-tag
            v-else
            :type="scope.row.listClass == 'primary' ? '' : scope.row.listClass"
            :class="scope.row.cssClass"
            >{{ $resolveText(scope.row.dictLabel, scope.row.dictLabelI18n) }}</el-tag
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:dict.dictionaryValue')"
        align="center"
        prop="dictValue"
      />
      <el-table-column
        :label="$t('system:dict.dictionarySortOrder')"
        align="center"
        prop="dictSort"
      />
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
        <el-form-item :label="$t('system:dict.type')">
          <el-input
            v-model="form.dictType"
            :disabled="true"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:dict.label')"
          prop="dictLabel"
        >
          <el-input
            v-model="form.dictLabel"
            :placeholder="$t('system:dict.labelPlaceholder')"
          />
        </el-form-item>
        <locale-text-fields
          :value="form.dictLabelI18n"
          :patch="form.dictLabelI18nPatch"
          @input="$set(form, 'dictLabelI18nPatch', $event)"
        />
        <el-form-item
          :label="$t('system:dict.value')"
          prop="dictValue"
        >
          <el-input
            v-model="form.dictValue"
            :placeholder="$t('system:dict.valuePlaceholder')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:dict.cSSClass')"
          prop="cssClass"
        >
          <el-input
            v-model="form.cssClass"
            :placeholder="$t('system:dict.enterACSSClass')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:dept.order')"
          prop="dictSort"
        >
          <el-input-number
            v-model="form.dictSort"
            controls-position="right"
            :min="0"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:dict.listClass')"
          prop="listClass"
        >
          <el-select v-model="form.listClass">
            <el-option
              v-for="item in listClassOptions"
              :key="item.value"
              :label="item.label + '(' + item.value + ')'"
              :value="item.value"
            ></el-option>
          </el-select>
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
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { listData, getData, delData, addData, updateData } from '@/api/system/dict/data'
import { optionselect as getDictOptionselect, getType } from '@/api/system/dict/type'

export default {
  name: 'Data',
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
      dataList: [],
      // 默认字典类型
      defaultDictType: '',
      // 弹出层标题
      titleKey: '',
      // 是否显示弹出层
      open: false,
      // 数据标签回显样式
      listClassOptions: [
        {
          value: 'default',
          get label() {
            return t('layout:size.default')
          },
        },
        {
          value: 'primary',
          get label() {
            return t('system:dict.primary')
          },
        },
        {
          value: 'success',
          get label() {
            return t('common:success')
          },
        },
        {
          value: 'info',
          get label() {
            return t('system:dict.information')
          },
        },
        {
          value: 'warning',
          get label() {
            return t('common:warning')
          },
        },
        {
          value: 'danger',
          get label() {
            return t('system:dict.danger')
          },
        },
      ],
      // 类型数据字典
      typeOptions: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        dictType: undefined,
        dictLabel: undefined,
        status: undefined,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        dictLabel: [
          { required: true, message: () => t('system:dict.labelRequired'), trigger: 'blur' },
        ],
        dictValue: [
          { required: true, message: () => t('system:dict.valueRequired'), trigger: 'blur' },
        ],
        dictSort: [
          { required: true, message: () => t('system:dataOrderIsRequired'), trigger: 'blur' },
        ],
      },
    }
  },
  created() {
    const dictId = this.$route.params && this.$route.params.dictId
    this.getType(dictId)
    this.getTypeList()
  },
  methods: {
    /** 查询字典类型详细 */
    getType(dictId) {
      getType(dictId).then((response) => {
        this.queryParams.dictType = response.data.dictType
        this.defaultDictType = response.data.dictType
        this.getList()
      })
    },
    /** 查询字典类型列表 */
    getTypeList() {
      getDictOptionselect().then((response) => {
        this.typeOptions = response.data
      })
    },
    /** 查询字典数据列表 */
    getList() {
      this.loading = true
      listData(this.queryParams).then((response) => {
        this.dataList = response.rows
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
        dictCode: undefined,
        dictLabel: undefined,
        dictValue: undefined,
        cssClass: undefined,
        listClass: 'default',
        dictSort: 0,
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
    /** 返回按钮操作 */
    handleClose() {
      const obj = { path: '/system/dict' }
      this.$tab.closeOpenPage(obj)
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm('queryForm')
      this.queryParams.dictType = this.defaultDictType
      this.handleQuery()
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset()
      this.open = true
      this.titleKey = 'system:dict.addData'
      this.form.dictType = this.queryParams.dictType
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map((item) => item.dictCode)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      const dictCode = row.dictCode || this.ids
      getData(dictCode).then((response) => {
        this.form = response.data
        this.open = true
        this.titleKey = 'system:dict.editData'
      })
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          if (this.form.dictCode != undefined) {
            updateData(this.form).then(() => {
              this.$store.dispatch('dict/removeDict', this.queryParams.dictType)
              this.$modal.msgSuccess(t('common:updateSuccess'))
              this.open = false
              this.getList()
            })
          } else {
            addData(this.form).then(() => {
              this.$store.dispatch('dict/removeDict', this.queryParams.dictType)
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
      const dictCodes = row.dictCode || this.ids
      this.$modal
        .confirm(
          t('system:confirmation.deleteDictionaryEntriesWithCodesValue', { value0: dictCodes })
        )
        .then(function () {
          return delData(dictCodes)
        })
        .then(() => {
          this.getList()
          this.$modal.msgSuccess(t('common:deleteSuccess'))
          this.$store.dispatch('dict/removeDict', this.queryParams.dictType)
        })
        .catch(() => {})
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download(
        'system/dict/data/export',
        {
          ...this.queryParams,
        },
        `data_${new Date().getTime()}.xlsx`
      )
    },
  },
}
</script>
