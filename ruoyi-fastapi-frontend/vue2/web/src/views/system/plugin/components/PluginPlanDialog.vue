<template>
  <el-dialog
    :title="title"
    :visible="visible"
    width="min(920px, calc(100vw - 32px))"
    append-to-body
    @close="emit('update:visible', false)"
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
        <span class="plan-summary-label">{{ $t('pluginAdmin:messages.plannedOperation') }}</span>
        <span class="plan-summary-value">{{ formatPluginOperation(planResult.operation) }}</span>
      </div>
      <div class="plan-summary-item">
        <span class="plan-summary-label">{{ $t('pluginAdmin:messages.targetPlugin') }}</span>
        <span class="plan-summary-value">{{ planResult.requestedPluginIds.length }}</span>
      </div>
      <div class="plan-summary-item">
        <span class="plan-summary-label">{{ $t('pluginAdmin:messages.executable') }}</span>
        <span class="plan-summary-value">{{ planResult.executablePluginIds.length }}</span>
      </div>
      <div class="plan-summary-item">
        <span class="plan-summary-label">{{ $t('pluginAdmin:messages.blockers') }}</span>
        <span class="plan-summary-value is-danger">{{ planResult.blockerCount }}</span>
      </div>
    </div>
    <el-descriptions
      :column="1"
      border
      class="mb16"
    >
      <el-descriptions-item :label="$t('pluginAdmin:messages.targetScope')">{{
        formatPluginIdsForDisplay(planResult.requestedPluginIds)
      }}</el-descriptions-item>
      <el-descriptions-item :label="$t('pluginAdmin:messages.executionOrder')">
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
      <el-tab-pane :label="$t('pluginAdmin:messages.planItem')">
        <el-table
          :data="planResult.items"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noPlanItems')"
        >
          <el-table-column
            :label="$t('pluginAdmin:messages.order')"
            prop="order"
            width="70"
            align="center"
          />
          <el-table-column
            :label="$t('pluginAdmin:id')"
            prop="pluginId"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:name')"
            prop="name"
            min-width="150"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.version')"
            prop="version"
            width="100"
            align="center"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.explicitlySelected')"
            width="90"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.requested ? 'success' : 'info'">{{
                scope.row.requested ? $t('common:yes') : $t('pluginAdmin:dependencies')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.executable')"
            width="90"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="getPlanReadyTagType(scope.row.ready)">{{
                scope.row.ready ? $t('common:yes') : $t('common:no')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:dependencies')"
            min-width="180"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">
              <span>{{ formatPlanDependencies(scope.row.dependencies) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.blockers')"
            width="90"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="getBlockerCount(scope.row) ? 'danger' : 'success'">{{
                getBlockerCount(scope.row)
              }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('pluginAdmin:messages.blockingReason')">
        <el-table
          :data="planResult.blockers"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noBlockers')"
        >
          <el-table-column
            :label="$t('pluginAdmin:id')"
            prop="pluginId"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.requiredPlugin')"
            prop="dependencyId"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('common:status')"
            width="150"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag type="danger">{{ getPlanBlockerStatusLabel(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('common:description')"
            prop="message"
            min-width="320"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('monitor:messages.executionResult')">
        <el-descriptions
          :column="4"
          border
          class="mb16"
        >
          <el-descriptions-item :label="$t('pluginAdmin:messages.total')">{{
            batchResult.summary.total
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('common:success')">{{
            batchResult.summary.succeeded
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('common:failed')">{{
            batchResult.summary.failed
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.skipped')">{{
            batchResult.summary.skipped
          }}</el-descriptions-item>
        </el-descriptions>
        <el-table
          :data="batchResult.executed"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noExecutionRecords')"
        >
          <el-table-column
            :label="$t('pluginAdmin:id')"
            prop="pluginId"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('common:actions')"
            width="90"
            align="center"
          >
            <template slot-scope="scope">{{ formatPluginOperation(scope.row.operation) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:status')"
            width="90"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.ok ? 'success' : 'danger'">{{
                scope.row.status || '-'
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:job.duration')"
            prop="durationMs"
            width="90"
            align="center"
          >
            <template slot-scope="scope">{{ formatDuration(scope.row.durationMs) }}ms</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:description')"
            prop="message"
            min-width="220"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('common:suggestion')"
            prop="suggestion"
            min-width="260"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-switch
        :value="continueOnError"
        :active-text="$t('pluginAdmin:messages.continueAfterFailure')"
        :inactive-text="$t('pluginAdmin:messages.stopOnFailure')"
        class="mr12"
        @input="emit('update:continueOnError', $event)"
      />
      <el-button
        type="primary"
        :disabled="!canExecuteBatchPlan"
        :loading="loading"
        @click="emit('execute')"
        v-hasPermi="['system:plugin:edit']"
        >{{ $t('pluginAdmin:messages.executionPlan')
        }}{{ formatPluginOperation(planResult.operation) }}</el-button
      >
      <el-button @click="emit('update:visible', false)">{{ $t('common:close') }}</el-button>
    </div>
  </el-dialog>
</template>

<script setup name="PluginPlanDialog">
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
      return t('pluginAdmin:messages.pluginDependencyPlan')
    },
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

const emit = defineEmits(['update:visible', 'update:continueOnError', 'execute'])

const canExecuteBatchPlan = computed(() => {
  return props.planResult.ok && props.planResult.executablePluginIds.length > 0
})

function getBlockerCount(row) {
  return Array.isArray(row.blockers) ? row.blockers.length : 0
}

function formatDuration(value) {
  return value === null || value === undefined ? '-' : value
}
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
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 4px;
  background: var(--el-fill-color-light, #f8f9fb);
}

.plan-summary-label {
  display: block;
  margin-bottom: 6px;
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;
}

.plan-summary-value {
  color: var(--el-text-color-primary, #303133);
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}

.plan-summary-value.is-danger {
  color: var(--el-color-danger, #f56c6c);
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
