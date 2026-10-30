<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
      label-width="auto"
    >
      <el-form-item
        :label="$t('system:parameterName')"
        prop="configName"
      >
        <el-input
          v-model="queryParams.configName"
          :placeholder="$t('system:enterParameterName')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:parameterKey')"
        prop="configKey"
      >
        <el-input
          v-model="queryParams.configKey"
          :placeholder="$t('system:enterParameterKey')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:builtIn')"
        prop="configType"
      >
        <el-select
          v-model="queryParams.configType"
          :placeholder="$t('system:builtIn')"
          clearable
          style="width: 240px"
        >
          <el-option
            v-for="dict in sys_yes_no"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('system:createdAt')"
        style="width: 308px"
      >
        <el-date-picker
          v-model="dateRange"
          value-format="YYYY-MM-DD"
          type="daterange"
          :aria-label="$t('system:dateRangeLabel', { timezone: getDisplayTimezone() })"
          range-separator="-"
          :start-placeholder="$t('system:startDate')"
          :end-placeholder="$t('system:endDate')"
        ></el-date-picker>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          icon="Search"
          @click="handleQuery"
          >{{ $t('system:search') }}</el-button
        >
        <el-button
          icon="Refresh"
          @click="resetQuery"
          >{{ $t('system:reset') }}</el-button
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
          v-hasPermi="['system:config:add']"
          >{{ $t('system:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['system:config:edit']"
          >{{ $t('system:edit') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['system:config:remove']"
          >{{ $t('system:delete') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['system:config:export']"
          >{{ $t('system:export') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Refresh"
          @click="handleRefreshCache"
          v-hasPermi="['system:config:remove']"
          >{{ $t('system:refreshCache') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
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
        :label="$t('system:parameterName')"
        align="center"
        prop="configName"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:parameterKey')"
        align="center"
        prop="configKey"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:parameterValue')"
        align="center"
        prop="configValue"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:builtIn')"
        align="center"
        prop="configType"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_yes_no"
            :value="scope.row.configType"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:remarks')"
        align="center"
        prop="remark"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:createdAt')"
        align="center"
        prop="createTime"
        width="180"
      >
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        width="150"
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-button
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:config:edit']"
            >{{ $t('system:edit') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:config:remove']"
            >{{ $t('system:delete') }}</el-button
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

    <!-- 添加或修改参数配置对话框 -->
    <el-dialog
      :title="typeof title === 'function' ? title() : title"
      v-model="open"
      width="500px"
      append-to-body
    >
      <el-form
        ref="configRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="auto"
      >
        <el-form-item
          :label="$t('system:parameterName')"
          prop="configName"
        >
          <el-input
            v-model="form.configName"
            :placeholder="$t('system:enterParameterName')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:parameterKey')"
          prop="configKey"
        >
          <el-input
            v-model="form.configKey"
            :placeholder="$t('system:enterParameterKey')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:parameterValue')"
          prop="configValue"
        >
          <el-input
            v-model="form.configValue"
            type="textarea"
            :placeholder="$t('system:enterParameterValue')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:builtIn')"
          prop="configType"
        >
          <el-radio-group v-model="form.configType">
            <el-radio
              v-for="dict in sys_yes_no"
              :key="dict.value"
              :value="dict.value"
              >{{ dict.label }}</el-radio
            >
          </el-radio-group>
        </el-form-item>
        <el-form-item
          :label="$t('system:remarks')"
          prop="remark"
        >
          <el-input
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('system:enterContent')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            type="primary"
            @click="submitForm"
            >{{ $t('system:confirm') }}</el-button
          >
          <el-button @click="cancel">{{ $t('system:cancel') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Config">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { getDisplayTimezone } from '@/utils/time'
import {
  listConfig,
  getConfig,
  delConfig,
  addConfig,
  updateConfig,
  refreshCache,
} from '@/api/system/config'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.configRef))
const { sys_yes_no } = proxy.useDict('sys_yes_no')

const configList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const dateRange = ref([])

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    configName: undefined,
    configKey: undefined,
    configType: undefined,
  },
  rules: {
    configName: [
      {
        required: true,
        get message() {
          return t('system:parameterNameIsRequired')
        },
        trigger: 'blur',
      },
    ],
    configKey: [
      {
        required: true,
        get message() {
          return t('system:parameterKeyIsRequired')
        },
        trigger: 'blur',
      },
    ],
    configValue: [
      {
        required: true,
        get message() {
          return t('system:parameterValueIsRequired')
        },
        trigger: 'blur',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询参数列表 */
function getList() {
  loading.value = true
  listConfig(proxy.addDateRange(queryParams.value, dateRange.value)).then((response) => {
    configList.value = response.rows
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
    configId: undefined,
    configName: undefined,
    configKey: undefined,
    configValue: undefined,
    configType: 'Y',
    remark: undefined,
  }
  proxy.resetForm('configRef')
}
/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}
/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = []
  proxy.resetForm('queryRef')
  handleQuery()
}
/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.configId)
  single.value = selection.length != 1
  multiple.value = !selection.length
}
/** 新增按钮操作 */
function handleAdd() {
  reset()
  open.value = true
  title.value = () => t('system:addParameter')
}
/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  const configId = row.configId || ids.value
  getConfig(configId).then((response) => {
    form.value = response.data
    open.value = true
    title.value = () => t('system:editParameter')
  })
}
/** 提交按钮 */
function submitForm() {
  proxy.$refs['configRef'].validate((valid) => {
    if (valid) {
      if (form.value.configId != undefined) {
        updateConfig(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
          open.value = false
          getList()
        })
      } else {
        addConfig(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('system:addedSuccessfully'))
          open.value = false
          getList()
        })
      }
    }
  })
}
/** 删除按钮操作 */
function handleDelete(row) {
  const configIds = row.configId || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: configIds }))
    .then(function () {
      return delConfig(configIds)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
    })
    .catch(() => {})
}
/** 导出按钮操作 */
function handleExport() {
  proxy.download(
    'system/config/export',
    {
      ...queryParams.value,
    },
    `config_${new Date().getTime()}.xlsx`
  )
}
/** 刷新缓存按钮操作 */
function handleRefreshCache() {
  refreshCache().then(() => {
    proxy.$modal.msgSuccess(t('system:cacheRefreshed'))
  })
}

getList()
// 时区变化后重新查询日期范围，保留正在编辑的表单。
watch(getDisplayTimezone, () => {
  if (dateRange.value?.length) {
    handleQuery()
  }
})
</script>
