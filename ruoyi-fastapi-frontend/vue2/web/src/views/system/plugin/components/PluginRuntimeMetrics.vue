<template>
  <section
    v-loading="loading"
    class="plugin-metrics"
    :aria-label="$t('pluginAdmin:messages.pluginRuntimeMonitoring')"
    :aria-busy="loading"
  >
    <div class="metrics-toolbar">
      <span role="status">{{
        updatedAt
          ? $t('pluginAdmin:metrics.queriedAt', { time: updatedAt })
          : $t('pluginAdmin:expression.queryCumulativeMetricsFromRunningProcesses')
      }}</span>
      <el-button
        icon="el-icon-refresh"
        :loading="loading"
        @click="refresh"
        >{{ $t('pluginAdmin:messages.refreshMetrics') }}</el-button
      >
    </div>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
    />
    <template v-else-if="data">
      <el-alert
        v-if="data.supported !== false"
        :title="
          data.scope === 'reporting_workers'
            ? $t('pluginAdmin:metrics.reportingWorkers', { count: data.observedWorkers })
            : $t('pluginAdmin:expression.showingOnlyTheProcessHandlingThisRequest')
        "
        :type="data.scope === 'reporting_workers' ? 'info' : 'warning'"
        :description="
          $t(
            'pluginAdmin:messages.metricsAccumulateFromProcessStartupAndResetOnRestartReportingProcessesMay'
          )
        "
        show-icon
        :closable="false"
      />
      <p
        v-if="data.supported !== false"
        class="metrics-hint"
      >
        {{ $t('pluginAdmin:messages.samplingInterval') }} {{ data.sampleIntervalSeconds || '-' }}
        {{ $t('pluginAdmin:messages.secondsValidityPeriod') }} {{ data.sampleTtlSeconds || '-' }}
        {{ $t('pluginAdmin:messages.secondsDurationCoversTheCompleteRequestOrTaskP95IsAnUpper') }}
      </p>
      <el-alert
        v-if="
          data.workerLimitReached || data.invalidSnapshots || data.staleSnapshots || droppedSeries
        "
        :title="$t('pluginAdmin:messages.someSamplesWereExcludedFromTheStatistics')"
        :description="
          $t('pluginAdmin:metrics.snapshotSummary', {
            invalid: data.invalidSnapshots || 0,
            stale: data.staleSnapshots || 0,
            dropped: droppedSeries,
            limit: data.workerLimitReached
              ? $t('pluginAdmin:expression.reached')
              : $t('pluginAdmin:expression.notReached'),
          })
        "
        type="warning"
        :closable="false"
        show-icon
      />
      <el-empty
        v-if="!(data.series || []).length"
        :description="
          data.supported === false
            ? $t('pluginAdmin:expression.runtimeMonitoringIsDisabledForThisProcess')
            : $t(
                'pluginAdmin:expression.noRuntimeMetricsForThisPluginOnlyLoadedV2PluginsAreSupported'
              )
        "
      />
      <article
        v-for="row in data.series || []"
        :key="[row.version, row.digest, row.generation, row.operation].join(':')"
        class="metrics-record"
      >
        <div class="metrics-record-title">
          <strong>{{ row.operation }}</strong
          ><el-tag effect="plain">{{ row.version }}</el-tag>
        </div>
        <dl class="metrics-values">
          <div
            v-for="item in counters(row)"
            :key="item.label"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
        <details>
          <summary>{{ $t('pluginAdmin:messages.versionIdentityAndRecentErrors') }}</summary>
          <dl class="metrics-identities">
            <dt>{{ $t('pluginAdmin:messages.artifactDigest') }}</dt>
            <dd>{{ row.digest || $t('pluginAdmin:expression.sourcePlugin') }}</dd>
            <dt>{{ $t('pluginAdmin:messages.releaseGeneration') }}</dt>
            <dd>{{ row.generation || '-' }}</dd>
            <dt>{{ $t('pluginAdmin:messages.latestError') }}</dt>
            <dd>{{ row.lastErrorType || '-' }}</dd>
            <dt>{{ $t('pluginAdmin:messages.traceID') }}</dt>
            <dd>{{ row.lastErrorRequestId || '-' }}</dd>
          </dl>
        </details>
      </article>
    </template>
  </section>
</template>

<script setup>
import { t } from '@/i18n/adapter'

import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { getPluginRuntimeMetrics } from '@/api/system/plugin'

const props = defineProps({ pluginId: { type: String, default: '' } })
const data = ref(null)
const loading = ref(false)
const error = ref('')
const updatedAt = ref('')
let controller
let revision = 0
const droppedSeries = computed(() =>
  (data.value?.workers || []).reduce((total, worker) => total + (worker.droppedSeries || 0), 0)
)

/** 查询当前插件，取消旧请求并丢弃迟到响应。 */
async function refresh() {
  controller?.abort()
  const current = ++revision
  loading.value = false
  error.value = ''
  if (!props.pluginId) return
  controller = new AbortController()
  loading.value = true
  try {
    const response = await getPluginRuntimeMetrics(props.pluginId, controller.signal)
    if (current !== revision) return
    data.value = response.data
    updatedAt.value = new Date().toLocaleTimeString()
  } catch {
    if (current === revision)
      error.value = t('pluginAdmin:messages.couldNotLoadRuntimeMetricsTryAgain')
  } finally {
    if (current === revision) loading.value = false
  }
}

/** 将同一版本的调用计数与耗时展示为带文字标签的指标。 */
function counters(row) {
  return [
    { label: t('pluginAdmin:messages.calls'), value: row.started },
    { label: t('pluginAdmin:messages.inFlight'), value: row.active },
    { label: t('common:success'), value: row.succeeded },
    { label: t('pluginAdmin:messages.rejected'), value: row.rejected },
    {
      label: t('pluginAdmin:messages.failuresFailureRate'),
      value: `${row.failed} / ${row.failureRatePercent}%`,
    },
    { label: t('common:cancel'), value: row.cancelled },
    { label: t('pluginAdmin:messages.timeoutsIncludedInFailures'), value: row.timedOut },
    { label: t('pluginAdmin:messages.averageDuration'), value: `${row.averageDurationMs} ms` },
    { label: t('pluginAdmin:messages.p95EstimatedUpperBound'), value: `${row.p95UpperBoundMs} ms` },
    {
      label: t('pluginAdmin:messages.maximumDuration'),
      value: `${Number(row.durationMaxMs).toFixed(1)} ms`,
    },
  ]
}

watch(
  () => props.pluginId,
  () => {
    data.value = null
    updatedAt.value = ''
    refresh()
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  revision++
  controller?.abort()
})
</script>

<style scoped>
.plugin-metrics {
  min-height: 160px;
}
.metrics-toolbar,
.metrics-record-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.metrics-hint {
  color: var(--el-text-color-regular, #606266);
  line-height: 1.6;
}
.metrics-record {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 4px;
}
.metrics-record-title {
  justify-content: flex-start;
}
.metrics-values {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 16px;
}
.metrics-values dt {
  color: var(--el-text-color-regular, #606266);
  font-size: 13px;
}
.metrics-values dd {
  margin: 4px 0 0;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
summary {
  cursor: pointer;
  padding: 8px 0;
  color: var(--el-color-primary, var(--current-color, #409eff));
}
.metrics-identities {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 8px;
}
.metrics-identities dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: monospace;
}
</style>
