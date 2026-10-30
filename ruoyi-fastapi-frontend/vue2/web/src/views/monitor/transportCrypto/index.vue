<template>
  <div
    class="app-container transport-crypto-monitor"
    v-loading="loading"
  >
    <el-row
      :gutter="16"
      class="mb16"
    >
      <el-col
        :xs="24"
        :sm="12"
        :lg="6"
      >
        <el-card
          shadow="hover"
          class="summary-card"
        >
          <div class="summary-header">
            <span class="summary-title">{{
              $t('monitor:messages.transportEncryptionStatus')
            }}</span>
            <el-tag :type="monitorData.transportCryptoEnabled ? 'success' : 'info'">
              {{
                monitorData.transportCryptoEnabled
                  ? $t('monitor:expression.enabled')
                  : $t('monitor:expression.notEnabled')
              }}
            </el-tag>
          </div>
          <div class="summary-value">{{ modeLabel }}</div>
          <div class="summary-desc">
            {{ $t('monitor:messages.currentMode') }}{{ monitorData.transportCryptoMode || '-' }}
          </div>
        </el-card>
      </el-col>

      <el-col
        :xs="24"
        :sm="12"
        :lg="6"
      >
        <el-card
          shadow="hover"
          class="summary-card"
        >
          <div class="summary-header">
            <span class="summary-title">{{ $t('monitor:messages.requestOverview') }}</span>
            <el-tag type="primary">{{ $t('monitor:messages.matchingRules') }}</el-tag>
          </div>
          <div class="summary-value">{{ formatCount(monitorData.requestsTotal) }}</div>
          <div class="summary-desc">
            {{ $t('monitor:messages.plaintext') }} {{ formatCount(monitorData.plainRequestsTotal) }}
            {{ $t('monitor:messages.encrypted') }}
            {{ formatCount(monitorData.encryptedRequestsTotal) }}
          </div>
        </el-card>
      </el-col>

      <el-col
        :xs="24"
        :sm="12"
        :lg="6"
      >
        <el-card
          shadow="hover"
          class="summary-card"
        >
          <div class="summary-header">
            <span class="summary-title">{{ $t('monitor:messages.decryptionSuccessRate') }}</span>
            <el-tag :type="decryptRateTagType"> {{ decryptSuccessRate.toFixed(1) }}% </el-tag>
          </div>
          <div class="summary-value">{{ formatCount(monitorData.decryptSuccessTotal) }}</div>
          <div class="summary-desc">
            {{ $t('common:failed') }} {{ formatCount(monitorData.decryptFailureTotal) }}
            {{ $t('monitor:messages.rejectedByPolicy') }}
            {{ formatCount(monitorData.requiredRejectedTotal) }}
          </div>
        </el-card>
      </el-col>

      <el-col
        :xs="24"
        :sm="12"
        :lg="6"
      >
        <el-card
          shadow="hover"
          class="summary-card"
        >
          <div class="summary-header">
            <span class="summary-title">{{ $t('monitor:messages.responseEncryption') }}</span>
            <el-tag type="warning">{{ $t('monitor:messages.jSONResponses') }}</el-tag>
          </div>
          <div class="summary-value">{{ formatCount(monitorData.encryptedResponsesTotal) }}</div>
          <div class="summary-desc">
            {{ $t('monitor:messages.plaintext') }}
            {{ formatCount(monitorData.plainResponsesTotal) }}
            {{ $t('monitor:messages.encryptedErrors') }}
            {{ formatCount(monitorData.encryptedErrorResponsesTotal) }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row
      :gutter="16"
      class="mb16"
    >
      <el-col
        :xs="24"
        :lg="16"
      >
        <el-card shadow="never">
          <div
            slot="header"
            class="card-header"
          >
            <span>{{ $t('monitor:messages.currentConfiguration') }}</span>
            <div class="card-actions">
              <div class="header-switch">
                <span class="header-switch-label">{{
                  autoRefresh
                    ? $t('monitor:expression.autoRefresh')
                    : $t('monitor:expression.manual')
                }}</span>
                <el-switch
                  v-model="autoRefresh"
                  active-color="#409eff"
                  inactive-color="#c0c4cc"
                />
              </div>
              <el-button
                type="primary"
                icon="el-icon-refresh"
                size="small"
                :loading="loading"
                @click="loadMonitorData(true)"
              >
                {{ $t('layout:tags.refresh') }}
              </el-button>
            </div>
          </div>

          <el-descriptions
            :column="2"
            border
          >
            <el-descriptions-item :label="$t('monitor:messages.statisticsScope')">
              {{ monitorScopeLabel }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:messages.appEnvironment')">
              {{ monitorData.appEnv || '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:messages.currentKeyVersion')">
              <el-tag>{{ monitorData.currentKid || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:messages.monitoringStartedAt')">
              {{ formatMonitorTime(monitorData.startedAt) || '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:messages.supportedKeyVersions')">
              <div class="tag-list">
                <el-tag
                  v-for="kid in monitorData.supportedKids || []"
                  :key="kid"
                  effect="plain"
                  class="tag-item"
                >
                  {{ kid }}
                </el-tag>
                <span v-if="!(monitorData.supportedKids || []).length">-</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:messages.failureCategories')">
              {{ failureReasonRows.length }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="$t('monitor:messages.aggregationInformation')"
              :span="2"
            >
              {{ monitorScopeDescription }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:messages.enabledPaths')">
              <div class="tag-list">
                <el-tag
                  v-for="path in monitorData.enabledPaths || []"
                  :key="path"
                  type="success"
                  effect="plain"
                  class="tag-item"
                >
                  {{ path }}
                </el-tag>
                <span v-if="!(monitorData.enabledPaths || []).length">{{
                  $t('monitor:messages.allAPIs')
                }}</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:messages.encryptionRequiredPaths')">
              <div class="tag-list">
                <el-tag
                  v-for="path in monitorData.requiredPaths || []"
                  :key="path"
                  type="warning"
                  effect="plain"
                  class="tag-item"
                >
                  {{ path }}
                </el-tag>
                <span v-if="!(monitorData.requiredPaths || []).length">-</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item
              :label="$t('monitor:messages.excludedPaths')"
              :span="2"
            >
              <div class="tag-list">
                <el-tag
                  v-for="path in monitorData.excludePaths || []"
                  :key="path"
                  type="info"
                  effect="plain"
                  class="tag-item"
                >
                  {{ path }}
                </el-tag>
                <span v-if="!(monitorData.excludePaths || []).length">-</span>
              </div>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col
        :xs="24"
        :lg="8"
      >
        <el-card
          shadow="never"
          class="health-card"
        >
          <div
            slot="header"
            class="card-header"
          >
            <span>{{ $t('monitor:messages.health') }}</span>
            <el-tag :type="healthTagLabelType">{{ healthLabel }}</el-tag>
          </div>

          <div class="health-item">
            <div class="health-label">
              <span>{{ $t('monitor:messages.decryptionSuccessRate') }}</span>
              <span>{{ decryptSuccessRate.toFixed(1) }}%</span>
            </div>
            <el-progress
              :percentage="Number(decryptSuccessRate.toFixed(1))"
              :status="healthProgressStatus"
            />
          </div>

          <div class="health-item">
            <div class="health-label">
              <span>{{ $t('monitor:messages.encryptedRequestShare') }}</span>
              <span>{{ encryptedRequestRate.toFixed(1) }}%</span>
            </div>
            <el-progress
              :percentage="Number(encryptedRequestRate.toFixed(1))"
              status="success"
            />
          </div>

          <div class="health-item">
            <div class="health-label">
              <span>{{ $t('monitor:messages.encryptedResponseShare') }}</span>
              <span>{{ encryptedResponseRate.toFixed(1) }}%</span>
            </div>
            <el-progress :percentage="Number(encryptedResponseRate.toFixed(1))" />
          </div>

          <el-alert
            :title="healthMessage"
            :type="healthTagType"
            :closable="false"
            show-icon
          />
        </el-card>
      </el-col>
    </el-row>

    <el-row
      :gutter="16"
      class="mb16"
    >
      <el-col
        :xs="24"
        :lg="10"
      >
        <el-card shadow="never">
          <div
            slot="header"
            class="card-header"
          >
            <span>{{ $t('monitor:messages.failureCauses') }}</span>
            <div class="card-actions compact-actions">
              <span class="card-subtitle">{{
                $t('monitor:messages.statisticsAggregatedInRedis')
              }}</span>
              <el-tag
                v-if="selectedFailureReason"
                type="danger"
                effect="plain"
                closable
                @close="clearFailureReasonSelection"
              >
                {{ selectedFailureReason }}
              </el-tag>
            </div>
          </div>

          <div
            v-if="failureReasonRows.length"
            ref="failureReasonChartRef"
            class="chart-panel"
          />
          <div
            v-else
            class="chart-empty"
          >
            {{ $t('monitor:messages.noFailuresRecorded') }}
          </div>

          <div class="table-title">{{ $t('monitor:messages.detailedData') }}</div>
          <el-table
            :data="displayedFailureReasonRows"
            :empty-text="$t('monitor:messages.noFailuresRecorded')"
            max-height="260"
            :row-class-name="getFailureReasonRowClassName"
            @row-click="handleFailureReasonRowClick"
          >
            <el-table-column
              :label="$t('common:failureReason')"
              prop="reason"
              min-width="180"
            >
              <template slot-scope="scope">
                <el-tag
                  :type="getFailureTagType(scope.row.reason)"
                  effect="plain"
                >
                  {{ scope.row.reason }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('monitor:messages.count')"
              prop="count"
              width="100"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:messages.share')"
              width="120"
              align="center"
            >
              <template slot-scope="scope">
                {{ formatPercent(scope.row.count, totalFailureReasonCount) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col
        :xs="24"
        :lg="14"
      >
        <el-card shadow="never">
          <div
            slot="header"
            class="card-header"
          >
            <span>{{ $t('monitor:messages.keyVersionStatistics') }}</span>
            <div class="card-actions compact-actions">
              <span class="card-subtitle">{{ $t('monitor:messages.monitorEachKeyIDKid') }}</span>
              <el-tag
                v-if="selectedKid"
                type="success"
                effect="plain"
                closable
                @close="clearKidSelection"
              >
                {{ selectedKid }}
              </el-tag>
            </div>
          </div>

          <div
            v-if="kidStatRows.length"
            ref="kidStatsChartRef"
            class="chart-panel"
          />
          <div
            v-else
            class="chart-empty"
          >
            {{ $t('monitor:messages.noKeyStatisticsAvailable') }}
          </div>

          <div class="table-title">{{ $t('monitor:messages.detailedData') }}</div>
          <el-table
            :data="displayedKidStatRows"
            :empty-text="$t('layout:notices.noData')"
            max-height="260"
            :row-class-name="getKidStatRowClassName"
            @row-click="handleKidStatRowClick"
          >
            <el-table-column
              :label="$t('monitor:messages.keyVersion')"
              prop="kid"
              min-width="140"
            >
              <template slot-scope="scope">
                <el-tag :type="scope.row.kid === monitorData.currentKid ? 'success' : 'info'">
                  {{ scope.row.kid || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('monitor:messages.encryptedRequests')"
              prop="encryptedRequests"
              min-width="110"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:messages.decryptionSucceeded')"
              prop="decryptSuccess"
              min-width="110"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:messages.decryptionFailed')"
              prop="decryptFailure"
              min-width="110"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:messages.encryptedResponses')"
              prop="encryptedResponses"
              min-width="110"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:messages.successRate')"
              min-width="120"
              align="center"
            >
              <template slot-scope="scope">
                {{
                  formatRate(
                    scope.row.decryptSuccess,
                    scope.row.decryptSuccess + scope.row.decryptFailure
                  )
                }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <div
        slot="header"
        class="card-header"
      >
        <span>{{ $t('monitor:messages.recentFailures') }}</span>
        <div class="card-actions compact-actions">
          <span class="card-subtitle"
            >{{ $t('monitor:messages.recent') }} {{ displayedRecentFailures.length }}
            {{ $t('monitor:transportCrypto.records') }}</span
          >
          <el-tag
            v-if="selectedFailureReason || selectedKid"
            type="info"
            effect="plain"
          >
            {{ $t('monitor:messages.filteredByTheCurrentSelection') }}
          </el-tag>
        </div>
      </div>

      <el-table
        :data="displayedRecentFailures"
        :empty-text="$t('monitor:messages.noFailuresRecorded')"
      >
        <el-table-column
          :label="$t('monitor:messages.time')"
          min-width="170"
        >
          <template slot-scope="scope">
            {{ formatMonitorTime(scope.row.time) || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:messages.requestMethod')"
          prop="method"
          width="100"
          align="center"
        >
          <template slot-scope="scope">
            <el-tag effect="plain">{{ scope.row.method || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:messages.requestPath')"
          prop="path"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column
          :label="$t('common:failureReason')"
          prop="reason"
          min-width="180"
        >
          <template slot-scope="scope">
            <el-tag
              :type="getFailureTagType(scope.row.reason)"
              effect="plain"
            >
              {{ scope.row.reason || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:messages.keyVersion')"
          prop="kid"
          min-width="140"
        >
          <template slot-scope="scope">
            {{ scope.row.kid || '-' }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getTransportCryptoMonitor } from '@/api/monitor/transportCrypto'
import { parseTime } from '@/utils/ruoyi'
import * as echarts from 'echarts'

const MODE_LABEL_MAP = {
  get required() {
    return t('monitor:messages.encryptionRequired')
  },
  get optional() {
    return t('monitor:messages.optionalEncryption')
  },
  get off() {
    return t('layout:notices.closed')
  },
}

const MONITOR_SCOPE_LABEL_MAP = {
  get 'redis-aggregated'() {
    return t('monitor:messages.redisAggregation')
  },
  get 'redis-aggregated+local-fallback'() {
    return t('monitor:messages.redisAggregationLocalFallback')
  },
  get 'process-local-fallback'() {
    return t('monitor:messages.localFallback')
  },
}

function createDefaultMonitorData() {
  return {
    supportedKids: [],
    enabledPaths: [],
    requiredPaths: [],
    excludePaths: [],
    kidStats: [],
    recentFailures: [],
    failureReasons: {},
  }
}

export default {
  name: 'TransportCryptoMonitorVue2',
  data() {
    return {
      loading: false,
      autoRefresh: true,
      monitorData: createDefaultMonitorData(),
      refreshTimer: null,
      selectedFailureReason: '',
      selectedKid: '',
      failureReasonChartInstance: null,
      kidStatsChartInstance: null,
    }
  },
  computed: {
    modeLabel() {
      return (
        MODE_LABEL_MAP[this.monitorData.transportCryptoMode] || t('monitor:messages.notConfigured')
      )
    },
    monitorScopeLabel() {
      return (
        MONITOR_SCOPE_LABEL_MAP[this.monitorData.monitorScope] ||
        this.monitorData.monitorScope ||
        '-'
      )
    },
    monitorScopeDescription() {
      if (this.monitorData.monitorScope === 'redis-aggregated') {
        return t('monitor:messages.statisticsAreAggregatedInRedisAcrossWorkersAndInstances')
      }
      if (this.monitorData.monitorScope === 'redis-aggregated+local-fallback') {
        return t('monitor:messages.redisAggregationIsActiveButSomeWritesFellBackToLocalMemory')
      }
      if (this.monitorData.monitorScope === 'process-local-fallback') {
        return t('monitor:messages.monitoringDataIsNotBeingWrittenToRedisThisPageShowsLocal')
      }
      return t('monitor:messages.transportEncryptionStatusAndStatistics')
    },
    failureReasonRows() {
      const failureReasons = this.monitorData.failureReasons || {}
      return Object.keys(failureReasons)
        .map(function (key) {
          return {
            reason: key,
            count: failureReasons[key],
          }
        })
        .sort(function (a, b) {
          return b.count - a.count
        })
    },
    totalFailureReasonCount() {
      return this.failureReasonRows.reduce(function (total, item) {
        return total + Number(item.count || 0)
      }, 0)
    },
    displayedFailureReasonRows() {
      if (!this.selectedFailureReason) {
        return this.failureReasonRows
      }
      return this.failureReasonRows.filter((item) => item.reason === this.selectedFailureReason)
    },
    kidStatRows() {
      const currentKid = this.monitorData.currentKid
      return (this.monitorData.kidStats || []).slice().sort(function (a, b) {
        if (a.kid === currentKid && b.kid !== currentKid) {
          return -1
        }
        if (b.kid === currentKid && a.kid !== currentKid) {
          return 1
        }
        const aTotal =
          Number(a.encryptedRequests || 0) +
          Number(a.decryptSuccess || 0) +
          Number(a.decryptFailure || 0)
        const bTotal =
          Number(b.encryptedRequests || 0) +
          Number(b.decryptSuccess || 0) +
          Number(b.decryptFailure || 0)
        return bTotal - aTotal
      })
    },
    displayedKidStatRows() {
      if (!this.selectedKid) {
        return this.kidStatRows
      }
      return this.kidStatRows.filter((item) => item.kid === this.selectedKid)
    },
    displayedRecentFailures() {
      return (this.monitorData.recentFailures || []).filter((item) => {
        const matchesReason =
          !this.selectedFailureReason || item.reason === this.selectedFailureReason
        const matchesKid = !this.selectedKid || item.kid === this.selectedKid
        return matchesReason && matchesKid
      })
    },
    decryptSuccessRate() {
      return this.getRate(
        this.monitorData.decryptSuccessTotal,
        this.monitorData.decryptSuccessTotal + this.monitorData.decryptFailureTotal
      )
    },
    encryptedRequestRate() {
      return this.getRate(this.monitorData.encryptedRequestsTotal, this.monitorData.requestsTotal)
    },
    encryptedResponseRate() {
      return this.getRate(
        this.monitorData.encryptedResponsesTotal,
        this.monitorData.encryptedResponsesTotal + this.monitorData.plainResponsesTotal
      )
    },
    decryptRateTagType() {
      if (this.decryptSuccessRate >= 95) {
        return 'success'
      }
      if (this.decryptSuccessRate >= 80) {
        return 'warning'
      }
      return 'danger'
    },
    healthLabel() {
      if ((this.monitorData.decryptFailureTotal || 0) === 0) {
        return t('monitor:messages.stable')
      }
      if (this.decryptSuccessRate >= 95) {
        return t('authCenter:messages.good')
      }
      if (this.decryptSuccessRate >= 80) {
        return t('monitor:messages.attention')
      }
      return t('monitor:messages.alert')
    },
    healthTagType() {
      if ((this.monitorData.decryptFailureTotal || 0) === 0) {
        return 'success'
      }
      if (this.decryptSuccessRate >= 95) {
        return 'success'
      }
      if (this.decryptSuccessRate >= 80) {
        return 'warning'
      }
      return 'error'
    },
    healthTagLabelType() {
      return this.healthTagType === 'error' ? 'danger' : this.healthTagType
    },
    healthProgressStatus() {
      if (this.decryptSuccessRate >= 95) {
        return 'success'
      }
      if (this.decryptSuccessRate >= 80) {
        return 'warning'
      }
      return 'exception'
    },
    healthMessage() {
      if ((this.monitorData.decryptFailureTotal || 0) === 0) {
        return t('monitor:messages.noDecryptionFailuresHaveBeenRecordedTheConnectionIsStable')
      }
      if (this.decryptSuccessRate >= 95) {
        return t('monitor:messages.aFewFailuresHaveOccurredContinueMonitoringTheirCauses')
      }
      if (this.decryptSuccessRate >= 80) {
        return t(
          'monitor:messages.recentRequestsIncludeFailuresReviewFailureCausesAndRecentRecordsFirst'
        )
      }
      return t('monitor:messages.theFailureRateIsHighCheckKeyVersionsAADBindingTimeWindows')
    },
  },
  watch: {
    autoRefresh() {
      this.resetRefreshTimer()
    },
    selectedFailureReason() {
      this.$nextTick(() => {
        this.renderFailureReasonChart()
      })
    },
    selectedKid() {
      this.$nextTick(() => {
        this.renderKidStatsChart()
      })
    },
  },
  mounted() {
    this.loadMonitorData(true)
    this.resetRefreshTimer()
    window.addEventListener('resize', this.resizeCharts)
  },
  beforeDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    window.removeEventListener('resize', this.resizeCharts)
    this.destroyCharts()
  },
  methods: {
    formatMonitorTime(value, pattern = '{y}-{m}-{d} {h}:{i}:{s}') {
      return parseTime(value, pattern)
    },
    loadMonitorData(showLoading) {
      const needLoading = showLoading !== false
      if (needLoading) {
        this.loading = true
      }
      return getTransportCryptoMonitor()
        .then((response) => {
          this.monitorData = Object.assign(createDefaultMonitorData(), response.data || {})
          this.$nextTick(() => {
            this.renderFailureReasonChart()
            this.renderKidStatsChart()
          })
        })
        .catch(() => {
          this.$message.error(t('monitor:interface.failedToLoadTransportEncryptionMonitoringData'))
        })
        .finally(() => {
          if (needLoading) {
            this.loading = false
          }
        })
    },
    resetRefreshTimer() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer)
        this.refreshTimer = null
      }
      if (this.autoRefresh) {
        this.refreshTimer = setInterval(() => {
          this.loadMonitorData(false)
        }, 15000)
      }
    },
    formatCount(value) {
      return Number(value || 0)
    },
    formatPercent(value, total) {
      if (!total) {
        return '0.0%'
      }
      return ((Number(value || 0) / total) * 100).toFixed(1) + '%'
    },
    formatRate(success, total) {
      return this.getRate(success, total).toFixed(1) + '%'
    },
    getRate(numerator, denominator) {
      if (!denominator) {
        return 0
      }
      return (Number(numerator || 0) / Number(denominator || 0)) * 100
    },
    getFailureTagType(reason) {
      const warningReasons = ['timestamp_expired', 'required_missing']
      const dangerReasons = ['decrypt_failed', 'aad_mismatch', 'replay_detected', 'kid_mismatch']

      if (dangerReasons.indexOf(reason) !== -1) {
        return 'danger'
      }
      if (warningReasons.indexOf(reason) !== -1) {
        return 'warning'
      }
      return 'info'
    },
    getFailureChartColor(reason) {
      const tagType = this.getFailureTagType(reason)
      if (tagType === 'danger') {
        return '#f56c6c'
      }
      if (tagType === 'warning') {
        return '#e6a23c'
      }
      return '#409eff'
    },
    buildKidChartBarData(item, value, color) {
      const isSelected = !this.selectedKid || this.selectedKid === item.kid
      return {
        value: Number(value || 0),
        itemStyle: {
          color: color,
          opacity: isSelected ? 1 : 0.3,
        },
      }
    },
    bindFailureReasonChartEvents(chartInstance) {
      chartInstance.off('click')
      chartInstance.on('click', (params) => {
        const targetReason =
          this.failureReasonRows[params.dataIndex] &&
          this.failureReasonRows[params.dataIndex].reason
        if (!targetReason) {
          return
        }
        this.selectedFailureReason = this.selectedFailureReason === targetReason ? '' : targetReason
      })
    },
    bindKidStatsChartEvents(chartInstance) {
      chartInstance.off('click')
      chartInstance.on('click', (params) => {
        const targetKid =
          this.kidStatRows[params.dataIndex] && this.kidStatRows[params.dataIndex].kid
        if (!targetKid) {
          return
        }
        this.selectedKid = this.selectedKid === targetKid ? '' : targetKid
      })
    },
    initFailureReasonChart() {
      if (!this.$refs.failureReasonChartRef) {
        if (this.failureReasonChartInstance) {
          this.failureReasonChartInstance.dispose()
          this.failureReasonChartInstance = null
        }
        return null
      }
      if (!this.failureReasonChartInstance) {
        this.failureReasonChartInstance = echarts.init(this.$refs.failureReasonChartRef)
        this.bindFailureReasonChartEvents(this.failureReasonChartInstance)
      }
      return this.failureReasonChartInstance
    },
    initKidStatsChart() {
      if (!this.$refs.kidStatsChartRef) {
        if (this.kidStatsChartInstance) {
          this.kidStatsChartInstance.dispose()
          this.kidStatsChartInstance = null
        }
        return null
      }
      if (!this.kidStatsChartInstance) {
        this.kidStatsChartInstance = echarts.init(this.$refs.kidStatsChartRef)
        this.bindKidStatsChartEvents(this.kidStatsChartInstance)
      }
      return this.kidStatsChartInstance
    },
    renderFailureReasonChart() {
      if (!this.failureReasonRows.length) {
        if (this.failureReasonChartInstance) {
          this.failureReasonChartInstance.dispose()
          this.failureReasonChartInstance = null
        }
        return
      }
      const chartInstance = this.initFailureReasonChart()
      if (!chartInstance) {
        return
      }
      chartInstance.setOption({
        animationDuration: 400,
        color: this.failureReasonRows.map((item) => this.getFailureChartColor(item.reason)),
        grid: {
          top: 16,
          left: 120,
          right: 24,
          bottom: 16,
          containLabel: true,
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
          formatter: (params) => {
            const currentItem = params && params[0]
            if (!currentItem) {
              return ''
            }
            const currentRow = this.failureReasonRows[currentItem.dataIndex]
            return t('monitor:confirmation.valueBrCountValueBrShareValue', {
              value0: currentRow.reason,
              value1: currentRow.count,
              value2: this.formatPercent(currentRow.count, this.totalFailureReasonCount),
            })
          },
        },
        xAxis: {
          type: 'value',
          splitLine: {
            lineStyle: {
              type: 'dashed',
            },
          },
        },
        yAxis: {
          type: 'category',
          data: this.failureReasonRows.map((item) => item.reason),
          axisTick: {
            show: false,
          },
        },
        series: [
          {
            name: t('monitor:messages.failureCount'),
            type: 'bar',
            barMaxWidth: 22,
            data: this.failureReasonRows.map((item) => ({
              value: Number(item.count || 0),
              itemStyle: {
                color: this.getFailureChartColor(item.reason),
                opacity:
                  !this.selectedFailureReason || this.selectedFailureReason === item.reason
                    ? 1
                    : 0.35,
                borderRadius: [0, 6, 6, 0],
              },
            })),
            label: {
              show: true,
              position: 'right',
            },
          },
        ],
      })
    },
    renderKidStatsChart() {
      if (!this.kidStatRows.length) {
        if (this.kidStatsChartInstance) {
          this.kidStatsChartInstance.dispose()
          this.kidStatsChartInstance = null
        }
        return
      }
      const chartInstance = this.initKidStatsChart()
      if (!chartInstance) {
        return
      }
      chartInstance.setOption({
        animationDuration: 400,
        color: ['#409eff', '#67c23a', '#f56c6c', '#909399'],
        legend: {
          top: 0,
        },
        grid: {
          top: 48,
          left: 24,
          right: 24,
          bottom: 32,
          containLabel: true,
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
        },
        xAxis: {
          type: 'category',
          axisLabel: {
            interval: 0,
            rotate: this.kidStatRows.length > 4 ? 20 : 0,
          },
          data: this.kidStatRows.map((item) => item.kid || '-'),
        },
        yAxis: {
          type: 'value',
          splitLine: {
            lineStyle: {
              type: 'dashed',
            },
          },
        },
        series: [
          {
            name: t('monitor:messages.encryptedRequests'),
            type: 'bar',
            barMaxWidth: 18,
            data: this.kidStatRows.map((item) =>
              this.buildKidChartBarData(item, item.encryptedRequests, '#409eff')
            ),
          },
          {
            name: t('monitor:messages.decryptionSucceeded'),
            type: 'bar',
            barMaxWidth: 18,
            data: this.kidStatRows.map((item) =>
              this.buildKidChartBarData(item, item.decryptSuccess, '#67c23a')
            ),
          },
          {
            name: t('monitor:messages.decryptionFailed'),
            type: 'bar',
            barMaxWidth: 18,
            data: this.kidStatRows.map((item) =>
              this.buildKidChartBarData(item, item.decryptFailure, '#f56c6c')
            ),
          },
          {
            name: t('monitor:messages.encryptedResponses'),
            type: 'bar',
            barMaxWidth: 18,
            data: this.kidStatRows.map((item) =>
              this.buildKidChartBarData(item, item.encryptedResponses, '#909399')
            ),
          },
        ],
      })
    },
    resizeCharts() {
      if (this.failureReasonChartInstance) {
        this.failureReasonChartInstance.resize()
      }
      if (this.kidStatsChartInstance) {
        this.kidStatsChartInstance.resize()
      }
    },
    destroyCharts() {
      if (this.failureReasonChartInstance) {
        this.failureReasonChartInstance.dispose()
        this.failureReasonChartInstance = null
      }
      if (this.kidStatsChartInstance) {
        this.kidStatsChartInstance.dispose()
        this.kidStatsChartInstance = null
      }
    },
    clearFailureReasonSelection() {
      this.selectedFailureReason = ''
    },
    clearKidSelection() {
      this.selectedKid = ''
    },
    handleFailureReasonRowClick(row) {
      const targetReason = row && row.reason ? row.reason : ''
      this.selectedFailureReason = this.selectedFailureReason === targetReason ? '' : targetReason
    },
    handleKidStatRowClick(row) {
      const targetKid = row && row.kid ? row.kid : ''
      this.selectedKid = this.selectedKid === targetKid ? '' : targetKid
    },
    getFailureReasonRowClassName(params) {
      return this.selectedFailureReason && params.row.reason === this.selectedFailureReason
        ? 'selected-table-row'
        : ''
    },
    getKidStatRowClassName(params) {
      return this.selectedKid && params.row.kid === this.selectedKid ? 'selected-table-row' : ''
    },
  },
}
</script>

<style lang="scss" scoped>
.mb16 {
  margin-bottom: 16px;
}

.summary-card {
  height: 140px;
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.summary-title {
  color: #606266;
  font-size: 14px;
}

.summary-value {
  color: #303133;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
}

.summary-desc {
  margin-top: 10px;
  color: #909399;
  font-size: 13px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.header-switch-label {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #d9ecff;
  border-radius: 999px;
  color: #409eff;
  font-size: 12px;
  line-height: 1;
  background: #ecf5ff;
  white-space: nowrap;
}

.compact-actions {
  justify-content: flex-end;
}

.card-subtitle {
  color: #909399;
  font-size: 12px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  margin: 0;
}

.health-card {
  height: 100%;
}

.health-item {
  margin-bottom: 18px;
}

.health-item:last-of-type {
  margin-bottom: 24px;
}

.health-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #606266;
  font-size: 13px;
}

.chart-panel {
  width: 100%;
  height: 300px;
  margin-bottom: 16px;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  margin-bottom: 16px;
  color: #909399;
  font-size: 13px;
  background: #fafafa;
  border: 1px dashed #ebeef5;
  border-radius: 4px;
}

.table-title {
  margin-bottom: 12px;
  color: #909399;
  font-size: 12px;
  font-weight: 500;
}

::v-deep .selected-table-row {
  background: #ecf5ff !important;
}

@media (max-width: 992px) {
  .summary-card {
    height: auto;
  }
}

@media (max-width: 768px) {
  .card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .card-actions {
    width: 100%;
    justify-content: space-between;
  }

  .compact-actions {
    justify-content: space-between;
  }

  .chart-panel {
    height: 260px;
  }
}
</style>
