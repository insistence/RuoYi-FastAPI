<template>
  <el-dialog
    :title="$t('pluginAdmin:dependencyTitle')"
    :visible="visible"
    width="min(860px, calc(100vw - 32px))"
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
    <div class="dependency-summary">
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{ $t('pluginAdmin:id') }}</span>
        <span class="dependency-summary-value">{{ result.pluginId || '-' }}</span>
      </div>
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{
          $t('pluginAdmin:messages.dependencyCheck')
        }}</span>
        <el-tag :type="result.dependencyOk ? 'success' : 'danger'">{{
          formatBoolean(result.dependencyOk)
        }}</el-tag>
      </div>
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{
          $t('pluginAdmin:messages.missingDependencies')
        }}</span>
        <span class="dependency-summary-value is-danger">{{ dependencyProblemCount }}</span>
      </div>
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{
          $t('pluginAdmin:messages.installationPlan')
        }}</span>
        <span class="dependency-summary-value">{{ formatPlanCount(result) }}</span>
      </div>
      <div class="dependency-summary-item">
        <span class="dependency-summary-label">{{
          $t('pluginAdmin:messages.installationPolicy')
        }}</span>
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
    </el-alert>
    <el-tabs>
      <el-tab-pane :label="$t('pluginAdmin:messages.dependencyStatus')">
        <el-table
          :data="result.dependencies || []"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noDependencyDeclarations')"
        >
          <el-table-column
            :label="$t('common:type')"
            prop="kind"
            width="90"
            align="center"
          />
          <el-table-column
            :label="$t('pluginAdmin:dependencies')"
            prop="requirement"
            min-width="200"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.installedVersion')"
            min-width="130"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.installedVersion || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.installationStatus')"
            width="100"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="getDependencyTagType(scope.row)">{{
                formatDependencyInstalled(scope.row)
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.versionRequirementMet')"
            width="100"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="getDependencyTagType(scope.row)">{{
                formatDependencyVersionSatisfied(scope.row)
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('common:description')"
            prop="message"
            min-width="240"
            :show-overflow-tooltip="true"
          />
        </el-table>
      </el-tab-pane>
      <el-tab-pane :label="$t('pluginAdmin:messages.installationPlan')">
        <el-table
          :data="result.plan || []"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noInstallationPlan')"
        >
          <el-table-column
            :label="$t('common:type')"
            prop="kind"
            width="90"
            align="center"
          />
          <el-table-column
            :label="$t('pluginAdmin:dependencies')"
            prop="requirement"
            min-width="150"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.workingDirectory')"
            prop="workdir"
            min-width="220"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('monitor:messages.command')"
            min-width="300"
          >
            <template slot-scope="scope">
              <div class="dependency-command-cell">
                <span class="dependency-command-text">{{ scope.row.commandText || '-' }}</span>
                <el-tooltip
                  :content="$t('pluginAdmin:messages.copyCommand')"
                  placement="top"
                >
                  <el-button
                    type="text"
                    icon="el-icon-document-copy"
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
        :label="$t('pluginAdmin:messages.policyDecision')"
      >
        <el-descriptions
          :column="2"
          border
          size="small"
          class="mb16"
        >
          <el-descriptions-item :label="$t('pluginAdmin:messages.policyMode')">{{
            policy.mode || '-'
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.executionAllowed')">
            <el-tag :type="policyAllowed ? 'success' : 'danger'">{{
              policyAllowed ? $t('authCenter:messages.allow') : $t('pluginAdmin:expression.blocked')
            }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.blockingReason')">{{
            formatPolicyList(policy.reasons)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.prerequisites')">{{
            formatPolicyList(policy.requirements)
          }}</el-descriptions-item>
          <el-descriptions-item :label="$t('pluginAdmin:messages.risks')">{{
            formatPolicyList(policy.warnings)
          }}</el-descriptions-item>
        </el-descriptions>
        <el-table
          :data="policy.items || []"
          size="small"
          border
          :empty-text="$t('pluginAdmin:messages.noPolicyEntries')"
        >
          <el-table-column
            :label="$t('common:type')"
            prop="kind"
            width="90"
            align="center"
          />
          <el-table-column
            :label="$t('pluginAdmin:dependencies')"
            prop="requirement"
            min-width="180"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('pluginAdmin:messages.decision')"
            width="90"
            align="center"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.allowed ? 'success' : 'danger'">{{
                scope.row.allowed
                  ? $t('authCenter:messages.allow')
                  : $t('pluginAdmin:expression.blocked')
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.lockedVersion')"
            min-width="120"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.lockedVersion || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('pluginAdmin:messages.offlineArtifacts')"
            min-width="220"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.artifactPath || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:description')"
            min-width="260"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ formatPolicyItemMessage(scope.row) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button
        type="primary"
        :disabled="isCapabilityOperationBlocked(result.capability, 'dependency_install')"
        :loading="loading"
        @click="emit('dry-run')"
        >{{ $t('pluginAdmin:messages.generateInstallationPlan') }}</el-button
      >
      <el-button
        type="success"
        :disabled="!canInstall"
        :loading="loading"
        @click="emit('install')"
        v-hasPermi="['system:plugin:edit']"
        >{{ $t('pluginAdmin:messages.installDependencies') }}</el-button
      >
      <el-button @click="emit('update:visible', false)">{{ $t('common:close') }}</el-button>
    </div>
  </el-dialog>
</template>

<script setup name="PluginDependencyDialog">
import { t } from '@/i18n/adapter'

import { computed } from 'vue'
import { Message } from 'element-ui'

const props = defineProps({
  visible: {
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

const emit = defineEmits(['update:visible', 'dry-run', 'install'])

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
    ? t('pluginAdmin:messages.thePolicyPermitsInstallation')
    : t('pluginAdmin:messages.thePolicyBlocksInstallation')
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
    return t(
      'pluginAdmin:messages.theWebConsoleOnlyGeneratesInstallationPlansPerformControlledInstallationWithCLI'
    )
  }
  return t(
    'pluginAdmin:messages.provideTheConfirmationParametersLockFilesOrOfflineArtifactsRequiredByThe'
  )
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

function formatPlanCount(result) {
  return result.planCount === null || result.planCount === undefined
    ? Array.isArray(result.plan)
      ? result.plan.length
      : 0
    : result.planCount
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
      Message.success(t('pluginAdmin:messages.commandCopied'))
    })
    .catch(() => {
      Message.error(t('pluginAdmin:messages.copyFailedCopyTheCommandManually'))
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
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 4px;
  background: var(--el-fill-color-light, #f8f9fb);
}

.dependency-summary-label {
  display: block;
  margin-bottom: 6px;
  color: var(--el-text-color-regular, #606266);
  font-size: 12px;
}

.dependency-summary-value {
  color: var(--el-text-color-primary, #303133);
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}

.dependency-summary-value.is-danger {
  color: var(--el-color-danger, #f56c6c);
}

.dependency-policy-messages {
  display: grid;
  gap: 4px;
}

.dependency-policy-next {
  margin-top: 6px;
  color: var(--el-text-color-regular, #606266);
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
  color: var(--el-text-color-primary, #303133);
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
