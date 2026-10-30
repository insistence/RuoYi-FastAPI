<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
      label-width="68px"
    >
      <el-form-item
        :label="$t('monitor:signInLocation')"
        prop="ipaddr"
      >
        <el-input
          v-model="queryParams.ipaddr"
          :placeholder="$t('monitor:enterSignInAddress')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:userName')"
        prop="userName"
      >
        <el-input
          v-model="queryParams.userName"
          :placeholder="$t('system:enterUserName')"
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
          :placeholder="$t('monitor:signInStatus')"
          clearable
          style="width: 240px"
        >
          <el-option
            v-for="dict in sys_common_status"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('monitor:signInTime')"
        style="width: 308px"
      >
        <el-date-picker
          v-model="dateRange"
          value-format="YYYY-MM-DD"
          type="daterange"
          :aria-label="$t('monitor:dateRangeValue', { value0: getDisplayTimezone() })"
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
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['monitor:logininfor:remove']"
          >{{ $t('system:delete') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          @click="handleClean"
          v-hasPermi="['monitor:logininfor:remove']"
          >{{ $t('monitor:clear') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="Unlock"
          :disabled="single"
          @click="handleUnlock"
          v-hasPermi="['monitor:logininfor:unlock']"
          >{{ $t('auth:lock.unlock') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['monitor:logininfor:export']"
          >{{ $t('system:export') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      ref="logininforRef"
      v-loading="loading"
      :data="logininforList"
      @selection-change="handleSelectionChange"
      :default-sort="defaultSort"
      @sort-change="handleSortChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('monitor:accessID')"
        align="center"
        prop="infoId"
      />
      <el-table-column
        :label="$t('system:userName')"
        align="center"
        prop="userName"
        :show-overflow-tooltip="true"
        sortable="custom"
        :sort-orders="['descending', 'ascending']"
      />
      <el-table-column
        :label="$t('monitor:address')"
        align="center"
        prop="ipaddr"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:signInLocationLabel')"
        align="center"
        prop="loginLocation"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:operatingSystem')"
        align="center"
        prop="os"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:browser')"
        align="center"
        prop="browser"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:signInStatus')"
        align="center"
        prop="status"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_common_status"
            :value="scope.row.status"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('monitor:description')"
        align="center"
        prop="msg"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:accessedAt')"
        align="center"
        prop="loginTime"
        sortable="custom"
        :sort-orders="['descending', 'ascending']"
        width="180"
      >
        <template #default="scope">
          <span>{{ parseTime(scope.row.loginTime) }}</span>
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
  </div>
</template>

<script setup name="Logininfor">
import { t } from '@/i18n/adapter'
import { getDisplayTimezone } from '@/utils/time'
import { list, delLogininfor, cleanLogininfor, unlockLogininfor } from '@/api/monitor/logininfor'

const { proxy } = getCurrentInstance()
const { sys_common_status } = proxy.useDict('sys_common_status')

const logininforList = ref([])
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const selectName = ref('')
const total = ref(0)
const dateRange = ref([])
const defaultSort = ref({ prop: 'loginTime', order: 'descending' })

// 查询参数
const queryParams = ref({
  pageNum: 1,
  pageSize: 10,
  ipaddr: undefined,
  userName: undefined,
  status: undefined,
  orderByColumn: undefined,
  isAsc: undefined,
})

/** 查询登录日志列表 */
function getList() {
  loading.value = true
  list(proxy.addDateRange(queryParams.value, dateRange.value)).then((response) => {
    logininforList.value = response.rows
    total.value = response.total
    loading.value = false
  })
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
  queryParams.value.pageNum = 1
  proxy.$refs['logininforRef'].sort(defaultSort.value.prop, defaultSort.value.order)
}
/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.infoId)
  multiple.value = !selection.length
  single.value = selection.length != 1
  selectName.value = selection.map((item) => item.userName)
}
/** 排序触发事件 */
function handleSortChange(column, prop, order) {
  queryParams.value.orderByColumn = column.prop
  queryParams.value.isAsc = column.order
  getList()
}
/** 删除按钮操作 */
function handleDelete(row) {
  const infoIds = row.infoId || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: infoIds }))
    .then(function () {
      return delLogininfor(infoIds)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
    })
    .catch(() => {})
}
/** 清空按钮操作 */
function handleClean() {
  proxy.$modal
    .confirm(t('monitor:clearAllSignInLogs'))
    .then(function () {
      return cleanLogininfor()
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('monitor:clearedSuccessfully'))
    })
    .catch(() => {})
}
/** 解锁按钮操作 */
function handleUnlock() {
  const username = selectName.value
  proxy.$modal
    .confirm(t('monitor:confirm.unlock', { name: username }))
    .then(function () {
      return unlockLogininfor(username)
    })
    .then(() => {
      proxy.$modal.msgSuccess(t('monitor:userUnlocked', { name: username }))
    })
    .catch(() => {})
}
/** 导出按钮操作 */
function handleExport() {
  proxy.download(
    'monitor/logininfor/export',
    {
      ...queryParams.value,
    },
    `logininfor_${new Date().getTime()}.xlsx`
  )
}

getList()
// 时区变化后重新查询日期范围，保留正在编辑的表单。
watch(getDisplayTimezone, () => {
  if (dateRange.value?.length) {
    handleQuery()
  }
})
</script>
