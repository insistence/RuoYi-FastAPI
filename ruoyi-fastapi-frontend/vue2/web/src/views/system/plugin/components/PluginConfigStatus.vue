<template>
  <section
    class="config-status"
    :aria-label="$t('pluginAdmin:messages.configurationActivationStatus')"
    :aria-busy="loading"
  >
    <div class="config-status-toolbar">
      <strong>{{ $t('pluginAdmin:messages.configurationActivationStatus') }}</strong>
      <el-button
        type="text"
        :loading="loading"
        @click="refresh"
        >{{ $t('pluginAdmin:messages.refreshStatus') }}</el-button
      >
    </div>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-else-if="loading && !data"
      role="status"
    >
      {{ $t('pluginAdmin:messages.loadingConfigurationVersions') }}
    </p>
    <template v-else-if="data">
      <el-alert
        :title="statusText"
        :type="statusType"
        :closable="false"
        show-icon
      />
      <p class="config-status-help">
        {{
          data.scope === 'reporting_workers'
            ? $t('pluginAdmin:expression.includesOnlyReportingProcesses')
            : data.scope === 'current_worker'
              ? $t('pluginAdmin:expression.thisQueryIncludesOnlyTheCurrentProcess')
              : $t('pluginAdmin:expression.noProcessDataAvailable')
        }}{{
          $t(
            'pluginAdmin:messages.startupSnapshotsUpdateAfterRestartPluginsAreResponsibleForApplyingConfigurationThey'
          )
        }}
        <template v-if="data.sampleIntervalSeconds"
          >{{ $t('pluginAdmin:messages.remoteStatusIsReportedEvery') }}
          {{ data.sampleIntervalSeconds }} {{ $t('pluginAdmin:messages.seconds') }}</template
        >
      </p>
      <p
        v-if="
          data.unknownWorkers ||
          data.invalidSnapshots ||
          data.staleSnapshots ||
          data.workerLimitReached
        "
        class="config-status-help"
      >
        {{ $t('pluginAdmin:messages.someProcessVersionsAreUnconfirmed')
        }}{{ data.unknownWorkers || 0 }}
        {{ $t('pluginAdmin:messages.haveNotReportedAConfigurationVersion') }}
        {{ data.invalidSnapshots || 0 }} {{ $t('pluginAdmin:messages.invalidSamples')
        }}{{ data.staleSnapshots || 0 }} {{ $t('pluginAdmin:messages.expiredSamples') }}
        <template v-if="data.workerLimitReached">{{
          $t('pluginAdmin:messages.thisQueryReachedTheProcessSamplingLimit')
        }}</template>
      </p>
      <details>
        <summary>
          {{ $t('pluginAdmin:messages.viewConfigurationVersionsAndProcessDetails') }}
        </summary>
        <p class="config-revision">
          {{ $t('pluginAdmin:messages.savedVersion') }}{{ data.desiredRevision }}
        </p>
        <ul
          v-if="(data.workers || []).length"
          class="config-workers"
        >
          <li
            v-for="worker in data.workers"
            :key="worker.workerId"
          >
            <p class="config-revision">
              {{ $t('pluginAdmin:messages.process') }} {{ worker.workerId }}
              {{ $t('pluginAdmin:messages.plugin') }} {{ worker.version }}
            </p>
            <p>
              {{
                !worker.active
                  ? $t('pluginAdmin:expression.notActivated')
                  : worker.matchesDesired
                    ? $t('pluginAdmin:expression.startupSnapshotMatches')
                    : $t('pluginAdmin:expression.startupSnapshotWillUpdateAfterRestart')
              }}
            </p>
            <p class="config-revision">
              {{ $t('pluginAdmin:messages.startupVersion') }}{{ worker.startupRevision }}
            </p>
            <p
              v-if="worker.lastReadRevision"
              class="config-revision"
            >
              {{ $t('pluginAdmin:messages.lastOnDemandRead') }}{{ worker.lastReadRevision
              }}{{ $t('pluginAdmin:messages.doesNotConfirmApplicationByTheBusinessLogic') }}
            </p>
          </li>
        </ul>
        <p v-else>
          {{
            $t(
              'pluginAdmin:messages.noProcessesSupportingConfigurationVersionReportingHaveBeenObserved'
            )
          }}
        </p>
      </details>
    </template>
  </section>
</template>

<script setup name="PluginConfigStatus">
import { t } from '@/i18n/adapter'

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getPluginConfigStatus } from '@/api/system/plugin'

const props = defineProps({
  pluginId: { type: String, required: true },
  refreshKey: { type: Number, default: 0 },
})
const data = ref(null)
const loading = ref(false)
const error = ref('')
let revision = 0
let controller
const statusText = computed(() => {
  if (data.value?.state === 'restart_required')
    return t(
      'pluginAdmin:messages.startupConfigurationForObservedProcessesWillUpdateAfterRestart',
      { pendingWorkers: data.value.pendingWorkers }
    )
  if (data.value?.state === 'observed_match')
    return t(
      'pluginAdmin:messages.startupConfigurationForObservedProcessesMatchesTheSavedVersion',
      { matchedWorkers: data.value.matchedWorkers }
    )
  return t('pluginAdmin:messages.noRunningStartupConfigurationHasBeenObservedCheckThatThePluginIs')
})
const statusType = computed(() => (data.value?.state === 'restart_required' ? 'warning' : 'info'))

async function refresh() {
  const current = ++revision
  controller?.abort()
  controller = new AbortController()
  error.value = ''
  loading.value = true
  try {
    const response = await getPluginConfigStatus(props.pluginId, controller.signal)
    if (current === revision) data.value = response.data
  } catch {
    if (current === revision) {
      data.value = null
      error.value = t(
        'pluginAdmin:messages.couldNotLoadConfigurationStatusSavedSettingsAreUnaffectedRefreshToTry'
      )
    }
  } finally {
    if (current === revision) loading.value = false
  }
}
watch(
  () => [props.pluginId, props.refreshKey],
  () => {
    data.value = null
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
.config-status {
  margin-bottom: 24px;
  color: var(--el-text-color-regular, #606266);
  line-height: 1.6;
}
.config-status-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.config-status-help {
  margin: 10px 0;
  font-size: 13px;
}
.config-revision {
  font-family: monospace;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.config-workers {
  padding-left: 20px;
}
.config-workers li + li {
  margin-top: 12px;
}
summary {
  cursor: pointer;
  color: var(--el-color-primary, var(--current-color, #409eff));
  padding: 8px 0;
}
</style>
