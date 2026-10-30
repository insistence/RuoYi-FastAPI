<template>
  <el-dialog
    :title="
      type === 'log'
        ? $t('monitor:expression.schedulerLogDetails')
        : $t('monitor:expression.taskDetails')
    "
    :visible.sync="dialogVisible"
    width="780px"
    append-to-body
  >
    <div class="detail-wrap">
      <template v-if="type === 'log'">
        <!-- 基本信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <i class="el-icon-info"></i> {{ $t('common:basicInfo') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:log.id') }}</span>
                <span class="detail-value">{{ form.jobLogId }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.executionStatus') }}</span>
                <el-tag
                  v-if="form.status == 0"
                  type="success"
                  size="small"
                  >{{ $t('layout:notices.active') }}</el-tag
                >
                <el-tag
                  v-else
                  type="danger"
                  size="small"
                  >{{ $t('common:failed') }}</el-tag
                >
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('common:startTime') }}</span>
                <span class="detail-value">{{ formatTime(form.startTime) }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('common:endTime') }}</span>
                <span class="detail-value">{{ formatTime(form.endTime) }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.recordedAt') }}</span>
                <span class="detail-value">{{ formatTime(form.createTime) }}</span>
              </div>
            </el-col>
            <el-col
              v-if="form.runDurationMs != null"
              :span="12"
            >
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.executionDuration') }}</span>
                <span class="detail-value"
                  >{{ form.runDurationMs }} {{ $t('common:milliseconds') }}</span
                >
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.id') }}</span>
                <span class="detail-value">{{ form.jobId || '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.scheduledTime') }}</span>
                <span class="detail-value">{{ formatTime(form.scheduledTime) }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.executionID') }}</span>
                <span class="detail-value">{{ form.executionId || '-' }}</span>
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 任务信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <i class="el-icon-time"></i> {{ $t('monitor:messages.taskInformation') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.name') }}</span>
                <span class="detail-value">{{ form.jobName }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.group') }}</span>
                <span class="detail-value">{{ form.jobGroup || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.executor') }}</span>
                <dict-tag
                  :options="dict.type.sys_job_executor"
                  :value="form.jobExecutor"
                />
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.taskTrigger') }}</span>
                <span class="detail-value">{{ form.jobTrigger || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.store') }}</span>
                <dict-tag
                  :options="dict.type.sys_job_store"
                  :value="form.jobStore"
                />
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.timezone') }}</span>
                <span class="detail-value">{{ form.timeZone || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.logInformation') }}</span>
                <span class="detail-value">{{ form.jobMessage }}</span>
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 调用信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <i class="el-icon-s-operation"></i> {{ $t('monitor:interface.callDetails') }}
          </div>
          <div class="code-body">
            <div class="code-field">
              <div class="code-field-label">{{ $t('monitor:job.target') }}</div>
              <div class="code-wrap">
                <pre class="code-pre">{{ form.invokeTarget || $t('monitor:expression.none') }}</pre>
              </div>
            </div>
            <div class="code-field">
              <div class="code-field-label">{{ $t('monitor:job.args') }}</div>
              <div class="code-wrap">
                <pre class="code-pre">{{ formatParameter(form.jobArgs) }}</pre>
              </div>
            </div>
            <div class="code-field">
              <div class="code-field-label">{{ $t('monitor:job.kwargs') }}</div>
              <div class="code-wrap">
                <pre class="code-pre">{{ formatParameter(form.jobKwargs) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 异常信息 -->
        <div
          v-if="form.status == 1"
          class="detail-card"
        >
          <div class="detail-card-title error-title">
            <i class="el-icon-warning"></i> {{ $t('monitor:messages.exceptionDetails') }}
          </div>
          <div class="error-body">
            <div class="error-msg">{{ form.exceptionInfo }}</div>
          </div>
        </div>
      </template>

      <template v-else>
        <!-- 任务配置 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <i class="el-icon-setting"></i> {{ $t('monitor:messages.taskConfiguration') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.id') }}</span>
                <span class="detail-value">{{ form.jobId }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.name') }}</span>
                <span class="detail-value">{{ form.jobName }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.group') }}</span>
                <span class="detail-value">{{ form.jobGroup || '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.executionStatus') }}</span>
                <el-tag
                  v-if="form.status == 0"
                  type="success"
                  size="small"
                  >{{ $t('layout:notices.active') }}</el-tag
                >
                <el-tag
                  v-else
                  type="info"
                  size="small"
                  >{{ $t('monitor:messages.pause') }}</el-tag
                >
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.executor') }}</span>
                <dict-tag
                  :options="dict.type.sys_job_executor"
                  :value="form.jobExecutor"
                />
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.store') }}</span>
                <dict-tag
                  :options="dict.type.sys_job_store"
                  :value="form.jobStore"
                />
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 调度信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <i class="el-icon-date"></i> {{ $t('monitor:messages.schedulingInformation') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.cronExpression') }}</span>
                <span class="detail-value">{{ form.cronExpression }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:job.timezone') }}</span>
                <span class="detail-value">{{ form.timeZone || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{
                  $t('monitor:interface.expectedExecutionTime')
                }}</span>
                <span class="detail-value">{{ formatTime(form.cronNextTime) }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:interface.nextScheduledTime') }}</span>
                <span class="detail-value">{{ formatTime(form.nextRunTime) }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.schedulerObservedAt') }}</span>
                <span class="detail-value">{{ formatTime(form.scheduleObservedTime) }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.allowedDelay') }}</span>
                <span class="detail-value">{{
                  form.misfireGraceTime === null
                    ? $t('monitor:messages.unlimitedDelay')
                    : $t('common:time.seconds', { value: form.misfireGraceTime })
                }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.missedRuns') }}</span>
                <span class="detail-value">{{
                  form.coalesce
                    ? $t('monitor:expression.latestOnly')
                    : $t('monitor:messages.runEachOccurrence')
                }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.maximumConcurrency') }}</span>
                <span class="detail-value">{{ form.maxInstances }}</span>
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 调度同步状态 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <i class="el-icon-refresh"></i> {{ $t('common:syncStatus') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('common:syncStatus') }}</span>
                <el-tag
                  size="small"
                  :type="syncState.type"
                  >{{ syncState.label }}</el-tag
                >
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.lastAppliedAt') }}</span>
                <span class="detail-value">{{ formatTime(form.appliedTime) }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.configurationVersion') }}</span>
                <span class="detail-value">{{
                  form.configVersion == null ? '-' : form.configVersion
                }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.appliedVersion') }}</span>
                <span class="detail-value">{{
                  form.appliedVersion == null ? '-' : form.appliedVersion
                }}</span>
              </div>
            </el-col>
          </el-row>
          <div
            v-if="form.syncError"
            class="error-body"
          >
            <div class="error-msg">{{ form.syncError }}</div>
          </div>
        </div>

        <!-- 执行方法 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <i class="el-icon-s-operation"></i> {{ $t('monitor:messages.executionMethod') }}
          </div>
          <div class="code-body">
            <div class="code-field">
              <div class="code-field-label">{{ $t('monitor:job.target') }}</div>
              <div class="code-wrap">
                <pre class="code-pre">{{ form.invokeTarget || $t('monitor:expression.none') }}</pre>
              </div>
            </div>
            <div class="code-field">
              <div class="code-field-label">{{ $t('monitor:job.args') }}</div>
              <div class="code-wrap">
                <pre class="code-pre">{{ formatParameter(form.jobArgs) }}</pre>
              </div>
            </div>
            <div class="code-field">
              <div class="code-field-label">{{ $t('monitor:job.kwargs') }}</div>
              <div class="code-wrap">
                <pre class="code-pre">{{ formatParameter(form.jobKwargs) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 元信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <i class="el-icon-document"></i> {{ $t('monitor:messages.metadata') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.createdBy') }}</span>
                <span class="detail-value">{{ form.createBy || '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('common:createdTime') }}</span>
                <span class="detail-value">{{ formatTime(form.createTime) }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:messages.updatedBy') }}</span>
                <span class="detail-value">{{ form.updateBy || '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('common:updatedTime') }}</span>
                <span class="detail-value">{{ formatTime(form.updateTime) }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row
            v-if="form.remark"
            class="detail-row"
          >
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('common:remark') }}</span>
                <span class="detail-value">{{ form.remark }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
      </template>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'

import { syncStates } from '@/utils/jobDisplay'

export default {
  name: 'JobDetail',
  dicts: ['sys_job_store', 'sys_job_executor'],
  props: {
    visible: { type: Boolean, default: false },
    row: { type: Object, default: () => ({}) },
    // 'job' 任务详细 | 'log' 调度日志详细
    type: { type: String, default: 'job' },
  },
  computed: {
    form() {
      return this.row || {}
    },
    dialogVisible: {
      get() {
        return this.visible
      },
      set(value) {
        this.$emit('update:visible', value)
      },
    },
    syncState() {
      return syncStates[this.form.syncStatus] || syncStates.pending
    },
  },
  methods: {
    formatParameter(value) {
      if (value === null || value === undefined || value === '') return t('monitor:expression.none')
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    },
    formatTime(value) {
      return value ? this.parseTime(value) : '-'
    },
  },
}
</script>

<style scoped>
.detail-label {
  width: 80px;
}

.code-field + .code-field {
  margin-top: 12px;
}

.code-field-label {
  margin-bottom: 6px;
  color: #909399;
  font-size: 12px;
}
</style>
