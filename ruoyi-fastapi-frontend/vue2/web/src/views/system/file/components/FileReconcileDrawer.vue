<template>
  <div>
    <el-drawer
      :title="$t('file:messages.fileStorageReconciliation')"
      :visible.sync="visible"
      size="88%"
      append-to-body
      @closed="handleClosed"
    >
      <div class="drawer-content">
        <el-alert
          :title="
            $t(
              'file:messages.reconciliationChecksFileMetadataAgainstPublicProtectedAndRecycledStorageInBoth'
            )
          "
          type="info"
          :closable="false"
          show-icon
          class="mb12"
        />

        <div class="reconcile-summary">
          <div class="summary-card summary-card--danger">
            <div class="summary-card__label">{{ $t('system:file.pending') }}</div>
            <div class="summary-card__value">{{ stats.openCount }}</div>
            <div class="summary-card__hint">
              {{ $t('file:messages.issuesRequiringReviewOrRepair') }}
            </div>
          </div>
          <div class="summary-card summary-card--critical">
            <div class="summary-card__label">{{ $t('file:messages.criticalIssues') }}</div>
            <div class="summary-card__value">{{ stats.criticalCount }}</div>
            <div class="summary-card__hint">
              {{ $t('file:messages.missingMisplacedOrInconsistentFiles') }}
            </div>
          </div>
          <div class="summary-card summary-card--warning">
            <div class="summary-card__label">{{ $t('file:messages.warnings') }}</div>
            <div class="summary-card__value">{{ stats.warningCount }}</div>
            <div class="summary-card__hint">
              {{ $t('file:messages.orphanedFilesOrInconsistentRecycleStatus') }}
            </div>
          </div>
          <div class="summary-card summary-card--quarantine">
            <div class="summary-card__label">{{ $t('file:messages.quarantineFile') }}</div>
            <div class="summary-card__value">{{ stats.quarantinedCount }}</div>
            <div class="summary-card__hint">
              {{ $t('file:messages.onlyAdministratorsCanRestoreOrPermanentlyDelete') }}
            </div>
          </div>
          <div class="summary-card summary-card--run">
            <div class="summary-card__label">{{ $t('file:messages.latestTask') }}</div>
            <div class="summary-card__status">
              <el-tag :type="runStatusType(latestRun.status)">
                {{ runStatusLabel(latestRun.status) }}
              </el-tag>
            </div>
            <div class="summary-card__hint">
              {{
                latestRun.startedTime
                  ? parseTime(latestRun.startedTime)
                  : $t('file:messages.notRunYet')
              }}
            </div>
          </div>
        </div>

        <div class="reconcile-toolbar">
          <div class="reconcile-toolbar__tip">
            {{
              $t('file:messages.fullDigestVerificationReadsAllFileContentsEnableItDuringOffPeak')
            }}
          </div>
          <div class="reconcile-toolbar__actions">
            <span class="mr8">{{ $t('file:messages.verifySHA256') }}</span>
            <el-switch
              v-model="checkHash"
              class="mr12"
            />
            <el-button
              type="primary"
              plain
              size="mini"
              icon="el-icon-refresh"
              :loading="scanning"
              :disabled="latestRun.status === 'running'"
              @click="handleStart"
              >{{ $t('file:messages.startReconciliation') }}</el-button
            >
          </div>
        </div>

        <el-tabs
          v-model="activeTab"
          @tab-click="handleTabClick"
        >
          <el-tab-pane
            :label="$t('file:messages.issueDetails')"
            name="issues"
          >
            <el-form
              :validate-on-rule-change="false"
              ref="issueQueryForm"
              :model="issueQuery"
              :inline="true"
              label-width="68px"
            >
              <el-form-item
                :label="$t('file:messages.keyword')"
                prop="keyword"
              >
                <el-input
                  v-model="issueQuery.keyword"
                  :placeholder="$t('file:messages.fileNameIDOrRelativePath')"
                  clearable
                  size="small"
                  style="width: 200px"
                  @keyup.enter.native="handleIssueQuery"
                />
              </el-form-item>
              <el-form-item
                :label="$t('file:messages.issueType')"
                prop="issueType"
              >
                <el-select
                  v-model="issueQuery.issueType"
                  :placeholder="$t('file:messages.allTypes')"
                  clearable
                  size="small"
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
                :label="$t('file:messages.severity')"
                prop="severity"
              >
                <el-select
                  v-model="issueQuery.severity"
                  :placeholder="$t('file:messages.allSeverities')"
                  clearable
                  size="small"
                  style="width: 200px"
                >
                  <el-option
                    :label="$t('common:critical')"
                    value="critical"
                  />
                  <el-option
                    :label="$t('common:warning')"
                    value="warning"
                  />
                  <el-option
                    :label="$t('common:tip')"
                    value="info"
                  />
                </el-select>
              </el-form-item>
              <el-form-item
                :label="$t('file:messages.processingStatus')"
                prop="status"
              >
                <el-select
                  v-model="issueQuery.status"
                  :placeholder="$t('common:allStatuses')"
                  clearable
                  size="small"
                  style="width: 200px"
                >
                  <el-option
                    :label="$t('system:file.pending')"
                    value="open"
                  />
                  <el-option
                    :label="$t('file:messages.ignored')"
                    value="ignored"
                  />
                  <el-option
                    :label="$t('file:messages.quarantined')"
                    value="quarantined"
                  />
                  <el-option
                    :label="$t('file:messages.resolved')"
                    value="resolved"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label-width="0">
                <el-button
                  type="primary"
                  size="mini"
                  icon="el-icon-search"
                  @click="handleIssueQuery"
                  >{{ $t('common:search') }}</el-button
                >
                <el-button
                  size="mini"
                  icon="el-icon-refresh"
                  @click="resetIssueQuery"
                  >{{ $t('common:reset') }}</el-button
                >
              </el-form-item>
            </el-form>

            <el-table
              v-loading="issueLoading"
              :data="issueList"
            >
              <el-table-column
                :label="$t('file:messages.level')"
                align="center"
                width="80"
              >
                <template slot-scope="scope">
                  <el-tag :type="severityTagType(scope.row.severity)">
                    {{ severityLabel(scope.row.severity) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('file:messages.issueType')"
                align="center"
                width="130"
              >
                <template slot-scope="scope">
                  {{ issueTypeLabel(scope.row.issueType) }}
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('system:file.file')"
                align="left"
                prop="originalName"
                min-width="170"
                show-overflow-tooltip
              >
                <template slot-scope="scope">
                  <div>{{ scope.row.originalName || $t('file:expression.unregisteredFile') }}</div>
                  <div class="cell-secondary">
                    {{ scope.row.fileId || '-' }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('file:messages.storageLocation')"
                align="left"
                min-width="230"
              >
                <template slot-scope="scope">
                  <div :title="formatLocation(scope.row.expectedRoot, scope.row.expectedKey)">
                    {{ $t('file:messages.expected')
                    }}{{ formatLocation(scope.row.expectedRoot, scope.row.expectedKey) }}
                  </div>
                  <div
                    class="cell-secondary"
                    :title="formatLocation(scope.row.actualRoot, scope.row.actualKey)"
                  >
                    {{ $t('file:messages.actual')
                    }}{{ formatLocation(scope.row.actualRoot, scope.row.actualKey) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('file:messages.size')"
                align="right"
                width="130"
              >
                <template slot-scope="scope">
                  <div>
                    {{ $t('file:messages.expected')
                    }}{{ formatOptionalSize(scope.row.expectedSize) }}
                  </div>
                  <div class="cell-secondary">
                    {{ $t('file:messages.actual') }}{{ formatOptionalSize(scope.row.actualSize) }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('common:status')"
                align="center"
                width="90"
              >
                <template slot-scope="scope">
                  <el-tag :type="issueStatusType(scope.row.status)">
                    {{ issueStatusLabel(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('file:messages.issueDescription')"
                align="left"
                prop="detail"
                min-width="180"
                show-overflow-tooltip
              />
              <el-table-column
                :label="$t('file:messages.lastDetected')"
                align="center"
                width="170"
              >
                <template slot-scope="scope">
                  {{ parseTime(scope.row.lastSeenTime) }}
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('common:actions')"
                align="center"
                width="70"
                fixed="right"
              >
                <template slot-scope="scope">
                  <el-tooltip
                    v-if="scope.row.availableActions && scope.row.availableActions.length"
                    :content="
                      latestRun.status === 'running'
                        ? $t('file:expression.reconciliationIsRunningWaitForTheScanToComplete')
                        : $t('file:expression.processIssue')
                    "
                    placement="top"
                  >
                    <span class="reconcile-action-trigger">
                      <el-dropdown
                        trigger="click"
                        :disabled="latestRun.status === 'running'"
                        @command="handleCommand($event, scope.row)"
                      >
                        <el-button
                          type="text"
                          icon="el-icon-setting"
                          class="table-operation-button"
                          :disabled="latestRun.status === 'running'"
                        />
                        <el-dropdown-menu slot="dropdown">
                          <el-dropdown-item
                            v-for="action in scope.row.availableActions"
                            :key="action"
                            :command="action"
                          >
                            {{ actionLabel(action) }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
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
              :page.sync="issueQuery.pageNum"
              :limit.sync="issueQuery.pageSize"
              @pagination="getIssueList"
            />
          </el-tab-pane>

          <el-tab-pane
            :label="$t('file:messages.taskHistory')"
            name="runs"
          >
            <el-table
              v-loading="runLoading"
              :data="runList"
            >
              <el-table-column
                :label="$t('monitor:messages.taskStatus')"
                align="center"
                width="100"
              >
                <template slot-scope="scope">
                  <el-tag :type="runStatusType(scope.row.status)">
                    {{ runStatusLabel(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('file:messages.trigger')"
                align="center"
                width="100"
              >
                <template slot-scope="scope">
                  {{
                    scope.row.triggerType === 'scheduled'
                      ? $t('pluginAdmin:messages.scheduledTasks')
                      : $t('file:expression.manual')
                  }}
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('file:messages.digestVerification')"
                align="center"
                width="90"
              >
                <template slot-scope="scope">{{
                  scope.row.checkHash ? $t('common:yes') : $t('common:no')
                }}</template>
              </el-table-column>
              <el-table-column
                :label="$t('file:messages.fileRecords')"
                align="right"
                prop="scannedFileCount"
                width="100"
              />
              <el-table-column
                :label="$t('file:messages.physicalFiles')"
                align="right"
                prop="scannedStorageCount"
                width="100"
              />
              <el-table-column
                :label="$t('file:messages.issuesFound')"
                align="right"
                prop="issueCount"
                width="100"
              />
              <el-table-column
                :label="$t('file:messages.newIssues')"
                align="right"
                prop="newIssueCount"
                width="100"
              />
              <el-table-column
                :label="$t('file:messages.automaticallyRecovered')"
                align="right"
                prop="resolvedIssueCount"
                width="100"
              />
              <el-table-column
                :label="$t('file:messages.initiatedBy')"
                align="center"
                prop="startedBy"
                width="110"
                show-overflow-tooltip
              />
              <el-table-column
                :label="$t('common:startTime')"
                align="center"
                width="170"
              >
                <template slot-scope="scope">{{ parseTime(scope.row.startedTime) }}</template>
              </el-table-column>
              <el-table-column
                :label="$t('file:messages.completedAt')"
                align="center"
                width="170"
              >
                <template slot-scope="scope">
                  {{ scope.row.finishedTime ? parseTime(scope.row.finishedTime) : '-' }}
                </template>
              </el-table-column>
              <el-table-column
                :label="$t('common:failureReason')"
                align="left"
                prop="errorMessage"
                min-width="180"
                show-overflow-tooltip
              />
            </el-table>
            <pagination
              v-show="runTotal > 0"
              :total="runTotal"
              :page.sync="runQuery.pageNum"
              :limit.sync="runQuery.pageSize"
              @pagination="getRunList"
            />
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <el-dialog
      :title="actionLabel(handleForm.action)"
      :visible.sync="handleOpen"
      width="520px"
      append-to-body
    >
      <el-alert
        v-if="actionDescriptions[handleForm.action]"
        :title="actionDescriptions[handleForm.action]"
        :type="dangerousActions.indexOf(handleForm.action) >= 0 ? 'warning' : 'info'"
        :closable="false"
        show-icon
        class="mb16"
      />
      <el-form
        :validate-on-rule-change="false"
        ref="handleForm"
        :model="handleForm"
        :rules="handleRules"
        label-width="90px"
      >
        <el-form-item
          v-if="handleForm.action === 'register_orphan'"
          :label="$t('file:originalName')"
          prop="originalName"
        >
          <el-input
            v-model="handleForm.originalName"
            :placeholder="$t('file:messages.mustMatchThePhysicalFileExtension')"
            maxlength="255"
          />
        </el-form-item>
        <el-form-item
          :label="$t('file:messages.processingReason')"
          prop="reason"
        >
          <el-input
            v-model="handleForm.reason"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            :placeholder="
              $t('file:messages.enterTheReasonItWillBeRetainedInTheReconciliationRecord')
            "
          />
        </el-form-item>
      </el-form>
      <div
        slot="footer"
        class="dialog-footer"
      >
        <el-button @click="handleOpen = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="handling"
          @click="submitHandle"
        >
          {{ $t('common:confirm') }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import {
  getFileReconcileStats,
  handleFileReconcileIssue,
  listFileReconcileIssue,
  listFileReconcileRun,
  startFileReconcile,
} from '@/api/system/file'
import { formatFileSize } from './fileFormatters'

export default {
  name: 'FileReconcileDrawer',
  data() {
    const validateOriginalName = (_rule, value, callback) => {
      if (this.handleForm.action === 'register_orphan' && !value) {
        callback(
          new Error(t('file:interface.enterTheOriginalFileNameWhenRegisteringAnOrphanedFile'))
        )
        return
      }
      callback()
    }
    return {
      visible: false,
      activeTab: 'issues',
      issueLoading: false,
      runLoading: false,
      scanning: false,
      handling: false,
      checkHash: false,
      issueList: [],
      runList: [],
      issueTotal: 0,
      runTotal: 0,
      pollTimer: null,
      currentIssueId: null,
      handleOpen: false,
      stats: {
        openCount: 0,
        criticalCount: 0,
        warningCount: 0,
        ignoredCount: 0,
        quarantinedCount: 0,
        latestRun: null,
      },
      issueQuery: {
        pageNum: 1,
        pageSize: 10,
        keyword: undefined,
        issueType: undefined,
        severity: undefined,
        status: 'open',
      },
      runQuery: {
        pageNum: 1,
        pageSize: 10,
      },
      handleForm: {
        action: '',
        reason: '',
        originalName: '',
      },
      handleRules: {
        reason: [
          {
            required: true,
            message: () => t('file:messages.enterAReasonForProcessing'),
            trigger: 'blur',
          },
        ],
        originalName: [{ validator: validateOriginalName, trigger: 'blur' }],
      },
      issueTypeOptions: [
        {
          get label() {
            return t('file:messages.invalidMetadata')
          },
          value: 'invalid_metadata',
        },
        {
          get label() {
            return t('file:messages.physicalFileMissing')
          },
          value: 'missing_file',
        },
        {
          get label() {
            return t('file:messages.activeFileInRecycleBin')
          },
          value: 'unexpected_trash',
        },
        {
          get label() {
            return t('file:messages.recycledFileInActiveStorage')
          },
          value: 'unexpected_source',
        },
        {
          get label() {
            return t('file:messages.duplicatePhysicalFile')
          },
          value: 'duplicate_file',
        },
        {
          get label() {
            return t('file:messages.wrongStorageArea')
          },
          value: 'wrong_storage_root',
        },
        {
          get label() {
            return t('file:messages.fileSizeMismatch')
          },
          value: 'size_mismatch',
        },
        {
          get label() {
            return t('file:messages.fileDigestMismatch')
          },
          value: 'hash_mismatch',
        },
        {
          get label() {
            return t('file:messages.orphanedPhysicalFile')
          },
          value: 'orphan_file',
        },
        {
          get label() {
            return t('file:messages.unsafeDirectoryEntry')
          },
          value: 'unsafe_entry',
        },
      ],
      dangerousActions: ['delete_quarantine', 'accept_current', 'register_orphan'],
      actionDescriptions: {
        get ignore() {
          return t('file:messages.keepThisIssueWithoutCountingItAsPendingItCanBeReopened')
        },
        get reopen() {
          return t('file:messages.returnAnIgnoredIssueToPendingStatus')
        },
        get restore_source() {
          return t('file:messages.restoreThePhysicalFileFromTheRecycleBinToItsRegisteredActive')
        },
        get move_to_trash() {
          return t('file:messages.moveTheRecycledFileFromActiveStorageToItsRegisteredRecycleBin')
        },
        get move_to_expected_root() {
          return t('file:messages.moveThePhysicalFileToTheStorageAreaRegisteredInTheFile')
        },
        get quarantine_file() {
          return t('file:messages.moveTheAbnormalCopyOrOrphanedFileToQuarantineWhereItIs')
        },
        get restore_quarantine() {
          return t('file:messages.restoreTheQuarantinedFileToItsPreviousLocationAndReopenTheIssue')
        },
        get delete_quarantine() {
          return t('file:messages.permanentlyDeleteTheQuarantinedFileThisCannotBeUndone')
        },
        get accept_current() {
          return t(
            'file:messages.recalculateTheCurrentPhysicalFileSizeAndDigestAndUpdateItsMetadata'
          )
        },
        get register_orphan() {
          return t('file:messages.registerTheOrphanedPhysicalFileAsAnActiveFileOwnedByThe')
        },
      },
    }
  },
  computed: {
    latestRun() {
      return this.stats.latestRun || {}
    },
  },
  beforeDestroy() {
    clearInterval(this.pollTimer)
  },
  methods: {
    open() {
      this.visible = true
      this.activeTab = 'issues'
      this.refreshAll()
      this.startPolling()
    },
    refreshAll() {
      this.getStats()
      this.getIssueList()
      this.getRunList()
    },
    getStats() {
      return getFileReconcileStats().then((response) => {
        Object.assign(this.stats, response.data)
      })
    },
    getIssueList() {
      this.issueLoading = true
      return listFileReconcileIssue(this.issueQuery)
        .then((response) => {
          this.issueList = response.rows
          this.issueTotal = response.total
        })
        .finally(() => {
          this.issueLoading = false
        })
    },
    getRunList() {
      this.runLoading = true
      return listFileReconcileRun(this.runQuery)
        .then((response) => {
          this.runList = response.rows
          this.runTotal = response.total
        })
        .finally(() => {
          this.runLoading = false
        })
    },
    handleStart() {
      this.scanning = true
      startFileReconcile({ checkHash: this.checkHash })
        .then(() => {
          this.$modal.msgSuccess(t('file:messages.storageReconciliationStarted'))
          this.refreshAll()
        })
        .finally(() => {
          this.scanning = false
        })
    },
    handleIssueQuery() {
      this.issueQuery.pageNum = 1
      this.getIssueList()
    },
    resetIssueQuery() {
      this.$refs.issueQueryForm.resetFields()
      this.issueQuery.pageNum = 1
      this.issueQuery.status = 'open'
      this.getIssueList()
    },
    handleTabClick(tab) {
      if (tab.name === 'runs') this.getRunList()
    },
    handleCommand(action, row) {
      this.currentIssueId = row.issueId
      Object.assign(this.handleForm, {
        action,
        reason: '',
        originalName: row.originalName || (row.actualKey ? row.actualKey.split('/').pop() : ''),
      })
      this.handleOpen = true
      this.$nextTick(() => this.$refs.handleForm.clearValidate())
    },
    submitHandle() {
      this.$refs.handleForm.validate((valid) => {
        if (!valid) return
        this.handling = true
        handleFileReconcileIssue(this.currentIssueId, {
          action: this.handleForm.action,
          reason: this.handleForm.reason,
          originalName:
            this.handleForm.action === 'register_orphan' ? this.handleForm.originalName : undefined,
        })
          .then(() => {
            this.$modal.msgSuccess(t('file:messages.storageIssueProcessedSuccessfully'))
            this.handleOpen = false
            this.refreshAll()
            this.$emit('refresh')
          })
          .finally(() => {
            this.handling = false
          })
      })
    },
    startPolling() {
      clearInterval(this.pollTimer)
      this.pollTimer = setInterval(() => {
        if (!this.visible || this.latestRun.status !== 'running') return
        this.refreshAll()
      }, 3000)
    },
    handleClosed() {
      clearInterval(this.pollTimer)
      this.pollTimer = null
      this.handleOpen = false
    },
    formatLocation(root, key) {
      return root && key ? `${root}:${key}` : '-'
    },
    formatOptionalSize(size) {
      return size === null || size === undefined ? '-' : formatFileSize(size)
    },
    issueTypeLabel(type) {
      const option = this.issueTypeOptions.find((item) => item.value === type)
      return option ? option.label : type
    },
    severityLabel(severity) {
      return (
        { critical: t('common:critical'), warning: t('common:warning'), info: t('common:tip') }[
          severity
        ] || severity
      )
    },
    severityTagType(severity) {
      return { critical: 'danger', warning: 'warning', info: 'info' }[severity] || 'info'
    },
    issueStatusLabel(status) {
      return (
        {
          open: t('system:file.pending'),
          ignored: t('file:messages.ignored'),
          quarantined: t('file:messages.quarantined'),
          resolved: t('file:messages.resolved'),
        }[status] || status
      )
    },
    issueStatusType(status) {
      return (
        {
          open: 'danger',
          ignored: 'info',
          quarantined: 'warning',
          resolved: 'success',
        }[status] || 'info'
      )
    },
    runStatusLabel(status) {
      return (
        {
          running: t('file:messages.running'),
          completed: t('common:completed'),
          failed: t('common:failed'),
        }[status] || t('file:messages.notRunYet')
      )
    },
    runStatusType(status) {
      return (
        {
          running: 'warning',
          completed: 'success',
          failed: 'danger',
        }[status] || 'info'
      )
    },
    actionLabel(action) {
      return (
        {
          ignore: t('file:messages.ignoreIssue'),
          reopen: t('file:messages.reopen'),
          restore_source: t('file:messages.restoreToActiveStorage'),
          move_to_trash: t('file:messages.moveToRecycledStorage'),
          move_to_expected_root: t('file:messages.moveToExpectedArea'),
          quarantine_file: t('file:messages.quarantineFile'),
          restore_quarantine: t('file:messages.restoreQuarantinedFile'),
          delete_quarantine: t('file:messages.permanentlyDeleteQuarantinedFile'),
          accept_current: t('file:messages.acceptCurrentFile'),
          register_orphan: t('file:messages.registerOrphanedFile'),
        }[action] || action
      )
    },
  },
}
</script>

<style scoped>
.drawer-content {
  padding: 0 20px 20px;
}

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
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
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
  --card-color: #f56c6c;
}
.summary-card--critical {
  --card-color: #b42318;
}
.summary-card--warning {
  --card-color: #e6a23c;
}
.summary-card--quarantine {
  --card-color: #7f56d9;
}
.summary-card--run {
  --card-color: #409eff;
}

.summary-card__label {
  color: #909399;
  font-size: 14px;
}

.summary-card__value {
  margin-top: 7px;
  color: #303133;
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
  color: #c0c4cc;
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
  background: #f5f7fa;
}

.reconcile-toolbar__tip {
  color: #909399;
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
  color: #909399;
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
