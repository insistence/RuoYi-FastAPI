<template>
  <el-dialog
    :visible.sync="dialogVisible"
    :title="$t('monitor:messages.taskExecutionHistory')"
    width="1000px"
    append-to-body
  >
    <el-tabs
      v-model="activeTab"
      @tab-click="resetPage"
    >
      <el-tab-pane
        :label="$t('monitor:job.history')"
        name="executions"
      />
      <el-tab-pane
        :label="$t('common:syncStatus')"
        name="sync"
      />
    </el-tabs>
    <el-form
      :validate-on-rule-change="false"
      size="small"
      :inline="true"
      label-width="68px"
      @submit.native.prevent="resetPage"
    >
      <el-form-item :label="$t('monitor:job.id')">
        <el-input-number
          v-model="queryJobId"
          :min="1"
          :precision="0"
          :controls="false"
          :placeholder="$t('monitor:messages.allTasks')"
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          size="mini"
          type="primary"
          icon="el-icon-search"
          native-type="submit"
          :loading="loading"
          >{{ $t('monitor:messages.search') }}</el-button
        >
        <el-button
          size="mini"
          icon="el-icon-refresh"
          :disabled="loading"
          @click="loadRecords()"
          >{{ $t('layout:tags.refresh') }}</el-button
        >
      </el-form-item>
    </el-form>
    <div
      v-if="focusedExecutionId && activeTab === 'executions'"
      class="execution-focus"
    >
      <span
        >{{ $t('monitor:messages.currentExecutionID') }}<code>{{ focusedExecutionId }}</code></span
      >
      <el-button
        size="mini"
        type="text"
        @click="showAllExecutions"
        >{{ $t('monitor:messages.viewAllExecutionsOfThisTask') }}</el-button
      >
    </div>
    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      :closable="false"
      show-icon
      class="runtime-alert"
    />
    <p
      class="runtime-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{
        loading
          ? $t('monitor:expression.loadingRecords')
          : $t('monitor:job.recordSummary', { total, processing: processingCount })
      }}
    </p>
    <el-table
      v-if="activeTab === 'executions'"
      v-loading="loading"
      :data="rows"
      row-key="executionId"
      max-height="460"
    >
      <el-table-column type="expand">
        <template slot-scope="scope">
          <div class="execution-details">
            <p>
              <strong>{{ $t('monitor:messages.executionID') }}</strong
              ><code>{{ scope.row.executionId }}</code>
            </p>
            <p>
              <strong>{{ $t('monitor:messages.fullResult') }}</strong
              >{{ scope.row.message || $t('monitor:expression.noExecutionResultsYet') }}
            </p>
            <p>
              <strong>{{ $t('monitor:messages.submittedBy') }}</strong
              >{{ scope.row.requestedBy || $t('monitor:expression.systemScheduler') }}
            </p>
            <p>
              <strong>{{ $t('monitor:messages.scheduledTime') }}</strong
              >{{ parseTime(scope.row.scheduledTime) || $t('monitor:job.execution.pending') }}
            </p>
            <p>
              <strong>{{ $t('monitor:messages.finishedAt') }}</strong
              >{{ parseTime(scope.row.endTime) || '—' }}
            </p>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        align="center"
        prop="jobId"
        :label="$t('monitor:job.id')"
        width="90"
      />
      <el-table-column
        align="center"
        prop="jobName"
        :label="$t('monitor:job.name')"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        align="center"
        :label="$t('common:source')"
        width="75"
      >
        <template slot-scope="scope">{{
          scope.row.source === 'manual'
            ? $t('monitor:expression.manual')
            : $t('monitor:expression.scheduled')
        }}</template>
      </el-table-column>
      <el-table-column
        align="center"
        :label="$t('monitor:job.executionStatus')"
        width="140"
      >
        <template slot-scope="scope">
          <el-tag
            size="small"
            :type="executionStates[scope.row.status]?.type || 'info'"
          >
            {{ executionStates[scope.row.status]?.label || scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        align="center"
        :label="$t('monitor:messages.submittedAt')"
        width="175"
      >
        <template slot-scope="scope">{{ parseTime(scope.row.createTime) }}</template>
      </el-table-column>
      <el-table-column
        align="center"
        :label="$t('monitor:job.duration')"
        width="105"
      >
        <template slot-scope="scope">{{
          scope.row.runDurationMs == null
            ? '—'
            : $t('common:time.milliseconds', { value: scope.row.runDurationMs })
        }}</template>
      </el-table-column>
      <el-table-column
        align="center"
        prop="message"
        :label="$t('monitor:messages.executionResult')"
        min-width="230"
        show-overflow-tooltip
      />
    </el-table>
    <el-table
      v-else
      v-loading="loading"
      :data="rows"
      row-key="jobId"
      max-height="460"
    >
      <el-table-column
        align="center"
        prop="jobId"
        :label="$t('monitor:job.id')"
        width="90"
      />
      <el-table-column
        align="center"
        :label="$t('monitor:messages.configurationType')"
        width="100"
      >
        <template slot-scope="scope">{{
          scope.row.deleted
            ? $t('authCenter:messages.deleteRecord')
            : $t('monitor:messages.taskConfiguration')
        }}</template>
      </el-table-column>
      <el-table-column
        align="center"
        prop="configVersion"
        :label="$t('monitor:messages.latestVersion')"
        width="95"
      />
      <el-table-column
        align="center"
        prop="appliedVersion"
        :label="$t('monitor:messages.appliedVersion')"
        width="105"
      />
      <el-table-column
        align="center"
        :label="$t('common:syncStatus')"
        width="115"
      >
        <template slot-scope="scope">
          <el-tag
            size="small"
            :type="syncStates[scope.row.syncStatus]?.type || 'info'"
          >
            {{ syncStates[scope.row.syncStatus]?.label || $t('monitor:job.sync.pending') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        align="center"
        :label="$t('monitor:messages.lastAppliedAt')"
        width="175"
      >
        <template slot-scope="scope">{{ parseTime(scope.row.appliedTime) || '—' }}</template>
      </el-table-column>
      <el-table-column
        align="center"
        prop="syncError"
        :label="$t('monitor:messages.synchronizationError')"
        min-width="240"
        show-overflow-tooltip
      />
      <el-table-column
        align="center"
        :label="$t('common:actions')"
        width="100"
      >
        <template slot-scope="scope">
          <el-button
            size="mini"
            v-if="scope.row.syncStatus !== 'applied'"
            v-hasPermi="['monitor:job:edit']"
            type="text"
            :loading="retryingId === scope.row.jobId"
            :disabled="retryingId !== null && retryingId !== scope.row.jobId"
            @click="retrySync(scope.row)"
            >{{ $t('monitor:messages.retrySynchronization') }}</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="pageNum"
      :limit.sync="pageSize"
      @pagination="loadRecords()"
    />
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button @click="dialogVisible = false">{{ $t('common:close') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'

import { listJobExecutions, listJobSync, retryJobSync } from '@/api/monitor/job'
import { executionStates, syncStates, notifyJobMutation } from '@/utils/jobDisplay'
export default {
  name: 'JobRuntime',
  props: {
    visible: Boolean,
    initialTab: {
      type: String,
      default: 'executions',
    },
    jobId: {
      type: [Number, String],
      default: undefined,
    },
    executionId: {
      type: String,
      default: undefined,
    },
  },
  data() {
    return {
      activeTab: 'executions',
      queryJobId: undefined,
      focusedExecutionId: undefined,
      rows: [],
      total: 0,
      pageNum: 1,
      pageSize: 10,
      loading: false,
      loadError: '',
      retryingId: null,
      executionStates: executionStates,
      syncStates: syncStates,
    }
  },
  computed: {
    dialogVisible: {
      get() {
        return this.visible
      },
      set(value) {
        return this.$emit('update:visible', value)
      },
    },
    processingCount() {
      return this.rows.filter((row) =>
        this.activeTab === 'executions'
          ? ['pending', 'submitted', 'running'].includes(row.status)
          : row.syncStatus === 'pending'
      ).length
    },
    runtimeQuery() {
      return [this.visible, this.initialTab, this.jobId, this.executionId]
    },
  },
  watch: {
    runtimeQuery: {
      handler() {
        this.stopRequests()
        if (!this.visible) return
        this.activeTab = this.initialTab
        this.queryJobId = this.jobId == null ? undefined : Number(this.jobId)
        this.focusedExecutionId = this.executionId
        this.loadError = ''
        this.resetPage()
      },
      immediate: true,
    },
  },
  beforeCreate() {
    this._timer = undefined
    this._controller = undefined
    this._requestVersion = 0
  },
  mounted() {
    document.addEventListener('visibilitychange', this.handleVisibility)
  },
  deactivated() {
    this.stopRequests()
    this.$emit('update:visible', false)
  },
  beforeDestroy() {
    this.stopRequests()
    document.removeEventListener('visibilitychange', this.handleVisibility)
  },
  methods: {
    /** 停止自动刷新并取消未完成的请求 */
    stopRequests() {
      clearTimeout(this._timer)
      this._controller?.abort()
      this._requestVersion++
      this.loading = false
    },
    /** 根据执行和同步状态安排下一次刷新 */
    scheduleRefresh() {
      clearTimeout(this._timer)
      const needsRefresh =
        this.processingCount > 0 ||
        this.loadError ||
        (this.activeTab === 'sync' && this.rows.some((row) => row.syncStatus === 'failed'))
      if (this.visible && !document.hidden && needsRefresh) {
        this._timer = setTimeout(() => this.loadRecords(true), 3000)
      }
    },
    /** 查询任务运行记录 */
    async loadRecords(silent = false) {
      if (!this.visible) return
      clearTimeout(this._timer)
      this._controller?.abort()
      this._controller = new AbortController()
      const version = ++this._requestVersion
      if (!silent) this.loading = true
      const query = {
        jobId: this.queryJobId || undefined,
        pageNum: this.pageNum,
        pageSize: this.pageSize,
      }
      if (this.activeTab === 'executions' && this.focusedExecutionId)
        query.executionId = this.focusedExecutionId
      const fetchRecords = this.activeTab === 'executions' ? listJobExecutions : listJobSync
      try {
        const response = await fetchRecords(query, {
          signal: this._controller.signal,
          skipErrorMessage: true,
        })
        if (version !== this._requestVersion || !this.visible) return
        this.rows = response.rows
        this.total = response.total
        this.loadError = ''
      } catch (error) {
        if (version === this._requestVersion && error.code !== 'ERR_CANCELED') {
          this.loadError = t('monitor:messages.couldNotLoadRecordsRefreshAndTryAgain')
        }
      } finally {
        if (version === this._requestVersion) {
          this.loading = false
          this.scheduleRefresh()
        }
      }
    },
    /** 重置分页并重新查询 */
    resetPage() {
      this.pageNum = 1
      this.rows = []
      this.total = 0
      this.loadRecords()
    },
    /** 查看当前任务的全部执行记录 */
    showAllExecutions() {
      this.focusedExecutionId = undefined
      this.resetPage()
    },
    /** 重试任务调度同步 */
    async retrySync(row) {
      this.retryingId = row.jobId
      try {
        const response = await retryJobSync(row.jobId)
        notifyJobMutation(this.$modal, response)
        this.$emit('sync-updated')
        await this.loadRecords(true)
      } catch {
        // 请求层已显示重试失败原因，保留当前记录。
      } finally {
        this.retryingId = null
      }
    },
    /** 处理页面显示状态变化 */
    handleVisibility() {
      if (document.hidden) this.stopRequests()
      else if (this.visible) this.loadRecords(true)
    },
  },
}
</script>

<style scoped>
.runtime-status {
  margin: 0 0 12px;
  color: #909399;
}

.runtime-alert {
  margin-bottom: 12px;
}

.execution-focus {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 12px;
}

.execution-details {
  padding: 4px 24px 12px;
  overflow-wrap: anywhere;
}

.execution-details p {
  margin: 8px 0;
  white-space: pre-wrap;
}

code {
  font-family: ui-monospace, Consolas, monospace;
  overflow-wrap: anywhere;
}
</style>
