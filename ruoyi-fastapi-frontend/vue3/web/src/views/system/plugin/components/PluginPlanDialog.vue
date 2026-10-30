<template>
  <el-dialog
    :title="title"
    :model-value="modelValue"
    width="min(920px, calc(100vw - 32px))"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert
      v-if="planResult.message"
      :title="planResult.message"
      :type="planResult.ok ? 'success' : 'warning'"
      show-icon
      :closable="false"
      class="mb16"
    />
    <div class="plan-summary">
      <div class="plan-summary-item">
        <span class="plan-summary-label">{{ $t('plugins:plannedOperation') }}</span>
        <span class="plan-summary-value">{{ formatPluginOperation(planResult.operation) }}</span>
      </div>
      <div class="plan-summary-item">
        <span class="plan-summary-label">{{ $t('plugins:targetPlugin') }}</span>
        <span class="plan-summary-value">{{ planResult.requestedPluginIds.length }}</span>
      </div>
      <div class="plan-summary-item">
        <span class="plan-summary-label">{{ $t('plugins:executable') }}</span>
        <span class="plan-summary-value">{{ planResult.executablePluginIds.length }}</span>
      </div>
      <div class="plan-summary-item">
        <span class="plan-summary-label">{{ $t('plugins:blockers') }}</span>
        <span class="plan-summary-value is-danger">{{ planResult.blockerCount }}</span>
      </div>
    </div>
    <el-descriptions
      :column="1"
      border
      class="mb16"
    >
      <el-descriptions-item :label="$t('plugins:targetScope')">{{
        formatPluginIdsForDisplay(planResult.requestedPluginIds)
      }}</el-descriptions-item>
      <el-descriptions-item :label="$t('plugins:executionOrder')">
        <el-tag
          v-for="pluginId in planResult.executablePluginIds"
          :key="pluginId"
          class="plan-order-tag"
          type="info"
          >{{ pluginId }}</el-tag
        >
        <span v-if="!planResult.executablePluginIds.length">-</span>
      </el-descriptions-item>
    </el-descriptions>

    <el-tabs>
      <el-tab-pane :label="$t('plugins:planItem')">
        <el-table
          :data="planResult.items"
          size="small"
          border
          :empty-text="$t('plugins:noPlanItems')"
        >
          <el-table-column
            :label="$t('plugins:order')"
            prop="order"
            width="70"
            align="center"
          />
          <el-table-column
            :label="$t('components:pluginID')"
            prop="pluginId"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('components:pluginName')"
            prop="name"
            min-width="150"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:version')"
            prop="version"
            width="100"
            align="center"
          />
          <el-table-column
            :label="$t('plugins:explicitlySelected')"
            width="90"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="scope.row.requested ? 'success' : 'info'">{{
                scope.row.requested ? $t('system:yes') : $t('components:dependencies')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:executable')"
            width="90"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="getPlanReadyTagType(scope.row.ready)">{{
                scope.row.ready ? $t('system:yes') : $t('system:no')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('components:dependencies')"
            min-width="180"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">
              <span>{{ formatPlanDependencies(scope.row.dependencies) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:blockers')"
            width="90"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="scope.row.blockers?.length ? 'danger' : 'success'">{{
                scope.row.blockers?.length || 0
              }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('plugins:blockingReasonLabel')">
        <el-table
          :data="planResult.blockers"
          size="small"
          border
          :empty-text="$t('plugins:noBlockers')"
        >
          <el-table-column
            :label="$t('components:pluginID')"
            prop="pluginId"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:requiredPlugin')"
            prop="dependencyId"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('system:status')"
            width="150"
            align="center"
          >
            <template #default="scope">
              <el-tag type="danger">{{ getPlanBlockerStatusLabel(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('components:description')"
            prop="message"
            min-width="320"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('monitor:executionResult')">
        <el-descriptions
          :column="4"
          border
          class="mb16"
        >
          <el-descriptions-item :label="$t('plugins:total')">{{
            batchResult.summary.total
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('system:success')">{{
            batchResult.summary.succeeded
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('monitor:failed')">{{
            batchResult.summary.failed
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:skipped')">{{
            batchResult.summary.skipped
          }}</el-descriptions-item>
        </el-descriptions>
        <el-table
          :data="batchResult.executed"
          size="small"
          border
          :empty-text="$t('plugins:noExecutionRecords')"
        >
          <el-table-column
            :label="$t('components:pluginID')"
            prop="pluginId"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('system:actions')"
            width="90"
            align="center"
          >
            <template #default="scope">{{ formatPluginOperation(scope.row.operation) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('system:status')"
            width="90"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="scope.row.ok ? 'success' : 'danger'">{{
                scope.row.status || '-'
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:duration')"
            prop="durationMs"
            width="90"
            align="center"
          >
            <template #default="scope">{{ scope.row.durationMs ?? '-' }}ms</template>
          </el-table-column>
          <el-table-column
            :label="$t('components:description')"
            prop="message"
            min-width="220"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('components:suggestion')"
            prop="suggestion"
            min-width="260"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="dialog-footer">
        <el-switch
          :model-value="continueOnError"
          :active-text="$t('plugins:continueAfterFailure')"
          :inactive-text="$t('plugins:stopOnFailure')"
          class="mr12"
          @update:model-value="emit('update:continueOnError', $event)"
        />
        <el-button
          type="primary"
          :disabled="!canExecuteBatchPlan"
          :loading="loading"
          @click="emit('execute')"
          v-hasPermi="['system:plugin:edit']"
          >{{ $t('plugins:executionPlan')
          }}{{ formatPluginOperation(planResult.operation) }}</el-button
        >
        <el-button @click="emit('update:modelValue', false)">{{ $t('monitor:close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup name="PluginPlanDialog">
import { t } from '@/i18n/adapter'
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: () => t('plugins:pluginDependencyPlan'),
  },
  planResult: {
    type: Object,
    required: true,
  },
  batchResult: {
    type: Object,
    required: true,
  },
  continueOnError: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  formatPluginOperation: {
    type: Function,
    required: true,
  },
  formatPluginIdsForDisplay: {
    type: Function,
    required: true,
  },
  formatPlanDependencies: {
    type: Function,
    required: true,
  },
  getPlanReadyTagType: {
    type: Function,
    required: true,
  },
  getPlanBlockerStatusLabel: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'update:continueOnError', 'execute'])

const canExecuteBatchPlan = computed(() => {
  return props.planResult.ok && props.planResult.executablePluginIds.length > 0
})
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}

.mr12 {
  margin-right: 12px;
}

.plan-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.plan-summary-item {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: var(--el-fill-color-light);
}

.plan-summary-label {
  display: block;
  margin-bottom: 6px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.plan-summary-value {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}

.plan-summary-value.is-danger {
  color: var(--el-color-danger);
}

.plan-order-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

@media (max-width: 1200px) {
  .plan-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .plan-summary {
    grid-template-columns: 1fr;
  }
}
</style>
