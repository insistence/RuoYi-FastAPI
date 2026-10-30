<template>
  <el-dialog
    :title="title"
    :visible="visible"
    width="min(920px, calc(100vw - 32px))"
    append-to-body
    @close="emit('update:visible', false)"
  >
    <el-alert
      v-if="result.message"
      :title="result.message"
      :type="result.ok ? 'success' : 'warning'"
      show-icon
      :closable="false"
      class="mb16"
    />

    <el-skeleton
      v-if="loading"
      :rows="6"
      animated
    />
    <template v-else>
      <div class="diagnostic-summary">
        <div class="diagnostic-summary-item">
          <span class="diagnostic-summary-label">{{ $t('pluginAdmin:id') }}</span>
          <span class="diagnostic-summary-value">{{ result.pluginId || '-' }}</span>
        </div>
        <div class="diagnostic-summary-item">
          <span class="diagnostic-summary-label">{{ $t('file:messages.result') }}</span>
          <el-tag :type="result.ok ? 'success' : 'danger'">{{
            result.ok ? $t('layout:notices.active') : $t('pluginAdmin:interface.error')
          }}</el-tag>
        </div>
        <div
          v-if="health"
          class="diagnostic-summary-item"
        >
          <span class="diagnostic-summary-label">{{ $t('common:status') }}</span>
          <span class="diagnostic-summary-value">{{ health.status || '-' }}</span>
        </div>
        <div
          v-if="health"
          class="diagnostic-summary-item"
        >
          <span class="diagnostic-summary-label">{{ $t('monitor:job.duration') }}</span>
          <span class="diagnostic-summary-value">{{ formatDuration(health.durationMs) }}ms</span>
        </div>
      </div>

      <el-tabs>
        <el-tab-pane
          v-if="health"
          :label="$t('pluginAdmin:messages.healthStatus')"
        >
          <el-descriptions
            :column="2"
            border
            class="mb16"
          >
            <el-descriptions-item :label="$t('pluginAdmin:messages.checker')">{{
              health.checker || '-'
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('common:status')">{{
              health.status || '-'
            }}</el-descriptions-item>
            <el-descriptions-item
              :label="$t('common:description')"
              :span="2"
              >{{ health.message || '-' }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="$t('system:messages.error')"
              :span="2"
              >{{ health.error || '-' }}</el-descriptions-item
            >
          </el-descriptions>
          <el-input
            :value="formatJson(health.details)"
            type="textarea"
            :rows="8"
            readonly
          />
        </el-tab-pane>

        <el-tab-pane
          v-if="diagnose"
          :label="$t('pluginAdmin:messages.checkSummary')"
        >
          <el-descriptions
            :column="3"
            border
            class="mb16"
          >
            <el-descriptions-item :label="$t('pluginAdmin:dependencies')">{{
              formatBoolean(diagnoseCheck.dependencyOk)
            }}</el-descriptions-item>
            <el-descriptions-item label="Manifest">{{
              formatBoolean(diagnoseCheck.manifestOk)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('common:structure')">{{
              formatBoolean(diagnoseCheck.structureOk)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('pluginAdmin:dependencyTitle')">{{
              formatBoolean(diagnoseCheck.pluginDependencyOk)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('pluginAdmin:menuConflict')">{{
              formatBoolean(diagnoseCheck.menuConflictOk)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('pluginAdmin:messages.configurationItem')">{{
              diagnoseConfigTotal
            }}</el-descriptions-item>
          </el-descriptions>
          <el-table
            :data="validationItems"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noDiagnosticIssues')"
          >
            <el-table-column
              :label="$t('pluginAdmin:messages.category')"
              prop="category"
              width="120"
              align="center"
            />
            <el-table-column
              :label="$t('common:level')"
              width="90"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="getValidationLevelTagType(scope.row.level)">{{
                  getValidationLevelLabel(scope.row.level)
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('common:type')"
              prop="kind"
              width="170"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('pluginAdmin:messages.object')"
              prop="value"
              min-width="180"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('common:description')"
              prop="message"
              min-width="260"
              :show-overflow-tooltip="true"
            />
          </el-table>
        </el-tab-pane>

        <el-tab-pane
          v-if="diagnose"
          :label="$t('pluginAdmin:messages.menuPlan')"
        >
          <el-input
            :value="formatJson(diagnose.menuPlan)"
            type="textarea"
            :rows="12"
            readonly
          />
        </el-tab-pane>

        <el-tab-pane :label="$t('pluginAdmin:messages.rawData')">
          <el-input
            :value="formatJson(result)"
            type="textarea"
            :rows="14"
            readonly
          />
        </el-tab-pane>
      </el-tabs>
    </template>

    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button @click="emit('update:visible', false)">{{ $t('common:close') }}</el-button>
    </div>
  </el-dialog>
</template>

<script setup name="PluginDiagnosticDialog">
import { t } from '@/i18n/adapter'

import { computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    get default() {
      return t('pluginAdmin:messages.pluginDiagnostics')
    },
  },
  result: {
    type: Object,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  formatJson: {
    type: Function,
    required: true,
  },
  formatBoolean: {
    type: Function,
    required: true,
  },
  getValidationLevelLabel: {
    type: Function,
    required: true,
  },
  getValidationLevelTagType: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['update:visible'])

const health = computed(() => props.result.health || null)
const diagnose = computed(() => (props.result.info || props.result.check ? props.result : null))
const diagnoseCheck = computed(() =>
  diagnose.value && diagnose.value.check ? diagnose.value.check : {}
)
const diagnoseConfigTotal = computed(() => {
  const config = diagnose.value && diagnose.value.config
  const total = config && config.summary ? config.summary.total : undefined
  return total === null || total === undefined ? '-' : total
})

const validationItems = computed(() => {
  const check = diagnose.value?.check || {}
  const groups = [
    [t('pluginAdmin:dependencies'), check.dependencies],
    [t('system:messages.manifestErrors'), check.manifestIssues],
    [t('system:messages.manifestWarnings'), check.manifestWarnings],
    [t('pluginAdmin:dependencyTitle'), check.pluginDependencyErrors],
    [t('common:structure'), check.structureErrors],
    [t('pluginAdmin:menuConflict'), check.menuConflicts],
  ]

  return groups.flatMap(([category, items]) =>
    Array.isArray(items)
      ? items.map((item) => ({
          category,
          level: item.level || (category.includes(t('common:warning')) ? 'warning' : 'error'),
          kind: item.kind || item.name || item.status || '-',
          value: item.value || item.requirement || item.path || item.pluginId || item.perms || '-',
          message: item.message || item.suggestion || item.reason || '',
        }))
      : []
  )
})

function formatDuration(value) {
  return value === null || value === undefined ? '-' : value
}
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}

.diagnostic-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.diagnostic-summary-item {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 4px;
  background: var(--el-fill-color-light, #f8f9fb);
}

.diagnostic-summary-label {
  display: block;
  margin-bottom: 6px;
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;
}

.diagnostic-summary-value {
  color: var(--el-text-color-primary, #303133);
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}
</style>
