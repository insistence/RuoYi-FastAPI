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
        :label="$t('system:dictionaryName')"
        prop="dictName"
      >
        <el-input
          v-model="queryParams.dictName"
          :placeholder="$t('system:enterDictionaryName')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:dictionaryType')"
        prop="dictType"
      >
        <el-input
          v-model="queryParams.dictType"
          :placeholder="$t('system:enterDictionaryType')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('system:dictionaryStatus')"
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
          v-hasPermi="['system:dict:add']"
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
          v-hasPermi="['system:dict:edit']"
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
          v-hasPermi="['system:dict:remove']"
          >{{ $t('system:delete') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['system:dict:export']"
          >{{ $t('system:export') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Refresh"
          @click="handleRefreshCache"
          v-hasPermi="['system:dict:remove']"
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
      :data="typeList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('system:dictionaryID')"
        align="center"
        prop="dictId"
      />
      <el-table-column
        :label="$t('system:dictionaryName')"
        align="center"
        prop="dictName"
        :formatter="(row) => resolveText(row.dictName, row.dictNameI18n)"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:dictionaryType')"
        align="center"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">
          <a
            class="link-type"
            style="cursor: pointer"
            @click="handleViewData(scope.row)"
            >{{ scope.row.dictType }}</a
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:status')"
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
        width="280"
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-button
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:dict:edit']"
            >{{ $t('system:edit') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Operation"
            @click="handleDataList(scope.row)"
            v-hasPermi="['system:dict:edit']"
            >{{ $t('system:list') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:dict:remove']"
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
        ref="dictRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="auto"
      >
        <el-form-item
          :label="$t('system:dictionaryName')"
          prop="dictName"
        >
          <el-input
            v-model="form.dictName"
            :placeholder="$t('system:enterDictionaryName')"
          />
        </el-form-item>
        <locale-name-input
          v-model="form.dictNameI18n"
          :original="originalTranslations"
        />
        <el-form-item prop="dictType">
          <el-input
            v-model="form.dictType"
            :placeholder="$t('system:enterDictionaryType')"
          />
          <template #label>
            <span>
              <el-tooltip
                :content="$t('system:storageKeyForExampleSysUserSex')"
                placement="top"
              >
                <el-icon><question-filled /></el-icon>
              </el-tooltip>
              {{ $t('system:dictionaryType') }}</span
            >
          </template>
        </el-form-item>
        <el-form-item
          :label="$t('system:status')"
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
        <el-form-item
          :label="$t('system:remarks')"
          prop="remark"
        >
          <el-input
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('system:enterContent')"
          ></el-input>
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

    <dict-data-drawer
      v-model:visible="drawerVisible"
      :row="drawerRow"
    />
  </div>
</template>

<script setup name="Dict">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { resolveText } from '@/i18n/adapter'
import LocaleNameInput from '@/components/LocaleNameInput/index.vue'
import { getDisplayTimezone } from '@/utils/time'
import DictDataDrawer from './detail'
import useDictStore from '@/store/modules/dict'
import {
  listType,
  getType,
  delType,
  addType,
  updateType,
  refreshCache,
} from '@/api/system/dict/type'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.dictRef))
const { sys_normal_disable } = proxy.useDict('sys_normal_disable')

const typeList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const dateRange = ref([])
const drawerVisible = ref(false)
const drawerRow = ref({})

const originalTranslations = ref({})

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    dictName: undefined,
    dictType: undefined,
    status: undefined,
  },
  rules: {
    dictName: [
      {
        required: true,
        get message() {
          return t('system:dictionaryNameIsRequired')
        },
        trigger: 'blur',
      },
    ],
    dictType: [
      {
        required: true,
        get message() {
          return t('system:dictionaryTypeIsRequired')
        },
        trigger: 'blur',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询字典类型列表 */
function getList() {
  loading.value = true
  listType(proxy.addDateRange(queryParams.value, dateRange.value)).then((response) => {
    typeList.value = response.rows
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
  originalTranslations.value = {}
  form.value = {
    dictId: undefined,
    dictName: undefined,
    dictType: undefined,
    status: '0',
    remark: undefined,
  }
  proxy.resetForm('dictRef')
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
/** 新增按钮操作 */
function handleAdd() {
  reset()
  open.value = true
  title.value = () => t('system:addDictionaryType')
}
/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.dictId)
  single.value = selection.length != 1
  multiple.value = !selection.length
}
/** 字典数据抽屉 */
function handleViewData(row) {
  drawerRow.value = row
  drawerVisible.value = true
}
/** 字典数据列表页面 */
function handleDataList(row) {
  proxy.$tab.openPage(t('layout:routes.dictData'), '/system/dict-data/index/' + row.dictId)
}
/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  const dictId = row.dictId || ids.value
  getType(dictId).then((response) => {
    originalTranslations.value = response.data.dictNameI18n || {}
    form.value = { ...response.data, dictNameI18n: {} }
    open.value = true
    title.value = () => t('system:editDictionaryType')
  })
}
/** 提交按钮 */
function submitForm() {
  proxy.$refs['dictRef'].validate((valid) => {
    if (valid) {
      if (form.value.dictId != undefined) {
        updateType(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
          open.value = false
          getList()
        })
      } else {
        addType(form.value).then((response) => {
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
  const dictIds = row.dictId || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: dictIds }))
    .then(function () {
      return delType(dictIds)
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
    'system/dict/type/export',
    {
      ...queryParams.value,
    },
    `dict_${new Date().getTime()}.xlsx`
  )
}
/** 刷新缓存按钮操作 */
function handleRefreshCache() {
  refreshCache().then(() => {
    proxy.$modal.msgSuccess(t('system:refreshedSuccessfully'))
    useDictStore().cleanDict()
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
