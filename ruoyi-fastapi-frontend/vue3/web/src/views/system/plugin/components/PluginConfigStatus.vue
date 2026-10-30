<template>
  <section
    class="config-status"
    :aria-label="$t('plugins:configurationActivationStatus')"
    :aria-busy="loading"
  >
    <div class="config-status-toolbar">
      <strong>{{ $t('plugins:configurationActivationStatus') }}</strong>
      <el-button
        link
        type="primary"
        :loading="loading"
        @click="refresh"
        >{{ $t('plugins:refreshStatus') }}</el-button
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
      {{ $t('plugins:loadingConfigurationVersions') }}
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
            ? $t('plugins:reportedProcessesOnly')
            : data.scope === 'current_worker'
              ? $t('plugins:onlyTheCurrentProcessHasDataForThisQuery')
              : $t('plugins:noProcessDataIsCurrentlyAvailable')
        }}{{ $t('plugins:startupSnapshotsUpdateAfterRestartPluginsAreResponsibleForApplying')
        }}<template v-if="data.sampleIntervalSeconds"
          >{{ $t('plugins:remoteStatusIsReportedEvery') }}{{ data.sampleIntervalSeconds }}
          {{ $t('plugins:seconds') }}</template
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
        {{ $t('plugins:someProcessVersionsAreUnconfirmed') }}{{ data.unknownWorkers || 0 }}
        {{ $t('plugins:haveNotReportedAConfigurationVersion') }}{{ data.invalidSnapshots || 0 }}
        {{ $t('plugins:invalidSamples') }}{{ data.staleSnapshots || 0 }}
        {{ $t('plugins:expiredSamples')
        }}<template v-if="data.workerLimitReached">{{
          $t('plugins:thisQueryReachedTheProcessSamplingLimit')
        }}</template>
      </p>
      <details>
        <summary>{{ $t('plugins:viewConfigurationVersionsAndProcessDetails') }}</summary>
        <p class="config-revision">{{ $t('plugins:savedVersion') }}{{ data.desiredRevision }}</p>
        <ul
          v-if="data.workers?.length"
          class="config-workers"
        >
          <li
            v-for="worker in data.workers"
            :key="worker.workerId"
          >
            <p class="config-revision">
              {{ $t('plugins:process') }}{{ worker.workerId }} {{ $t('plugins:plugin')
              }}{{ worker.version }}
            </p>
            <p>
              {{
                !worker.active
                  ? $t('oauth:notActivated')
                  : worker.matchesDesired
                    ? $t('plugins:startupSnapshotMatches')
                    : $t('plugins:startupSnapshotNeedsARestartToUpdate')
              }}
            </p>
            <p class="config-revision">
              {{ $t('plugins:startupVersion') }}{{ worker.startupRevision }}
            </p>
            <p
              v-if="worker.lastReadRevision"
              class="config-revision"
            >
              {{ $t('plugins:lastOnDemandRead') }}{{ worker.lastReadRevision
              }}{{ $t('plugins:doesNotConfirmApplicationByTheBusinessLogic') }}
            </p>
          </li>
        </ul>
        <p v-else>
          {{ $t('plugins:noProcessesSupportingConfigurationVersionReportingHaveBeenObserved') }}
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
    return t('plugins:startupConfigurationForValueObservedProcessesWillUpdateAfterRestart', {
      pendingWorkers: data.value.pendingWorkers,
    })
  if (data.value?.state === 'observed_match')
    return t('plugins:startupConfigurationForValueObservedProcessesMatchesTheSavedVersion', {
      matchedWorkers: data.value.matchedWorkers,
    })
  return t('plugins:noRunningStartupConfigurationHasBeenObservedCheckThatThe')
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
      error.value = t('plugins:couldNotLoadConfigurationStatusSavedSettingsAreUnaffectedRefresh')
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
  color: var(--el-text-color-regular);
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
  color: var(--el-color-primary);
  padding: 8px 0;
}
</style>
