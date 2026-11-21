<template>
  <section
    v-loading="loading"
    class="plugin-metrics"
    :aria-label="$t('plugins:pluginRuntimeMonitoring')"
    :aria-busy="loading"
  >
    <div class="metrics-toolbar">
      <span role="status">{{
        updatedAt
          ? $t('plugins:queryTimeValue', { updatedAt: updatedAt })
          : $t('plugins:queryCumulativeMetricsFromRunningProcesses')
      }}</span>
      <el-button
        icon="Refresh"
        :loading="loading"
        @click="refresh"
        >{{ $t('plugins:refreshMetrics') }}</el-button
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
            ? $t('plugins:reportedProcessesValue', { observedWorkers: data.observedWorkers })
            : $t('plugins:onlyTheProcessHandlingThisRequestIsShown')
        "
        :type="data.scope === 'reporting_workers' ? 'info' : 'warning'"
        :description="$t('plugins:metricsAccumulateFromProcessStartupAndResetOnRestartReporting')"
        show-icon
        :closable="false"
      />
      <p
        v-if="data.supported !== false"
        class="metrics-hint"
      >
        {{ $t('plugins:samplingInterval') }}{{ data.sampleIntervalSeconds || '-' }}
        {{ $t('plugins:secondsValidityPeriod') }}{{ data.sampleTtlSeconds || '-' }}
        {{ $t('plugins:secondsDurationCoversTheCompleteRequestOrTaskP95Is') }}
      </p>
      <el-alert
        v-if="
          data.workerLimitReached || data.invalidSnapshots || data.staleSnapshots || droppedSeries
        "
        :title="$t('plugins:someSamplesWereExcludedFromTheStatistics')"
        :description="
          $t('plugins:invalidValueExpiredValueOverMetricCapacityValueProcessRead', {
            value0: data.invalidSnapshots || 0,
            value1: data.staleSnapshots || 0,
            droppedSeries: droppedSeries,
            value3: data.workerLimitReached ? '已达到' : '未达到',
          })
        "
        type="warning"
        :closable="false"
        show-icon
      />
      <el-empty
        v-if="!data.series?.length"
        :description="
          data.supported === false
            ? $t('plugins:runtimeMonitoringIsNotEnabledForThisProcess')
            : $t('plugins:noRuntimeMetricsForThisPluginOnlyLoadedV2Plugins')
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
          <summary>{{ $t('plugins:versionIdentityAndRecentErrors') }}</summary>
          <dl class="metrics-identities">
            <dt>{{ $t('plugins:artifactDigest') }}</dt>
            <dd>{{ row.digest || $t('plugins:sourcePlugin') }}</dd>
            <dt>{{ $t('plugins:releaseGeneration') }}</dt>
            <dd>{{ row.generation || '-' }}</dd>
            <dt>{{ $t('plugins:latestErrorLabel') }}</dt>
            <dd>{{ row.lastErrorType || '-' }}</dd>
            <dt>{{ $t('plugins:traceID') }}</dt>
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
    if (current === revision) error.value = t('plugins:couldNotLoadRuntimeMetricsTryAgain')
  } finally {
    if (current === revision) loading.value = false
  }
}

/** 将同一版本的调用计数与耗时展示为带文字标签的指标。 */
function counters(row) {
  return [
    {
      get label() {
        return t('plugins:calls')
      },
      value: row.started,
    },
    {
      get label() {
        return t('plugins:inFlight')
      },
      value: row.active,
    },
    {
      get label() {
        return t('system:success')
      },
      value: row.succeeded,
    },
    {
      get label() {
        return t('plugins:rejected')
      },
      value: row.rejected,
    },
    {
      get label() {
        return t('plugins:failuresFailureRate')
      },
      value: `${row.failed} / ${row.failureRatePercent}%`,
    },
    {
      get label() {
        return t('common:cancel')
      },
      value: row.cancelled,
    },
    {
      get label() {
        return t('plugins:timeoutsIncludedInFailures')
      },
      value: row.timedOut,
    },
    {
      get label() {
        return t('plugins:averageDuration')
      },
      value: `${row.averageDurationMs} ms`,
    },
    {
      get label() {
        return t('plugins:p95EstimatedUpperBound')
      },
      value: `${row.p95UpperBoundMs} ms`,
    },
    {
      get label() {
        return t('plugins:maximumDuration')
      },
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
  color: var(--el-text-color-regular);
  line-height: 1.6;
}
.metrics-record {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
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
  color: var(--el-text-color-regular);
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
  color: var(--el-color-primary);
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
