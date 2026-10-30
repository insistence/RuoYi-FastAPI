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
        :label="$t('monitor:taskName')"
        prop="jobName"
      >
        <el-input
          v-model="queryParams.jobName"
          :placeholder="$t('monitor:enterATaskName')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('monitor:businessGroup')"
        prop="jobGroup"
      >
        <el-input
          v-model="queryParams.jobGroup"
          :placeholder="$t('monitor:enterBusinessGroup')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('monitor:taskID')"
        prop="jobId"
      >
        <el-input
          v-model="queryParams.jobId"
          :placeholder="$t('monitor:exactTaskID')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('monitor:executionID')"
        prop="executionId"
      >
        <el-input
          v-model="queryParams.executionId"
          :placeholder="$t('monitor:exactExecutionID')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('monitor:executionStatus')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('monitor:selectExecutionStatus')"
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
        :label="$t('monitor:executionTime')"
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
          v-hasPermi="['monitor:job:remove']"
          >{{ $t('system:delete') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          @click="handleClean"
          v-hasPermi="['monitor:job:remove']"
          >{{ $t('monitor:clear') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['monitor:job:export']"
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
      :data="jobLogList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('monitor:logID')"
        width="80"
        align="center"
        prop="jobLogId"
      />
      <el-table-column
        :label="$t('monitor:taskID')"
        width="90"
        align="center"
        prop="jobId"
      />
      <el-table-column
        :label="$t('monitor:taskName')"
        align="center"
        prop="jobName"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:businessGroup')"
        align="center"
        prop="jobGroup"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">
          {{ scope.row.jobGroup }}
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('monitor:callTarget')"
        align="center"
        prop="invokeTarget"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:logInformation')"
        align="center"
        prop="jobMessage"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:executionStatus')"
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
        :label="$t('monitor:executionTime')"
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
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-button
            link
            type="primary"
            icon="View"
            @click="handleView(scope.row)"
            v-hasPermi="['monitor:job:query']"
            >{{ $t('monitor:details') }}</el-button
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

    <!-- 调度日志详细 -->
    <job-detail
      v-model:visible="open"
      :row="form"
      type="log"
    />
  </div>
</template>

<script setup name="JobLog">
import { t } from '@/i18n/adapter'
import { getDisplayTimezone } from '@/utils/time'
import JobDetail from './detail'
import { listJobLog, delJobLog, cleanJobLog } from '@/api/monitor/jobLog'

const { proxy } = getCurrentInstance()
const { sys_common_status } = proxy.useDict('sys_common_status')

const jobLogList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const multiple = ref(true)
const total = ref(0)
const dateRange = ref([])
const route = useRoute()

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    jobId: undefined,
    executionId: undefined,
    jobName: undefined,
    jobGroup: undefined,
    status: undefined,
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询调度日志列表 */
function getList() {
  loading.value = true
  const query = {
    ...queryParams.value,
    jobId: queryParams.value.jobId || undefined,
    executionId: queryParams.value.executionId || undefined,
  }
  listJobLog(proxy.addDateRange(query, dateRange.value))
    .then((response) => {
      jobLogList.value = response.rows
      total.value = response.total
    })
    .finally(() => {
      loading.value = false
    })
}
// 返回按钮
function handleClose() {
  const obj = { path: '/monitor/job' }
  proxy.$tab.closeOpenPage(obj)
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
// 多选框选中数据
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.jobLogId)
  multiple.value = !selection.length
}
/** 详细按钮操作 */
function handleView(row) {
  open.value = true
  form.value = row
}
/** 删除按钮操作 */
function handleDelete(row) {
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: ids.value }))
    .then(function () {
      return delJobLog(ids.value)
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
    .confirm(t('monitor:clearAllSchedulerLogs'))
    .then(function () {
      return cleanJobLog()
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('monitor:clearedSuccessfully'))
    })
    .catch(() => {})
}
/** 导出按钮操作 */
function handleExport() {
  proxy.download(
    'monitor/jobLog/export',
    proxy.addDateRange(
      {
        ...queryParams.value,
        jobId: queryParams.value.jobId || undefined,
        executionId: queryParams.value.executionId || undefined,
      },
      dateRange.value
    ),
    `job_log_${new Date().getTime()}.xlsx`
  )
}

// 使用稳定编号查询，任务改名或删除后仍能查看执行日志。
watch(
  () => [route.params.jobId, route.query.executionId],
  ([jobId, executionId]) => {
    queryParams.value.jobId = jobId && jobId != 0 ? jobId : undefined
    queryParams.value.executionId = executionId || undefined
    queryParams.value.jobName = undefined
    queryParams.value.jobGroup = undefined
    handleQuery()
  },
  { immediate: true }
)
// 时区变化后重新查询日期范围，保留正在编辑的表单。
watch(getDisplayTimezone, () => {
  if (dateRange.value?.length) {
    handleQuery()
  }
})
</script>
