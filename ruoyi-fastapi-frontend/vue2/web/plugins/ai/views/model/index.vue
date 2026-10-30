<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
    >
      <el-form-item
        :label="$t('plugin.ai:modelCode')"
        prop="modelCode"
      >
        <el-input
          v-model="queryParams.modelCode"
          :placeholder="$t('plugin.ai:enterAModelCode')"
          clearable
          style="width: 200px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('plugin.ai:provider')"
        prop="provider"
      >
        <el-select
          v-model="queryParams.provider"
          :placeholder="$t('plugin.ai:chooseAProvider')"
          clearable
          style="width: 200px"
          @keyup.enter.native="handleQuery"
        >
          <el-option
            v-for="dict in dict.type.ai_provider_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('plugin.ai:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('plugin.ai:modelStatus')"
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
      <el-form-item>
        <el-button
          type="primary"
          icon="el-icon-search"
          @click="handleQuery"
          >{{ $t('plugin.ai:search') }}</el-button
        >
        <el-button
          icon="el-icon-refresh"
          @click="resetQuery"
          >{{ $t('plugin.ai:reset') }}</el-button
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
          @click="handleAdd"
          v-hasPermi="['ai:model:add']"
          >{{ $t('plugin.ai:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="el-icon-edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['ai:model:edit']"
          >{{ $t('plugin.ai:edit') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="el-icon-delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['ai:model:remove']"
          >{{ $t('plugin.ai:delete') }}</el-button
        >
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-loading="loading"
      :data="modelList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('plugin.ai:modelId')"
        align="center"
        prop="modelId"
      />
      <el-table-column
        :label="$t('plugin.ai:modelCode')"
        align="center"
        prop="modelCode"
      />
      <el-table-column
        :label="$t('plugin.ai:provider')"
        align="center"
        prop="provider"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.ai_provider_type"
            :value="scope.row.provider"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('plugin.ai:supportsReasoning')"
        align="center"
        prop="supportReasoning"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.sys_yes_no"
            :value="scope.row.supportReasoning"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('plugin.ai:supportsImages')"
        align="center"
        prop="supportImages"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.sys_yes_no"
            :value="scope.row.supportImages"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('plugin.ai:status')"
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
        :label="$t('plugin.ai:createdAt')"
        align="center"
        prop="createTime"
        width="180"
      >
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('plugin.ai:actions')"
        width="180"
        align="center"
        class-name="small-padding fixed-width"
      >
        <template slot-scope="scope">
          <el-button
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['ai:model:edit']"
            >{{ $t('plugin.ai:edit') }}</el-button
          >
          <el-button
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['ai:model:remove']"
            >{{ $t('plugin.ai:delete') }}</el-button
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

    <!-- 添加或修改对话框 -->
    <el-dialog
      :title="$t(titleKey)"
      :visible.sync="open"
      width="700px"
      append-to-body
    >
      <el-form
        ref="modelRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-row :gutter="10">
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:modelCode')"
              prop="modelCode"
            >
              <el-input
                v-model="form.modelCode"
                :placeholder="$t('plugin.ai:modelCodeHint')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:modelName')"
              prop="modelName"
            >
              <el-input
                v-model="form.modelName"
                :placeholder="$t('plugin.ai:enterAModelName')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:provider')"
              prop="provider"
            >
              <el-select
                v-model="form.provider"
                :placeholder="$t('plugin.ai:chooseAProvider')"
                style="width: 100%"
              >
                <el-option
                  v-for="dict in dict.type.ai_provider_type"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:modelSortOrder')"
              prop="modelSort"
            >
              <el-input-number
                v-model="form.modelSort"
                :min="0"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('plugin.ai:model.apiKey')"
              prop="apiKey"
            >
              <el-input
                v-model="form.apiKey"
                :placeholder="$t('plugin.ai:enterAnAPIKey')"
                type="password"
                show-password
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('plugin.ai:model.baseUrl')"
              prop="baseUrl"
            >
              <el-input
                v-model="form.baseUrl"
                :placeholder="$t('plugin.ai:enterABaseURL')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:maximumOutput')"
              prop="maxTokens"
            >
              <el-input-number
                v-model="form.maxTokens"
                :min="0"
                style="width: 100%"
                :placeholder="$t('plugin.ai:maximumOutput')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:defaultTemperature')"
              prop="temperature"
            >
              <el-input-number
                v-model="form.temperature"
                :min="0"
                :max="2"
                :step="0.1"
                :placeholder="$t('plugin.ai:defaultTemperature')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:supportsReasoning')"
              prop="supportReasoning"
            >
              <el-radio-group v-model="form.supportReasoning">
                <el-radio
                  v-for="dict in dict.type.sys_yes_no"
                  :key="dict.value"
                  :label="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:supportsImages')"
              prop="supportImages"
            >
              <el-radio-group v-model="form.supportImages">
                <el-radio
                  v-for="dict in dict.type.sys_yes_no"
                  :key="dict.value"
                  :label="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:modelType')"
              prop="modelType"
            >
              <el-input
                v-model="form.modelType"
                :placeholder="$t('plugin.ai:enterAModelTypeOptional')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('plugin.ai:status')"
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
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('plugin.ai:remark')"
              prop="remark"
            >
              <el-input
                v-model="form.remark"
                type="textarea"
                :placeholder="$t('plugin.ai:enterContent')"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            type="primary"
            @click="submitForm"
            >{{ $t('plugin.ai:oK') }}</el-button
          >
          <el-button @click="cancel">{{ $t('plugin.ai:cancel') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { listModel, addModel, delModel, getModel, updateModel } from '../../api/model'

export default {
  name: 'AiModel',
  dicts: ['ai_provider_type', 'sys_normal_disable', 'sys_yes_no'],
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
      // 模型表格数据
      modelList: [],
      // 弹出层标题
      titleKey: '',
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        modelCode: undefined,
        provider: undefined,
        status: undefined,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        modelCode: [
          {
            required: true,
            message: () => t('plugin.ai:messages.modelCodeIsRequired'),
            trigger: 'blur',
          },
        ],
        provider: [
          {
            required: true,
            message: () => t('plugin.ai:messages.providerIsRequired'),
            trigger: 'change',
          },
        ],
        modelSort: [
          {
            required: true,
            message: () => t('plugin.ai:messages.modelSortOrderIsRequired'),
            trigger: 'blur',
          },
        ],
      },
    }
  },
  created() {
    this.getList()
  },
  methods: {
    /** 查询列表 */
    getList() {
      this.loading = true
      listModel(this.queryParams).then((response) => {
        this.modelList = response.rows
        this.total = response.total
        this.loading = false
      })
    },
    /** 取消按钮 */
    cancel() {
      this.open = false
      this.reset()
    },
    /** 表单重置 */
    reset() {
      this.form = {
        modelId: undefined,
        modelCode: undefined,
        modelName: undefined,
        provider: undefined,
        modelSort: 0,
        apiKey: undefined,
        baseUrl: undefined,
        maxTokens: undefined,
        temperature: undefined,
        supportReasoning: 'N',
        supportImages: 'N',
        modelType: undefined,
        status: '0',
        remark: undefined,
      }
      this.resetForm('modelRef')
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm('queryRef')
      this.handleQuery()
    },
    /** 多选框选中数据 */
    handleSelectionChange(selection) {
      this.ids = selection.map((item) => item.modelId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset()
      this.open = true
      this.titleKey = 'plugin.ai:messages.addModel'
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      const modelId = row.modelId || this.ids
      getModel(modelId).then((response) => {
        this.form = response.data
        if (this.form.maxTokens === null) {
          this.form.maxTokens = undefined
        }
        if (this.form.temperature === null) {
          this.form.temperature = undefined
        }
        this.open = true
        this.titleKey = 'plugin.ai:messages.editModel'
      })
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs['modelRef'].validate((valid) => {
        if (valid) {
          if (this.form.modelId != undefined) {
            updateModel(this.form).then((response) => {
              this.$modal.msgSuccess(t('plugin.ai:updated'))
              this.open = false
              this.getList()
            })
          } else {
            addModel(this.form).then((response) => {
              this.$modal.msgSuccess(t('plugin.ai:created'))
              this.open = false
              this.getList()
            })
          }
        }
      })
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      const modelIds = row.modelId || this.ids
      this.$modal
        .confirm(t('plugin.ai:deleteModel', { ids: modelIds }))
        .then(function () {
          return delModel(modelIds)
        })
        .then(() => {
          this.getList()
          this.$modal.msgSuccess(t('plugin.ai:messages.deletedSuccessfully'))
        })
        .catch(() => {})
    },
  },
}
</script>
