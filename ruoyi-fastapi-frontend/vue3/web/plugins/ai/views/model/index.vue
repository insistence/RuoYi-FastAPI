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
          @keyup.enter="handleQuery"
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
          @keyup.enter="handleQuery"
        >
          <el-option
            v-for="dict in ai_provider_type"
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
            v-for="dict in sys_normal_disable"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          icon="Search"
          @click="handleQuery"
          >{{ $t('plugin.ai:search') }}</el-button
        >
        <el-button
          icon="Refresh"
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
          icon="Plus"
          @click="handleAdd"
          v-hasPermi="['ai:model:add']"
          >{{ $t('plugin.ai:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
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
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['ai:model:remove']"
          >{{ $t('plugin.ai:delete') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
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
        :label="$t('plugin.ai:modelID')"
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
        <template #default="scope">
          <dict-tag
            :options="ai_provider_type"
            :value="scope.row.provider"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('plugin.ai:supportsReasoning')"
        align="center"
        prop="supportReasoning"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_yes_no"
            :value="scope.row.supportReasoning"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('plugin.ai:supportsImages')"
        align="center"
        prop="supportImages"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_yes_no"
            :value="scope.row.supportImages"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('plugin.ai:status')"
        align="center"
        prop="status"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_normal_disable"
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
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('plugin.ai:actions')"
        width="180"
        align="center"
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-button
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['ai:model:edit']"
            >{{ $t('plugin.ai:edit') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Delete"
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
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <!-- 添加或修改对话框 -->
    <el-dialog
      :title="typeof title === 'function' ? title() : title"
      v-model="open"
      width="700px"
      append-to-body
    >
      <el-form
        ref="modelRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
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
                :placeholder="$t('plugin.ai:enterModelCodeEGDeepseekR1')"
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
                  v-for="dict in ai_provider_type"
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
              label="API Key"
              prop="apiKey"
            >
              <el-input
                v-model="form.apiKey"
                :placeholder="$t('plugin.ai:enterAnAPIKey')"
                type="password"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              label="Base URL"
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
                  v-for="dict in sys_yes_no"
                  :key="dict.value"
                  :value="dict.value"
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
                  v-for="dict in sys_yes_no"
                  :key="dict.value"
                  :value="dict.value"
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
                  v-for="dict in sys_normal_disable"
                  :key="dict.value"
                  :value="dict.value"
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
            >{{ $t('plugin.ai:confirm') }}</el-button
          >
          <el-button @click="cancel">{{ $t('plugin.ai:cancel') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="AiModel">
import { useLocaleForm } from '@/composables/useLocaleForm'
import { t } from '@/i18n/adapter'
import { listModel, addModel, delModel, getModel, updateModel } from '../../api/model'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.modelRef))
const { ai_provider_type, sys_normal_disable, sys_yes_no } = proxy.useDict(
  'ai_provider_type',
  'sys_normal_disable',
  'sys_yes_no'
)

const modelList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    modelCode: undefined,
    provider: undefined,
    status: undefined,
  },
  rules: {
    modelCode: [
      {
        required: true,
        get message() {
          return t('plugin.ai:modelCodeIsRequired')
        },
        trigger: 'blur',
      },
    ],
    provider: [
      {
        required: true,
        get message() {
          return t('plugin.ai:providerIsRequired')
        },
        trigger: 'change',
      },
    ],
    modelSort: [
      {
        required: true,
        get message() {
          return t('plugin.ai:modelSortOrderIsRequired')
        },
        trigger: 'blur',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询列表 */
function getList() {
  loading.value = true
  listModel(queryParams.value).then((response) => {
    modelList.value = response.rows
    total.value = response.total
    loading.value = false
  })
}

/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}

/** 表单重置 */
function reset() {
  form.value = {
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
  proxy.resetForm('modelRef')
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}

/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.modelId)
  single.value = selection.length != 1
  multiple.value = !selection.length
}

/** 新增按钮操作 */
function handleAdd() {
  reset()
  open.value = true
  title.value = () => t('plugin.ai:addModel')
}

/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  const modelId = row.modelId || ids.value
  getModel(modelId).then((response) => {
    form.value = response.data
    open.value = true
    title.value = () => t('plugin.ai:editModel')
  })
}

/** 提交按钮 */
function submitForm() {
  proxy.$refs['modelRef'].validate((valid) => {
    if (valid) {
      if (form.value.modelId != undefined) {
        updateModel(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('plugin.ai:updated'))
          open.value = false
          getList()
        })
      } else {
        addModel(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('plugin.ai:added'))
          open.value = false
          getList()
        })
      }
    }
  })
}

/** 删除按钮操作 */
function handleDelete(row) {
  const modelIds = row.modelId || ids.value
  proxy.$modal
    .confirm(t('plugin.ai:deleteModels', { ids: modelIds }))
    .then(function () {
      return delModel(modelIds)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('plugin.ai:deletedSuccessfully'))
    })
    .catch(() => {})
}

getList()
</script>
