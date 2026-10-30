<template>
  <el-dialog
    :title="$t('components:pluginDependencies')"
    :model-value="modelValue"
    width="min(860px, calc(100vw - 32px))"
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
    <div class="dependency-summary">
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{ $t('components:pluginID') }}</span>
        <span class="dependency-summary-value">{{ result.pluginId || '-' }}</span>
      </div>
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{ $t('plugins:dependencyCheck') }}</span>
        <el-tag :type="result.dependencyOk ? 'success' : 'danger'">{{
          formatBoolean(result.dependencyOk)
        }}</el-tag>
      </div>
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{ $t('plugins:missingDependenciesLabel') }}</span>
        <span class="dependency-summary-value is-danger">{{ dependencyProblemCount }}</span>
      </div>
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{ $t('plugins:installationPlan') }}</span>
        <span class="dependency-summary-value">{{
          result.planCount ?? (result.plan || []).length
        }}</span>
      </div>
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{ $t('plugins:installationPolicy') }}</span>
        <el-tag
          v-if="policy"
          :type="policyTagType"
          >{{ policy.mode || '-' }}</el-tag
        >
        <span
          v-else
          class="dependency-summary-value"
          >-</span
        >
      </div>
    </div>
    <el-alert
      v-if="policy"
      :title="policySummaryTitle"
      :type="policyAllowed ? 'success' : 'warning'"
      show-icon
      :closable="false"
      class="mb16"
    >
      <template #default>
        <div
          v-if="policyMessages.length"
          class="dependency-policy-messages"
        >
          <div
            v-for="message in policyMessages"
            :key="message"
          >
            {{ message }}
          </div>
        </div>
        <div
          v-if="policyNextStep"
          class="dependency-policy-next"
        >
          {{ policyNextStep }}
        </div>
      </template>
    </el-alert>
    <el-tabs>
      <el-tab-pane :label="$t('plugins:dependencyStatus')">
        <el-table
          :data="result.dependencies || []"
          size="small"
          border
          :empty-text="$t('plugins:noDependencyDeclarations')"
        >
          <el-table-column
            :label="$t('system:type')"
            prop="kind"
            width="90"
            align="center"
          />
          <el-table-column
            :label="$t('components:dependencies')"
            prop="requirement"
            min-width="200"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:installedVersion')"
            min-width="130"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.installedVersion || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:installationStatus')"
            width="100"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="getDependencyTagType(scope.row)">{{
                formatDependencyInstalled(scope.row)
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:versionRequirementMet')"
            width="100"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="getDependencyTagType(scope.row)">{{
                formatDependencyVersionSatisfied(scope.row)
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('components:description')"
            prop="message"
            min-width="240"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('plugins:installationPlan')">
        <el-table
          :data="result.plan || []"
          size="small"
          border
          :empty-text="$t('plugins:noInstallationPlan')"
        >
          <el-table-column
            :label="$t('system:type')"
            prop="kind"
            width="90"
            align="center"
          />
          <el-table-column
            :label="$t('components:dependencies')"
            prop="requirement"
            min-width="150"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:workingDirectory')"
            prop="workdir"
            min-width="220"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('monitor:command')"
            min-width="300"
          >
            <template #default="scope">
              <div class="dependency-command-cell">
                <span class="dependency-command-text">{{ scope.row.commandText || '-' }}</span>
                <el-tooltip
                  :content="$t('plugins:copyCommand')"
                  placement="top"
                >
                  <el-button
                    link
                    type="primary"
                    icon="CopyDocument"
                    :disabled="!scope.row.commandText"
                    @click="copyDependencyCommand(scope.row.commandText)"
                  />
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane
        v-if="policy"
        :label="$t('plugins:policyDecision')"
      >
        <el-descriptions
          :column="2"
          border
          size="small"
          class="mb16"
        >
          <el-descriptions-item :label="$t('plugins:policyMode')">{{
            policy.mode || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:executionAllowed')">
            <el-tag :type="policyAllowed ? 'success' : 'danger'">{{
              policyAllowed ? $t('authCenter:allow') : $t('plugins:blockedLabel')
            }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:blockingReason')">{{
            formatPolicyList(policy.reasons)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:prerequisites')">{{
            formatPolicyList(policy.requirements)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('plugins:risks')">{{
            formatPolicyList(policy.warnings)
          }}</el-descriptions-item>
        </el-descriptions>
        <el-table
          :data="policy.items || []"
          size="small"
          border
          :empty-text="$t('plugins:noPolicyEntries')"
        >
          <el-table-column
            :label="$t('system:type')"
            prop="kind"
            width="90"
            align="center"
          />
          <el-table-column
            :label="$t('components:dependencies')"
            prop="requirement"
            min-width="180"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('plugins:decision')"
            width="90"
            align="center"
          >
            <template #default="scope">
              <el-tag :type="scope.row.allowed ? 'success' : 'danger'">{{
                scope.row.allowed ? $t('authCenter:allow') : $t('plugins:blockedLabel')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:lockedVersion')"
            min-width="120"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.lockedVersion || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('plugins:offlineArtifacts')"
            min-width="220"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ scope.row.artifactPath || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('components:description')"
            min-width="260"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">{{ formatPolicyItemMessage(scope.row) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          type="primary"
          :disabled="isCapabilityOperationBlocked(result.capability, 'dependency_install')"
          :loading="loading"
          @click="emit('dry-run')"
          >{{ $t('plugins:generateInstallationPlan') }}</el-button
        >
        <el-button
          type="success"
          :disabled="!canInstall"
          :loading="loading"
          @click="emit('install')"
          v-hasPermi="['system:plugin:edit']"
          >{{ $t('plugins:installDependencies') }}</el-button
        >
        <el-button @click="emit('update:modelValue', false)">{{ $t('monitor:close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup name="PluginDependencyDialog">
import { t } from '@/i18n/adapter'
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  result: {
    type: Object,
    default: () => ({}),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  isCapabilityOperationBlocked: {
    type: Function,
    required: true,
  },
  formatBoolean: {
    type: Function,
    required: true,
  },
  getDependencyTagType: {
    type: Function,
    required: true,
  },
  formatDependencyInstalled: {
    type: Function,
    required: true,
  },
  formatDependencyVersionSatisfied: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'dry-run', 'install'])

const dependencyProblemCount = computed(() => {
  const dependencies = Array.isArray(props.result.dependencies) ? props.result.dependencies : []
  return dependencies.filter((item) => item.status !== 'skipped' && !item.ok).length
})

const policy = computed(() => {
  const policyPayload = props.result.policy
  return policyPayload && typeof policyPayload === 'object' ? policyPayload : null
})

const policyAllowed = computed(() => policy.value?.allowed === true)

const policyTagType = computed(() => (policyAllowed.value ? 'success' : 'warning'))

const policySummaryTitle = computed(() =>
  policyAllowed.value
    ? t('plugins:thePolicyPermitsInstallation')
    : t('plugins:thePolicyBlocksInstallation')
)

const policyMessages = computed(() => {
  if (!policy.value) {
    return []
  }
  return [
    ...(Array.isArray(policy.value.reasons) ? policy.value.reasons : []),
    ...(Array.isArray(policy.value.requirements) ? policy.value.requirements : []),
    ...(Array.isArray(policy.value.warnings) ? policy.value.warnings : []),
  ]
})

const policyNextStep = computed(() => {
  if (!policy.value || policyAllowed.value) {
    return ''
  }
  if (policy.value.mode === 'plan_only') {
    return t('plugins:theWebConsoleOnlyGeneratesInstallationPlansPerformControlledInstallation')
  }
  return t('plugins:provideTheConfirmationParametersLockFilesOrOfflineArtifactsRequired')
})

const canInstall = computed(() => {
  return (
    !props.isCapabilityOperationBlocked(props.result.capability, 'dependency_install') &&
    Array.isArray(props.result.plan) &&
    props.result.plan.length > 0 &&
    policy.value?.allowed !== false
  )
})

function formatPolicyList(items) {
  return Array.isArray(items) && items.length ? items.join('；') : '-'
}

function formatPolicyItemMessage(item) {
  return formatPolicyList([
    ...(Array.isArray(item.reasons) ? item.reasons : []),
    ...(Array.isArray(item.requirements) ? item.requirements : []),
    ...(Array.isArray(item.warnings) ? item.warnings : []),
  ])
}

function copyDependencyCommand(commandText) {
  if (!commandText) {
    return
  }
  copyText(commandText)
    .then(() => {
      ElMessage.success(t('plugins:commandCopied'))
    })
    .catch(() => {
      ElMessage.error(t('plugins:copyFailedCopyTheCommandManually'))
    })
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) {
    throw new Error('copy failed')
  }
}
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}

.dependency-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.dependency-summary-item {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: var(--el-fill-color-light);
}

.dependency-summary-label {
  display: block;
  margin-bottom: 6px;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.dependency-summary-value {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}

.dependency-summary-value.is-danger {
  color: var(--el-color-danger);
}

.dependency-policy-messages {
  display: grid;
  gap: 4px;
}

.dependency-policy-next {
  margin-top: 6px;
  color: var(--el-text-color-regular);
}

.dependency-command-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dependency-command-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-family: monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1200px) {
  .dependency-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .dependency-summary {
    grid-template-columns: 1fr;
  }
}
</style>
