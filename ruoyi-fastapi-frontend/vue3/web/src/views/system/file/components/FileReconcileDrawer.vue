<template>
  <el-drawer
    :title="$t('files:fileStorageReconciliation')"
    v-model="visible"
    size="88%"
    append-to-body
    @closed="handleClosed"
  >
    <el-alert
      :title="$t('files:reconciliationChecksFileMetadataAgainstPublicProtectedAndRecycledStorage')"
      type="info"
      :closable="false"
      show-icon
      class="mb12"
    />

    <div class="reconcile-summary">
      <div class="summary-card summary-card--danger">
        <div class="summary-card__label">{{ $t('components:pending') }}</div>
        <div class="summary-card__value">{{ stats.openCount }}</div>
        <div class="summary-card__hint">{{ $t('files:issuesRequiringReviewOrRepair') }}</div>
      </div>
      <div class="summary-card summary-card--critical">
        <div class="summary-card__label">{{ $t('files:criticalIssues') }}</div>
        <div class="summary-card__value">{{ stats.criticalCount }}</div>
        <div class="summary-card__hint">{{ $t('files:missingMisplacedOrInconsistentFiles') }}</div>
      </div>
      <div class="summary-card summary-card--warning">
        <div class="summary-card__label">{{ $t('files:warnings') }}</div>
        <div class="summary-card__value">{{ stats.warningCount }}</div>
        <div class="summary-card__hint">
          {{ $t('files:orphanedFilesOrInconsistentRecycleStatus') }}
        </div>
      </div>
      <div class="summary-card summary-card--quarantine">
        <div class="summary-card__label">{{ $t('files:quarantineFile') }}</div>
        <div class="summary-card__value">{{ stats.quarantinedCount }}</div>
        <div class="summary-card__hint">
          {{ $t('files:onlyAdministratorsCanRestoreOrPermanentlyDelete') }}
        </div>
      </div>
      <div class="summary-card summary-card--run">
        <div class="summary-card__label">{{ $t('files:latestTask') }}</div>
        <div class="summary-card__status">
          <el-tag :type="runStatusType(stats.latestRun?.status)">
            {{ runStatusLabel(stats.latestRun?.status) }}
          </el-tag>
        </div>
        <div class="summary-card__hint">
          {{ stats.latestRun ? parseTime(stats.latestRun.startedTime) : $t('files:notRunYet') }}
        </div>
      </div>
    </div>

    <div class="reconcile-toolbar">
      <div class="reconcile-toolbar__tip">
        {{ $t('files:fullDigestVerificationReadsAllFileContentsEnableItDuring') }}
      </div>
      <div class="reconcile-toolbar__actions">
        <span class="mr8">{{ $t('files:verifySHA256') }}</span>
        <el-switch
          v-model="checkHash"
          class="mr12"
        />
        <el-button
          type="primary"
          plain
          icon="Refresh"
          :loading="scanning"
          :disabled="stats.latestRun?.status === 'running'"
          @click="handleStart"
        >
          {{ $t('files:startReconciliation') }}</el-button
        >
      </div>
    </div>

    <el-tabs
      v-model="activeTab"
      @tab-change="handleTabChange"
    >
      <el-tab-pane
        :label="$t('files:issueDetails')"
        name="issues"
      >
        <el-form
          ref="issueQueryRef"
          :model="issueQuery"
          :inline="true"
          label-width="68px"
        >
          <el-form-item
            :label="$t('files:keyword')"
            prop="keyword"
          >
            <el-input
              v-model="issueQuery.keyword"
              :placeholder="$t('files:fileNameIDOrRelativePath')"
              clearable
              style="width: 200px"
              @keyup.enter="handleIssueQuery"
            />
          </el-form-item>
          <el-form-item
            :label="$t('files:issueType')"
            prop="issueType"
          >
            <el-select
              v-model="issueQuery.issueType"
              :placeholder="$t('files:allTypes')"
              clearable
              style="width: 200px"
            >
              <el-option
                v-for="item in issueTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('files:severity')"
            prop="severity"
          >
            <el-select
              v-model="issueQuery.severity"
              :placeholder="$t('files:allSeverities')"
              clearable
              style="width: 200px"
            >
              <el-option
                :label="$t('monitor:critical')"
                value="critical"
              />
              <el-option
                :label="$t('system:warning')"
                value="warning"
              />
              <el-option
                :label="$t('common:notice')"
                value="info"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('files:processingStatus')"
            prop="status"
          >
            <el-select
              v-model="issueQuery.status"
              :placeholder="$t('components:allStatuses')"
              clearable
              style="width: 200px"
            >
              <el-option
                :label="$t('components:pending')"
                value="open"
              />
              <el-option
                :label="$t('files:ignored')"
                value="ignored"
              />
              <el-option
                :label="$t('files:quarantined')"
                value="quarantined"
              />
              <el-option
                :label="$t('files:resolved')"
                value="resolved"
              />
            </el-select>
          </el-form-item>
          <el-form-item label-width="0">
            <el-button
              type="primary"
              icon="Search"
              @click="handleIssueQuery"
            >
              {{ $t('system:search') }}</el-button
            >
            <el-button
              icon="Refresh"
              @click="resetIssueQuery"
              >{{ $t('system:reset') }}</el-button
            >
          </el-form-item>
        </el-form>

        <el-table
          v-loading="issueLoading"
          :data="issueList"
        >
          <el-table-column
            :label="$t('files:level')"
            align="center"
            width="80"
          >
            <template #default="scope">
              <el-tag :type="severityTagType(scope.row.severity)">
                {{ severityLabel(scope.row.severity) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('files:issueType')"
            align="center"
            prop="issueType"
            width="130"
          >
            <template #default="scope">
              {{ issueTypeLabel(scope.row.issueType) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('components:file')"
            align="left"
            prop="originalName"
            min-width="170"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">
              <div>{{ scope.row.originalName || $t('files:unregisteredFile') }}</div>
              <div class="cell-secondary">{{ scope.row.fileId || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('files:storageLocation')"
            align="left"
            min-width="230"
          >
            <template #default="scope">
              <div :title="formatLocation(scope.row.expectedRoot, scope.row.expectedKey)">
                {{ $t('files:expected')
                }}{{ formatLocation(scope.row.expectedRoot, scope.row.expectedKey) }}
              </div>
              <div
                class="cell-secondary"
                :title="formatLocation(scope.row.actualRoot, scope.row.actualKey)"
              >
                {{ $t('files:actual')
                }}{{ formatLocation(scope.row.actualRoot, scope.row.actualKey) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('files:size')"
            align="right"
            width="130"
          >
            <template #default="scope">
              <div>{{ $t('files:expected') }}{{ formatOptionalSize(scope.row.expectedSize) }}</div>
              <div class="cell-secondary">
                {{ $t('files:actual') }}{{ formatOptionalSize(scope.row.actualSize) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:status')"
            align="center"
            width="90"
          >
            <template #default="scope">
              <el-tag :type="issueStatusType(scope.row.status)">
                {{ issueStatusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('files:issueDescription')"
            align="left"
            prop="detail"
            min-width="180"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('files:lastDetected')"
            align="center"
            width="170"
          >
            <template #default="scope">
              {{ parseTime(scope.row.lastSeenTime) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:actions')"
            align="center"
            width="70"
            fixed="right"
          >
            <template #default="scope">
              <el-tooltip
                v-if="scope.row.availableActions?.length"
                :content="
                  stats.latestRun?.status === 'running'
                    ? $t('files:reconciliationIsRunningWaitForTheScanToFinish')
                    : $t('files:handleAnomaly')
                "
                placement="top"
              >
                <span class="reconcile-action-trigger">
                  <el-dropdown
                    trigger="click"
                    :disabled="stats.latestRun?.status === 'running'"
                    @command="handleCommand($event, scope.row)"
                  >
                    <el-button
                      link
                      type="primary"
                      icon="Setting"
                      :disabled="stats.latestRun?.status === 'running'"
                    />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item
                          v-for="action in scope.row.availableActions"
                          :key="action"
                          :command="action"
                        >
                          {{ actionLabel(action) }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </span>
              </el-tooltip>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
        <pagination
          v-show="issueTotal > 0"
          :total="issueTotal"
          v-model:page="issueQuery.pageNum"
          v-model:limit="issueQuery.pageSize"
          @pagination="getIssueList"
        />
      </el-tab-pane>

      <el-tab-pane
        :label="$t('files:taskHistory')"
        name="runs"
      >
        <el-table
          v-loading="runLoading"
          :data="runList"
        >
          <el-table-column
            :label="$t('monitor:taskStatus')"
            align="center"
            width="100"
          >
            <template #default="scope">
              <el-tag :type="runStatusType(scope.row.status)">
                {{ runStatusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('files:trigger')"
            align="center"
            width="100"
          >
            <template #default="scope">
              {{
                scope.row.triggerType === 'scheduled'
                  ? $t('plugins:scheduledTasks')
                  : $t('monitor:manual')
              }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('files:digestVerification')"
            align="center"
            width="90"
          >
            <template #default="scope">{{
              scope.row.checkHash ? $t('system:yes') : $t('system:no')
            }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('files:fileRecords')"
            align="right"
            prop="scannedFileCount"
            width="100"
          />
          <el-table-column
            :label="$t('files:physicalFiles')"
            align="right"
            prop="scannedStorageCount"
            width="100"
          />
          <el-table-column
            :label="$t('files:issuesFound')"
            align="right"
            prop="issueCount"
            width="100"
          />
          <el-table-column
            :label="$t('files:newIssues')"
            align="right"
            prop="newIssueCount"
            width="100"
          />
          <el-table-column
            :label="$t('files:automaticallyRecovered')"
            align="right"
            prop="resolvedIssueCount"
            width="100"
          />
          <el-table-column
            :label="$t('files:initiatedBy')"
            align="center"
            prop="startedBy"
            width="110"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('monitor:startTime')"
            align="center"
            width="170"
          >
            <template #default="scope">{{ parseTime(scope.row.startedTime) }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('files:completedAt')"
            align="center"
            width="170"
          >
            <template #default="scope">
              {{ scope.row.finishedTime ? parseTime(scope.row.finishedTime) : '-' }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:failureReason')"
            align="left"
            prop="errorMessage"
            min-width="180"
            :show-overflow-tooltip="true"
          />
        </el-table>
        <pagination
          v-show="runTotal > 0"
          :total="runTotal"
          v-model:page="runQuery.pageNum"
          v-model:limit="runQuery.pageSize"
          @pagination="getRunList"
        />
      </el-tab-pane>
    </el-tabs>
  </el-drawer>

  <el-dialog
    :title="actionLabel(handleForm.action)"
    v-model="handleOpen"
    width="520px"
    append-to-body
  >
    <el-alert
      v-if="actionDescriptions[handleForm.action]"
      :title="actionDescriptions[handleForm.action]"
      :type="dangerousActions.includes(handleForm.action) ? 'warning' : 'info'"
      :closable="false"
      show-icon
      class="mb16"
    />
    <el-form
      ref="handleFormRef"
      :model="handleForm"
      :rules="handleRules"
      label-width="90px"
    >
      <el-form-item
        v-if="handleForm.action === 'register_orphan'"
        :label="$t('components:originalFileName')"
        prop="originalName"
      >
        <el-input
          v-model="handleForm.originalName"
          :placeholder="$t('files:mustMatchThePhysicalFileExtension')"
          maxlength="255"
        />
      </el-form-item>
      <el-form-item
        :label="$t('files:processingReason')"
        prop="reason"
      >
        <el-input
          v-model="handleForm.reason"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          :placeholder="$t('files:enterTheReasonItWillBeRetainedInTheReconciliation')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleOpen = false">{{ $t('system:cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="handling"
          @click="submitHandle"
        >
          {{ $t('system:confirm') }}</el-button
        >
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import {
  getFileReconcileStats,
  handleFileReconcileIssue,
  listFileReconcileIssue,
  listFileReconcileRun,
  startFileReconcile,
} from '@/api/system/file'
import { formatFileSize } from './fileFormatters'

const emit = defineEmits(['refresh'])
const { proxy } = getCurrentInstance()
const visible = ref(false)
const activeTab = ref('issues')
const issueLoading = ref(false)
const runLoading = ref(false)
const scanning = ref(false)
const handling = ref(false)
const checkHash = ref(false)
const issueList = ref([])
const runList = ref([])
const issueTotal = ref(0)
const runTotal = ref(0)
const issueQueryRef = ref()
const handleFormRef = ref()
const handleOpen = ref(false)
const currentIssueId = ref()
let pollTimer

const stats = reactive({
  openCount: 0,
  criticalCount: 0,
  warningCount: 0,
  ignoredCount: 0,
  quarantinedCount: 0,
  latestRun: undefined,
})
const issueQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: undefined,
  issueType: undefined,
  severity: undefined,
  status: 'open',
})
const runQuery = reactive({
  pageNum: 1,
  pageSize: 10,
})
const handleForm = reactive({
  action: '',
  reason: '',
  originalName: '',
})
const handleRules = {
  reason: [
    {
      required: true,
      get message() {
        return t('files:enterAReasonForProcessing')
      },
      trigger: 'blur',
    },
  ],
  originalName: [
    {
      validator: (_rule, value, callback) => {
        if (handleForm.action === 'register_orphan' && !value) {
          callback(new Error(t('files:enterTheOriginalFileNameWhenRegisteringAnOrphanedFile')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}
const issueTypeOptions = [
  {
    get label() {
      return t('files:invalidMetadata')
    },
    value: 'invalid_metadata',
  },
  {
    get label() {
      return t('files:physicalFileMissing')
    },
    value: 'missing_file',
  },
  {
    get label() {
      return t('files:activeFileInRecycleBin')
    },
    value: 'unexpected_trash',
  },
  {
    get label() {
      return t('files:recycledFileInActiveStorage')
    },
    value: 'unexpected_source',
  },
  {
    get label() {
      return t('files:duplicatePhysicalFile')
    },
    value: 'duplicate_file',
  },
  {
    get label() {
      return t('files:wrongStorageArea')
    },
    value: 'wrong_storage_root',
  },
  {
    get label() {
      return t('files:fileSizeMismatch')
    },
    value: 'size_mismatch',
  },
  {
    get label() {
      return t('files:fileDigestMismatch')
    },
    value: 'hash_mismatch',
  },
  {
    get label() {
      return t('files:orphanedPhysicalFile')
    },
    value: 'orphan_file',
  },
  {
    get label() {
      return t('files:unsafeDirectoryEntry')
    },
    value: 'unsafe_entry',
  },
]
const dangerousActions = ['delete_quarantine', 'accept_current', 'register_orphan']
const actionDescriptions = {
  get ignore() {
    return t('files:keepThisIssueWithoutCountingItAsPendingItCan')
  },
  get reopen() {
    return t('files:returnAnIgnoredIssueToPendingStatus')
  },
  get restore_source() {
    return t('files:restoreThePhysicalFileFromTheRecycleBinToIts')
  },
  get move_to_trash() {
    return t('files:moveTheRecycledFileFromActiveStorageToItsRegistered')
  },
  get move_to_expected_root() {
    return t('files:moveThePhysicalFileToTheStorageAreaRegisteredIn')
  },
  get quarantine_file() {
    return t('files:moveTheAbnormalCopyOrOrphanedFileToQuarantineWhere')
  },
  get restore_quarantine() {
    return t('files:restoreTheQuarantinedFileToItsPreviousLocationAndReopen')
  },
  get delete_quarantine() {
    return t('files:permanentlyDeleteTheQuarantinedFileThisCannotBeUndone')
  },
  get accept_current() {
    return t('files:recalculateTheCurrentPhysicalFileSizeAndDigestAndUpdate')
  },
  get register_orphan() {
    return t('files:registerTheOrphanedPhysicalFileAsAnActiveFileOwned')
  },
}

function open() {
  visible.value = true
  activeTab.value = 'issues'
  refreshAll()
  startPolling()
}

function refreshAll() {
  getStats()
  getIssueList()
  getRunList()
}

function getStats() {
  return getFileReconcileStats().then((response) => {
    Object.assign(stats, response.data)
  })
}

function getIssueList() {
  issueLoading.value = true
  return listFileReconcileIssue(issueQuery)
    .then((response) => {
      issueList.value = response.rows
      issueTotal.value = response.total
    })
    .finally(() => {
      issueLoading.value = false
    })
}

function getRunList() {
  runLoading.value = true
  return listFileReconcileRun(runQuery)
    .then((response) => {
      runList.value = response.rows
      runTotal.value = response.total
    })
    .finally(() => {
      runLoading.value = false
    })
}

function handleStart() {
  scanning.value = true
  startFileReconcile({ checkHash: checkHash.value })
    .then(() => {
      proxy.$modal.msgSuccess(t('files:storageReconciliationStarted'))
      refreshAll()
    })
    .finally(() => {
      scanning.value = false
    })
}

function handleIssueQuery() {
  issueQuery.pageNum = 1
  getIssueList()
}

function resetIssueQuery() {
  issueQueryRef.value?.resetFields()
  issueQuery.pageNum = 1
  issueQuery.status = 'open'
  getIssueList()
}

function handleTabChange(tabName) {
  if (tabName === 'runs') {
    getRunList()
  }
}

function handleCommand(action, row) {
  currentIssueId.value = row.issueId
  Object.assign(handleForm, {
    action,
    reason: '',
    originalName: row.originalName || row.actualKey?.split('/').pop() || '',
  })
  handleOpen.value = true
  nextTick(() => handleFormRef.value?.clearValidate())
}

function submitHandle() {
  handleFormRef.value?.validate((valid) => {
    if (!valid) return
    handling.value = true
    handleFileReconcileIssue(currentIssueId.value, {
      action: handleForm.action,
      reason: handleForm.reason,
      originalName: handleForm.action === 'register_orphan' ? handleForm.originalName : undefined,
    })
      .then(() => {
        proxy.$modal.msgSuccess(t('files:storageIssueProcessedSuccessfully'))
        handleOpen.value = false
        refreshAll()
        emit('refresh')
      })
      .finally(() => {
        handling.value = false
      })
  })
}

function startPolling() {
  clearInterval(pollTimer)
  pollTimer = setInterval(() => {
    if (!visible.value || stats.latestRun?.status !== 'running') return
    refreshAll()
  }, 3000)
}

function handleClosed() {
  clearInterval(pollTimer)
  pollTimer = undefined
  handleOpen.value = false
}

function formatLocation(root, key) {
  return root && key ? `${root}:${key}` : '-'
}

function formatOptionalSize(size) {
  return size === null || size === undefined ? '-' : formatFileSize(size)
}

function issueTypeLabel(type) {
  return issueTypeOptions.find((item) => item.value === type)?.label || type
}

function severityLabel(severity) {
  return (
    {
      get critical() {
        return t('monitor:critical')
      },
      get warning() {
        return t('system:warning')
      },
      get info() {
        return t('common:notice')
      },
    }[severity] || severity
  )
}

function severityTagType(severity) {
  return { critical: 'danger', warning: 'warning', info: 'info' }[severity] || 'info'
}

function issueStatusLabel(status) {
  return (
    {
      get open() {
        return t('components:pending')
      },
      get ignored() {
        return t('files:ignored')
      },
      get quarantined() {
        return t('files:quarantined')
      },
      get resolved() {
        return t('files:resolved')
      },
    }[status] || status
  )
}

function issueStatusType(status) {
  return (
    {
      open: 'danger',
      ignored: 'info',
      quarantined: 'warning',
      resolved: 'success',
    }[status] || 'info'
  )
}

function runStatusLabel(status) {
  return (
    {
      get running() {
        return t('files:running')
      },
      get completed() {
        return t('monitor:completed')
      },
      get failed() {
        return t('monitor:failed')
      },
    }[status] || t('files:notRunYet')
  )
}

function runStatusType(status) {
  return (
    {
      running: 'warning',
      completed: 'success',
      failed: 'danger',
    }[status] || 'info'
  )
}

function actionLabel(action) {
  return (
    {
      get ignore() {
        return t('files:ignoreIssue')
      },
      get reopen() {
        return t('files:reopen')
      },
      get restore_source() {
        return t('files:restoreToActiveStorage')
      },
      get move_to_trash() {
        return t('files:moveToRecycledStorage')
      },
      get move_to_expected_root() {
        return t('files:moveToExpectedArea')
      },
      get quarantine_file() {
        return t('files:quarantineFile')
      },
      get restore_quarantine() {
        return t('files:restoreQuarantinedFile')
      },
      get delete_quarantine() {
        return t('files:permanentlyDeleteQuarantinedFile')
      },
      get accept_current() {
        return t('files:acceptCurrentFile')
      },
      get register_orphan() {
        return t('files:registerOrphanedFile')
      },
    }[action] || action
  )
}

onBeforeUnmount(() => clearInterval(pollTimer))

defineExpose({ open })
</script>

<style scoped>
.reconcile-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  position: relative;
  overflow: hidden;
  min-height: 112px;
  padding: 16px 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.summary-card::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  content: '';
  background: var(--card-color);
}

.summary-card--danger {
  --card-color: var(--el-color-danger);
}

.summary-card--critical {
  --card-color: #b42318;
}

.summary-card--warning {
  --card-color: var(--el-color-warning);
}

.summary-card--quarantine {
  --card-color: #7f56d9;
}

.summary-card--run {
  --card-color: var(--el-color-primary);
}

.summary-card__label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.summary-card__value {
  margin-top: 7px;
  color: var(--el-text-color-primary);
  font-size: 28px;
  font-weight: 600;
  line-height: 34px;
}

.summary-card__status {
  display: flex;
  align-items: center;
  height: 41px;
}

.summary-card__hint {
  overflow: hidden;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reconcile-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.reconcile-toolbar__tip {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.reconcile-toolbar__actions {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.reconcile-action-trigger {
  display: inline-flex;
  align-items: center;
}

.cell-secondary {
  overflow: hidden;
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1400px) {
  .reconcile-summary {
    grid-template-columns: repeat(3, minmax(160px, 1fr));
  }
}
</style>
