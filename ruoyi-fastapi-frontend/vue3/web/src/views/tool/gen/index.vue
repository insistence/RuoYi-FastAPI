<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
    >
      <el-form-item
        :label="$t('tools:tableName')"
        prop="tableName"
      >
        <el-input
          v-model="queryParams.tableName"
          :placeholder="$t('tools:enterTableName')"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('tools:tableDescription')"
        prop="tableComment"
      >
        <el-input
          v-model="queryParams.tableComment"
          :placeholder="$t('tools:enterTableDescription')"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('tools:dataSource')"
        prop="dataSourceName"
      >
        <el-select
          v-model="queryParams.dataSourceName"
          :placeholder="$t('tools:selectADataSource')"
          clearable
          filterable
          style="width: 220px"
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
        :label="$t('system:createdAt')"
        style="width: 308px"
      >
        <el-date-picker
          v-model="dateRange"
          value-format="YYYY-MM-DD"
          type="daterange"
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
          icon="Download"
          :disabled="multiple"
          @click="handleGenTable"
          v-hasPermi="['tool:gen:code']"
          >{{ $t('tools:generate') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="Plus"
          @click="openCreateTable"
          v-hasRole="['admin']"
          >{{ $t('tools:create') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="info"
          plain
          icon="Upload"
          @click="openImportTable"
          v-hasPermi="['tool:gen:import']"
          >{{ $t('system:import') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleEditTable"
          v-hasPermi="['tool:gen:edit']"
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
          v-hasPermi="['tool:gen:remove']"
          >{{ $t('system:delete') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-loading="loading"
      :data="tableList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        align="center"
        width="55"
      ></el-table-column>
      <el-table-column
        :label="$t('system:noLabel')"
        type="index"
        width="50"
        align="center"
      >
        <template #default="scope">
          <span>{{ (queryParams.pageNum - 1) * queryParams.pageSize + scope.$index + 1 }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('tools:tableName')"
        align="center"
        prop="tableName"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('tools:tableDescription')"
        align="center"
        prop="tableComment"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('tools:entity')"
        align="center"
        prop="className"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('tools:dataSource')"
        align="center"
        prop="dataSourceName"
        width="160"
      />
      <el-table-column
        :label="$t('system:createdAt')"
        align="center"
        prop="createTime"
        width="160"
      />
      <el-table-column
        :label="$t('monitor:updatedAt')"
        align="center"
        prop="updateTime"
        width="160"
      />
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        width="330"
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-tooltip
            :content="$t('components:preview')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="View"
              @click="handlePreview(scope.row)"
              v-hasPermi="['tool:gen:preview']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('oauth:edit')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="Edit"
              @click="handleEditTable(scope.row)"
              v-hasPermi="['tool:gen:edit']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('system:delete')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="Delete"
              @click="handleDelete(scope.row)"
              v-hasPermi="['tool:gen:remove']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('tools:synchronize')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="Refresh"
              @click="handleSynchDb(scope.row)"
              v-hasPermi="['tool:gen:edit']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('tools:generateCode')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="Download"
              @click="handleGenTable(scope.row)"
              v-hasPermi="['tool:gen:code']"
            ></el-button>
          </el-tooltip>
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
    <!-- 预览界面 -->
    <el-dialog
      :title="preview.title"
      v-model="preview.open"
      width="80%"
      top="5vh"
      append-to-body
      class="scrollbar"
    >
      <el-tabs v-model="preview.activeName">
        <el-tab-pane
          v-for="(value, key) in preview.data"
          :label="key.substring(key.lastIndexOf('/') + 1, key.indexOf('.jinja2'))"
          :name="key.substring(key.lastIndexOf('/') + 1, key.indexOf('.jinja2'))"
          :key="value"
        >
          <el-link
            underline="never"
            icon="DocumentCopy"
            v-copyText="value"
            v-copyText:callback="copyTextSuccess"
            style="float: right"
            >{{ $t('monitor:copy') }}</el-link
          >
          <pre>{{ value }}</pre>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
    <import-table
      ref="importRef"
      :data-sources="dataSources"
      @ok="handleQuery"
    />
    <create-table
      ref="createRef"
      :data-sources="dataSources"
      @ok="handleQuery"
    />
  </div>
</template>

<script setup name="Gen">
import { t } from '@/i18n/adapter'
import {
  listDataSources,
  listTable,
  previewTable,
  delTable,
  genCode,
  synchDb,
} from '@/api/tool/gen'
import router from '@/router'
import importTable from './importTable'
import createTable from './createTable'

const route = useRoute()
const { proxy } = getCurrentInstance()

const tableList = ref([])
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const tableNames = ref([])
const selectedSourceNames = ref([])
const dateRange = ref([])
const uniqueId = ref('')
const dataSources = ref([])

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    tableName: undefined,
    tableComment: undefined,
    dataSourceName: undefined,
  },
  preview: {
    open: false,
    get title() {
      return t('tools:codePreview')
    },
    data: {},
    activeName: 'do.py',
  },
})

const { queryParams, preview } = toRefs(data)

onActivated(() => {
  const time = route.query.t
  if (time != null && time != uniqueId.value) {
    uniqueId.value = time
    queryParams.value.pageNum = Number(route.query.pageNum)
    dateRange.value = []
    proxy.resetForm('queryForm')
    getList()
  }
})

/** 查询表集合 */
function getList() {
  loading.value = true
  listTable(proxy.addDateRange(queryParams.value, dateRange.value)).then((response) => {
    tableList.value = response.rows
    total.value = response.total
    loading.value = false
  })
}

/** 查询代码生成数据源选项 */
function getDataSources() {
  listDataSources().then((response) => {
    dataSources.value = response.data || []
  })
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 生成代码操作 */
function handleGenTable(row) {
  const tbNames = row.tableName || tableNames.value
  if (tbNames == '') {
    proxy.$modal.msgError(t('tools:selectItemsToGenerate'))
    return
  }
  const sourceNames = row.tableName ? [row.dataSourceName] : selectedSourceNames.value
  const uniqueSourceNames = [...new Set(sourceNames.filter(Boolean))]
  if (uniqueSourceNames.length !== 1) {
    proxy.$modal.msgError(t('tools:selectGenerationConfigurationsFromTheSameDataSource'))
    return
  }
  const dataSourceName = uniqueSourceNames[0]
  if (row.genType === '1') {
    genCode(row.tableName, dataSourceName).then((response) => {
      proxy.$modal.msgSuccess(t('tools:generatedAt', { path: row.genPath }))
    })
  } else {
    const zipName = Array.isArray(tbNames) ? 'ruoyi-fastapi.zip' : tbNames + '.zip'
    const tables = encodeURIComponent(Array.isArray(tbNames) ? tbNames.join(',') : tbNames)
    proxy.$download.zip(
      '/tool/gen/batchGenCode?tables=' +
        tables +
        '&dataSourceName=' +
        encodeURIComponent(dataSourceName),
      zipName
    )
  }
}

/** 同步数据库操作 */
function handleSynchDb(row) {
  const tableName = row.tableName
  proxy.$modal
    .confirm(t('tools:confirm.syncTable', { name: tableName }))
    .then(function () {
      return synchDb(tableName, row.dataSourceName)
    })
    .then(() => {
      proxy.$modal.msgSuccess(t('tools:synchronizedSuccessfully'))
    })
    .catch(() => {})
}

/** 打开导入表弹窗 */
function openImportTable() {
  proxy.$refs['importRef'].show()
}

/** 打开创建表弹窗 */
function openCreateTable() {
  proxy.$refs['createRef'].show()
}

/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = []
  proxy.resetForm('queryRef')
  handleQuery()
}

/** 预览按钮 */
function handlePreview(row) {
  previewTable(row.tableId).then((response) => {
    preview.value.data = response.data
    preview.value.open = true
    preview.value.activeName = 'do.py'
  })
}

/** 复制代码成功 */
function copyTextSuccess() {
  proxy.$modal.msgSuccess(t('tools:copiedSuccessfully'))
}

// 多选框选中数据
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.tableId)
  tableNames.value = selection.map((item) => item.tableName)
  selectedSourceNames.value = selection.map((item) => item.dataSourceName)
  single.value = selection.length != 1
  multiple.value = !selection.length
}

/** 修改按钮操作 */
function handleEditTable(row) {
  const tableId = row.tableId || ids.value[0]
  const tableName = row.tableName || tableNames.value[0]
  const params = { pageNum: queryParams.value.pageNum }
  proxy.$tab.openPage(
    t('tools:editTable', { name: tableName }),
    '/tool/gen-edit/index/' + tableId,
    params
  )
}

/** 删除按钮操作 */
function handleDelete(row) {
  const tableIds = row.tableId || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: tableIds }))
    .then(function () {
      return delTable(tableIds)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
    })
    .catch(() => {})
}

getList()
getDataSources()
</script>
