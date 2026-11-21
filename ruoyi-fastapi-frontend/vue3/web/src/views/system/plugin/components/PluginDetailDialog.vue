<template>
  <el-dialog
    :title="$t('plugins:pluginDetails')"
    :model-value="modelValue"
    width="min(920px, calc(100vw - 32px))"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane
        :label="$t('plugins:overview')"
        name="overview"
      >
        <div class="detail-section-title detail-section-title-first">
          {{ $t('plugins:basicInformation') }}
        </div>
        <el-descriptions
          :column="2"
          border
          class="mb16"
        >
          <el-descriptions-item :label="$t('components:pluginID')">{{
            detail.pluginId
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('components:pluginName')">{{
            detail.pluginName
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="
              detail.source === 'artifact'
                ? $t('plugins:artifactVersion')
                : $t('plugins:sourceVersion')
            "
            >{{ detail.version }}</el-descriptions-item
          >
          <el-descriptions-item :label="$t('plugins:installedVersion')">{{
            detail.installedVersion || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('components:enableSettings')">{{
            detail.enabled === '0' ? $t('system:enable') : $t('system:disabled')
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('components:pluginStatus')">{{
            getStatusLabel(detail.status)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('monitor:source')">{{
            detail.source || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('monitor:updatedAt')">{{
            formatPluginTime(detail.updateTime)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:category')">{{
            detail.metadata?.category || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('system:label')">{{
            formatDetailTags(detail.metadata?.tags)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('tools:author')">{{
            detail.metadata?.author || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:license')">{{
            detail.metadata?.license || '-'
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="$t('plugins:latestError')"
            :span="2"
            >{{ detail.lastError || '-' }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="$t('plugins:pluginDescription')"
            :span="2"
            >{{ detail.description || '-' }}</el-descriptions-item
          >
        </el-descriptions>

        <template v-if="detail.source === 'artifact'">
          <div class="detail-section-title">{{ $t('plugins:artifactRelease') }}</div>
          <el-alert
            v-if="releaseView.unavailable"
            :title="$t('plugins:releaseStatusIsUnavailableRefreshTheListAndTryAgain')"
            type="info"
            show-icon
            :closable="false"
            class="mb16"
          />
          <el-alert
            v-if="releaseView.error"
            :title="$t('plugins:artifactReleaseError')"
            :description="releaseView.error"
            type="error"
            show-icon
            :closable="false"
            class="mb16 release-error"
          />
          <el-alert
            v-if="releaseView.restartRequired"
            :title="$t('plugins:notAllWorkerStatusesHaveBeenConfirmed')"
            :description="$t('plugins:completeTheReleaseDuringAMaintenanceWindowThenStartAll')"
            type="warning"
            show-icon
            :closable="false"
            class="mb16"
          />
          <el-descriptions
            :column="2"
            border
            class="mb16"
          >
            <el-descriptions-item :label="$t('plugins:releaseStatus')">
              <el-tag :type="releaseView.tagType">{{ releaseView.label }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('plugins:maintenancePreparation')">{{
              releaseView.preparationLabel
            }}</el-descriptions-item>
            <el-descriptions-item
              :label="$t('plugins:workerStatus')"
              :span="2"
              >{{ releaseView.workerSummary }}</el-descriptions-item
            >
            <el-descriptions-item :label="$t('plugins:targetMatchedDisabledConfirmed')"
              >{{ releaseView.counts.healthy }} /
              {{ releaseView.counts.disabled }}</el-descriptions-item
            >
            <el-descriptions-item :label="$t('plugins:mismatchFailed')"
              >{{ releaseView.counts.mismatch }} /
              {{ releaseView.counts.failed }}</el-descriptions-item
            >
            <el-descriptions-item :label="$t('plugins:unconfirmedHeartbeatExpired')"
              >{{ releaseView.counts.missing }} /
              {{ releaseView.counts.stale }}</el-descriptions-item
            >
            <el-descriptions-item :label="$t('plugins:targetCodeVersion')">{{
              detail.release?.targetVersion || '-'
            }}</el-descriptions-item>
            <el-descriptions-item
              :label="$t('plugins:targetArtifactDigest')"
              :span="2"
              ><code class="release-identity">{{
                detail.release?.targetDigest || $t('plugins:noTargetSelected')
              }}</code></el-descriptions-item
            >
            <el-descriptions-item
              :label="$t('plugins:preparedDigest')"
              :span="2"
              ><code class="release-identity">{{
                detail.release?.preparedDigest || $t('plugins:maintenancePreparationIsIncomplete')
              }}</code></el-descriptions-item
            >
            <el-descriptions-item
              :label="$t('plugins:releaseGeneration')"
              :span="2"
              ><code class="release-identity">{{
                detail.release?.generation || '-'
              }}</code></el-descriptions-item
            >
            <el-descriptions-item
              :label="$t('plugins:installedSchemaVersion')"
              :span="2"
            >
              {{ detail.installedVersion || '-' }}
              <div class="release-explanation">
                {{
                  $t('plugins:theVersionReachedByDatabaseMigrationsAndInstalledResourcesRolling')
                }}
              </div>
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <div class="detail-section-title">{{ $t('plugins:backendDeclarations') }}</div>
        <el-descriptions
          :column="2"
          border
          class="mb16"
        >
          <el-descriptions-item
            :label="$t('plugins:backendPath')"
            :span="2"
            >{{ detail.backendPath || '-' }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="$t('plugins:backendModule')"
            :span="2"
            >{{ detail.backend?.module || '-' }}</el-descriptions-item
          >
          <el-descriptions-item :label="$t('plugins:automaticRouteDiscovery')">{{
            formatYesNo(detail.backend?.autoScanRouters)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:scheduledTasks')">{{
            detail.backend?.jobs?.length || 0
          }}</el-descriptions-item>
        </el-descriptions>

        <div class="detail-section-title">{{ $t('plugins:frontendDeclarations') }}</div>
        <el-descriptions
          :column="2"
          border
        >
          <el-descriptions-item
            :label="$t('plugins:frontendPath')"
            :span="2"
            >{{ detail.frontendPath || '-' }}</el-descriptions-item
          >
          <el-descriptions-item :label="$t('plugins:frontendPluginID')">{{
            detail.frontend?.pluginId || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:frontendBasePath')">{{
            detail.frontend?.basePath || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:viewDirectory')">{{
            detail.frontend?.viewsPath || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:aPIDirectory')">{{
            detail.frontend?.apiPath || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:frontendDelivery')">{{
            getFrontendDeliveryLabel(detail.frontend?.delivery)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:menuDeclarations')">{{
            detail.frontend?.menus?.length || 0
          }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>
      <el-tab-pane
        :label="$t('plugins:runtimeMonitoring')"
        name="metrics"
        lazy
      >
        <PluginRuntimeMetrics
          v-if="modelValue && activeTab === 'metrics'"
          :plugin-id="detail.pluginId"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('system:menu')">
        <el-table
          :data="detail.frontend?.menus || []"
          size="small"
          border
          :empty-text="$t('plugins:noMenuDeclarations')"
        >
          <el-table-column
            :label="$t('components:name')"
            prop="name"
            min-width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:path')"
            prop="path"
            min-width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:component')"
            prop="component"
            min-width="180"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('components:permissions')"
            prop="perms"
            min-width="160"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.perms || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('system:type')"
            prop="type"
            width="70"
            align="center"
          />
          <el-table-column
            :label="$t('system:order')"
            prop="orderNum"
            width="70"
            align="center"
          />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('components:permissions')">
        <el-table
          :data="detail.permissions || []"
          size="small"
          border
          :empty-text="$t('plugins:noPermissionDeclarations')"
        >
          <el-table-column
            :label="$t('system:permissionIdentifier')"
            prop="code"
            min-width="180"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:displayName')"
            prop="name"
            min-width="140"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.name || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('components:description')"
            prop="description"
            min-width="220"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.description || '-' }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('plugins:configuration')">
        <el-table
          :data="detail.config || []"
          size="small"
          border
          :empty-text="$t('plugins:noConfigurationDeclarations')"
        >
          <el-table-column
            :label="$t('plugins:configurationKey')"
            prop="key"
            min-width="160"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('components:name')"
            prop="label"
            min-width="140"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.label || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('system:type')"
            prop="type"
            width="100"
            align="center"
          />
          <el-table-column
            :label="$t('tools:required')"
            width="70"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="scope.row.required ? 'warning' : 'info'">{{
                scope.row.required ? $t('system:yes') : $t('system:no')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:sensitive')"
            width="70"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="scope.row.secret ? 'warning' : 'info'">{{
                scope.row.secret ? $t('system:yes') : $t('system:no')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tools:defaultValue')"
            min-width="160"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ formatConfigDefaultValue(scope.row) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:constraints')"
            min-width="200"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ formatConfigConstraint(scope.row) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('components:description')"
            prop="description"
            min-width="220"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('components:dependencies')">
        <div class="detail-section-title detail-section-title-first">
          {{ $t('plugins:runtimeDependencies') }}
        </div>
        <el-table
          :data="detailDependencyRows"
          size="small"
          border
          :empty-text="$t('plugins:noRuntimeDependencyDeclarations')"
        >
          <el-table-column
            :label="$t('system:type')"
            prop="label"
            width="120"
            align="center"
          />
          <el-table-column
            :label="$t('components:count')"
            width="80"
            align="center"
          >
            <template #default="scope">{{ scope.row.items.length }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:dependency')"
            min-width="520"
          >
            <template #default="scope">
              <div class="detail-tag-list">
                <el-tag
                  v-for="item in scope.row.items"
                  :key="scope.row.kind + item"
                  :type="scope.row.tagType"
                  effect="plain"
                  >{{ item }}</el-tag
                >
                <span
                  v-if="!scope.row.items.length"
                  class="detail-empty-text"
                  >-</span
                >
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="detail-section-title">{{ $t('plugins:databaseScripts') }}</div>
        <el-table
          :data="detailScriptRows"
          size="small"
          border
          :empty-text="$t('plugins:noDatabaseScriptDeclarations')"
        >
          <el-table-column
            :label="$t('system:type')"
            prop="label"
            width="120"
            align="center"
          />
          <el-table-column
            :label="$t('components:count')"
            width="80"
            align="center"
          >
            <template #default="scope">{{ scope.row.items.length }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:script')"
            min-width="520"
          >
            <template #default="scope">
              <div class="detail-tag-list">
                <el-tag
                  v-for="item in scope.row.items"
                  :key="scope.row.kind + item"
                  type="info"
                  effect="plain"
                  >{{ item }}</el-tag
                >
                <span
                  v-if="!scope.row.items.length"
                  class="detail-empty-text"
                  >-</span
                >
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="detail-section-title">{{ $t('plugins:executionHistory') }}</div>
        <el-table
          v-loading="migrationLoading"
          :data="migrationHistory"
          size="small"
          border
          :empty-text="$t('plugins:noMigrationHistory')"
        >
          <el-table-column
            :label="$t('plugins:script')"
            prop="migrationPath"
            min-width="220"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:version')"
            prop="version"
            width="100"
            align="center"
          >
            <template #default="scope">{{ scope.row.version || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('system:status')"
            width="120"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="getMigrationStatusTagType(scope.row.status)">
                {{ getMigrationStatusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:count')"
            prop="attemptCount"
            width="70"
            align="center"
          >
            <template #default="scope">{{ scope.row.attemptCount ?? 0 }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:statement')"
            prop="statementCount"
            width="70"
            align="center"
          >
            <template #default="scope">{{ scope.row.statementCount ?? 0 }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:startTime')"
            width="160"
            align="center"
          >
            <template #default="scope">{{
              formatPluginTime(scope.row.startedTime || scope.row.createTime)
            }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:endTime')"
            width="160"
            align="center"
          >
            <template #default="scope">{{ formatPluginTime(scope.row.finishedTime) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:errorMessage')"
            min-width="220"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.errorMessage || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('system:actions')"
            width="110"
            align="center"
            fixed="right"
          >
            <template #default="scope">
              <div class="detail-row-actions">
                <el-tooltip
                  v-if="canMarkMigrationSuccess(scope.row)"
                  :content="$t('plugins:markSuccessful')"
                  placement="top"
                >
                  <el-button
                    link
                    type="success"
                    icon="CircleCheck"
                    @click="emit('mark-migration-success', scope.row)"
                    v-hasPermi="['system:plugin:edit']"
                  />
                </el-tooltip>
                <el-tooltip
                  v-if="canMarkMigrationFailed(scope.row)"
                  :content="$t('plugins:markFailed')"
                  placement="top"
                >
                  <el-button
                    link
                    type="danger"
                    icon="CircleClose"
                    @click="emit('mark-migration-failed', scope.row)"
                    v-hasPermi="['system:plugin:edit']"
                  />
                </el-tooltip>
                <span
                  v-if="!canMarkMigrationSuccess(scope.row) && !canMarkMigrationFailed(scope.row)"
                  >-</span
                >
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="detail-section-title">{{ $t('components:pluginDependencies') }}</div>
        <el-table
          :data="detail.pluginDependencies || []"
          size="small"
          border
          :empty-text="$t('plugins:noPluginDependencies')"
        >
          <el-table-column
            :label="$t('components:pluginID')"
            prop="id"
            width="160"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:versionConstraint')"
            prop="version"
            width="140"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.version || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('components:description')"
            prop="description"
            min-width="220"
            :show-overflow-tooltip="true"
          />
        </el-table>
        <div class="detail-section-title">{{ $t('plugins:scheduledTasks') }}</div>
        <el-table
          :data="detail.backend?.jobs || []"
          size="small"
          border
          :empty-text="$t('plugins:noScheduledTaskDeclarations')"
        >
          <el-table-column
            :label="$t('plugins:taskID')"
            prop="id"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('components:name')"
            prop="name"
            min-width="140"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.name || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:invocationTarget')"
            prop="callable"
            min-width="220"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            label="Cron"
            prop="cronExpression"
            width="150"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:enabledByDefault')"
            width="90"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="scope.row.enabled ? 'success' : 'info'">{{
                scope.row.enabled ? $t('system:yes') : $t('system:no')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('components:description')"
            prop="description"
            min-width="220"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          v-if="detail.status === 'error' && detail.source !== 'artifact'"
          type="primary"
          @click="emit('repair')"
          v-hasPermi="['system:plugin:edit']"
          >{{ $t('plugins:reinstallToRepair') }}</el-button
        >
        <el-button @click="emit('update:modelValue', false)">{{ $t('monitor:close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup name="PluginDetailDialog">
import { t } from '@/i18n/adapter'
import { computed, ref } from 'vue'
import { getPluginReleaseView } from '@/utils/pluginReleaseFormatter'
import PluginRuntimeMetrics from './PluginRuntimeMetrics.vue'

const activeTab = ref('overview')

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  detail: {
    type: Object,
    default: () => ({}),
  },
  getStatusLabel: {
    type: Function,
    required: true,
  },
  formatPluginTime: {
    type: Function,
    required: true,
  },
  formatConfigDefaultValue: {
    type: Function,
    required: true,
  },
  formatConfigConstraint: {
    type: Function,
    required: true,
  },
  migrationHistory: {
    type: Array,
    default: () => [],
  },
  migrationLoading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:modelValue',
  'repair',
  'mark-migration-success',
  'mark-migration-failed',
])

const releaseView = computed(() => getPluginReleaseView(props.detail))

const detailDependencyRows = computed(() => {
  const dependencies = props.detail.dependencies || {}
  return [
    {
      kind: 'python',
      label: 'Python',
      tagType: 'success',
      items: normalizeDetailItems(dependencies.python),
    },
    {
      kind: 'npm',
      label: 'npm',
      tagType: 'primary',
      items: normalizeDetailItems(dependencies.npm),
    },
    {
      kind: 'npmDev',
      label: 'npmDev',
      tagType: 'warning',
      items: normalizeDetailItems(dependencies.npmDev),
    },
  ]
})

const detailScriptRows = computed(() => {
  const backend = props.detail.backend || {}
  return [
    {
      kind: 'migration',
      label: 'Migration',
      items: normalizeDetailItems(backend.migrations),
    },
    {
      kind: 'seed',
      label: 'Seed',
      items: normalizeDetailItems(backend.seeds),
    },
  ]
})

function formatYesNo(value) {
  if (value === undefined || value === null) {
    return '-'
  }
  return value ? t('system:yes') : t('system:no')
}

function formatDetailTags(tags) {
  return Array.isArray(tags) && tags.length ? tags.join(', ') : '-'
}

function getFrontendDeliveryLabel(delivery) {
  if (!delivery) {
    return '-'
  }
  const typeMap = {
    get none() {
      return t('plugins:noFrontendResources')
    },
    get source() {
      return t('plugins:sourceDelivery')
    },
    get bundle() {
      return t('plugins:standaloneFrontendArtifact')
    },
  }
  return typeMap[delivery.type] || delivery.type || '-'
}

function normalizeDetailItems(items) {
  return Array.isArray(items) ? items.filter(Boolean) : []
}

function getMigrationStatusLabel(status) {
  const statusMap = {
    get running() {
      return t('plugins:runningInterrupted')
    },
    get success() {
      return t('system:success')
    },
    get failed() {
      return t('monitor:failed')
    },
    get unknown() {
      return t('components:unknown')
    },
  }
  return statusMap[status] || status || '-'
}

function getMigrationStatusTagType(status) {
  const statusMap = {
    running: 'warning',
    success: 'success',
    failed: 'danger',
    unknown: 'info',
  }
  return statusMap[status] || 'info'
}

function canMarkMigrationSuccess(row) {
  return props.detail.source !== 'artifact' && ['running', 'failed'].includes(row?.status)
}

function canMarkMigrationFailed(row) {
  return props.detail.source !== 'artifact' && row?.status === 'running'
}
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}

.detail-section-title {
  margin: 14px 0 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
}

.detail-section-title-first {
  margin-top: 0;
}

.detail-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
  align-items: center;
}

.detail-empty-text {
  color: var(--el-text-color-regular);
}

.detail-row-actions {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.release-identity {
  overflow-wrap: anywhere;
}

.release-explanation {
  margin-top: 4px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.release-error :deep(.el-alert__description) {
  overflow-wrap: anywhere;
}
</style>
