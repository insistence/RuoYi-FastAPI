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
        :label="$t('monitor:job.name')"
        prop="jobName"
      >
        <el-input
          v-model="queryParams.jobName"
          :placeholder="$t('monitor:job.namePlaceholder')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('monitor:job.groupName')"
        prop="jobGroup"
      >
        <el-input
          v-model="queryParams.jobGroup"
          :placeholder="$t('monitor:interface.enterATaskGroupName')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('monitor:messages.taskStatus')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('monitor:messages.selectTaskStatus')"
          clearable
        >
          <el-option
            v-for="dict in dict.type.sys_job_status"
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
          v-hasPermi="['monitor:job:add']"
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
          v-hasPermi="['monitor:job:edit']"
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
          v-hasPermi="['monitor:job:remove']"
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
          v-hasPermi="['monitor:job:export']"
          >{{ $t('common:export') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="info"
          plain
          icon="el-icon-s-operation"
          size="mini"
          @click="handleJobLog"
          v-hasPermi="['monitor:job:query']"
          >{{ $t('monitor:messages.logs') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="info"
          plain
          icon="el-icon-tickets"
          size="mini"
          @click="handleRuntime('executions')"
          v-hasPermi="['monitor:job:query']"
          >{{ $t('monitor:messages.executionHistory') }}</el-button
        >
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
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
        :label="$t('monitor:job.id')"
        width="100"
        align="center"
        prop="jobId"
      />
      <el-table-column
        :label="$t('monitor:job.name')"
        min-width="120"
        align="center"
        :show-overflow-tooltip="true"
      >
        <template slot-scope="scope">
          <a
            class="link-type"
            style="cursor: pointer"
            @click="handleView(scope.row)"
            >{{ scope.row.jobName }}</a
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('monitor:job.groupName')"
        min-width="100"
        align="center"
        prop="jobGroup"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:messages.callTarget')"
        min-width="130"
        align="center"
        prop="invokeTarget"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:messages.cronExpression')"
        min-width="130"
        align="center"
        prop="cronExpression"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:job.timezone')"
        align="center"
        prop="timeZone"
        width="150"
      />
      <el-table-column
        :label="$t('common:status')"
        align="center"
        width="80"
      >
        <template slot-scope="scope">
          <el-switch
            v-model="scope.row.status"
            active-value="0"
            inactive-value="1"
            :aria-label="$t('monitor:job.toggleLabel', { name: scope.row.jobName })"
            :disabled="changingIds.includes(scope.row.jobId)"
            @change="handleStatusChange(scope.row)"
          ></el-switch>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('common:syncStatus')"
        align="center"
        width="100"
      >
        <template slot-scope="scope">
          <el-button
            v-if="canQueryRuntime"
            size="mini"
            type="text"
            @click="handleRuntime('sync', scope.row)"
          >
            {{ (syncStates[scope.row.syncStatus] || syncStates.pending).label }}
          </el-button>
          <el-tag
            v-else
            size="small"
            :type="(syncStates[scope.row.syncStatus] || syncStates.pending).type"
          >
            {{ (syncStates[scope.row.syncStatus] || syncStates.pending).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('common:actions')"
        align="center"
        fixed="right"
        width="180"
        class-name="small-padding fixed-width"
      >
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['monitor:job:edit']"
            >{{ $t('common:edit') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['monitor:job:remove']"
            >{{ $t('common:delete') }}</el-button
          >
          <el-dropdown
            size="mini"
            @command="(command) => handleCommand(command, scope.row)"
            v-hasPermi="['monitor:job:changeStatus', 'monitor:job:query']"
          >
            <el-button
              size="mini"
              type="text"
              icon="el-icon-d-arrow-right"
              >{{ $t('common:more') }}</el-button
            >
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item
                command="handleRun"
                icon="el-icon-caret-right"
                :disabled="runningIds.includes(scope.row.jobId)"
                v-hasPermi="['monitor:job:changeStatus']"
                >{{ $t('monitor:job.runOnce') }}</el-dropdown-item
              >
              <el-dropdown-item
                command="handleJobLog"
                icon="el-icon-s-operation"
                v-hasPermi="['monitor:job:query']"
                >{{ $t('layout:routes.jobLog') }}</el-dropdown-item
              >
              <el-dropdown-item
                command="handleExecutions"
                icon="el-icon-tickets"
                v-hasPermi="['monitor:job:query']"
                >{{ $t('monitor:job.history') }}</el-dropdown-item
              >
              <el-dropdown-item
                command="handleSync"
                icon="el-icon-refresh"
                v-hasPermi="['monitor:job:query']"
                >{{ $t('common:syncStatus') }}</el-dropdown-item
              >
            </el-dropdown-menu>
          </el-dropdown>
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

    <!-- 添加或修改定时任务对话框 -->
    <el-dialog
      :title="$t(titleKey)"
      :visible.sync="open"
      width="800px"
      append-to-body
    >
      <el-form
        :validate-on-rule-change="false"
        ref="form"
        :model="form"
        :rules="rules"
        label-width="120px"
      >
        <el-row>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:job.name')"
              prop="jobName"
            >
              <el-input
                v-model="form.jobName"
                :placeholder="$t('monitor:job.namePlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('monitor:job.group')"
              prop="jobGroup"
            >
              <el-input
                v-model="form.jobGroup"
                :placeholder="$t('monitor:messages.enterBusinessGroup')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="jobExecutor">
              <span slot="label">
                {{ $t('monitor:job.executor') }}
                <el-tooltip placement="top">
                  <div slot="content">
                    {{ $t('monitor:messages.thisOptionHasNoEffectForAsynchronousFunctions') }}
                  </div>
                  <i class="el-icon-question"></i>
                </el-tooltip>
              </span>
              <el-select
                v-model="form.jobExecutor"
                :placeholder="$t('monitor:messages.selectTaskExecutor')"
              >
                <el-option
                  v-for="dict in dict.type.sys_job_executor"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('monitor:job.store')"
              prop="jobStore"
            >
              <el-select
                v-model="form.jobStore"
                :placeholder="$t('monitor:messages.selectJobStore')"
              >
                <el-option
                  v-for="dict in dict.type.sys_job_store"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('monitor:job.timezone')"
              prop="timeZone"
            >
              <el-select
                v-model="form.timeZone"
                filterable
                allow-create
                :placeholder="$t('monitor:messages.selectAnIANATimeZone')"
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
          <el-col :span="24">
            <el-form-item prop="invokeTarget">
              <span slot="label">
                {{ $t('monitor:messages.callMethod') }}
                <el-tooltip placement="top">
                  <div slot="content">
                    {{ $t('monitor:messages.exampleModuleTaskSchedulerTestJob') }}
                  </div>
                  <i class="el-icon-question"></i>
                </el-tooltip>
              </span>
              <el-input
                v-model="form.invokeTarget"
                :placeholder="$t('monitor:messages.enterCallTarget')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:job.args')"
              prop="jobArgs"
            >
              <json-editor
                v-model="form.jobArgs"
                :label="$t('monitor:job.args')"
                value-type="array"
                :validate="(value) => parseJobParameter(value, 'jobArgs')"
              />
              <div class="form-help">
                {{ $t('monitor:interface.useAJSONArrayEnterWhenNoArgumentsAreNeeded') }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:job.kwargs')"
              prop="jobKwargs"
            >
              <json-editor
                v-model="form.jobKwargs"
                :label="$t('monitor:job.kwargs')"
                value-type="object"
                :validate="(value) => parseJobParameter(value, 'jobKwargs')"
              />
              <div class="form-help">
                {{ $t('monitor:interface.useAJSONObjectEnterWhenNoArgumentsAreNeeded') }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:messages.cronExpression')"
              prop="cronExpression"
            >
              <el-input
                v-model="form.cronExpression"
                :placeholder="$t('monitor:messages.enterCronExpression')"
              >
                <template slot="append">
                  <el-button
                    type="primary"
                    @click="handleShowCron"
                  >
                    {{ $t('monitor:messages.generateExpression') }}
                    <i class="el-icon-time el-icon--right"></i>
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col
            :span="24"
            v-if="form.jobId !== undefined"
          >
            <el-form-item :label="$t('common:status')">
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in dict.type.sys_job_status"
                  :key="dict.value"
                  :label="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('monitor:messages.allowedDelay')"
              prop="misfireGraceTime"
            >
              <el-input-number
                v-if="!unlimitedDelay"
                v-model="form.misfireGraceTime"
                :min="1"
                :max="2147483647"
                :precision="0"
                controls-position="right"
                :aria-label="$t('monitor:messages.allowedDelayInSeconds')"
              />
              <span
                v-if="!unlimitedDelay"
                class="field-unit"
                >{{ $t('common:seconds') }}</span
              >
              <el-checkbox v-model="unlimitedDelay">{{
                $t('monitor:messages.unlimitedDelay')
              }}</el-checkbox>
              <div class="form-help">
                {{
                  $t(
                    'monitor:interface.runsBeyondTheAllowedDelayAreSkippedUnlimitedDelayAllowsOverdueRunsToExecute'
                  )
                }}
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('monitor:messages.missedRuns')"
              prop="coalesce"
            >
              <el-radio-group
                v-model="form.coalesce"
                size="small"
              >
                <el-radio-button :label="false">{{
                  $t('monitor:messages.runEachOccurrence')
                }}</el-radio-button>
                <el-radio-button :label="true">{{
                  $t('monitor:expression.latestOnly')
                }}</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('monitor:messages.maximumConcurrency')"
              prop="maxInstances"
            >
              <el-input-number
                v-model="form.maxInstances"
                :min="1"
                :max="2147483647"
                :precision="0"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item>
              <div class="form-help">
                {{
                  $t(
                    'monitor:interface.backlogProcessingRespectsTheAllowedDelayScheduledAndManualRunsShareTheConcurrencyLimit'
                  )
                }}
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <div
        slot="footer"
        class="dialog-footer"
      >
        <el-button
          type="primary"
          :loading="submitting"
          @click="submitForm"
          >{{ $t('common:confirm') }}</el-button
        >
        <el-button
          :disabled="submitting"
          @click="cancel"
          >{{ $t('common:cancel') }}</el-button
        >
      </div>
    </el-dialog>

    <el-dialog
      :title="$t('monitor:messages.cronExpressionGenerator')"
      :visible.sync="openCron"
      append-to-body
      destroy-on-close
      class="scrollbar"
    >
      <crontab
        @hide="openCron = false"
        @fill="crontabFill"
        :expression="expression"
        :time-zone="form.timeZone"
      ></crontab>
    </el-dialog>

    <!-- 任务详细 -->
    <job-detail
      :visible.sync="openView"
      :row="form"
      type="job"
    />
    <job-runtime
      :visible.sync="runtimeOpen"
      :initial-tab="runtimeContext.tab"
      :job-id="runtimeContext.jobId"
      :execution-id="runtimeContext.executionId"
      @sync-updated="getList"
    />
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import {
  listJob,
  getJob,
  delJob,
  addJob,
  updateJob,
  runJob,
  changeJobStatus,
} from '@/api/monitor/job'
import JobDetail from './detail'
import Crontab from '@/components/Crontab'
import JobRuntime from './runtime'
import JsonEditor from '@/components/JsonEditor'
import {
  parseJobParameter,
  buildJobPayload,
  syncStates,
  notifyJobMutation,
} from '@/utils/jobDisplay'
import { checkPermi } from '@/utils/permission'

export default {
  components: { Crontab, JobDetail, JobRuntime, JsonEditor },
  name: 'Job',
  dicts: ['sys_job_status', 'sys_job_executor', 'sys_job_store'],
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
      // 定时任务表格数据
      jobList: [],
      // 弹出层标题
      titleKey: '',
      // 是否显示弹出层
      open: false,
      // 是否显示详细弹出层
      openView: false,
      // 是否显示Cron表达式弹出层
      openCron: false,
      // 传入的表达式
      expression: '',
      submitting: false,
      changingIds: [],
      runningIds: [],
      runtimeOpen: false,
      runtimeContext: {
        tab: 'executions',
      },
      timeZoneOptions:
        typeof Intl.supportedValuesOf === 'function'
          ? Intl.supportedValuesOf('timeZone')
          : [this.$store.state.user.appTimezone],
      syncStates: syncStates,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        jobName: undefined,
        jobGroup: undefined,
        status: undefined,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        timeZone: [
          {
            required: true,
            message: () => t('monitor:messages.cronTimeZoneIsRequired'),
            trigger: 'blur',
          },
        ],
        misfireGraceTime: [
          {
            validator: this.validateGraceTime,
            trigger: 'change',
          },
        ],
        maxInstances: [
          {
            required: true,
            type: 'number',
            min: 1,
            message: () => t('monitor:messages.maximumConcurrencyMustBeAPositiveInteger'),
            trigger: 'change',
          },
        ],
        jobKwargs: [
          {
            validator: this.validateParameter,
            trigger: 'blur',
          },
        ],
        jobArgs: [
          {
            validator: this.validateParameter,
            trigger: 'blur',
          },
        ],
        jobStore: [
          {
            required: true,
            message: () => t('monitor:messages.jobStoreIsRequired'),
            trigger: 'change',
          },
        ],
        jobGroup: [
          {
            required: true,
            whitespace: true,
            message: () => t('monitor:messages.businessGroupIsRequired'),
            trigger: 'blur',
          },
        ],
        jobName: [
          {
            required: true,
            message: () => t('monitor:messages.taskNameIsRequired'),
            trigger: 'blur',
          },
        ],
        invokeTarget: [
          {
            required: true,
            message: () => t('monitor:messages.callTargetIsRequired'),
            trigger: 'blur',
          },
        ],
        cronExpression: [
          {
            required: true,
            message: () => t('monitor:messages.cronExpressionIsRequired'),
            trigger: 'blur',
          },
        ],
      },
    }
  },
  computed: {
    canQueryRuntime() {
      return checkPermi(['monitor:job:query'])
    },
    unlimitedDelay: {
      get() {
        return this.form.misfireGraceTime === null
      },
      set(value) {
        this.form.misfireGraceTime = value ? null : 1
      },
    },
  },
  beforeCreate() {
    this._syncRefreshTimer = undefined
    this._listController = undefined
    this._listVersion = 0
    this._pageActive = true
  },
  created() {
    this.getList()
  },
  mounted() {
    document.addEventListener('visibilitychange', this.handlePageVisibility)
  },
  activated() {
    if (!this._pageActive) {
      this._pageActive = true
      this.getList()
    }
  },
  deactivated() {
    this._pageActive = false
    this.stopListRefresh()
  },
  beforeDestroy() {
    this._pageActive = false
    this.stopListRefresh()
    document.removeEventListener('visibilitychange', this.handlePageVisibility)
  },
  methods: {
    parseJobParameter,
    validateParameter(rule, value, callback) {
      try {
        parseJobParameter(value, rule.field)
        callback()
      } catch (error) {
        callback(error)
      }
    },
    validateGraceTime(_rule, value, callback) {
      const valid = value === null || (Number.isInteger(value) && value >= 1 && value <= 2147483647)
      callback(
        valid
          ? undefined
          : new Error(t('monitor:messages.allowedDelayMustBeAPositiveIntegerInSeconds'))
      )
    },
    handleRuntime(tab, row, executionId) {
      if (!this.canQueryRuntime) return
      this.runtimeContext = {
        tab,
        jobId: row?.jobId,
        executionId,
      }
      this.runtimeOpen = true
    },
    showMutationResult(response) {
      notifyJobMutation(this.$modal, response)
      if (response.data?.syncStatus === 'failed') {
        const affected = response.data.jobs
        this.handleRuntime('sync', affected?.length === 1 ? affected[0] : undefined)
      }
    },
    stopListRefresh() {
      clearTimeout(this._syncRefreshTimer)
      this._listController?.abort()
      this._listVersion++
      this.loading = false
    },
    handlePageVisibility() {
      if (document.hidden) this.stopListRefresh()
      else if (this._pageActive)
        this.getList({
          silent: true,
        })
    },
    /** 查询定时任务列表 */
    async getList(options = {}) {
      const silent = options?.silent === true
      clearTimeout(this._syncRefreshTimer)
      this._listController?.abort()
      this._listController = new AbortController()
      const version = ++this._listVersion
      if (!silent) this.loading = true
      try {
        const response = await listJob(
          {
            ...this.queryParams,
          },
          {
            signal: this._listController.signal,
            skipErrorMessage: silent,
          }
        )
        if (version !== this._listVersion) return
        this.jobList = response.rows
        this.total = response.total
      } catch {
        // 保留当前列表；主动请求的失败信息由请求层显示。
      } finally {
        if (version === this._listVersion) {
          this.loading = false
          if (
            this._pageActive &&
            !document.hidden &&
            this.jobList.some((job) => ['pending', 'failed'].includes(job.syncStatus))
          ) {
            this._syncRefreshTimer = setTimeout(
              () =>
                this.getList({
                  silent: true,
                }),
              3000
            )
          }
        }
      }
    },
    // 任务执行器名字典翻译
    jobExecutorFormat(row, column) {
      return this.selectDictLabel(this.dict.type.sys_job_executor, row.jobExecutor)
    },
    // 取消按钮
    cancel() {
      this.open = false
      this.reset()
    },
    // 表单重置
    reset() {
      this.form = {
        jobId: undefined,
        jobName: undefined,
        jobGroup: 'default',
        jobStore: 'default',
        jobExecutor: 'default',
        jobArgs: '[]',
        jobKwargs: '{}',
        invokeTarget: undefined,
        cronExpression: undefined,
        timeZone: this.$store.state.user.appTimezone,
        misfireGraceTime: 1,
        coalesce: false,
        maxInstances: 1,
        status: '1',
      }
      this.resetForm('form')
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm('queryForm')
      this.handleQuery()
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map((item) => item.jobId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    // 更多操作触发
    handleCommand(command, row) {
      switch (command) {
        case 'handleRun':
          this.handleRun(row)
          break
        case 'handleView':
          this.handleView(row)
          break
        case 'handleExecutions':
          this.handleRuntime('executions', row)
          break
        case 'handleSync':
          this.handleRuntime('sync', row)
          break
        case 'handleJobLog':
          this.handleJobLog(row)
          break
        default:
          break
      }
    },
    // 任务状态修改
    async handleStatusChange(row) {
      if (this.changingIds.includes(row.jobId)) return
      this.changingIds.push(row.jobId)
      let text = row.status === '0' ? t('common:enable') : t('common:disable')
      try {
        await this.$modal.confirm(t('monitor:messages.task', { text, jobName: row.jobName }))
        const response = await changeJobStatus(row.jobId, row.status)
        this.showMutationResult(response)
        await this.getList()
      } catch {
        row.status = row.status === '0' ? '1' : '0'
      } finally {
        this.changingIds = this.changingIds.filter((id) => id !== row.jobId)
      }
    },
    /* 立即执行一次 */
    async handleRun(row) {
      if (this.runningIds.includes(row.jobId)) return
      this.runningIds.push(row.jobId)
      try {
        await this.$modal.confirm(t('monitor:messages.runTaskOnceNow', { jobName: row.jobName }))
        const response = await runJob(row.jobId)
        this.$modal.msg(response.msg)
        this.handleRuntime('executions', row, response.data.executionId)
      } catch {
        // 用户取消或请求层已显示失败原因。
      } finally {
        this.runningIds = this.runningIds.filter((id) => id !== row.jobId)
      }
    },
    /** 任务详细信息 */
    handleView(row) {
      getJob(row.jobId).then((response) => {
        this.form = response.data
        this.openView = true
      })
    },
    /** cron表达式按钮操作 */
    handleShowCron() {
      this.expression = this.form.cronExpression
      this.openCron = true
    },
    /** 确定后回传值 */
    crontabFill(value) {
      this.form.cronExpression = value
    },
    /** 任务日志列表查询 */
    handleJobLog(row) {
      const jobId = row.jobId || 0
      this.$router.push('/monitor/job-log/index/' + jobId)
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset()
      this.open = true
      this.titleKey = 'monitor:messages.addTask'
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      const jobId = row.jobId || this.ids
      getJob(jobId).then((response) => {
        this.form = {
          ...response.data,
          jobArgs: JSON.stringify(response.data.jobArgs ?? [], null, 2),
          jobKwargs: JSON.stringify(response.data.jobKwargs ?? {}, null, 2),
        }
        this.open = true
        this.titleKey = 'monitor:messages.editTask'
      })
    },
    /** 提交按钮 */
    submitForm() {
      if (this.submitting) return
      this.$refs['form'].validate(async (valid) => {
        if (!valid || this.submitting) return
        this.submitting = true
        try {
          const save = this.form.jobId != undefined ? updateJob : addJob
          const response = await save(buildJobPayload(this.form))
          this.open = false
          this.showMutationResult(response)
          this.getList()
        } catch {
          // 保存失败时保留表单；配置已保存但同步失败时显示同步状态。
        } finally {
          this.submitting = false
        }
      })
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      const jobIds = row.jobId || this.ids
      this.$modal
        .confirm(t('monitor:confirmation.deleteScheduledTasksWithIDsValue', { value0: jobIds }))
        .then(function () {
          return delJob(jobIds)
        })
        .then((response) => {
          this.getList()
          this.showMutationResult(response)
        })
        .catch(() => {})
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download(
        'monitor/job/export',
        {
          ...this.queryParams,
        },
        `job_${new Date().getTime()}.xlsx`
      )
    },
  },
}
</script>

<style scoped>
.form-help {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}
.field-unit {
  margin: 0 16px 0 8px;
}
</style>
