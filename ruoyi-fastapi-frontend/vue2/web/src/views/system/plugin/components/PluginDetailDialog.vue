<template>
  <el-dialog
    :title="$t('pluginAdmin:messages.pluginDetails')"
    :visible="visible"
    width="min(920px, calc(100vw - 32px))"
    append-to-body
    @close="emit('update:visible', false)"
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane
        :label="$t('pluginAdmin:messages.overview')"
        name="overview"
      >
        <div class="detail-section-title detail-section-title-first">
          {{ $t('pluginAdmin:messages.basicInformation') }}
        </div>
        <el-descriptions
          :column="2"
          border
          class="mb16"
        >
          <el-descriptions-item :label="$t('pluginAdmin:id')">{{
            detail.pluginId
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:name')">{{
            detail.pluginName
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="
              detail.source === 'artifact'
                ? $t('pluginAdmin:expression.artifactVersion')
                : $t('pluginAdmin:expression.sourceVersion')
            "
            >{{ detail.version }}</el-descriptions-item
          >
          <el-descriptions-item :label="$t('pluginAdmin:messages.installedVersion')">{{
            detail.installedVersion || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:enableSettings')">{{
            detail.enabled === '0' ? $t('system:oauth.enable') : $t('system:oauth.disabled')
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:status')">{{
            getStatusLabel(detail.status)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('common:source')">{{
            detail.source || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('common:updatedTime')">{{
            formatPluginTime(detail.updateTime)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.category')">{{
            metadata.category || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('system:dict.label')">{{
            formatDetailTags(metadata.tags)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.author')">{{
            metadata.author || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.license')">{{
            metadata.license || '-'
          }}</el-descriptions-item>
          <el-descriptions-item
            :label="$t('pluginAdmin:messages.latestError')"
            :span="2"
            >{{ detail.lastError || '-' }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="$t('pluginAdmin:messages.pluginDescription')"
            :span="2"
            >{{ detail.description || '-' }}</el-descriptions-item
          >
        </el-descriptions>

        <template v-if="detail.source === 'artifact'">
          <div class="detail-section-title">{{ $t('pluginAdmin:messages.artifactRelease') }}</div>
          <el-alert
            v-if="releaseView.unavailable"
            :title="$t('pluginAdmin:messages.releaseStatusIsUnavailableRefreshTheListAndTryAgain')"
            type="info"
            show-icon
            :closable="false"
            class="mb16"
          />
          <el-alert
            v-if="releaseView.error"
            :title="$t('pluginAdmin:messages.artifactReleaseError')"
            :description="releaseView.error"
            type="error"
            show-icon
            :closable="false"
            class="mb16 release-error"
          />
          <el-alert
            v-if="releaseView.restartRequired"
            :title="$t('pluginAdmin:messages.notAllWorkerStatusesHaveBeenConfirmed')"
            :description="
              $t(
                'pluginAdmin:messages.completeTheReleaseDuringAMaintenanceWindowThenStartAllWorkersThe'
              )
            "
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
            <el-descriptions-item :label="$t('pluginAdmin:messages.releaseStatus')">
              <el-tag :type="releaseView.tagType">{{ releaseView.label }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('pluginAdmin:messages.maintenancePreparation')">{{
              releaseView.preparationLabel
            }}</el-descriptions-item>
            <el-descriptions-item
              :label="$t('pluginAdmin:messages.workerStatus')"
              :span="2"
              >{{ releaseView.workerSummary }}</el-descriptions-item
            >
            <el-descriptions-item :label="$t('pluginAdmin:messages.targetMatchedDisabledConfirmed')"
              >{{ releaseView.counts.healthy }} /
              {{ releaseView.counts.disabled }}</el-descriptions-item
            >
            <el-descriptions-item :label="$t('pluginAdmin:messages.mismatchFailed')"
              >{{ releaseView.counts.mismatch }} /
              {{ releaseView.counts.failed }}</el-descriptions-item
            >
            <el-descriptions-item :label="$t('pluginAdmin:messages.unconfirmedHeartbeatExpired')"
              >{{ releaseView.counts.missing }} /
              {{ releaseView.counts.stale }}</el-descriptions-item
            >
            <el-descriptions-item :label="$t('pluginAdmin:messages.targetCodeVersion')">{{
              release.targetVersion || '-'
            }}</el-descriptions-item>
            <el-descriptions-item
              :label="$t('pluginAdmin:messages.targetArtifactDigest')"
              :span="2"
              ><code class="release-identity">{{
                release.targetDigest || $t('pluginAdmin:release.no_target')
              }}</code></el-descriptions-item
            >
            <el-descriptions-item
              :label="$t('pluginAdmin:messages.preparedDigest')"
              :span="2"
              ><code class="release-identity">{{
                release.preparedDigest ||
                $t('pluginAdmin:expression.maintenancePreparationIsIncomplete')
              }}</code></el-descriptions-item
            >
            <el-descriptions-item
              :label="$t('pluginAdmin:messages.releaseGeneration')"
              :span="2"
              ><code class="release-identity">{{
                release.generation || '-'
              }}</code></el-descriptions-item
            >
            <el-descriptions-item
              :label="$t('pluginAdmin:messages.installedSchemaVersion')"
              :span="2"
            >
              {{ detail.installedVersion || '-' }}
              <div class="release-explanation">
                {{
                  $t(
                    'pluginAdmin:messages.theVersionReachedByDatabaseMigrationsAndInstalledResourcesRollingBackCode'
                  )
                }}
              </div>
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <div class="detail-section-title">{{ $t('pluginAdmin:messages.backendDeclarations') }}</div>
        <el-descriptions
          :column="2"
          border
          class="mb16"
        >
          <el-descriptions-item
            :label="$t('pluginAdmin:messages.backendPath')"
            :span="2"
            >{{ detail.backendPath || '-' }}</el-descriptions-item
          >
          <el-descriptions-item
            :label="$t('pluginAdmin:messages.backendModule')"
            :span="2"
            >{{ backend.module || '-' }}</el-descriptions-item
          >
          <el-descriptions-item :label="$t('pluginAdmin:messages.automaticRouteDiscovery')">{{
            formatYesNo(backend.autoScanRouters)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.scheduledTasks')">{{
            backendJobs.length
          }}</el-descriptions-item>
        </el-descriptions>

        <div class="detail-section-title">
          {{ $t('pluginAdmin:messages.frontendDeclarations') }}
        </div>
        <el-descriptions
          :column="2"
          border
        >
          <el-descriptions-item
            :label="$t('pluginAdmin:messages.frontendPath')"
            :span="2"
            >{{ detail.frontendPath || '-' }}</el-descriptions-item
          >
          <el-descriptions-item :label="$t('pluginAdmin:messages.frontendPluginID')">{{
            frontend.pluginId || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.frontendBasePath')">{{
            frontend.basePath || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.viewDirectory')">{{
            frontend.viewsPath || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.aPIDirectory')">{{
            frontend.apiPath || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.frontendDelivery')">{{
            getFrontendDeliveryLabel(frontend.delivery)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.menuDeclarations')">{{
            frontendMenus.length
          }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>
      <el-tab-pane
        :label="$t('pluginAdmin:messages.runtimeMonitoring')"
        name="metrics"
        lazy
      >
        <PluginRuntimeMetrics
          v-if="visible && activeTab === 'metrics'"
          :plugin-id="detail.pluginId"
        />
      </el-tab-pane>
      <el-tab-pane :label="$t('system:menu.menu')">
        <el-table
          :data="frontendMenus"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noMenuDeclarations')"
        >
          <el-table-column
            :label="$t('common:name')"
            prop="name"
            min-width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.path')"
            prop="path"
            min-width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.component')"
            prop="component"
            min-width="180"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('system:permission.title')"
            prop="perms"
            min-width="160"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.perms || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:type')"
            prop="type"
            width="70"
            align="center"
          />
          <el-table-column
            :label="$t('common:sort')"
            prop="orderNum"
            width="70"
            align="center"
          />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('system:permission.title')">
        <el-table
          :data="detail.permissions || []"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noPermissionDeclarations')"
        >
          <el-table-column
            :label="$t('system:menu.permission')"
            prop="code"
            min-width="180"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.displayName')"
            prop="name"
            min-width="140"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.name || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:description')"
            prop="description"
            min-width="220"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.description || '-' }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('pluginAdmin:messages.configuration')">
        <el-table
          :data="detail.config || []"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noConfigurationDeclarations')"
        >
          <el-table-column
            :label="$t('pluginAdmin:messages.configurationKey')"
            prop="key"
            min-width="160"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('common:name')"
            prop="label"
            min-width="140"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.label || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:type')"
            prop="type"
            width="100"
            align="center"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.required')"
            width="70"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.required ? 'warning' : 'info'">{{
                scope.row.required ? $t('common:yes') : $t('common:no')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.sensitive')"
            width="70"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.secret ? 'warning' : 'info'">{{
                scope.row.secret ? $t('common:yes') : $t('common:no')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.defaultValue')"
            min-width="160"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ formatConfigDefaultValue(scope.row) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.constraints')"
            min-width="200"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ formatConfigConstraint(scope.row) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:description')"
            prop="description"
            min-width="220"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('pluginAdmin:dependencies')">
        <div class="detail-section-title detail-section-title-first">
          {{ $t('pluginAdmin:messages.runtimeDependencies') }}
        </div>
        <el-table
          :data="detailDependencyRows"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noRuntimeDependencyDeclarations')"
        >
          <el-table-column
            :label="$t('common:type')"
            prop="label"
            width="120"
            align="center"
          />
          <el-table-column
            :label="$t('common:count')"
            width="80"
            align="center"
          >
            <template slot-scope="scope">{{ scope.row.items.length }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.dependency')"
            min-width="520"
          >
            <template slot-scope="scope">
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

        <div class="detail-section-title">{{ $t('pluginAdmin:messages.databaseScripts') }}</div>
        <el-table
          :data="detailScriptRows"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noDatabaseScriptDeclarations')"
        >
          <el-table-column
            :label="$t('common:type')"
            prop="label"
            width="120"
            align="center"
          />
          <el-table-column
            :label="$t('common:count')"
            width="80"
            align="center"
          >
            <template slot-scope="scope">{{ scope.row.items.length }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.script')"
            min-width="520"
          >
            <template slot-scope="scope">
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

        <div class="detail-section-title">{{ $t('pluginAdmin:messages.executionHistory') }}</div>
        <el-table
          v-loading="migrationLoading"
          :data="migrationHistory"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noMigrationHistory')"
        >
          <el-table-column
            :label="$t('pluginAdmin:messages.script')"
            prop="migrationPath"
            min-width="220"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.version')"
            prop="version"
            width="100"
            align="center"
          >
            <template slot-scope="scope">{{ scope.row.version || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:status')"
            width="120"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="getMigrationStatusTagType(scope.row.status)">
                {{ getMigrationStatusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:messages.count')"
            prop="attemptCount"
            width="70"
            align="center"
          >
            <template slot-scope="scope">{{ formatCount(scope.row.attemptCount) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.statement')"
            prop="statementCount"
            width="70"
            align="center"
          >
            <template slot-scope="scope">{{ formatCount(scope.row.statementCount) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:startTime')"
            width="160"
            align="center"
          >
            <template slot-scope="scope">{{
              formatPluginTime(scope.row.startedTime || scope.row.createTime)
            }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:endTime')"
            width="160"
            align="center"
          >
            <template slot-scope="scope">{{ formatPluginTime(scope.row.finishedTime) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.errorMessage')"
            min-width="220"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.errorMessage || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:actions')"
            width="110"
            align="center"
            fixed="right"
          >
            <template slot-scope="scope">
              <div class="detail-row-actions">
                <el-tooltip
                  v-if="canMarkMigrationSuccess(scope.row)"
                  :content="$t('pluginAdmin:messages.markSuccessful')"
                  placement="top"
                >
                  <el-button
                    type="text"
                    icon="el-icon-circle-check"
                    @click="emit('mark-migration-success', scope.row)"
                    v-hasPermi="['system:plugin:edit']"
                  />
                </el-tooltip>
                <el-tooltip
                  v-if="canMarkMigrationFailed(scope.row)"
                  :content="$t('pluginAdmin:messages.markFailed')"
                  placement="top"
                >
                  <el-button
                    type="text"
                    icon="el-icon-circle-close"
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

        <div class="detail-section-title">{{ $t('pluginAdmin:dependencyTitle') }}</div>
        <el-table
          :data="detail.pluginDependencies || []"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noPluginDependencies')"
        >
          <el-table-column
            :label="$t('pluginAdmin:id')"
            prop="id"
            width="160"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.versionConstraint')"
            prop="version"
            width="140"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.version || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:description')"
            prop="description"
            min-width="220"
            :show-overflow-tooltip="true"
          />
        </el-table>
        <div class="detail-section-title">{{ $t('pluginAdmin:messages.scheduledTasks') }}</div>
        <el-table
          :data="backendJobs"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noScheduledTaskDeclarations')"
        >
          <el-table-column
            :label="$t('pluginAdmin:messages.taskID')"
            prop="id"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('common:name')"
            prop="name"
            min-width="140"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.name || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:job.target')"
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
            :label="$t('pluginAdmin:messages.enabledByDefault')"
            width="90"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.enabled ? 'success' : 'info'">{{
                scope.row.enabled ? $t('common:yes') : $t('common:no')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('common:description')"
            prop="description"
            min-width="220"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button
        v-if="detail.status === 'error' && detail.source !== 'artifact'"
        type="primary"
        @click="emit('repair')"
        v-hasPermi="['system:plugin:edit']"
        >{{ $t('pluginAdmin:messages.reinstallToRepair') }}</el-button
      >
      <el-button @click="emit('update:visible', false)">{{ $t('common:close') }}</el-button>
    </div>
  </el-dialog>
</template>

<script setup name="PluginDetailDialog">
import { t } from '@/i18n/adapter'

import { computed, ref } from 'vue'
import { getPluginReleaseView } from '@/utils/pluginReleaseDisplay'
import PluginRuntimeMetrics from './PluginRuntimeMetrics.vue'

const activeTab = ref('overview')

const props = defineProps({
  visible: {
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
  'update:visible',
  'repair',
  'mark-migration-success',
  'mark-migration-failed',
])

const metadata = computed(() => props.detail.metadata || {})
const backend = computed(() => props.detail.backend || {})
const frontend = computed(() => props.detail.frontend || {})
const frontendMenus = computed(() =>
  Array.isArray(frontend.value.menus) ? frontend.value.menus : []
)
const backendJobs = computed(() => (Array.isArray(backend.value.jobs) ? backend.value.jobs : []))
const release = computed(() => props.detail.release || {})
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
  return value ? t('common:yes') : t('common:no')
}

function formatCount(value) {
  return value === null || value === undefined ? 0 : value
}

function formatDetailTags(tags) {
  return Array.isArray(tags) && tags.length ? tags.join(', ') : '-'
}

function getFrontendDeliveryLabel(delivery) {
  if (!delivery) {
    return '-'
  }
  const typeMap = {
    none: t('pluginAdmin:messages.noFrontendResources'),
    source: t('pluginAdmin:messages.sourceDelivery'),
    bundle: t('pluginAdmin:messages.standaloneFrontendArtifact'),
  }
  return typeMap[delivery.type] || delivery.type || '-'
}

function normalizeDetailItems(items) {
  return Array.isArray(items) ? items.filter(Boolean) : []
}

function getMigrationStatusLabel(status) {
  const statusMap = {
    running: t('pluginAdmin:messages.runningInterrupted'),
    success: t('common:success'),
    failed: t('common:failed'),
    unknown: t('common:unknown'),
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
  color: var(--el-text-color-regular, #606266);
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
  color: var(--el-text-color-regular, #606266);
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
  color: var(--el-text-color-regular, #606266);
  line-height: 1.5;
}

.release-error :deep(.el-alert__description) {
  overflow-wrap: anywhere;
}
</style>
