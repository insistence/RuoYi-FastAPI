<template>
  <div class="app-container">
    <el-form
      :validate-on-rule-change="false"
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
      label-width="68px"
      class="plugin-query-form"
    >
      <el-form-item
        :label="$t('pluginAdmin:id')"
        prop="pluginId"
      >
        <el-input
          v-model="queryParams.pluginId"
          :placeholder="$t('pluginAdmin:messages.enterAPluginID')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('pluginAdmin:name')"
        prop="pluginName"
      >
        <el-input
          v-model="queryParams.pluginName"
          :placeholder="$t('pluginAdmin:messages.enterAPluginName')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('pluginAdmin:enableSettings')"
        prop="enabled"
      >
        <el-select
          v-model="queryParams.enabled"
          :placeholder="$t('pluginAdmin:enableSettings')"
          clearable
        >
          <el-option
            :label="$t('common:enable')"
            value="0"
          />
          <el-option
            :label="$t('common:disable')"
            value="1"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('pluginAdmin:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('pluginAdmin:status')"
          clearable
        >
          <el-option
            v-for="item in pluginStatusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          icon="el-icon-search"
          @click="handleQuery"
          >{{ $t('common:search') }}</el-button
        >
        <el-button
          icon="el-icon-refresh"
          @click="resetQuery"
          >{{ $t('common:reset') }}</el-button
        >
      </el-form-item>
    </el-form>

    <el-row
      :gutter="10"
      class="mb8"
    >
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="el-icon-share"
          :disabled="!selectedPluginIds.length"
          @click="handlePlan('install')"
          v-hasPermi="['system:plugin:query']"
          >{{ $t('pluginAdmin:messages.installationPlan') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="el-icon-connection"
          :disabled="!selectedPluginIds.length"
          @click="handlePlan('enable')"
          v-hasPermi="['system:plugin:query']"
          >{{ $t('pluginAdmin:messages.enablementPlan') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="el-icon-upload2"
          :disabled="!selectedPluginIds.length"
          @click="handlePlan('upgrade')"
          v-hasPermi="['system:plugin:query']"
          >{{ $t('pluginAdmin:messages.upgradePlan') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          plain
          icon="el-icon-tickets"
          @click="handleOperationLog"
          v-hasPermi="['system:plugin:query']"
          >{{ $t('pluginAdmin:messages.auditRecords') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-tooltip
          :content="formatPluginIdsForDisplay(selectedPluginIds)"
          :disabled="!selectedPluginIds.length"
          placement="top"
        >
          <el-tag
            :type="selectedPluginIds.length ? 'success' : 'info'"
            :closable="!!selectedPluginIds.length"
            :disable-transitions="true"
            class="plugin-selection-tag"
            @close="clearSelectedPlugins"
            >{{ planTargetSummary }}</el-tag
          >
        </el-tooltip>
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      ref="pluginTableRef"
      v-loading="loading"
      :data="pluginList"
      row-key="pluginId"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
        :selectable="canSelectForBatch"
      />
      <el-table-column
        :label="$t('pluginAdmin:id')"
        align="center"
        prop="pluginId"
        width="120"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('pluginAdmin:name')"
        align="center"
        prop="pluginName"
        min-width="140"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('pluginAdmin:messages.codeVersion')"
        align="center"
        prop="version"
        width="100"
      />
      <el-table-column
        :label="$t('pluginAdmin:messages.installedVersion')"
        align="center"
        prop="installedVersion"
        width="110"
      >
        <template slot-scope="scope">
          <span>{{ scope.row.installedVersion || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('pluginAdmin:enableSettings')"
        align="center"
        width="90"
      >
        <template slot-scope="scope">
          <el-tooltip
            :content="getEnabledSwitchTooltip(scope.row)"
            :disabled="!isEnabledSwitchBlocked(scope.row)"
            placement="top"
          >
            <span class="plugin-switch-tooltip-target">
              <el-switch
                v-model="scope.row.enabled"
                :aria-label="$t('pluginAdmin:settings.enableLabel', { name: scope.row.pluginName })"
                active-value="0"
                inactive-value="1"
                :disabled="isEnabledSwitchBlocked(scope.row)"
                @change="handleEnabledChange(scope.row)"
                v-hasPermi="['system:plugin:edit']"
              />
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('pluginAdmin:status')"
        align="center"
        prop="status"
        width="110"
      >
        <template slot-scope="scope">
          <el-tag :type="getStatusTagType(scope.row.status)">{{
            getStatusLabel(scope.row.status)
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('pluginAdmin:messages.artifactRelease')"
        align="center"
        min-width="220"
      >
        <template #default="scope">
          <plugin-release-status
            v-if="scope.row.source === 'artifact'"
            :plugin="scope.row"
          />
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('common:source')"
        align="center"
        prop="source"
        width="80"
      />
      <el-table-column
        :label="$t('common:updatedTime')"
        align="center"
        prop="updateTime"
        width="165"
      >
        <template slot-scope="scope">
          <span>{{ formatPluginTime(scope.row.updateTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('common:actions')"
        align="center"
        width="260"
        fixed="right"
        class-name="small-padding fixed-width"
      >
        <template slot-scope="scope">
          <div class="plugin-action-buttons">
            <el-tooltip
              :content="$t('common:details')"
              placement="top"
            >
              <el-button
                type="text"
                icon="el-icon-view"
                :aria-label="$t('common:details')"
                @click="handleDetail(scope.row)"
                v-hasPermi="['system:plugin:query']"
              />
            </el-tooltip>
            <el-tooltip
              :content="$t('pluginAdmin:messages.configuration')"
              placement="top"
              v-if="!isOrphanPlugin(scope.row)"
            >
              <el-button
                type="text"
                icon="el-icon-setting"
                :aria-label="$t('pluginAdmin:messages.configuration')"
                @click="handleConfig(scope.row)"
                v-hasPermi="['system:plugin:query']"
              />
            </el-tooltip>
            <el-tooltip
              :content="$t('pluginAdmin:dependencies')"
              placement="top"
              v-if="!isOrphanPlugin(scope.row)"
            >
              <el-button
                type="text"
                icon="el-icon-connection"
                :aria-label="$t('pluginAdmin:dependencies')"
                @click="handleDependencies(scope.row)"
                v-hasPermi="['system:plugin:query']"
              />
            </el-tooltip>
            <el-tooltip
              :content="$t('pluginAdmin:messages.check')"
              placement="top"
              v-if="!isOrphanPlugin(scope.row)"
            >
              <el-button
                type="text"
                icon="el-icon-circle-check"
                :aria-label="$t('pluginAdmin:messages.check')"
                @click="handleCheck(scope.row)"
                v-hasPermi="['system:plugin:query']"
              />
            </el-tooltip>
            <el-tooltip
              :content="$t('pluginAdmin:messages.healthCheck')"
              placement="top"
              v-if="!isOrphanPlugin(scope.row)"
            >
              <el-button
                type="text"
                icon="el-icon-first-aid-kit"
                :aria-label="$t('pluginAdmin:messages.healthCheck')"
                @click="handleHealth(scope.row)"
                v-hasPermi="['system:plugin:query']"
              />
            </el-tooltip>
            <el-tooltip
              :content="$t('pluginAdmin:messages.diagnosticBundle')"
              placement="top"
              v-if="!isOrphanPlugin(scope.row)"
            >
              <el-button
                type="text"
                icon="el-icon-document-checked"
                :aria-label="$t('pluginAdmin:messages.diagnosticBundle')"
                @click="handleDiagnose(scope.row)"
                v-hasPermi="['system:plugin:query']"
              />
            </el-tooltip>
            <el-tooltip
              :content="
                getOperationTooltip(scope.row, 'install', $t('pluginAdmin:messages.install'))
              "
              placement="top"
              v-if="canInstall(scope.row)"
            >
              <el-button
                type="text"
                icon="el-icon-download"
                :aria-label="$t('pluginAdmin:messages.install')"
                :disabled="isOperationBlocked(scope.row, 'install')"
                @click="handleInstallDryRun(scope.row)"
                v-hasPermi="['system:plugin:edit']"
              />
            </el-tooltip>
            <el-tooltip
              :content="
                getOperationTooltip(scope.row, 'upgrade', $t('pluginAdmin:messages.upgrade'))
              "
              placement="top"
              v-if="canUpgrade(scope.row)"
            >
              <el-button
                type="text"
                icon="el-icon-upload2"
                :aria-label="$t('pluginAdmin:messages.upgrade')"
                :disabled="isOperationBlocked(scope.row, 'upgrade')"
                @click="handleUpgradeDryRun(scope.row)"
                v-hasPermi="['system:plugin:edit']"
              />
            </el-tooltip>
            <el-tooltip
              :content="
                getOperationTooltip(scope.row, 'uninstall', $t('pluginAdmin:messages.uninstall'))
              "
              placement="top"
              v-if="canUninstall(scope.row)"
            >
              <el-button
                type="text"
                class="plugin-action-danger"
                icon="el-icon-switch-button"
                :aria-label="$t('pluginAdmin:messages.uninstall')"
                :disabled="isOperationBlocked(scope.row, 'uninstall')"
                @click="handleUninstallDryRun(scope.row)"
                v-hasPermi="['system:plugin:edit']"
              />
            </el-tooltip>
            <el-tooltip
              :content="$t('pluginAdmin:messages.cleanUpOrphanedMetadata')"
              placement="top"
              v-if="isOrphanPlugin(scope.row)"
            >
              <el-button
                type="text"
                class="plugin-action-danger"
                icon="el-icon-delete"
                :aria-label="$t('pluginAdmin:messages.cleanUpOrphanedMetadata')"
                @click="handlePurgeDryRun(scope.row)"
                v-hasPermi="['system:plugin:remove']"
              />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="queryParams.pageNum"
      :limit.sync="queryParams.pageSize"
      @pagination="getList"
    />

    <plugin-detail-dialog
      :visible.sync="detailOpen"
      :detail="detail"
      :get-status-label="getStatusLabel"
      :format-plugin-time="formatPluginTime"
      :format-config-default-value="formatConfigDefaultValue"
      :format-config-constraint="formatConfigConstraint"
      :migration-history="migrationHistory"
      :migration-loading="migrationLoading"
      @repair="handleRepairFromDetail"
      @mark-migration-success="handleMarkMigrationSuccess"
      @mark-migration-failed="handleMarkMigrationFailed"
    />

    <plugin-dependency-dialog
      :visible.sync="dependencyOpen"
      :result="dependencyResult"
      :loading="dependencyLoading"
      :is-capability-operation-blocked="isCapabilityOperationBlocked"
      :format-boolean="formatBoolean"
      :get-dependency-tag-type="getDependencyTagType"
      :format-dependency-installed="formatDependencyInstalled"
      :format-dependency-version-satisfied="formatDependencyVersionSatisfied"
      @dry-run="handleDependencyDryRun"
      @install="handleDependencyInstall"
    />

    <plugin-diagnostic-dialog
      :visible.sync="diagnosticOpen"
      :title="diagnosticTitle"
      :result="diagnosticResult"
      :loading="diagnosticLoading"
      :format-json="formatJson"
      :format-boolean="formatBoolean"
      :get-validation-level-label="getValidationLevelLabel"
      :get-validation-level-tag-type="getValidationLevelTagType"
    />

    <plugin-plan-dialog
      :visible.sync="planOpen"
      :continue-on-error.sync="batchContinueOnError"
      :title="planTitle"
      :plan-result="planResult"
      :batch-result="batchResult"
      :loading="planLoading"
      :format-plugin-operation="formatPluginOperation"
      :format-plugin-ids-for-display="formatPluginIdsForDisplay"
      :format-plan-dependencies="formatPlanDependencies"
      :get-plan-ready-tag-type="getPlanReadyTagType"
      :get-plan-blocker-status-label="getPlanBlockerStatusLabel"
      @execute="handleExecuteBatch(false)"
    />

    <el-drawer
      :title="$t('pluginAdmin:messages.pluginOperationAudit')"
      :visible.sync="operationLogOpen"
      size="max(50vw, min(600px, 100vw))"
      append-to-body
    >
      <div class="plugin-audit-drawer">
        <div
          class="plugin-audit-search"
          v-show="operationLogShowSearch"
        >
          <el-form
            :validate-on-rule-change="false"
            :model="operationLogQueryParams"
            :inline="true"
            label-width="68px"
            class="plugin-query-form plugin-log-toolbar"
          >
            <el-form-item :label="$t('pluginAdmin:id')">
              <el-input
                v-model="operationLogQueryParams.pluginId"
                :placeholder="$t('pluginAdmin:messages.enterAPluginID')"
                clearable
                @keyup.enter.native="handleOperationLogQuery"
              />
            </el-form-item>
            <el-form-item :label="$t('common:actions')">
              <el-select
                v-model="operationLogQueryParams.operation"
                :placeholder="$t('monitor:log.operationType')"
                clearable
              >
                <el-option
                  v-for="item in plugin_operation_type"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="$t('common:status')">
              <el-select
                v-model="operationLogQueryParams.status"
                :placeholder="$t('monitor:job.executionStatus')"
                clearable
              >
                <el-option
                  v-for="item in operationLogStatusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              :label="$t('common:createdTime')"
              class="plugin-audit-date-range"
            >
              <el-date-picker
                v-model="operationLogDateRange"
                value-format="YYYY-MM-DD"
                type="daterange"
                range-separator="-"
                :start-placeholder="$t('common:startDate')"
                :end-placeholder="$t('common:endDate')"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                icon="el-icon-search"
                @click="handleOperationLogQuery"
                >{{ $t('common:search') }}</el-button
              >
              <el-button
                icon="el-icon-refresh"
                @click="resetOperationLogQuery"
                >{{ $t('common:reset') }}</el-button
              >
            </el-form-item>
          </el-form>
        </div>

        <el-collapse
          v-model="operationLogMaintenanceActive"
          class="plugin-audit-maintenance"
        >
          <el-collapse-item name="retention">
            <template slot="title">
              <span class="plugin-audit-maintenance-title">{{
                $t('pluginAdmin:messages.auditRetentionPolicy')
              }}</span>
              <el-tag
                size="small"
                type="info"
                >{{ $t('layout:size.default') }} {{ operationLogRetentionDefaultDays }}
                {{ $t('pluginAdmin:messages.days') }}</el-tag
              >
            </template>
            <el-form
              :validate-on-rule-change="false"
              :model="operationLogRetentionForm"
              :inline="true"
              label-width="84px"
              class="plugin-log-toolbar"
            >
              <el-form-item :label="$t('file:messages.retentionDays')">
                <el-input-number
                  v-model="operationLogRetentionForm.retentionDays"
                  :min="0"
                  :max="3650"
                  controls-position="right"
                  style="width: 150px"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  icon="el-icon-document-checked"
                  :loading="operationLogRetentionLoading"
                  @click="handleOperationLogRetentionPreview"
                  >{{ $t('pluginAdmin:messages.previewCleanup') }}</el-button
                >
                <el-button
                  type="danger"
                  plain
                  icon="el-icon-delete"
                  :loading="operationLogRetentionLoading"
                  @click="handleOperationLogRetentionClean"
                  v-hasPermi="['system:plugin:edit']"
                  >{{ $t('pluginAdmin:messages.confirmCleanup') }}</el-button
                >
              </el-form-item>
            </el-form>
            <el-alert
              v-if="operationLogRetentionResult.matchedCount !== undefined"
              :title="formatRetentionMessage(operationLogRetentionResult)"
              :type="operationLogRetentionResult.deletedCount ? 'success' : 'info'"
              show-icon
              :closable="false"
            />
          </el-collapse-item>
        </el-collapse>

        <div class="plugin-audit-table">
          <div class="plugin-audit-table-toolbar">
            <el-row
              :gutter="10"
              class="plugin-audit-table-actions"
            >
              <el-col :span="1.5">
                <el-button
                  type="warning"
                  plain
                  icon="el-icon-download"
                  :loading="operationLogExportLoading"
                  @click="handleOperationLogExport"
                  v-hasPermi="['system:plugin:export']"
                  >{{ $t('common:export') }}</el-button
                >
              </el-col>
            </el-row>
            <right-toolbar
              :showSearch.sync="operationLogShowSearch"
              @queryTable="getOperationLogList"
            ></right-toolbar>
          </div>
          <el-table
            v-loading="operationLogLoading"
            :data="operationLogList"
            size="small"
            border
          >
            <el-table-column
              :label="$t('pluginAdmin:messages.logID')"
              prop="operationId"
              width="90"
              align="center"
            />
            <el-table-column
              :label="$t('common:actions')"
              width="90"
              align="center"
            >
              <template slot-scope="scope">{{
                formatPluginOperation(scope.row.operation)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="$t('common:status')"
              width="90"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="getOperationLogStatusTagType(scope.row.status)">{{
                  getOperationLogStatusLabel(scope.row.status)
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('pluginAdmin:messages.plugin')"
              min-width="180"
              :show-overflow-tooltip="true"
            >
              <template slot-scope="scope">{{
                formatPlanDependencies(scope.row.pluginIds)
              }}</template>
            </el-table-column>
            <el-table-column
              :label="$t('common:success')"
              width="70"
              align="center"
            >
              <template slot-scope="scope">{{ getSummaryCount(scope.row, 'succeeded') }}</template>
            </el-table-column>
            <el-table-column
              :label="$t('common:failed')"
              width="70"
              align="center"
            >
              <template slot-scope="scope">{{ getSummaryCount(scope.row, 'failed') }}</template>
            </el-table-column>
            <el-table-column
              :label="$t('common:createdTime')"
              width="170"
              align="center"
            >
              <template slot-scope="scope">{{ parseTime(scope.row.createTime) }}</template>
            </el-table-column>
            <el-table-column
              :label="$t('common:actions')"
              width="70"
              align="center"
            >
              <template slot-scope="scope">
                <el-tooltip
                  :content="$t('common:details')"
                  placement="top"
                >
                  <el-button
                    type="text"
                    icon="el-icon-view"
                    :aria-label="$t('file:messages.auditDetails')"
                    @click="handleOperationLogDetail(scope.row)"
                  />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
          <pagination
            v-show="operationLogTotal > 0"
            :total="operationLogTotal"
            :page.sync="operationLogQueryParams.pageNum"
            :limit.sync="operationLogQueryParams.pageSize"
            @pagination="getOperationLogList"
          />
        </div>

        <div class="drawer-footer">
          <el-button @click="operationLogOpen = false">{{ $t('common:close') }}</el-button>
        </div>
      </div>
    </el-drawer>

    <el-dialog
      :title="$t('file:messages.auditDetails')"
      :visible.sync="operationLogDetailOpen"
      width="min(920px, calc(100vw - 32px))"
      append-to-body
    >
      <el-descriptions
        :column="3"
        border
        class="mb16"
      >
        <el-descriptions-item :label="$t('pluginAdmin:messages.logID')">{{
          operationLogDetail.operationId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('common:actions')">{{
          formatPluginOperation(operationLogDetail.operation)
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('common:status')">{{
          getOperationLogStatusLabel(operationLogDetail.status)
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('pluginAdmin:messages.dryRun')">{{
          operationLogDetail.dryRun ? $t('common:yes') : $t('common:no')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('pluginAdmin:messages.continueAfterFailure')">{{
          operationLogDetail.continueOnError ? $t('common:yes') : $t('common:no')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('common:createdTime')">{{
          parseTime(operationLogDetail.createTime) || '-'
        }}</el-descriptions-item>
        <el-descriptions-item
          :label="$t('pluginAdmin:messages.plugin')"
          :span="3"
          >{{ formatPlanDependencies(operationLogDetail.pluginIds) }}</el-descriptions-item
        >
        <el-descriptions-item
          :label="$t('common:remark')"
          :span="3"
          >{{ operationLogDetail.remark || '-' }}</el-descriptions-item
        >
      </el-descriptions>
      <el-tabs>
        <el-tab-pane :label="$t('pluginAdmin:messages.summary')">
          <el-descriptions
            :column="3"
            border
            class="mb16"
          >
            <el-descriptions-item :label="$t('pluginAdmin:messages.successCount')">{{
              getSummaryCount(operationLogDetail, 'succeeded')
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('pluginAdmin:messages.failureCount')">{{
              getSummaryCount(operationLogDetail, 'failed')
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('pluginAdmin:messages.skippedCount')">{{
              getSummaryCount(operationLogDetail, 'skipped')
            }}</el-descriptions-item>
            <el-descriptions-item
              :label="$t('pluginAdmin:messages.configurationChanges')"
              :span="3"
            >
              {{ formatPlanDependencies(getSummaryChangedKeys(operationLogDetail)) }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="$t('pluginAdmin:messages.failureSuggestions')"
              :span="3"
            >
              {{ operationLogDetail.failedSuggestion || $t('pluginAdmin:messages.none') }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="$t('pluginAdmin:messages.failedStep')"
              :span="3"
            >
              {{ getOperationFailedStep(operationLogDetail) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:messages.checkResults')">
          <el-table
            :data="operationLogDetail.validationItems || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noCheckResults')"
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
              width="180"
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
              min-width="220"
              :show-overflow-tooltip="true"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:messages.actionPlan')">
          <el-table
            :data="operationLogDetail.actionItems || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noActionPlan')"
          >
            <el-table-column
              :label="$t('pluginAdmin:messages.action')"
              prop="label"
              min-width="180"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('common:enable')"
              width="80"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="scope.row.enabled ? 'success' : 'info'">{{
                  scope.row.enabled ? $t('common:yes') : $t('common:no')
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('common:count')"
              prop="count"
              width="80"
              align="center"
            >
              <template slot-scope="scope">{{ formatNullable(scope.row.count) }}</template>
            </el-table-column>
            <el-table-column
              :label="$t('common:status')"
              min-width="160"
              :show-overflow-tooltip="true"
            >
              <template slot-scope="scope">{{ formatActionPlanState(scope.row) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:messages.dependencyPlan')">
          <el-table
            :data="operationLogDetail.planItems || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noDependencyPlan')"
          >
            <el-table-column
              :label="$t('pluginAdmin:id')"
              prop="pluginId"
              width="150"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('pluginAdmin:messages.version')"
              prop="version"
              width="110"
              align="center"
            />
            <el-table-column
              :label="$t('pluginAdmin:messages.ready')"
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
              min-width="200"
              :show-overflow-tooltip="true"
            >
              <template slot-scope="scope">{{
                formatPlanDependencies(scope.row.dependencies)
              }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('monitor:job.history')">
          <el-table
            :data="getExecutedResults(operationLogDetail)"
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
              <template slot-scope="scope">{{
                formatPluginOperation(scope.row.operation)
              }}</template>
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
              <template slot-scope="scope">{{ formatNullable(scope.row.durationMs) }}ms</template>
            </el-table-column>
            <el-table-column
              :label="$t('pluginAdmin:messages.failedStep')"
              prop="failedStep"
              width="150"
              :show-overflow-tooltip="true"
            >
              <template slot-scope="scope">{{ getExecutedFailedStep(scope.row) }}</template>
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
        <el-tab-pane :label="$t('pluginAdmin:messages.configurationChanges')">
          <el-table
            :data="operationLogDetail.configChanges || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noConfigurationChanges')"
          >
            <el-table-column
              :label="$t('pluginAdmin:messages.configurationKey')"
              prop="key"
              width="180"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('common:name')"
              prop="label"
              width="160"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('pluginAdmin:messages.sensitive')"
              width="80"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="scope.row.secret ? 'warning' : 'info'">{{
                  scope.row.secret ? $t('common:yes') : $t('common:no')
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('pluginAdmin:messages.before')"
              prop="before"
              min-width="180"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('pluginAdmin:messages.after')"
              prop="after"
              min-width="180"
              :show-overflow-tooltip="true"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:messages.rawResult')">
          <el-input
            :value="formatJson(operationLogDetail.result)"
            type="textarea"
            :rows="14"
            readonly
          />
        </el-tab-pane>
      </el-tabs>
      <div
        slot="footer"
        class="dialog-footer"
      >
        <el-button @click="operationLogDetailOpen = false">{{ $t('common:close') }}</el-button>
      </div>
    </el-dialog>

    <plugin-config-dialog
      :visible.sync="configOpen"
      :title="configTitle"
      :items="configItems"
      :plugin-id="configPluginId"
      :refresh-key="configStatusRevision"
      :loading="configLoading"
      :format-config-default-value="formatConfigDefaultValue"
      :format-config-constraint="formatConfigConstraint"
      @submit="submitConfig"
    />

    <el-dialog
      :title="actionTitle"
      :visible.sync="actionOpen"
      width="min(860px, calc(100vw - 32px))"
      append-to-body
    >
      <el-alert
        v-if="actionResult.message"
        :title="actionResult.message"
        :type="actionResult.ok ? 'success' : 'warning'"
        show-icon
        :closable="false"
        class="mb16"
      />
      <el-descriptions
        :column="3"
        border
        class="mb16"
      >
        <el-descriptions-item :label="$t('pluginAdmin:id')">{{
          actionResult.pluginId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('pluginAdmin:messages.dependencyCheck')">{{
          formatBoolean(actionResult.dependencyOk)
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('pluginAdmin:messages.structureCheck')">{{
          formatBoolean(actionResult.structureOk)
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('pluginAdmin:menuConflict')">{{
          formatBoolean(actionResult.menuConflictOk)
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('pluginAdmin:messages.dryRunMode')">{{
          actionResult.dryRun ? $t('common:yes') : $t('common:no')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('pluginAdmin:messages.upgradeRequired')">{{
          formatBoolean(actionResult.needsUpgrade)
        }}</el-descriptions-item>
      </el-descriptions>

      <el-tabs>
        <el-tab-pane
          v-if="actionResult.error"
          :label="$t('pluginAdmin:messages.errorDetails')"
        >
          <el-alert
            :title="actionResult.error.message || $t('pluginAdmin:messages.pluginOperationFailed')"
            type="error"
            show-icon
            :closable="false"
            class="mb16"
          />
          <el-descriptions
            :column="2"
            border
            class="mb16"
          >
            <el-descriptions-item :label="$t('pluginAdmin:id')">{{
              actionResult.pluginId || pendingAction.pluginId || '-'
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('common:actions')">{{
              actionResult.operation
                ? formatPluginOperation(actionResult.operation)
                : pendingAction.label || '-'
            }}</el-descriptions-item>
            <el-descriptions-item :label="$t('pluginAdmin:messages.failedStep')">{{
              actionResult.failedStep || actionResult.error.failedStep || '-'
            }}</el-descriptions-item>
            <el-descriptions-item
              v-if="actionResult.migrationRecovery"
              :label="$t('pluginAdmin:dialog.migration')"
            >
              {{ actionResult.migrationRecovery.migrationPath || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="actionResult.migrationRecovery"
              :label="$t('pluginAdmin:messages.migrationStatus')"
            >
              {{ actionResult.migrationRecovery.status || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="$t('common:suggestion')"
              :span="2"
              >{{
                actionResult.error.suggestion ||
                $t('pluginAdmin:expression.reviewBackendLogsOrRunTheChecksAgain')
              }}</el-descriptions-item
            >
          </el-descriptions>
          <el-input
            :value="formatJson(actionResult.error.raw)"
            type="textarea"
            :rows="10"
            readonly
          />
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:messages.actionPlan')">
          <el-table
            :data="actionResult.actions || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noActionPlan')"
          >
            <el-table-column
              :label="$t('pluginAdmin:messages.action')"
              prop="label"
              min-width="180"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('common:enable')"
              width="80"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="scope.row.enabled ? 'success' : 'info'">{{
                  scope.row.enabled ? $t('common:yes') : $t('common:no')
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('common:status')"
              width="90"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag
                  v-if="scope.row.ok !== undefined"
                  :type="scope.row.ok ? 'success' : 'danger'"
                >
                  {{
                    scope.row.ok
                      ? $t('pluginAdmin:messages.passed')
                      : $t('pluginAdmin:interface.error')
                  }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('common:count')"
              prop="count"
              width="80"
              align="center"
            >
              <template slot-scope="scope">{{ formatNullable(scope.row.count) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:dependencies')">
          <el-table
            :data="actionResult.dependencies || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noDependencyDeclarations')"
          >
            <el-table-column
              :label="$t('common:level')"
              width="90"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="getValidationLevelTagType(scope.row.level)">
                  {{ getValidationLevelLabel(scope.row.level) }}
                </el-tag>
              </template>
            </el-table-column>
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
              :label="$t('pluginAdmin:messages.installed')"
              width="90"
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
              min-width="220"
              :show-overflow-tooltip="true"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:messages.manifestNotices')">
          <el-table
            :data="actionResult.manifestIssues || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noManifestNotices')"
          >
            <el-table-column
              :label="$t('common:level')"
              width="90"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="getValidationLevelTagType(scope.row.level)">
                  {{ getValidationLevelLabel(scope.row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('common:type')"
              prop="kind"
              width="170"
              align="center"
            />
            <el-table-column
              :label="$t('pluginAdmin:messages.path')"
              prop="path"
              min-width="220"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('common:description')"
              prop="message"
              min-width="240"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('common:suggestion')"
              prop="suggestion"
              min-width="240"
              :show-overflow-tooltip="true"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:messages.structureErrors')">
          <el-table
            :data="actionResult.structureErrors || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noStructureErrors')"
          >
            <el-table-column
              :label="$t('common:level')"
              width="90"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="getValidationLevelTagType(scope.row.level)">
                  {{ getValidationLevelLabel(scope.row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('common:type')"
              prop="kind"
              width="120"
              align="center"
            />
            <el-table-column
              :label="$t('pluginAdmin:messages.path')"
              prop="path"
              min-width="220"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('common:description')"
              prop="message"
              min-width="240"
              :show-overflow-tooltip="true"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('pluginAdmin:menuConflict')">
          <el-table
            :data="actionResult.menuConflicts || []"
            size="small"
            border
            :empty-text="$t('pluginAdmin:messages.noMenuConflicts')"
          >
            <el-table-column
              :label="$t('common:level')"
              width="90"
              align="center"
            >
              <template slot-scope="scope">
                <el-tag :type="getValidationLevelTagType(scope.row.level)">
                  {{ getValidationLevelLabel(scope.row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('common:type')"
              prop="kind"
              width="150"
              align="center"
            />
            <el-table-column
              :label="$t('pluginAdmin:messages.conflictingValue')"
              prop="value"
              min-width="160"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('common:description')"
              prop="message"
              min-width="280"
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
          v-if="pendingAction.type && pendingAction.type !== 'purge'"
          type="primary"
          :loading="actionLoading"
          @click="handleExecutePendingAction"
          v-hasPermi="['system:plugin:edit']"
          >{{ $t('pluginAdmin:messages.execute') }}{{ pendingAction.label }}</el-button
        >
        <el-button
          v-if="pendingAction.type === 'purge'"
          type="danger"
          :loading="actionLoading"
          @click="handleExecutePendingAction"
          v-hasPermi="['system:plugin:remove']"
          >{{ $t('pluginAdmin:messages.execute') }}{{ pendingAction.label }}</el-button
        >
        <el-button @click="actionOpen = false">{{ $t('common:close') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup name="Plugin">
import { t } from '@/i18n/adapter'

import { computed, getCurrentInstance, reactive, ref, toRefs } from 'vue'
import {
  batchPlugins,
  checkPlugin,
  checkPluginDependencies,
  diagnosePlugin,
  disablePlugin,
  enablePlugin,
  getPlugin,
  getPluginConfig,
  getPluginOperationLog,
  healthPlugin,
  installPluginDependencies,
  installPlugin,
  listPlugin,
  listPluginMigrations,
  listPluginOperationLog,
  markPluginMigrationFailed,
  markPluginMigrationSuccess,
  planPlugins,
  purgePlugin,
  retainPluginOperationLog,
  uninstallPlugin,
  updatePluginConfig,
  upgradePlugin,
} from '@/api/system/plugin'
import { getConfigKey } from '@/api/system/config'
import PluginConfigDialog from './components/PluginConfigDialog.vue'
import PluginDependencyDialog from './components/PluginDependencyDialog.vue'
import PluginDiagnosticDialog from './components/PluginDiagnosticDialog.vue'
import PluginDetailDialog from './components/PluginDetailDialog.vue'
import PluginPlanDialog from './components/PluginPlanDialog.vue'
import PluginReleaseStatus from './components/PluginReleaseStatus.vue'
import {
  getPlanBlockerStatusLabel,
  getPlanOperationLabel,
  getPlanReadyTagType,
  getValidationLevelLabel,
  getValidationLevelTagType,
  normalizePluginActionResult,
  normalizePluginBatchResponse,
  normalizePluginOperationLogDetail,
  normalizePluginPlanResponse,
} from '@/utils/pluginPlanFormatter'

const { proxy } = getCurrentInstance()
const plugin_operation_type = ref([])
proxy
  .getDicts('plugin_operation_type')
  .then((response) => {
    plugin_operation_type.value = (response.data || []).map((item) => ({
      label: item.dictLabel,
      value: item.dictValue,
      raw: item,
    }))
  })
  .catch(() => {
    plugin_operation_type.value = []
  })
const parseTime = proxy.parseTime
const INVALID_PLUGIN_TIME_VALUES = new Set(['', '-', '0', '0-0-0 0:0:0', '0000-00-00 00:00:00'])
const OPERATION_LOG_RETENTION_CONFIG_KEY = 'sys.plugin.operationLogRetentionDays'

const pluginTableRef = ref(null)
const pluginList = ref([])
const selectedPluginIds = ref([])
const loading = ref(true)
const showSearch = ref(true)
const total = ref(0)
const detailOpen = ref(false)
const detail = ref({})
const migrationLoading = ref(false)
const migrationHistory = ref([])
const actionOpen = ref(false)
const actionLoading = ref(false)
const actionTitleFactory = ref(() => t('pluginAdmin:dialog.actionResult'))
const actionTitle = computed(() => actionTitleFactory.value())
const actionResult = ref({})
const pendingAction = ref({})
const configOpen = ref(false)
const configLoading = ref(false)
const configTitleFactory = ref(() => t('pluginAdmin:dialog.configuration'))
const configTitle = computed(() => configTitleFactory.value())
const configPluginId = ref('')
const configItems = ref([])
const configStatusRevision = ref(0)
let configRequestRevision = 0
const dependencyOpen = ref(false)
const dependencyLoading = ref(false)
const dependencyPluginId = ref('')
const dependencyResult = ref({})
const diagnosticOpen = ref(false)
const diagnosticLoading = ref(false)
const diagnosticTitleFactory = ref(() => t('pluginAdmin:dialog.diagnostics'))
const diagnosticTitle = computed(() => diagnosticTitleFactory.value())
const diagnosticResult = ref({})
const planOpen = ref(false)
const planLoading = ref(false)
const planTitleFactory = ref(() => t('pluginAdmin:dialog.dependencyPlan'))
const planTitle = computed(() => planTitleFactory.value())
const planResult = ref(normalizePluginPlanResponse({}))
const batchContinueOnError = ref(false)
const batchResult = ref(normalizePluginBatchResponse({}))
const operationLogOpen = ref(false)
const operationLogShowSearch = ref(true)
const operationLogLoading = ref(false)
const operationLogExportLoading = ref(false)
const operationLogList = ref([])
const operationLogTotal = ref(0)
const operationLogDateRange = ref([])
const operationLogDetailOpen = ref(false)
const operationLogDetail = ref({})
const operationLogRetentionLoading = ref(false)
const operationLogRetentionResult = ref({})
const operationLogRetentionDefaultDays = ref(180)
const operationLogMaintenanceActive = ref([])
const operationLogRetentionForm = reactive({
  retentionDays: 180,
})

function formatPluginTime(value) {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'string' && INVALID_PLUGIN_TIME_VALUES.has(value.trim())) {
    return '-'
  }

  const formatted = parseTime(value)
  if (!formatted || INVALID_PLUGIN_TIME_VALUES.has(String(formatted).trim())) {
    return '-'
  }

  return formatted
}

const pluginStatusOptions = [
  {
    get label() {
      return t('pluginAdmin:messages.discovered')
    },
    value: 'discovered',
    tagType: 'info',
  },
  {
    get label() {
      return t('pluginAdmin:messages.installed')
    },
    value: 'installed',
    tagType: 'success',
  },
  {
    get label() {
      return t('pluginAdmin:messages.upgradeAvailable')
    },
    value: 'pending_upgrade',
    tagType: 'warning',
  },
  {
    get label() {
      return t('pluginAdmin:interface.error')
    },
    value: 'error',
    tagType: 'danger',
  },
]

const operationLogStatusOptions = [
  {
    get label() {
      return t('pluginAdmin:interface.success')
    },
    value: 'success',
    tagType: 'success',
  },
  {
    get label() {
      return t('pluginAdmin:interface.failed')
    },
    value: 'failed',
    tagType: 'danger',
  },
  {
    get label() {
      return t('pluginAdmin:messages.blocked')
    },
    value: 'blocked',
    tagType: 'warning',
  },
  {
    get label() {
      return t('pluginAdmin:messages.dryRun')
    },
    value: 'dry_run',
    tagType: 'info',
  },
]

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    pluginId: undefined,
    pluginName: undefined,
    enabled: undefined,
    status: undefined,
    source: undefined,
  },
  operationLogQueryParams: {
    pageNum: 1,
    pageSize: 10,
    pluginId: undefined,
    operation: undefined,
    status: undefined,
  },
})

const { queryParams, operationLogQueryParams } = toRefs(data)

const planTargetSummary = computed(() => {
  return selectedPluginIds.value.length
    ? t('pluginAdmin:messages.pluginsSelected', { length: selectedPluginIds.value.length })
    : t('pluginAdmin:messages.selectAPlugin')
})

/** 查询插件列表 */
function getList() {
  loading.value = true
  listPlugin(queryParams.value)
    .then((response) => {
      pluginList.value = response.rows
      total.value = response.total
    })
    .catch((error) => {
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      loading.value = false
    })
}

/** 多选框选中数据 */
function handleSelectionChange(selection) {
  selectedPluginIds.value = selection.map((item) => item.pluginId).filter(Boolean)
}

function canSelectForBatch(row) {
  return !isOrphanPlugin(row) && row?.source !== 'artifact'
}

/** 清空当前选择 */
function clearSelectedPlugins() {
  selectedPluginIds.value = []
  pluginTableRef.value?.clearSelection?.()
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  clearSelectedPlugins()
  getList()
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}

/** 插件启停状态修改 */
function handleEnabledChange(row) {
  const enabled = row.enabled === '0'
  const operation = getEnabledSwitchOperation(row)
  if (isOperationBlocked(row, operation)) {
    row.enabled = row.enabled === '0' ? '1' : '0'
    proxy.$modal.msgWarning(getCapabilityReason(row.capability))
    return
  }
  const text = enabled ? t('common:enable') : t('common:disable')
  proxy.$modal
    .confirm(
      t('pluginAdmin:confirmation.valuePluginValue', { value0: text, value1: row.pluginName })
    )
    .then(function () {
      return enabled ? enablePlugin(row.pluginId) : disablePlugin(row.pluginId)
    })
    .then(() => {
      proxy.$modal.msgSuccess(t('pluginAdmin:confirmation.valueSucceeded', { value0: text }))
      getList()
    })
    .catch(function (error) {
      row.enabled = row.enabled === '0' ? '1' : '0'
      if (isUserCancel(error)) {
        return
      }
      showActionResult(
        () => t('pluginAdmin:confirmation.pluginValueFailed', { value0: text }),
        buildErrorActionResult(error, {
          pluginId: row.pluginId,
          operation: enabled ? 'enable' : 'disable',
        }),
        {}
      )
    })
}

function getEnabledSwitchOperation(row) {
  return row?.enabled === '0' ? 'disable' : 'enable'
}

function isEnabledSwitchBlocked(row) {
  const triesToEnableErrorPlugin = row?.status === 'error' && row?.enabled !== '0'
  return triesToEnableErrorPlugin || isOperationBlocked(row, getEnabledSwitchOperation(row))
}

function getEnabledSwitchTooltip(row) {
  if (row?.source === 'artifact') {
    return t(
      'pluginAdmin:messages.forSignedArtifactsChangeTheEnabledStateWithReleaseEnableDisableDuring'
    )
  }
  if (row?.status === 'error') {
    return row?.enabled === '0'
      ? t('pluginAdmin:messages.thePluginIsIsolatedDueToAnErrorTurnItOffTo')
      : t('pluginAdmin:messages.thePluginIsInAnErrorStateReinstallOrUpgradeItBefore')
  }
  if (isOperationBlocked(row, getEnabledSwitchOperation(row))) {
    return getCapabilityReason(row.capability)
  }
  return ''
}

/** 打开详情 */
function handleDetail(row) {
  loading.value = true
  migrationHistory.value = []
  getPlugin(row.pluginId)
    .then((response) => {
      detail.value = response.data
      detailOpen.value = true
      loadPluginMigrationHistory(row.pluginId)
    })
    .catch((error) => {
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      loading.value = false
    })
}

/** 查询插件 migration 历史 */
function loadPluginMigrationHistory(pluginId) {
  if (!pluginId) {
    migrationHistory.value = []
    return Promise.resolve()
  }
  migrationLoading.value = true
  return listPluginMigrations(pluginId)
    .then((response) => {
      migrationHistory.value = response.data?.migrations || []
    })
    .catch((error) => {
      migrationHistory.value = []
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      migrationLoading.value = false
    })
}

/** 人工标记 migration 成功 */
function handleMarkMigrationSuccess(row) {
  const pluginId = detail.value.pluginId
  const migrationPath = row?.migrationPath
  if (!pluginId || !migrationPath) {
    return
  }
  proxy.$modal
    .confirm(
      t('pluginAdmin:confirmation.markValueAsSuccessfullyExecuted', { value0: migrationPath })
    )
    .then(function () {
      migrationLoading.value = true
      return markPluginMigrationSuccess(pluginId, {
        migrationPath,
        note: t('pluginAdmin:interface.manuallyMarkedSuccessfulInTheManagementConsole'),
      })
    })
    .then((response) => {
      proxy.$modal.msgSuccess(
        response.data?.message || t('pluginAdmin:messages.migrationMarkedSuccessful')
      )
      return loadPluginMigrationHistory(pluginId)
    })
    .then(() => {
      getList()
    })
    .catch((error) => {
      if (!isUserCancel(error)) {
        proxy.$modal.msgError(getErrorMessage(error))
      }
    })
    .finally(() => {
      migrationLoading.value = false
    })
}

/** 人工标记 migration 失败 */
function handleMarkMigrationFailed(row) {
  const pluginId = detail.value.pluginId
  const migrationPath = row?.migrationPath
  if (!pluginId || !migrationPath) {
    return
  }
  proxy.$modal
    .confirm(
      t('pluginAdmin:confirmation.markValueAsFailedAndAllowFutureRetries', {
        value0: migrationPath,
      })
    )
    .then(function () {
      migrationLoading.value = true
      return markPluginMigrationFailed(pluginId, {
        migrationPath,
        note: t('pluginAdmin:interface.manuallyMarkedFailedInTheManagementConsole'),
      })
    })
    .then((response) => {
      proxy.$modal.msgSuccess(
        response.data?.message || t('pluginAdmin:messages.migrationMarkedFailed')
      )
      return loadPluginMigrationHistory(pluginId)
    })
    .then(() => {
      getList()
    })
    .catch((error) => {
      if (!isUserCancel(error)) {
        proxy.$modal.msgError(getErrorMessage(error))
      }
    })
    .finally(() => {
      migrationLoading.value = false
    })
}

/** 打开插件配置 */
function handleConfig(row) {
  const revision = ++configRequestRevision
  configLoading.value = true
  configPluginId.value = row.pluginId
  configTitleFactory.value = () =>
    t('pluginAdmin:confirmation.valueConfiguration', { value0: row.pluginName })
  getPluginConfig(row.pluginId)
    .then((response) => {
      if (revision !== configRequestRevision) return
      const configs = response.data?.configs || []
      configItems.value = configs
      configOpen.value = true
      configStatusRevision.value++
    })
    .catch((error) => {
      if (revision !== configRequestRevision) return
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      if (revision === configRequestRevision) configLoading.value = false
    })
}

/** 保存插件配置 */
function submitConfig(values) {
  const revision = ++configRequestRevision
  configLoading.value = true
  updatePluginConfig(configPluginId.value, { values })
    .then((response) => {
      if (revision !== configRequestRevision) return
      proxy.$modal.msgSuccess(t('pluginAdmin:messages.pluginConfigurationSaved'))
      configItems.value = response.data?.configs || configItems.value
      configStatusRevision.value++
    })
    .catch((error) => {
      if (revision !== configRequestRevision) return
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      if (revision === configRequestRevision) configLoading.value = false
    })
}

/** 检查插件 */
function handleCheck(row) {
  actionLoading.value = true
  checkPlugin(row.pluginId)
    .then((response) => {
      showActionResult(() => t('pluginAdmin:messages.pluginCheckResults'), response.data, {})
    })
    .catch((error) => {
      showActionResult(
        () => t('pluginAdmin:messages.pluginCheckFailed'),
        buildErrorActionResult(error, {
          pluginId: row.pluginId,
          operation: 'check',
        }),
        {}
      )
    })
    .finally(() => {
      actionLoading.value = false
    })
}

/** 执行插件健康检查 */
function handleHealth(row) {
  diagnosticLoading.value = true
  diagnosticTitleFactory.value = () =>
    t('pluginAdmin:confirmation.valueHealthCheck', { value0: row.pluginName })
  diagnosticResult.value = {
    pluginId: row.pluginId,
    message: t('pluginAdmin:messages.runningPluginHealthChecks'),
  }
  diagnosticOpen.value = true
  healthPlugin(row.pluginId)
    .then((response) => {
      diagnosticResult.value = response.data || {}
    })
    .catch((error) => {
      diagnosticResult.value = {
        ok: false,
        pluginId: row.pluginId,
        message: getErrorMessage(error),
        error: serializeError(error),
      }
    })
    .finally(() => {
      diagnosticLoading.value = false
    })
}

/** 生成插件诊断包 */
function handleDiagnose(row) {
  diagnosticLoading.value = true
  diagnosticTitleFactory.value = () =>
    t('pluginAdmin:confirmation.valueDiagnosticBundle', {
      value0: row.pluginName,
    })
  diagnosticResult.value = {
    pluginId: row.pluginId,
    message: t('pluginAdmin:messages.generatingPluginDiagnosticBundle'),
  }
  diagnosticOpen.value = true
  diagnosePlugin(row.pluginId)
    .then((response) => {
      diagnosticResult.value = response.data || {}
    })
    .catch((error) => {
      diagnosticResult.value = {
        ok: false,
        pluginId: row.pluginId,
        message: getErrorMessage(error),
        error: serializeError(error),
      }
    })
    .finally(() => {
      diagnosticLoading.value = false
    })
}

/** 检查插件依赖 */
function handleDependencies(row) {
  dependencyLoading.value = true
  dependencyPluginId.value = row.pluginId
  checkPluginDependencies(row.pluginId)
    .then((response) => {
      dependencyResult.value = response.data || {}
      dependencyOpen.value = true
    })
    .catch((error) => {
      dependencyResult.value = {
        ok: false,
        pluginId: row.pluginId,
        message: getErrorMessage(error),
        dependencies: [],
        plan: [],
      }
      dependencyOpen.value = true
    })
    .finally(() => {
      dependencyLoading.value = false
    })
}

/** 生成插件依赖安装计划 */
function handleDependencyDryRun() {
  if (isCapabilityOperationBlocked(dependencyResult.value.capability, 'dependency_install')) {
    proxy.$modal.msgWarning(getCapabilityReason(dependencyResult.value.capability))
    return
  }
  dependencyLoading.value = true
  installPluginDependencies(dependencyPluginId.value, true)
    .then((response) => {
      dependencyResult.value = response.data || {}
    })
    .catch((error) => {
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      dependencyLoading.value = false
    })
}

/** 执行插件依赖安装 */
function handleDependencyInstall() {
  if (isCapabilityOperationBlocked(dependencyResult.value.capability, 'dependency_install')) {
    proxy.$modal.msgWarning(getCapabilityReason(dependencyResult.value.capability))
    return
  }
  if (dependencyResult.value.policy?.allowed === false) {
    proxy.$modal.msgWarning(getDependencyPolicyReason(dependencyResult.value.policy))
    return
  }
  proxy.$modal
    .confirm(
      t('pluginAdmin:confirmation.installMissingDependenciesForPluginValue', {
        value0: dependencyPluginId.value,
      })
    )
    .then(function () {
      dependencyLoading.value = true
      return installPluginDependencies(dependencyPluginId.value, false)
    })
    .then((response) => {
      dependencyResult.value = response.data || {}
      proxy.$modal.msgSuccess(t('pluginAdmin:messages.pluginDependenciesInstalled'))
    })
    .catch((error) => {
      if (!isUserCancel(error)) {
        proxy.$modal.msgError(getErrorMessage(error))
      }
    })
    .finally(() => {
      dependencyLoading.value = false
    })
}

/** 生成插件批量操作拓扑计划 */
function handlePlan(operation) {
  if (!selectedPluginIds.value.length) {
    proxy.$modal.msgWarning(t('pluginAdmin:messages.selectPluginsFirst'))
    return
  }
  planLoading.value = true
  planTitleFactory.value = () =>
    t('pluginAdmin:confirmation.pluginValuePlan', {
      value0: formatPluginOperation(operation),
    })
  const pluginIds = getBatchTargetPluginIds()
  batchResult.value = normalizePluginBatchResponse({})
  planPlugins(operation, pluginIds)
    .then((response) => {
      planResult.value = normalizePluginPlanResponse(response.data)
      planOpen.value = true
    })
    .catch((error) => {
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      planLoading.value = false
    })
}

/** 获取批量目标插件ID */
function getBatchTargetPluginIds() {
  return [...selectedPluginIds.value]
}

/** 执行插件批量操作 */
function handleExecuteBatch(dryRun) {
  if (!(planResult.value.ok && planResult.value.executablePluginIds.length > 0)) {
    return
  }
  const operation = planResult.value.operation
  const pluginIds = planResult.value.executablePluginIds
  proxy.$modal
    .confirm(
      t('pluginAdmin:confirmation.runPluginValueInBatchTargetsValue', {
        value0: formatPluginOperation(operation),
        value1: formatPlanDependencies(pluginIds),
      })
    )
    .then(function () {
      planLoading.value = true
      return batchPlugins(operation, pluginIds, dryRun, batchContinueOnError.value)
    })
    .then((response) => {
      batchResult.value = normalizePluginBatchResponse(response.data)
      planResult.value = normalizePluginPlanResponse(response.data)
      proxy.$modal.msgSuccess(
        response.data?.message || t('pluginAdmin:messages.batchPluginOperationCompleted')
      )
      getList()
    })
    .catch((error) => {
      if (isUserCancel(error)) {
        return
      }
      batchResult.value = normalizePluginBatchResponse(buildErrorBatchResult(error, operation))
    })
    .finally(() => {
      planLoading.value = false
    })
}

/** 打开插件操作审计 */
function handleOperationLog() {
  resetOperationLogSearchState()
  resetOperationLogRetentionState()
  operationLogOpen.value = true
  loadOperationLogRetentionPolicy()
  getOperationLogList()
}

/** 搜索插件操作审计 */
function handleOperationLogQuery() {
  operationLogQueryParams.value.pageNum = 1
  getOperationLogList()
}

/** 重置插件操作审计查询 */
function resetOperationLogQuery() {
  resetOperationLogSearchState()
  handleOperationLogQuery()
}

function resetOperationLogSearchState() {
  operationLogDateRange.value = []
  operationLogQueryParams.value.pageNum = 1
  operationLogQueryParams.value.pluginId = undefined
  operationLogQueryParams.value.operation = undefined
  operationLogQueryParams.value.status = undefined
}

function resetOperationLogRetentionState() {
  operationLogRetentionLoading.value = false
  operationLogRetentionResult.value = {}
  operationLogRetentionForm.retentionDays = operationLogRetentionDefaultDays.value
}

function buildOperationLogQueryParams() {
  return proxy.addDateRange({ ...operationLogQueryParams.value }, operationLogDateRange.value)
}

function loadOperationLogRetentionPolicy() {
  getConfigKey(OPERATION_LOG_RETENTION_CONFIG_KEY)
    .then((response) => {
      const retentionDays = Number(response.msg)
      if (Number.isInteger(retentionDays) && retentionDays >= 0) {
        operationLogRetentionDefaultDays.value = retentionDays
        operationLogRetentionForm.retentionDays = retentionDays
      }
    })
    .catch(() => {})
}

/** 查询插件操作审计列表 */
function getOperationLogList() {
  operationLogLoading.value = true
  listPluginOperationLog(buildOperationLogQueryParams())
    .then((response) => {
      operationLogList.value = response.rows
      operationLogTotal.value = response.total
    })
    .catch((error) => {
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      operationLogLoading.value = false
    })
}

/** 打开插件操作审计详情 */
function handleOperationLogDetail(row) {
  getPluginOperationLog(row.operationId)
    .then((response) => {
      operationLogDetail.value = normalizePluginOperationLogDetail(response.data || {})
      operationLogDetailOpen.value = true
    })
    .catch((error) => {
      proxy.$modal.msgError(getErrorMessage(error))
    })
}

/** 导出插件操作审计 */
function handleOperationLogExport() {
  operationLogExportLoading.value = true
  proxy
    .download(
      'system/plugin/operation-log/export',
      {
        ...buildOperationLogQueryParams(),
        exportLimit: 5000,
      },
      `plugin_operation_log_${new Date().getTime()}.xlsx`
    )
    .finally(() => {
      operationLogExportLoading.value = false
    })
}

/** 预览插件操作审计保留策略 */
function handleOperationLogRetentionPreview() {
  operationLogRetentionLoading.value = true
  retainPluginOperationLog({
    retentionDays: operationLogRetentionForm.retentionDays,
    dryRun: true,
  })
    .then((response) => {
      operationLogRetentionResult.value = response.data || {}
    })
    .catch((error) => {
      proxy.$modal.msgError(getErrorMessage(error))
    })
    .finally(() => {
      operationLogRetentionLoading.value = false
    })
}

/** 清理插件操作审计历史 */
function handleOperationLogRetentionClean() {
  proxy.$modal
    .confirm(buildOperationLogRetentionConfirmMessage())
    .then(function () {
      operationLogRetentionLoading.value = true
      return retainPluginOperationLog({
        retentionDays: operationLogRetentionForm.retentionDays,
        dryRun: false,
      })
    })
    .then((response) => {
      operationLogRetentionResult.value = response.data || {}
      proxy.$modal.msgSuccess(t('pluginAdmin:messages.pluginAuditLogsDeleted'))
      getOperationLogList()
    })
    .catch((error) => {
      if (!isUserCancel(error)) {
        proxy.$modal.msgError(getErrorMessage(error))
      }
    })
    .finally(() => {
      operationLogRetentionLoading.value = false
    })
}

function buildOperationLogRetentionConfirmMessage() {
  if (Number(operationLogRetentionForm.retentionDays) === 0) {
    return t('pluginAdmin:messages.deleteAllPluginOperationAuditLogsRecordedBeforeNow')
  }

  return t('pluginAdmin:confirmation.clearPluginAuditLogsOlderThanValueDays', {
    value0: operationLogRetentionForm.retentionDays,
  })
}

/** 安装插件预演 */
function handleInstallDryRun(row) {
  actionLoading.value = true
  installPlugin(row.pluginId, true)
    .then((response) => {
      showActionResult(() => t('pluginAdmin:messages.pluginInstallationDryRun'), response.data, {
        type: 'install',
        label: t('pluginAdmin:messages.install'),
        pluginId: row.pluginId,
        pluginName: row.pluginName,
      })
    })
    .catch((error) => {
      showActionResult(
        () => t('pluginAdmin:messages.pluginInstallationDryRunFailed'),
        buildErrorActionResult(error, {
          pluginId: row.pluginId,
          operation: 'install',
        }),
        {}
      )
    })
    .finally(() => {
      actionLoading.value = false
    })
}

/** 升级插件预演 */
function handleUpgradeDryRun(row) {
  actionLoading.value = true
  upgradePlugin(row.pluginId, true)
    .then((response) => {
      showActionResult(() => t('pluginAdmin:messages.pluginUpgradeDryRun'), response.data, {
        type: 'upgrade',
        label: t('pluginAdmin:messages.upgrade'),
        pluginId: row.pluginId,
        pluginName: row.pluginName,
      })
    })
    .catch((error) => {
      showActionResult(
        () => t('pluginAdmin:messages.pluginUpgradeDryRunFailed'),
        buildErrorActionResult(error, {
          pluginId: row.pluginId,
          operation: 'upgrade',
        }),
        {}
      )
    })
    .finally(() => {
      actionLoading.value = false
    })
}

/** 安全卸载插件预演 */
function handleUninstallDryRun(row) {
  actionLoading.value = true
  uninstallPlugin(row.pluginId, true)
    .then((response) => {
      showActionResult(() => t('pluginAdmin:messages.pluginRemovalDryRun'), response.data, {
        type: 'uninstall',
        label: t('pluginAdmin:messages.uninstall'),
        pluginId: row.pluginId,
        pluginName: row.pluginName,
      })
    })
    .catch((error) => {
      showActionResult(
        () => t('pluginAdmin:messages.pluginRemovalDryRunFailed'),
        buildErrorActionResult(error, {
          pluginId: row.pluginId,
          operation: 'uninstall',
        }),
        {}
      )
    })
    .finally(() => {
      actionLoading.value = false
    })
}

/** 物理清理孤儿插件元数据预演 */
function handlePurgeDryRun(row) {
  actionLoading.value = true
  purgePlugin(row.pluginId, true)
    .then((response) => {
      showActionResult(() => t('pluginAdmin:messages.orphanedPluginCleanupDryRun'), response.data, {
        type: 'purge',
        label: t('pluginAdmin:messages.cleanUpOrphanedMetadata'),
        pluginId: row.pluginId,
        pluginName: row.pluginName,
      })
    })
    .catch((error) => {
      showActionResult(
        () => t('pluginAdmin:messages.orphanedPluginCleanupDryRunFailed'),
        buildErrorActionResult(error, {
          pluginId: row.pluginId,
          operation: 'purge',
        }),
        {}
      )
    })
    .finally(() => {
      actionLoading.value = false
    })
}

/** 执行预演后的插件操作 */
function handleExecutePendingAction() {
  if (!pendingAction.value.type) {
    return
  }
  const action = pendingAction.value
  proxy.$modal
    .confirm(
      t('pluginAdmin:confirmation.runValueForPluginValue', {
        value0: action.pluginName,
        value1: action.label,
      })
    )
    .then(function () {
      actionLoading.value = true
      const requestMap = {
        install: installPlugin,
        upgrade: upgradePlugin,
        uninstall: uninstallPlugin,
        purge: purgePlugin,
      }
      const request = requestMap[action.type]
      return request(action.pluginId, false)
    })
    .then((response) => {
      showActionResult(
        () =>
          t('pluginAdmin:confirmation.pluginValueResult', {
            value0: formatPluginOperation(action.type),
          }),
        response.data,
        {}
      )
      proxy.$modal.msgSuccess(
        t('pluginAdmin:confirmation.pluginValueCompleted', { value0: action.label })
      )
      getList()
    })
    .catch((error) => {
      if (isUserCancel(error)) {
        return
      }
      showActionResult(
        () =>
          t('pluginAdmin:confirmation.pluginValueFailed', {
            value0: formatPluginOperation(action.type),
          }),
        buildErrorActionResult(error, {
          pluginId: action.pluginId,
          operation: action.type,
        }),
        {}
      )
    })
    .finally(() => {
      actionLoading.value = false
    })
}

/** 展示插件操作结果 */
function showActionResult(title, result, nextAction) {
  actionTitleFactory.value = title
  actionResult.value = normalizeActionResult(result)
  pendingAction.value = canExecuteActionResult(actionResult.value) ? nextAction : {}
  actionOpen.value = true
}

/** 从详情进入异常插件的重新安装修复流程 */
function handleRepairFromDetail() {
  const plugin = { ...detail.value }
  detailOpen.value = false
  handleInstallDryRun(plugin)
}

function getStatusLabel(status) {
  const option = pluginStatusOptions.find((item) => item.value === status)
  return option ? option.label : status || '-'
}

function getStatusTagType(status) {
  const option = pluginStatusOptions.find((item) => item.value === status)
  return option ? option.tagType : 'info'
}

function canInstall(row) {
  return (
    !isOrphanPlugin(row) &&
    row?.source !== 'artifact' &&
    (!row.installedVersion || row.status === 'discovered' || row.status === 'error')
  )
}

function canUpgrade(row) {
  return !isOrphanPlugin(row) && row?.source !== 'artifact' && row.status === 'pending_upgrade'
}

function canUninstall(row) {
  return (
    !isOrphanPlugin(row) &&
    row?.source !== 'artifact' &&
    row.installedVersion &&
    row.enabled === '0'
  )
}

function isOrphanPlugin(row) {
  return row?.source === 'orphan'
}

function canExecuteActionResult(result) {
  return (
    !result.error &&
    !isCapabilityOperationBlocked(result.capability, result.operation) &&
    result.dryRun &&
    result.structureOk !== false &&
    result.menuConflictOk !== false
  )
}

function isOperationBlocked(row, operation) {
  return row?.source === 'artifact' || isCapabilityOperationBlocked(row?.capability, operation)
}

function isCapabilityOperationBlocked(capability, operation) {
  return (
    Array.isArray(capability?.blockedOperations) && capability.blockedOperations.includes(operation)
  )
}

function getCapabilityReason(capability) {
  return (
    capability?.primaryReason ||
    capability?.warnings?.[0] ||
    t('pluginAdmin:messages.thisEnvironmentDoesNotPermitThisPluginOperation')
  )
}

function getDependencyPolicyReason(policy) {
  const messages = [
    ...(Array.isArray(policy?.reasons) ? policy.reasons : []),
    ...(Array.isArray(policy?.requirements) ? policy.requirements : []),
  ]
  return (
    messages[0] || t('pluginAdmin:messages.theCurrentDependencyPolicyDoesNotPermitInstallation')
  )
}

function getOperationTooltip(row, operation, label) {
  return isOperationBlocked(row, operation) ? getCapabilityReason(row.capability) : label
}

function getDependencyTagType(row) {
  if (row.status === 'skipped') {
    return 'info'
  }
  return row.ok ? 'success' : 'danger'
}

function formatDependencyInstalled(row) {
  if (row.status === 'skipped') {
    return t('pluginAdmin:messages.notApplicable')
  }
  return row.installed ? t('common:yes') : t('common:no')
}

function formatDependencyVersionSatisfied(row) {
  if (row.status === 'skipped') {
    return t('pluginAdmin:messages.notApplicable')
  }
  return row.versionSatisfied ? t('common:yes') : t('common:no')
}

function normalizeActionResult(result) {
  return normalizePluginActionResult(result)
}

function buildErrorActionResult(error, context = {}) {
  const message = getErrorMessage(error)
  const payload = error?.response?.data?.data || {}
  const migrationRecovery = payload.migrationRecovery
  return {
    ok: false,
    pluginId: payload.pluginId || context.pluginId,
    operation: payload.operation || context.operation,
    dependencyOk: false,
    structureOk: undefined,
    menuConflictOk: undefined,
    failedStep: payload.failedStep,
    migrationRecovery,
    error: {
      message: payload.error || message,
      suggestion:
        migrationRecovery?.suggestion ||
        t(
          'pluginAdmin:messages.runPluginChecksAndResolveDirectoryDependencyMenuAndPermissionConflictsBefore'
        ),
      raw: serializeError(error),
    },
    message,
  }
}

function buildErrorBatchResult(error, operation) {
  const message = getErrorMessage(error)
  const executablePluginIds = planResult.value.executablePluginIds
  return {
    ok: false,
    operation,
    message,
    summary: {
      total: executablePluginIds.length,
      succeeded: 0,
      failed: 1,
      skipped: Math.max(executablePluginIds.length - 1, 0),
    },
    executed: [
      {
        pluginId: executablePluginIds[0] || '-',
        operation,
        ok: false,
        status: 'failed',
        message,
        suggestion: t('pluginAdmin:messages.reviewAuditDetailsOrBackendLogsThenTryAgain'),
      },
    ],
  }
}

function getErrorMessage(error) {
  if (!error) {
    return t('pluginAdmin:messages.pluginOperationFailed')
  }
  if (typeof error === 'string') {
    return error
  }
  return (
    error.message ||
    error.msg ||
    error.response?.data?.msg ||
    t('pluginAdmin:messages.pluginOperationFailed')
  )
}

function serializeError(error) {
  if (!error) {
    return {}
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  return {
    message: error.message,
    name: error.name,
    status: error.response?.status,
    data: error.response?.data,
  }
}

function isUserCancel(error) {
  return error === 'cancel' || error === 'close' || error?.message === 'cancel'
}

function formatBoolean(value) {
  if (value === undefined || value === null) {
    return '-'
  }
  return value ? t('pluginAdmin:messages.passed') : t('common:exception')
}

function formatNullable(value, fallback = '-') {
  return value === undefined || value === null ? fallback : value
}

function getSummaryCount(payload, key) {
  const value = payload && payload.summary ? payload.summary[key] : undefined
  return value === undefined || value === null ? 0 : value
}

function getSummaryChangedKeys(payload) {
  return payload && payload.summary && Array.isArray(payload.summary.changedKeys)
    ? payload.summary.changedKeys
    : []
}

function getOperationFailedStep(payload) {
  if (!payload) {
    return t('pluginAdmin:messages.none')
  }
  const result = payload.result || {}
  const failed = result.failed || {}
  return (
    payload.failedStep ||
    result.failedStep ||
    (failed.result && failed.result.failedStep) ||
    t('pluginAdmin:messages.none')
  )
}

function getExecutedResults(payload) {
  const result = payload && payload.result
  return result && Array.isArray(result.executed) ? result.executed : []
}

function getExecutedFailedStep(row) {
  return row.failedStep || (row.result && row.result.failedStep) || '-'
}

function formatPlanDependencies(dependencies) {
  return Array.isArray(dependencies) && dependencies.length ? dependencies.join(', ') : '-'
}

function formatPluginIdsForDisplay(pluginIds) {
  const ids = Array.isArray(pluginIds) ? pluginIds.filter(Boolean) : []
  if (!ids.length) {
    return '-'
  }
  const visibleIds = ids.slice(0, 8).join(', ')
  return ids.length > 8
    ? t('pluginAdmin:confirmation.valuePluginsIncludingValue', {
        value0: visibleIds,
        value1: ids.length,
      })
    : visibleIds
}

function formatConfigDefaultValue(item) {
  const value = item.default
  if (item.secret && value !== undefined && value !== null && value !== '') {
    return '******'
  }
  if (value === undefined || value === null || value === '') {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function formatConfigConstraint(item) {
  const constraints = []
  if (item.min !== undefined && item.min !== null) {
    constraints.push(t('pluginAdmin:confirmation.minimumValue', { value0: item.min }))
  }
  if (item.max !== undefined && item.max !== null) {
    constraints.push(t('pluginAdmin:confirmation.maximumValue', { value0: item.max }))
  }
  if (item.pattern) {
    constraints.push(t('pluginAdmin:confirmation.patternValue', { value0: item.pattern }))
  }
  if (Array.isArray(item.options) && item.options.length) {
    constraints.push(
      t('pluginAdmin:confirmation.optionsValue', {
        value0: item.options.map(formatConfigOption).join(', '),
      })
    )
  }
  return constraints.length ? constraints.join('; ') : '-'
}

function formatConfigOption(option) {
  if (!option || typeof option !== 'object') {
    return String(option)
  }
  const value = option.value === undefined || option.value === null ? '' : String(option.value)
  return option.label ? option.label + '(' + value + ')' : value
}

function formatPluginOperation(operation) {
  return getPlanOperationLabel(operation, plugin_operation_type.value)
}

function getOperationLogStatusLabel(status) {
  const option = operationLogStatusOptions.find((item) => item.value === status)

  return option ? option.label : status || '-'
}

function getOperationLogStatusTagType(status) {
  const option = operationLogStatusOptions.find((item) => item.value === status)

  return option ? option.tagType : 'info'
}

function formatRetentionMessage(result) {
  const actionText = result.dryRun ? t('common:preview') : t('file:messages.deletePermanently')
  const cutoffTime = formatPluginTime(result.cutoffTime)
  return t(
    'pluginAdmin:confirmation.valueCompleteRetainValueDaysCutoffValueValueMatchedValueDeleted',
    {
      value0: actionText,
      value1: result.retentionDays,
      value2: cutoffTime,
      value3: result.matchedCount,
      value4: result.deletedCount,
    }
  )
}

function formatActionPlanState(action) {
  if (action.ok === true) {
    return t('pluginAdmin:messages.passed')
  }
  if (action.ok === false) {
    return t('common:exception')
  }
  if (action.hook) {
    return action.hook
  }
  if (action.targetEnabled !== undefined) {
    return action.targetEnabled
      ? t('pluginAdmin:messages.targetEnabled')
      : t('pluginAdmin:messages.targetDisabled')
  }
  if (action.targetStatus !== undefined) {
    return action.targetStatus === '0'
      ? t('pluginAdmin:messages.targetHealthy')
      : t('pluginAdmin:messages.targetDisabled')
  }
  return '-'
}

function formatJson(value) {
  return JSON.stringify(value || {}, null, 2)
}

getList()
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}

.mr12 {
  margin-right: 12px;
}

.plugin-selection-tag {
  height: 32px;
  line-height: 30px;
}

.plugin-switch-tooltip-target {
  display: inline-flex;
  align-items: center;
}

.plugin-action-buttons {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.plugin-action-buttons ::v-deep .el-button {
  margin-left: 0;
}

.plugin-query-form ::v-deep .el-input,
.plugin-query-form ::v-deep .el-select {
  width: 220px;
}

.plugin-audit-drawer {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  box-sizing: border-box;
  padding: 0 20px 20px;
}

.plugin-audit-search {
  padding: 12px 12px 4px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 4px;
}

.plugin-audit-search {
  background: var(--el-bg-color, #fff);
}

.plugin-audit-maintenance {
  margin-bottom: 12px;
  background: var(--el-fill-color-light, #f8f9fb);
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 4px;
}

.plugin-audit-maintenance ::v-deep .el-collapse-item__header {
  height: 40px;
  padding: 0 12px;
  background: transparent;
  border-bottom-color: transparent;
}

.plugin-audit-maintenance ::v-deep .el-collapse-item__wrap {
  background: transparent;
  border-bottom: 0;
}

.plugin-audit-maintenance ::v-deep .el-collapse-item__content {
  padding: 0 12px 12px;
}

.plugin-audit-maintenance-title {
  margin-right: 8px;
  color: var(--el-text-color-regular, #606266);
  font-weight: 600;
}

.plugin-log-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.plugin-log-toolbar ::v-deep .el-form-item {
  margin-bottom: 10px;
}

.plugin-audit-date-range ::v-deep .el-date-editor {
  width: 220px;
}

.plugin-action-danger {
  color: #f56c6c;
}

.plugin-audit-table {
  flex: 1;
  min-height: 0;
}

.plugin-audit-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.plugin-audit-table-actions {
  flex: 1;
}

.drawer-footer {
  margin-top: 16px;
  text-align: right;
}

@media (max-width: 768px) {
  .plugin-audit-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
</style>
