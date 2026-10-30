<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
    >
      <el-form-item
        :label="$t('monitor:taskName')"
        prop="jobName"
      >
        <el-input
          v-model="queryParams.jobName"
          :placeholder="$t('monitor:enterATaskName')"
          clearable
          style="width: 200px"
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
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('monitor:taskStatus')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('monitor:selectTaskStatus')"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="dict in sys_job_status"
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
          v-hasPermi="['monitor:job:add']"
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
          v-hasPermi="['monitor:job:edit']"
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
          v-hasPermi="['monitor:job:remove']"
          >{{ $t('system:delete') }}</el-button
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
          type="info"
          plain
          icon="Operation"
          @click="handleJobLog"
          v-hasPermi="['monitor:job:query']"
          >{{ $t('monitor:logs') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="info"
          plain
          icon="Tickets"
          @click="handleRuntime('executions')"
          v-hasPermi="['monitor:job:query']"
          >{{ $t('monitor:executionHistoryLabel') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-loading="loading"
      :data="jobList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('monitor:taskID')"
        width="100"
        align="center"
        prop="jobId"
      />
      <el-table-column
        :label="$t('monitor:taskName')"
        align="center"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">
          <a
            class="link-type"
            style="cursor: pointer"
            @click="handleView(scope.row)"
            >{{ scope.row.jobName }}</a
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('monitor:businessGroup')"
        align="center"
        prop="jobGroup"
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
        :label="$t('monitor:cronExpressionLabel')"
        align="center"
        prop="cronExpression"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:cronTimeZone')"
        align="center"
        prop="timeZone"
        width="150"
      />
      <el-table-column
        :label="$t('monitor:schedulerSynchronization')"
        align="center"
        width="115"
      >
        <template #default="scope">
          <el-button
            v-if="canQueryRuntime"
            link
            :type="syncStates[scope.row.syncStatus]?.type || 'warning'"
            @click="handleRuntime('sync', scope.row)"
          >
            {{ syncStates[scope.row.syncStatus]?.label || $t('plugins:pendingSynchronization') }}
          </el-button>
          <span v-else>{{
            syncStates[scope.row.syncStatus]?.label || $t('plugins:pendingSynchronization')
          }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:status')"
        align="center"
      >
        <template #default="scope">
          <el-switch
            v-model="scope.row.status"
            active-value="0"
            inactive-value="1"
            :disabled="changingIds.has(scope.row.jobId)"
            :aria-label="$t('monitor:enabledStatusOfTaskValue', { jobName: scope.row.jobName })"
            @change="handleStatusChange(scope.row)"
          ></el-switch>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        width="200"
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-tooltip
            :content="$t('system:edit')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="Edit"
              @click="handleUpdate(scope.row)"
              v-hasPermi="['monitor:job:edit']"
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
              v-hasPermi="['monitor:job:remove']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('monitor:runOnce')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="CaretRight"
              :loading="runningIds.has(scope.row.jobId)"
              :aria-label="$t('monitor:runValueNow', { jobName: scope.row.jobName })"
              @click="handleRun(scope.row)"
              v-hasPermi="['monitor:job:changeStatus']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('layout:routes.jobLog')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="Operation"
              @click="handleJobLog(scope.row)"
              v-hasPermi="['monitor:job:query']"
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

    <!-- 添加或修改定时任务对话框 -->
    <el-dialog
      :title="typeof title === 'function' ? title() : title"
      v-model="open"
      width="820px"
      class="scrollbar"
      style="max-width: calc(100vw - 32px)"
      append-to-body
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
      :show-close="!submitting"
      destroy-on-close
    >
      <el-form
        ref="jobRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="120px"
      >
        <el-row>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:taskName')"
              prop="jobName"
            >
              <el-input
                v-model="form.jobName"
                maxlength="64"
                :placeholder="$t('monitor:namesMustBeUniqueWithinABusinessGroup')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('monitor:businessGroup')"
              prop="jobGroup"
            >
              <el-input
                v-model="form.jobGroup"
                maxlength="64"
                :placeholder="$t('monitor:forExampleDefaultReportsFileMaintenance')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="jobExecutor">
              <template #label>
                <span>
                  {{ $t('monitor:taskExecutor')
                  }}<el-tooltip placement="top">
                    <template #content>
                      <div>{{ $t('monitor:thisOptionHasNoEffectForAsynchronousFunctions') }}</div>
                    </template>
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-select
                v-model="form.jobExecutor"
                :placeholder="$t('monitor:selectTaskExecutor')"
              >
                <el-option
                  v-for="dict in sys_job_executor"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:jobStore')"
              prop="jobStore"
            >
              <el-select
                v-model="form.jobStore"
                :placeholder="$t('monitor:selectJobStore')"
              >
                <el-option
                  v-for="dict in sys_job_store"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                />
              </el-select>
              <div class="form-help">
                {{ $t('monitor:theMemoryStoreRebuildsSchedulesAfterARestartDatabaseAnd') }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item prop="invokeTarget">
              <template #label>
                <span>
                  {{ $t('monitor:callMethod')
                  }}<el-tooltip placement="top">
                    <template #content>
                      <div>{{ $t('monitor:exampleModuleTaskSchedulerTestJob') }}</div>
                    </template>
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-input
                v-model="form.invokeTarget"
                :placeholder="$t('monitor:enterCallTarget')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:positionalArguments')"
              prop="jobArgs"
            >
              <json-editor
                v-model="form.jobArgs"
                :label="$t('monitor:positionalArguments')"
                value-type="array"
                :validate="(value) => parseJobParameter(value, 'jobArgs')"
              />
              <div class="form-help">
                {{ $t('monitor:useForNoArgumentsArraysMayContainStringsNumbersBooleans') }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:keywordArguments')"
              prop="jobKwargs"
            >
              <json-editor
                v-model="form.jobKwargs"
                :label="$t('monitor:keywordArguments')"
                value-type="object"
                :validate="(value) => parseJobParameter(value, 'jobKwargs')"
              />
              <div class="form-help">
                {{ $t('monitor:useForNoArgumentsPropertyNamesMustMatchTheFunction') }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:cronExpressionLabelText')"
              prop="cronExpression"
            >
              <el-input
                v-model="form.cronExpression"
                :placeholder="$t('monitor:enterCronExpression')"
              >
                <template #append>
                  <el-button
                    type="primary"
                    @click="handleShowCron"
                  >
                    {{ $t('monitor:generateExpression')
                    }}<i class="el-icon-time el-icon--right"></i>
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:cronTimeZone')"
              prop="timeZone"
            >
              <el-select
                v-model="form.timeZone"
                filterable
                allow-create
                :placeholder="$t('monitor:selectAnIANATimeZone')"
              >
                <el-option
                  v-for="zone in timeZoneOptions"
                  :key="zone"
                  :label="zone"
                  :value="zone"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col
            :span="24"
            v-if="form.jobId !== undefined"
          >
            <el-form-item :label="$t('system:status')">
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in sys_job_status"
                  :key="dict.value"
                  :value="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:allowedDelay')"
              prop="misfireGraceTime"
            >
              <el-input-number
                v-if="!unlimitedDelay"
                v-model="form.misfireGraceTime"
                :min="1"
                :max="2147483647"
                :precision="0"
                controls-position="right"
                :aria-label="$t('monitor:allowedDelayInSeconds')"
              />
              <span
                v-if="!unlimitedDelay"
                class="field-unit"
                >{{ $t('components:seconds') }}</span
              >
              <el-switch
                v-model="unlimitedDelay"
                :active-text="$t('monitor:unlimitedDelay')"
                :aria-label="$t('monitor:allowUnlimitedDelay')"
              />
              <div class="form-help">
                {{ $t('monitor:measuredFromTheScheduledTimeRunsBeyondTheGracePeriod') }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:missedRuns')"
              prop="coalesce"
            >
              <el-radio-group v-model="form.coalesce">
                <el-radio-button :value="false">{{
                  $t('monitor:runEachOccurrence')
                }}</el-radio-button>
                <el-radio-button :value="true">{{
                  $t('monitor:runOnlyTheLatestOccurrence')
                }}</el-radio-button>
              </el-radio-group>
              <div class="form-help">
                {{ $t('monitor:usedWhenMultipleDueRunsAreFoundInOneCheck') }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:maximumConcurrency')"
              prop="maxInstances"
            >
              <el-input-number
                v-model="form.maxInstances"
                :min="1"
                :max="2147483647"
                :precision="0"
                controls-position="right"
              />
              <div class="form-help">
                {{ $t('monitor:scheduledAndManualRunsShareThisLimitExcessRunsAre') }}
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            type="primary"
            :loading="submitting"
            @click="submitForm"
            >{{ $t('system:confirm') }}</el-button
          >
          <el-button
            :disabled="submitting"
            @click="cancel"
            >{{ $t('system:cancel') }}</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-dialog
      :title="$t('monitor:cronExpressionGenerator')"
      v-model="openCron"
      append-to-body
      destroy-on-close
    >
      <crontab
        ref="crontabRef"
        :expression="expression"
        :time-zone="form.timeZone"
        @hide="openCron = false"
        @fill="crontabFill"
      />
    </el-dialog>

    <!-- 任务详细 -->
    <job-detail
      v-model:visible="openView"
      :row="form"
      type="job"
    />
    <job-runtime
      v-model:visible="runtimeOpen"
      :initial-tab="runtimeContext.tab"
      :job-id="runtimeContext.jobId"
      :execution-id="runtimeContext.executionId"
      @sync-updated="getList"
    />
  </div>
</template>

<script setup name="Job">
import { useLocaleForm } from '@/composables/useLocaleForm'
import { t } from '@/i18n/adapter'
import Crontab from '@/components/Crontab'
import JobDetail from './detail'
import JobRuntime from './runtime'
import JsonEditor from '@/components/JsonEditor'
import { parseJobParameter, buildJobPayload, syncStates, notifyJobMutation } from '@/utils/job'
import { checkPermi } from '@/utils/permission'
import {
  listJob,
  getJob,
  delJob,
  addJob,
  updateJob,
  runJob,
  changeJobStatus,
} from '@/api/monitor/job'
import useUserStore from '@/store/modules/user'

const router = useRouter()
const userStore = useUserStore()
const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.jobRef))
const { sys_job_status, sys_job_executor, sys_job_store } = proxy.useDict(
  'sys_job_status',
  'sys_job_executor',
  'sys_job_store'
)

const jobList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const openView = ref(false)
const openCron = ref(false)
const expression = ref('')
const submitting = ref(false)
const changingIds = reactive(new Set())
const runningIds = reactive(new Set())
const runtimeOpen = ref(false)
const runtimeContext = ref({ tab: 'executions' })
const canQueryRuntime = computed(() => checkPermi(['monitor:job:query']))
let syncRefreshTimer
let listController
let listVersion = 0
let pageActive = true
const timeZoneOptions =
  typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [userStore.appTimezone]

/** 显示对应参数字段的JSON格式错误 */
function validateParameter(rule, value, callback) {
  try {
    parseJobParameter(value, rule.field)
    callback()
  } catch (error) {
    callback(error)
  }
}

/** 校验允许延迟，空值表示不限延迟 */
function validateGraceTime(_rule, value, callback) {
  const valid = value === null || (Number.isInteger(value) && value >= 1 && value <= 2147483647)
  callback(valid ? undefined : new Error(t('monitor:allowedDelayMustBeAPositiveIntegerInSeconds')))
}

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    jobName: undefined,
    jobGroup: undefined,
    status: undefined,
  },
  rules: {
    jobName: [
      {
        required: true,
        get message() {
          return t('monitor:taskNameIsRequired')
        },
        trigger: 'blur',
      },
    ],
    jobGroup: [
      {
        required: true,
        whitespace: true,
        get message() {
          return t('monitor:businessGroupIsRequired')
        },
        trigger: 'blur',
      },
    ],
    jobStore: [
      {
        required: true,
        get message() {
          return t('monitor:jobStoreIsRequired')
        },
        trigger: 'change',
      },
    ],
    jobArgs: [{ validator: validateParameter, trigger: 'blur' }],
    jobKwargs: [{ validator: validateParameter, trigger: 'blur' }],
    maxInstances: [
      {
        required: true,
        type: 'number',
        min: 1,
        get message() {
          return t('monitor:maximumConcurrencyMustBeAPositiveInteger')
        },
        trigger: 'change',
      },
    ],
    misfireGraceTime: [{ validator: validateGraceTime, trigger: 'change' }],
    invokeTarget: [
      {
        required: true,
        get message() {
          return t('monitor:callTargetIsRequired')
        },
        trigger: 'blur',
      },
    ],
    cronExpression: [
      {
        required: true,
        get message() {
          return t('monitor:cronExpressionIsRequired')
        },
        trigger: 'change',
      },
    ],
    timeZone: [
      {
        required: true,
        get message() {
          return t('monitor:cronTimeZoneIsRequired')
        },
        trigger: 'blur',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)
const unlimitedDelay = computed({
  get: () => form.value.misfireGraceTime === null,
  set: (value) => {
    form.value.misfireGraceTime = value ? null : 1
  },
})

/** 查询定时任务列表 */
async function getList(options = {}) {
  const silent = options?.silent === true
  clearTimeout(syncRefreshTimer)
  listController?.abort()
  listController = new AbortController()
  const version = ++listVersion
  if (!silent) loading.value = true
  try {
    const response = await listJob(
      { ...queryParams.value },
      { signal: listController.signal, skipErrorMessage: silent }
    )
    if (version !== listVersion) return
    jobList.value = response.rows
    total.value = response.total
  } catch {
    // 保留当前列表；主动请求的失败信息由请求层显示。
  } finally {
    if (version === listVersion) {
      loading.value = false
      if (
        pageActive &&
        !document.hidden &&
        jobList.value.some((job) => ['pending', 'failed'].includes(job.syncStatus))
      ) {
        syncRefreshTimer = setTimeout(() => getList({ silent: true }), 3000)
      }
    }
  }
}

/** 打开任务运行记录 */
function handleRuntime(tab, row, executionId) {
  if (!canQueryRuntime.value) return
  runtimeContext.value = { tab, jobId: row?.jobId, executionId }
  runtimeOpen.value = true
}

/** 显示任务变更结果 */
function showMutationResult(response) {
  notifyJobMutation(proxy.$modal, response)
  if (response.data?.syncStatus === 'failed') {
    const affected = response.data.jobs
    handleRuntime('sync', affected?.length === 1 ? affected[0] : undefined)
  }
}
/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}
/** 表单重置 */
function reset() {
  form.value = {
    jobId: undefined,
    jobName: undefined,
    jobGroup: 'default',
    jobStore: 'default',
    jobExecutor: 'default',
    jobArgs: '[]',
    jobKwargs: '{}',
    invokeTarget: undefined,
    cronExpression: undefined,
    timeZone: userStore.appTimezone,
    misfireGraceTime: 1,
    coalesce: false,
    maxInstances: 1,
    status: '1',
  }
  proxy.resetForm('jobRef')
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
// 多选框选中数据
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.jobId)
  single.value = selection.length != 1
  multiple.value = !selection.length
}
// 任务状态修改
async function handleStatusChange(row) {
  if (changingIds.has(row.jobId)) return
  changingIds.add(row.jobId)
  let text = row.status === '0' ? t('system:enable') : t('system:disabled')
  try {
    await proxy.$modal.confirm(t('monitor:valueTaskValue', { text, jobName: row.jobName }))
    const response = await changeJobStatus(row.jobId, row.status)
    showMutationResult(response)
    await getList()
  } catch {
    row.status = row.status === '0' ? '1' : '0'
  } finally {
    changingIds.delete(row.jobId)
  }
}
/* 立即执行一次 */
async function handleRun(row) {
  if (runningIds.has(row.jobId)) return
  runningIds.add(row.jobId)
  try {
    await proxy.$modal.confirm(t('monitor:runTaskValueOnceNow', { jobName: row.jobName }))
    const response = await runJob(row.jobId)
    proxy.$modal.msg(response.msg)
    handleRuntime('executions', row, response.data.executionId)
  } catch {
    // 用户取消或请求层已显示失败原因。
  } finally {
    runningIds.delete(row.jobId)
  }
}
/** 任务详细信息 */
function handleView(row) {
  getJob(row.jobId).then((response) => {
    form.value = response.data
    openView.value = true
  })
}
/** cron表达式按钮操作 */
function handleShowCron() {
  expression.value = form.value.cronExpression
  openCron.value = true
}
/** 确定后回传值 */
function crontabFill(value) {
  form.value.cronExpression = value
}
/** 任务日志列表查询 */
function handleJobLog(row) {
  const jobId = row.jobId || 0
  router.push('/monitor/job-log/index/' + jobId)
}
/** 新增按钮操作 */
function handleAdd() {
  reset()
  open.value = true
  title.value = () => t('monitor:addTask')
}
/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  const jobId = row.jobId || ids.value
  getJob(jobId).then((response) => {
    form.value = {
      ...response.data,
      jobArgs: JSON.stringify(response.data.jobArgs ?? [], null, 2),
      jobKwargs: JSON.stringify(response.data.jobKwargs ?? {}, null, 2),
    }
    open.value = true
    title.value = () => t('monitor:editTask')
  })
}
/** 提交按钮 */
async function submitForm() {
  if (submitting.value) return
  submitting.value = true
  try {
    const valid = await proxy.$refs['jobRef'].validate().catch(() => false)
    if (!valid) return
    const save = form.value.jobId != undefined ? updateJob : addJob
    const response = await save(buildJobPayload(form.value))
    open.value = false
    showMutationResult(response)
    await getList()
  } catch {
    // 校验或保存失败时保留表单；同步失败通过已保存响应单独展示。
  } finally {
    submitting.value = false
  }
}
/** 删除按钮操作 */
function handleDelete(row) {
  const jobIds = row.jobId || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: jobIds }))
    .then(function () {
      return delJob(jobIds)
    })
    .then((response) => {
      getList()
      showMutationResult(response)
    })
    .catch(() => {})
}
/** 导出按钮操作 */
function handleExport() {
  proxy.download(
    'monitor/job/export',
    {
      ...queryParams.value,
    },
    `job_${new Date().getTime()}.xlsx`
  )
}

/** 停止列表刷新并取消未完成的请求 */
function stopListRefresh() {
  clearTimeout(syncRefreshTimer)
  listController?.abort()
  listVersion++
  loading.value = false
}

/** 处理页面显示状态变化 */
function handlePageVisibility() {
  if (document.hidden) stopListRefresh()
  else if (pageActive) getList({ silent: true })
}

onMounted(() => document.addEventListener('visibilitychange', handlePageVisibility))
onActivated(() => {
  if (!pageActive) {
    pageActive = true
    getList()
  }
})
onDeactivated(() => {
  pageActive = false
  stopListRefresh()
})
onBeforeUnmount(() => {
  pageActive = false
  stopListRefresh()
  document.removeEventListener('visibilitychange', handlePageVisibility)
})
getList()
</script>

<style scoped>
.form-help {
  width: 100%;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-top: 4px;
}
.field-unit {
  margin: 0 16px 0 8px;
}
</style>
