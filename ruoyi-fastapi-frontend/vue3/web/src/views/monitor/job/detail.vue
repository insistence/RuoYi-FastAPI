<template>
  <el-dialog
    :title="type === 'log' ? $t('monitor:schedulerLogDetails') : $t('monitor:taskDetails')"
    v-model="dialogVisible"
    width="780px"
    style="max-width: calc(100vw - 32px)"
    append-to-body
  >
    <div class="detail-wrap">
      <template v-if="type === 'log'">
        <!-- 基本信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <el-icon><InfoFilled /></el-icon> {{ $t('system:basicInformation') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:logID') }}</span
                ><span class="detail-value">{{ form.jobLogId }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:executionStatus') }}</span>
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
                  >{{ $t('monitor:failed') }}</el-tag
                >
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:scheduledTime') }}</span
                ><span class="detail-value">{{ parseTime(form.scheduledTime) || '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskTimeZone') }}</span
                ><span class="detail-value">{{ form.timeZone || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:startTime') }}</span
                ><span class="detail-value">{{ parseTime(form.startTime) || '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:endTime') }}</span
                ><span class="detail-value">{{ parseTime(form.endTime) || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:recordedAt') }}</span
                ><span class="detail-value">{{ parseTime(form.createTime) || '-' }}</span>
              </div>
            </el-col>
            <el-col
              :span="12"
              v-if="form.runDurationMs !== null && form.runDurationMs !== undefined"
            >
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:executionDuration') }}</span
                ><span class="detail-value"
                  >{{ form.runDurationMs }} {{ $t('monitor:milliseconds') }}</span
                >
              </div>
            </el-col>
          </el-row>
        </div>
        <!-- 任务信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <el-icon><Clock /></el-icon> {{ $t('monitor:taskInformation') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskID') }}</span
                ><span class="detail-value">{{
                  form.jobId ?? $t('monitor:noHistoricalLink')
                }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:jobStore') }}</span
                ><span class="detail-value">{{
                  selectDictLabel(sys_job_store, form.jobStore) || '-'
                }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:executionID') }}</span
                ><span class="detail-value mono">{{
                  form.executionId || $t('monitor:noHistoricalLink')
                }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskName') }}</span
                ><span class="detail-value">{{ form.jobName }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskGroup') }}</span>
                <span class="detail-value">{{ form.jobGroup }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskExecutor') }}</span>
                <dict-tag
                  :options="sys_job_executor"
                  :value="form.jobExecutor"
                />
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskTrigger') }}</span
                ><span class="detail-value">{{ form.jobTrigger || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:logInformation') }}</span
                ><span class="detail-value">{{ form.jobMessage }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
        <!-- 调用目标 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <el-icon><Operation /></el-icon> {{ $t('monitor:invocationTarget') }}
          </div>
          <div class="code-body">
            <div class="code-wrap">
              <pre class="code-pre">{{ form.invokeTarget || $t('monitor:none') }}</pre>
            </div>
          </div>
        </div>
        <!-- 调用参数 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <el-icon><Document /></el-icon> {{ $t('monitor:callArguments') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:positionalArguments') }}</span
                ><span class="detail-value mono">{{ form.jobArgs || $t('monitor:none') }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:keywordArguments') }}</span
                ><span class="detail-value mono">{{ form.jobKwargs || $t('monitor:none') }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
        <!-- 异常信息 -->
        <div
          class="detail-card"
          v-if="form.status == 1"
        >
          <div class="detail-card-title error-title">
            <el-icon><Warning /></el-icon> {{ $t('monitor:exceptionDetails') }}
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
            <el-icon><Setting /></el-icon> {{ $t('monitor:taskConfiguration') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskID') }}</span
                ><span class="detail-value">{{ form.jobId }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskName') }}</span
                ><span class="detail-value">{{ form.jobName }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskGroup') }}</span>
                <span class="detail-value">{{ form.jobGroup }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:executionStatus') }}</span>
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
                  >{{ $t('monitor:pause') }}</el-tag
                >
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:taskExecutor') }}</span>
                <dict-tag
                  :options="sys_job_executor"
                  :value="form.jobExecutor"
                />
              </div>
            </el-col>
          </el-row>
        </div>
        <!-- 调度信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <el-icon><Calendar /></el-icon> {{ $t('monitor:schedulingInformation') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:schedulerSynchronization') }}</span>
                <el-tag
                  :type="syncStates[form.syncStatus]?.type || 'warning'"
                  size="small"
                >
                  {{ syncStates[form.syncStatus]?.label || $t('plugins:pendingSynchronization') }}
                </el-tag>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:configurationVersion') }}</span
                ><span class="detail-value">
                  {{ $t('monitor:applied') }}{{ form.appliedVersion ?? 0 }} {{ $t('monitor:latest')
                  }}{{ form.configVersion ?? '—' }}
                </span>
              </div>
            </el-col>
          </el-row>
          <el-alert
            v-if="form.syncError"
            :title="form.syncError"
            type="error"
            show-icon
            :closable="false"
          />
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:cronExpression') }}</span
                ><span class="detail-value mono">{{ form.cronExpression }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:cronTimeZoneLabel') }}</span
                ><span class="detail-value">{{ form.timeZone }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:actualNextRun') }}</span
                ><span class="detail-value">{{
                  form.status === '1'
                    ? $t('components:disabled')
                    : parseTime(form.nextRunTime) || $t('monitor:noValidSchedulerObservation')
                }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:cronSchedulePreview') }}</span
                ><span class="detail-value">{{
                  parseTime(form.cronNextTime) || $t('monitor:noFutureOccurrence')
                }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:schedulerObservedAt') }}</span
                ><span class="detail-value"
                  >{{ parseTime(form.scheduleObservedTime) || '-'
                  }}{{ $t('monitor:thePreviewIsCalculatedFromCronRulesAndDoesNot') }}</span
                >
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:allowedDelay') }}</span>
                <span class="detail-value">{{
                  form.misfireGraceTime === null
                    ? $t('monitor:unlimited')
                    : $t('monitor:valueSecondsSkipWhenOverdue', {
                        misfireGraceTime: form.misfireGraceTime,
                      })
                }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:maximumConcurrency') }}</span>
                <span class="detail-value"
                  >{{ form.maxInstances }}{{ $t('monitor:scheduledAndManualRuns') }}</span
                >
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:missedRuns') }}</span
                ><span class="detail-value">{{
                  form.coalesce
                    ? $t('monitor:runOnlyTheLatestOccurrence')
                    : $t('monitor:runEachOccurrence')
                }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:jobStore') }}</span
                ><span class="detail-value">{{
                  selectDictLabel(sys_job_store, form.jobStore) || '-'
                }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
        <!-- 执行方法 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <el-icon><Operation /></el-icon> {{ $t('monitor:executionMethod') }}
          </div>
          <div class="code-body">
            <div class="code-wrap">
              <pre class="code-pre">{{ form.invokeTarget || $t('monitor:none') }}</pre>
            </div>
          </div>
        </div>
        <!-- 调用参数 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <el-icon><Document /></el-icon> {{ $t('monitor:callArguments') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:positionalArguments') }}</span
                ><span class="detail-value mono">{{ form.jobArgs || $t('monitor:none') }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:keywordArguments') }}</span
                ><span class="detail-value mono">{{ form.jobKwargs || $t('monitor:none') }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
        <!-- 元信息 -->
        <div class="detail-card">
          <div class="detail-card-title">
            <el-icon><Document /></el-icon> {{ $t('monitor:metadata') }}
          </div>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:createdBy') }}</span
                ><span class="detail-value">{{ form.createBy || '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('system:createdAt') }}</span
                ><span class="detail-value">{{ parseTime(form.createTime) || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-row">
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:updatedBy') }}</span
                ><span class="detail-value">{{ form.updateBy || '-' }}</span>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="detail-item">
                <span class="detail-label">{{ $t('monitor:updatedAt') }}</span
                ><span class="detail-value">{{ parseTime(form.updateTime) || '-' }}</span>
              </div>
            </el-col>
          </el-row>
          <el-row
            class="detail-row"
            v-if="form.remark"
          >
            <el-col :span="24">
              <div class="detail-item">
                <span class="detail-label">{{ $t('system:remarks') }}</span
                ><span class="detail-value">{{ form.remark }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
      </template>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">{{ $t('monitor:close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup name="JobDetail">
import { syncStates } from '@/utils/job'

const props = defineProps({
  visible: { type: Boolean, default: false },
  row: { type: Object, default: () => ({}) },
  // 'job' 任务详细 | 'log' 调度日志详细
  type: { type: String, default: 'job' },
})

const emit = defineEmits(['update:visible'])

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const { proxy } = getCurrentInstance()
const { sys_job_executor, sys_job_store } = proxy.useDict('sys_job_executor', 'sys_job_store')

const form = computed(() => props.row || {})
</script>

<style scoped>
.detail-label {
  width: 110px;
  flex-shrink: 0;
}
</style>
