<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
    >
      <el-form-item
        :label="$t('system:dictionaryName')"
        prop="dictType"
      >
        <el-select
          v-model="queryParams.dictType"
          style="width: 200px"
        >
          <el-option
            v-for="item in typeOptions"
            :key="item.dictId"
            :label="resolveText(item.dictName, item.dictNameI18n)"
            :value="item.dictType"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('system:dictionaryLabel')"
        prop="dictLabel"
      >
        <el-input
          v-model="queryParams.dictLabel"
          :placeholder="$t('system:enterDictionaryLabel')"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('system:dataStatus')"
          clearable
          style="width: 200px"
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
          type="warning"
          plain
          icon="Close"
          @click="handleClose"
          >{{ $t('layout:search.close') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
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
        :label="$t('system:dictionaryCode')"
        align="center"
        prop="dictCode"
      />
      <el-table-column
        :label="$t('system:dictionaryLabel')"
        align="center"
        prop="dictLabel"
      >
        <template #default="scope">
          <span
            v-if="
              (scope.row.listClass == '' || scope.row.listClass == 'default') &&
              (scope.row.cssClass == '' || scope.row.cssClass == null)
            "
            >{{ resolveText(scope.row.dictLabel, scope.row.dictLabelI18n) }}</span
          >
          <el-tag
            v-else
            :type="scope.row.listClass == 'primary' ? '' : scope.row.listClass"
            :class="scope.row.cssClass"
            >{{ resolveText(scope.row.dictLabel, scope.row.dictLabelI18n) }}</el-tag
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:dictionaryValue')"
        align="center"
        prop="dictValue"
      />
      <el-table-column
        :label="$t('system:dictionaryOrder')"
        align="center"
        prop="dictSort"
      />
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
        width="160"
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
        ref="dataRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="auto"
      >
        <el-form-item :label="$t('system:dictionaryType')">
          <el-input
            v-model="form.dictType"
            :disabled="true"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:dataLabel')"
          prop="dictLabel"
        >
          <el-input
            v-model="form.dictLabel"
            :placeholder="$t('system:enterDataLabel')"
          />
        </el-form-item>
        <locale-name-input
          v-model="form.dictLabelI18n"
          :original="originalTranslations"
        />
        <el-form-item
          :label="$t('system:dataValue')"
          prop="dictValue"
        >
          <el-input
            v-model="form.dictValue"
            :placeholder="$t('system:enterDataValue')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:styleClass')"
          prop="cssClass"
        >
          <el-input
            v-model="form.cssClass"
            :placeholder="$t('system:enterStyleClass')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:displayOrder')"
          prop="dictSort"
        >
          <el-input-number
            v-model="form.dictSort"
            controls-position="right"
            :min="0"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:displayStyle')"
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
  </div>
</template>

<script setup name="Data">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { resolveText } from '@/i18n/adapter'
import LocaleNameInput from '@/components/LocaleNameInput/index.vue'
import useDictStore from '@/store/modules/dict'
import { optionselect as getDictOptionselect, getType } from '@/api/system/dict/type'
import { listData, getData, delData, addData, updateData } from '@/api/system/dict/data'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.dataRef))
const { sys_normal_disable } = proxy.useDict('sys_normal_disable')

const dataList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const defaultDictType = ref('')
const typeOptions = ref([])
const route = useRoute()
// 数据标签回显样式
const listClassOptions = ref([
  {
    value: 'default',
    get label() {
      return t('layout:size.default')
    },
  },
  {
    value: 'primary',
    get label() {
      return t('system:primary')
    },
  },
  {
    value: 'success',
    get label() {
      return t('system:success')
    },
  },
  {
    value: 'info',
    get label() {
      return t('system:information')
    },
  },
  {
    value: 'warning',
    get label() {
      return t('system:warning')
    },
  },
  {
    value: 'danger',
    get label() {
      return t('system:danger')
    },
  },
])

const originalTranslations = ref({})

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    dictType: undefined,
    dictLabel: undefined,
    status: undefined,
  },
  rules: {
    dictLabel: [
      {
        required: true,
        get message() {
          return t('system:dataLabelIsRequired')
        },
        trigger: 'blur',
      },
    ],
    dictValue: [
      {
        required: true,
        get message() {
          return t('system:dataValueIsRequired')
        },
        trigger: 'blur',
      },
    ],
    dictSort: [
      {
        required: true,
        get message() {
          return t('system:dataOrderIsRequired')
        },
        trigger: 'blur',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询字典类型详细 */
function getTypes(dictId) {
  getType(dictId).then((response) => {
    queryParams.value.dictType = response.data.dictType
    defaultDictType.value = response.data.dictType
    getList()
  })
}

/** 查询字典类型列表 */
function getTypeList() {
  getDictOptionselect().then((response) => {
    typeOptions.value = response.data
  })
}
/** 查询字典数据列表 */
function getList() {
  loading.value = true
  listData(queryParams.value).then((response) => {
    dataList.value = response.rows
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
    dictCode: undefined,
    dictLabel: undefined,
    dictValue: undefined,
    cssClass: undefined,
    listClass: 'default',
    dictSort: 0,
    status: '0',
    remark: undefined,
  }
  proxy.resetForm('dataRef')
}
/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}
/** 返回按钮操作 */
function handleClose() {
  const obj = { path: '/system/dict' }
  proxy.$tab.closeOpenPage(obj)
}
/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm('queryRef')
  queryParams.value.dictType = defaultDictType.value
  handleQuery()
}
/** 新增按钮操作 */
function handleAdd() {
  reset()
  open.value = true
  title.value = () => t('system:addDictionaryEntry')
  form.value.dictType = queryParams.value.dictType
}
/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.dictCode)
  single.value = selection.length != 1
  multiple.value = !selection.length
}
/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  const dictCode = row.dictCode || ids.value
  getData(dictCode).then((response) => {
    originalTranslations.value = response.data.dictLabelI18n || {}
    form.value = { ...response.data, dictLabelI18n: {} }
    open.value = true
    title.value = () => t('system:editDictionaryEntry')
  })
}
/** 提交按钮 */
function submitForm() {
  proxy.$refs['dataRef'].validate((valid) => {
    if (valid) {
      if (form.value.dictCode != undefined) {
        updateData(form.value).then((response) => {
          useDictStore().removeDict(queryParams.value.dictType)
          proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
          open.value = false
          getList()
        })
      } else {
        addData(form.value).then((response) => {
          useDictStore().removeDict(queryParams.value.dictType)
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
  const dictCodes = row.dictCode || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: dictCodes }))
    .then(function () {
      return delData(dictCodes)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
      useDictStore().removeDict(queryParams.value.dictType)
    })
    .catch(() => {})
}
/** 导出按钮操作 */
function handleExport() {
  proxy.download(
    'system/dict/data/export',
    {
      ...queryParams.value,
    },
    `dict_data_${new Date().getTime()}.xlsx`
  )
}

getTypes(route.params && route.params.dictId)
getTypeList()
</script>
