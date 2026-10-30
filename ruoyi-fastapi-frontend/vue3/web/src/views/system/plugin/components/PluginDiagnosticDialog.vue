<template>
  <el-dialog
    :title="title"
    :model-value="modelValue"
    width="min(920px, calc(100vw - 32px))"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
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
          <span class="diagnostic-summary-label">{{ $t('components:pluginID') }}</span>
          <span class="diagnostic-summary-value">{{ result.pluginId || '-' }}</span>
        </div>
        <div class="diagnostic-summary-item">
          <span class="diagnostic-summary-label">{{ $t('files:result') }}</span>
          <el-tag :type="result.ok ? 'success' : 'danger'">{{
            result.ok ? $t('layout:notices.active') : $t('monitor:error')
          }}</el-tag>
        </div>
        <div
          v-if="health"
          class="diagnostic-summary-item"
        >
          <span class="diagnostic-summary-label">{{ $t('system:status') }}</span>
          <span class="diagnostic-summary-value">{{ health.status || '-' }}</span>
        </div>
        <div
          v-if="health"
          class="diagnostic-summary-item"
        >
          <span class="diagnostic-summary-label">{{ $t('monitor:duration') }}</span>
          <span class="diagnostic-summary-value">{{ health.durationMs ?? '-' }}ms</span>
        </div>
      </div>

      <el-tabs>
        <el-tab-pane
          v-if="health"
          :label="$t('plugins:healthStatus')"
        >
          <el-descriptions
            :column="2"
            border
            class="mb16"
          >
            <el-descriptions-item :label="$t('plugins:checker')">{{
              health.checker || '-'
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('system:status')">{{
              health.status || '-'
            }}</el-descriptions-item>
            <el-descriptions-item
              :label="$t('components:description')"
              :span="2"
              >{{ health.message || '-' }}</el-descriptions-item
            >
            <el-descriptions-item
              :label="$t('plugins:error')"
              :span="2"
              >{{ health.error || '-' }}</el-descriptions-item
            >
          </el-descriptions>
          <el-input
            :model-value="formatJson(health.details)"
            type="textarea"
            :rows="8"
            readonly
          />
        </el-tab-pane>

        <el-tab-pane
          v-if="diagnose"
          :label="$t('plugins:checkSummary')"
        >
          <el-descriptions
            :column="3"
            border
            class="mb16"
          >
            <el-descriptions-item :label="$t('components:dependencies')">{{
              formatBoolean(diagnose.check?.dependencyOk)
            }}</el-descriptions-item>
            <el-descriptions-item label="Manifest">{{
              formatBoolean(diagnose.check?.manifestOk)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('components:structure')">{{
              formatBoolean(diagnose.check?.structureOk)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('components:pluginDependencies')">{{
              formatBoolean(diagnose.check?.pluginDependencyOk)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('components:menuConflicts')">{{
              formatBoolean(diagnose.check?.menuConflictOk)
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('plugins:configurationItem')">{{
              diagnose.config?.summary?.total ?? '-'
            }}</el-descriptions-item>
          </el-descriptions>
          <el-table
            :data="validationItems"
            size="small"
            border
            :empty-text="$t('plugins:noDiagnosticIssues')"
          >
            <el-table-column
              :label="$t('plugins:category')"
              prop="category"
              width="120"
              align="center"
            />
            <el-table-column
              :label="$t('components:level')"
              width="90"
              align="center"
            >
              <template #default="scope">
                <el-tag :type="getValidationLevelTagType(scope.row.level)">{{
                  getValidationLevelLabel(scope.row.level)
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('system:type')"
              prop="kind"
              width="170"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('plugins:object')"
              prop="value"
              min-width="180"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('components:description')"
              prop="message"
              min-width="260"
              :show-overflow-tooltip="true"
            />
          </el-table>
        </el-tab-pane>

        <el-tab-pane
          v-if="diagnose"
          :label="$t('plugins:menuPlan')"
        >
          <el-input
            :model-value="formatJson(diagnose.menuPlan)"
            type="textarea"
            :rows="12"
            readonly
          />
        </el-tab-pane>

        <el-tab-pane :label="$t('plugins:rawData')">
          <el-input
            :model-value="formatJson(result)"
            type="textarea"
            :rows="14"
            readonly
          />
        </el-tab-pane>
      </el-tabs>
    </template>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="emit('update:modelValue', false)">{{ $t('monitor:close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup name="PluginDiagnosticDialog">
import { t } from '@/i18n/adapter'
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: () => t('plugins:pluginDiagnostics'),
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

const emit = defineEmits(['update:modelValue'])

const health = computed(() => props.result.health || null)
const diagnose = computed(() => (props.result.info || props.result.check ? props.result : null))

const validationItems = computed(() => {
  const check = diagnose.value?.check || {}
  const groups = [
    [t('components:dependencies'), check.dependencies],
    [t('plugins:manifestError'), check.manifestIssues],
    [t('plugins:manifestWarning'), check.manifestWarnings],
    [t('components:pluginDependencies'), check.pluginDependencyErrors],
    [t('components:structure'), check.structureErrors],
    [t('components:menuConflicts'), check.menuConflicts],
  ]

  return groups.flatMap(([category, items]) =>
    Array.isArray(items)
      ? items.map((item) => ({
          category,
          level: item.level || (category.includes(t('system:warning')) ? 'warning' : 'error'),
          kind: item.kind || item.name || item.status || '-',
          value: item.value || item.requirement || item.path || item.pluginId || item.perms || '-',
          message: item.message || item.suggestion || item.reason || '',
        }))
      : []
  )
})
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
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: var(--el-fill-color-light);
}

.diagnostic-summary-label {
  display: block;
  margin-bottom: 6px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.diagnostic-summary-value {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}
</style>
