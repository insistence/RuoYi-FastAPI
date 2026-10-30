<template>
  <div class="app-container">
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
            <span class="summary-title">{{ $t('monitor:transportEncryptionStatus') }}</span>
            <el-tag :type="monitorData.transportCryptoEnabled ? 'success' : 'info'">
              {{
                monitorData.transportCryptoEnabled
                  ? $t('monitor:enabled')
                  : $t('plugins:notEnabled')
              }}
            </el-tag>
          </div>
          <div class="summary-value">{{ modeLabel }}</div>
          <div class="summary-desc">
            {{ $t('monitor:currentMode') }}{{ monitorData.transportCryptoMode || '-' }}
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
            <span class="summary-title">{{ $t('monitor:requestOverview') }}</span>
            <el-tag type="primary">{{ $t('monitor:matchingRules') }}</el-tag>
          </div>
          <div class="summary-value">{{ formatCount(monitorData.requestsTotal) }}</div>
          <div class="summary-desc">
            {{ $t('monitor:plaintext') }}{{ formatCount(monitorData.plainRequestsTotal) }}
            {{ $t('monitor:encrypted') }}{{ formatCount(monitorData.encryptedRequestsTotal) }}
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
            <span class="summary-title">{{ $t('monitor:decryptionSuccessRate') }}</span>
            <el-tag
              :type="
                decryptSuccessRate >= 95
                  ? 'success'
                  : decryptSuccessRate >= 80
                    ? 'warning'
                    : 'danger'
              "
            >
              {{ decryptSuccessRate.toFixed(1) }}%
            </el-tag>
          </div>
          <div class="summary-value">{{ formatCount(monitorData.decryptSuccessTotal) }}</div>
          <div class="summary-desc">
            {{ $t('monitor:failed') }}{{ formatCount(monitorData.decryptFailureTotal) }}
            {{ $t('monitor:rejectedByPolicy') }}{{ formatCount(monitorData.requiredRejectedTotal) }}
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
            <span class="summary-title">{{ $t('monitor:responseEncryption') }}</span>
            <el-tag type="warning">{{ $t('monitor:jSONResponses') }}</el-tag>
          </div>
          <div class="summary-value">{{ formatCount(monitorData.encryptedResponsesTotal) }}</div>
          <div class="summary-desc">
            {{ $t('monitor:plaintext') }}{{ formatCount(monitorData.plainResponsesTotal) }}
            {{ $t('monitor:encryptedErrors')
            }}{{ formatCount(monitorData.encryptedErrorResponsesTotal) }}
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
          <template #header>
            <div class="card-header">
              <span>{{ $t('monitor:currentConfiguration') }}</span>
              <div class="card-actions">
                <el-switch
                  v-model="autoRefresh"
                  inline-prompt
                  :active-text="$t('monitor:autoRefresh')"
                  :inactive-text="$t('monitor:manual')"
                />
                <el-button
                  type="primary"
                  icon="Refresh"
                  :loading="loading"
                  @click="loadMonitorData"
                >
                  {{ $t('layout:tags.refresh') }}</el-button
                >
              </div>
            </div>
          </template>

          <el-descriptions
            :column="2"
            border
          >
            <el-descriptions-item :label="$t('monitor:statisticsScope')">
              {{ monitorScopeLabel }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:appEnvironment')">
              {{ monitorData.appEnv || '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:currentKeyVersion')">
              <el-tag>{{ monitorData.currentKid || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:monitoringStartedAt')">
              {{ formatMonitorTime(monitorData.startedAt) || '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:supportedKeyVersions')">
              <div class="tag-list">
                <el-tag
                  v-for="kid in monitorData.supportedKids || []"
                  :key="kid"
                  class="tag-item"
                  effect="plain"
                >
                  {{ kid }}
                </el-tag>
                <span v-if="!(monitorData.supportedKids || []).length">-</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:failureCategories')">
              {{ failureReasonRows.length }}
            </el-descriptions-item>
            <el-descriptions-item
              :label="$t('monitor:aggregationInformation')"
              :span="2"
            >
              {{ monitorScopeDescription }}
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:enabledPaths')">
              <div class="tag-list">
                <el-tag
                  v-for="path in monitorData.enabledPaths || []"
                  :key="path"
                  type="success"
                  class="tag-item"
                  effect="plain"
                >
                  {{ path }}
                </el-tag>
                <span v-if="!(monitorData.enabledPaths || []).length">{{
                  $t('monitor:allAPIs')
                }}</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('monitor:encryptionRequiredPaths')">
              <div class="tag-list">
                <el-tag
                  v-for="path in monitorData.requiredPaths || []"
                  :key="path"
                  type="warning"
                  class="tag-item"
                  effect="plain"
                >
                  {{ path }}
                </el-tag>
                <span v-if="!(monitorData.requiredPaths || []).length">-</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item
              :label="$t('monitor:excludedPaths')"
              :span="2"
            >
              <div class="tag-list">
                <el-tag
                  v-for="path in monitorData.excludePaths || []"
                  :key="path"
                  type="info"
                  class="tag-item"
                  effect="plain"
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
          <template #header>
            <div class="card-header">
              <span>{{ $t('monitor:health') }}</span>
              <el-tag :type="healthTagLabelType">{{ healthLabel }}</el-tag>
            </div>
          </template>

          <div class="health-item">
            <div class="health-label">
              <span>{{ $t('monitor:decryptionSuccessRate') }}</span>
              <span>{{ decryptSuccessRate.toFixed(1) }}%</span>
            </div>
            <el-progress
              :percentage="Number(decryptSuccessRate.toFixed(1))"
              :status="healthProgressStatus"
            />
          </div>

          <div class="health-item">
            <div class="health-label">
              <span>{{ $t('monitor:encryptedRequestShare') }}</span>
              <span>{{ encryptedRequestRate.toFixed(1) }}%</span>
            </div>
            <el-progress
              :percentage="Number(encryptedRequestRate.toFixed(1))"
              status="success"
            />
          </div>

          <div class="health-item">
            <div class="health-label">
              <span>{{ $t('monitor:encryptedResponseShare') }}</span>
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
          <template #header>
            <div class="card-header">
              <span>{{ $t('monitor:failureCauses') }}</span>
              <div class="card-actions compact-actions">
                <span class="card-subtitle">{{ $t('monitor:statisticsAggregatedInRedis') }}</span>
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
          </template>

          <div
            v-if="failureReasonRows.length"
            ref="failureReasonChartRef"
            class="chart-panel"
          />
          <el-empty
            v-else
            :description="$t('monitor:noFailuresRecorded')"
            :image-size="88"
            class="chart-empty"
          />

          <div class="table-title">{{ $t('monitor:detailedData') }}</div>
          <el-table
            :data="displayedFailureReasonRows"
            :empty-text="$t('monitor:noFailuresRecorded')"
            max-height="260"
            :row-class-name="getFailureReasonRowClassName"
            @row-click="handleFailureReasonRowClick"
          >
            <el-table-column
              :label="$t('monitor:failureReason')"
              prop="reason"
              min-width="180"
            >
              <template #default="scope">
                <el-tag
                  :type="getFailureTagType(scope.row.reason)"
                  effect="plain"
                >
                  {{ scope.row.reason }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('monitor:count')"
              prop="count"
              width="100"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:share')"
              width="120"
              align="center"
            >
              <template #default="scope">
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
          <template #header>
            <div class="card-header">
              <span>{{ $t('monitor:keyVersionStatistics') }}</span>
              <div class="card-actions compact-actions">
                <span class="card-subtitle">{{ $t('monitor:monitorEachKeyIDKid') }}</span>
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
          </template>

          <div
            v-if="kidStatRows.length"
            ref="kidStatsChartRef"
            class="chart-panel"
          />
          <el-empty
            v-else
            :description="$t('monitor:noKeyStatisticsAvailable')"
            :image-size="88"
            class="chart-empty"
          />

          <div class="table-title">{{ $t('monitor:detailedData') }}</div>
          <el-table
            :data="displayedKidStatRows"
            :empty-text="$t('layout:notices.noData')"
            max-height="260"
            :row-class-name="getKidStatRowClassName"
            @row-click="handleKidStatRowClick"
          >
            <el-table-column
              :label="$t('monitor:keyVersion')"
              prop="kid"
              min-width="140"
            >
              <template #default="scope">
                <el-tag :type="scope.row.kid === monitorData.currentKid ? 'success' : 'info'">
                  {{ scope.row.kid || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="$t('monitor:encryptedRequests')"
              prop="encryptedRequests"
              min-width="110"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:decryptionSucceeded')"
              prop="decryptSuccess"
              min-width="110"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:decryptionFailed')"
              prop="decryptFailure"
              min-width="110"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:encryptedResponses')"
              prop="encryptedResponses"
              min-width="110"
              align="center"
            />
            <el-table-column
              :label="$t('monitor:successRate')"
              min-width="120"
              align="center"
            >
              <template #default="scope">
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
      <template #header>
        <div class="card-header">
          <span>{{ $t('monitor:recentFailures') }}</span>
          <div class="card-actions compact-actions">
            <span class="card-subtitle"
              >{{ $t('monitor:recent') }}{{ displayedRecentFailures.length }}
              {{ $t('monitor:records') }}</span
            >
            <el-tag
              v-if="selectedFailureReason || selectedKid"
              type="info"
              effect="plain"
            >
              {{ $t('monitor:filteredByTheCurrentSelection') }}</el-tag
            >
          </div>
        </div>
      </template>

      <el-table
        :data="displayedRecentFailures"
        :empty-text="$t('monitor:noFailuresRecorded')"
      >
        <el-table-column
          :label="$t('monitor:time')"
          min-width="170"
        >
          <template #default="scope">
            {{ formatMonitorTime(scope.row.time) || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:requestMethod')"
          prop="method"
          width="100"
          align="center"
        >
          <template #default="scope">
            <el-tag effect="plain">{{ scope.row.method || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:requestPath')"
          prop="path"
          min-width="260"
          :show-overflow-tooltip="true"
        />
        <el-table-column
          :label="$t('monitor:failureReason')"
          prop="reason"
          min-width="180"
        >
          <template #default="scope">
            <el-tag
              :type="getFailureTagType(scope.row.reason)"
              effect="plain"
            >
              {{ scope.row.reason || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:keyVersion')"
          prop="kid"
          min-width="140"
        >
          <template #default="scope">
            {{ scope.row.kid || '-' }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup name="TransportCryptoMonitor">
import { t, useI18n } from '@/i18n/adapter'
import { getTransportCryptoMonitor } from '@/api/monitor/transportCrypto'
import { parseTime } from '@/utils/ruoyi'
import * as echarts from 'echarts'

const { proxy } = getCurrentInstance()

const { locale } = useI18n()
const loading = ref(false)
const autoRefresh = ref(true)
const failureReasonChartRef = ref(null)
const kidStatsChartRef = ref(null)
const selectedFailureReason = ref('')
const selectedKid = ref('')
const monitorData = ref({
  supportedKids: [],
  enabledPaths: [],
  requiredPaths: [],
  excludePaths: [],
  kidStats: [],
  recentFailures: [],
  failureReasons: {},
})

let refreshTimer = null
let failureReasonChartInstance = null
let kidStatsChartInstance = null

const modeLabelMap = {
  get required() {
    return t('monitor:encryptionRequired')
  },
  get optional() {
    return t('monitor:optionalEncryption')
  },
  get off() {
    return t('layout:notices.closed')
  },
}

const monitorScopeLabelMap = {
  get 'redis-aggregated'() {
    return t('monitor:redisAggregation')
  },
  get 'redis-aggregated+local-fallback'() {
    return t('monitor:redisAggregationLocalFallback')
  },
  get 'process-local-fallback'() {
    return t('monitor:localFallback')
  },
}

const modeLabel = computed(
  () => modeLabelMap[monitorData.value.transportCryptoMode] || t('monitor:notConfigured')
)

const monitorScopeLabel = computed(
  () =>
    monitorScopeLabelMap[monitorData.value.monitorScope] || monitorData.value.monitorScope || '-'
)

const monitorScopeDescription = computed(() => {
  if (monitorData.value.monitorScope === 'redis-aggregated') {
    return t('monitor:statisticsAreAggregatedInRedisAcrossWorkersAndInstances')
  }
  if (monitorData.value.monitorScope === 'redis-aggregated+local-fallback') {
    return t('monitor:redisAggregationIsActiveButSomeWritesFellBackTo')
  }
  if (monitorData.value.monitorScope === 'process-local-fallback') {
    return t('monitor:monitoringDataIsNotBeingWrittenToRedisThisPage')
  }
  return t('monitor:transportEncryptionStatusAndStatistics')
})

const failureReasonRows = computed(() => {
  const failureReasons = monitorData.value.failureReasons || {}
  return Object.keys(failureReasons)
    .map((key) => ({
      reason: key,
      count: failureReasons[key],
    }))
    .sort((a, b) => b.count - a.count)
})

const totalFailureReasonCount = computed(() =>
  failureReasonRows.value.reduce((total, item) => total + Number(item.count || 0), 0)
)

const displayedFailureReasonRows = computed(() => {
  if (!selectedFailureReason.value) {
    return failureReasonRows.value
  }
  return failureReasonRows.value.filter((item) => item.reason === selectedFailureReason.value)
})

const kidStatRows = computed(() =>
  [...(monitorData.value.kidStats || [])].sort((a, b) => {
    const currentKid = monitorData.value.currentKid
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
)

const displayedKidStatRows = computed(() => {
  if (!selectedKid.value) {
    return kidStatRows.value
  }
  return kidStatRows.value.filter((item) => item.kid === selectedKid.value)
})

const displayedRecentFailures = computed(() => {
  return (monitorData.value.recentFailures || []).filter((item) => {
    const matchesReason =
      !selectedFailureReason.value || item.reason === selectedFailureReason.value
    const matchesKid = !selectedKid.value || item.kid === selectedKid.value
    return matchesReason && matchesKid
  })
})

const decryptSuccessRate = computed(() =>
  getRate(
    monitorData.value.decryptSuccessTotal,
    monitorData.value.decryptSuccessTotal + monitorData.value.decryptFailureTotal
  )
)

const encryptedRequestRate = computed(() =>
  getRate(monitorData.value.encryptedRequestsTotal, monitorData.value.requestsTotal)
)

const encryptedResponseRate = computed(() =>
  getRate(
    monitorData.value.encryptedResponsesTotal,
    monitorData.value.encryptedResponsesTotal + monitorData.value.plainResponsesTotal
  )
)

const healthLabel = computed(() => {
  if ((monitorData.value.decryptFailureTotal || 0) === 0) {
    return t('monitor:stable')
  }
  if (decryptSuccessRate.value >= 95) {
    return t('monitor:good')
  }
  if (decryptSuccessRate.value >= 80) {
    return t('monitor:attention')
  }
  return t('monitor:alert')
})

const healthTagType = computed(() => {
  if ((monitorData.value.decryptFailureTotal || 0) === 0) {
    return 'success'
  }
  if (decryptSuccessRate.value >= 95) {
    return 'success'
  }
  if (decryptSuccessRate.value >= 80) {
    return 'warning'
  }
  return 'error'
})

const healthTagLabelType = computed(() =>
  healthTagType.value === 'error' ? 'danger' : healthTagType.value
)

const healthProgressStatus = computed(() => {
  if (decryptSuccessRate.value >= 95) {
    return 'success'
  }
  if (decryptSuccessRate.value >= 80) {
    return 'warning'
  }
  return 'exception'
})

const healthMessage = computed(() => {
  if ((monitorData.value.decryptFailureTotal || 0) === 0) {
    return t('monitor:noDecryptionFailuresHaveBeenRecordedTheConnectionIsStable')
  }
  if (decryptSuccessRate.value >= 95) {
    return t('monitor:aFewFailuresHaveOccurredContinueMonitoringTheirCauses')
  }
  if (decryptSuccessRate.value >= 80) {
    return t('monitor:recentRequestsIncludeFailuresReviewFailureCausesAndRecentRecords')
  }
  return t('monitor:theFailureRateIsHighCheckKeyVersionsAADBinding')
})

function formatMonitorTime(value, pattern = '{y}-{m}-{d} {h}:{i}:{s}') {
  return parseTime(value, pattern)
}

function loadMonitorData(showLoading = true) {
  loading.value = true
  if (showLoading) {
    proxy.$modal.loading(t('monitor:loadingTransportEncryptionMonitoringDataPleaseWait'))
  }
  getTransportCryptoMonitor()
    .then((response) => {
      monitorData.value = {
        supportedKids: [],
        enabledPaths: [],
        requiredPaths: [],
        excludePaths: [],
        kidStats: [],
        recentFailures: [],
        failureReasons: {},
        ...response.data,
      }
      nextTick(() => {
        renderFailureReasonChart()
        renderKidStatsChart()
      })
    })
    .finally(() => {
      loading.value = false
      if (showLoading) {
        proxy.$modal.closeLoading()
      }
    })
}

function resetRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (autoRefresh.value) {
    refreshTimer = setInterval(() => {
      loadMonitorData(false)
    }, 15000)
  }
}

function formatCount(value) {
  return Number(value || 0)
}

function formatPercent(value, total) {
  if (!total) {
    return '0.0%'
  }
  return `${((Number(value || 0) / total) * 100).toFixed(1)}%`
}

function formatRate(success, total) {
  return `${getRate(success, total).toFixed(1)}%`
}

function getRate(numerator, denominator) {
  if (!denominator) {
    return 0
  }
  return (Number(numerator || 0) / Number(denominator || 0)) * 100
}

function getFailureTagType(reason) {
  const warningReasons = ['timestamp_expired', 'required_missing']
  const dangerReasons = ['decrypt_failed', 'aad_mismatch', 'replay_detected', 'kid_mismatch']

  if (dangerReasons.includes(reason)) {
    return 'danger'
  }
  if (warningReasons.includes(reason)) {
    return 'warning'
  }
  return 'info'
}

function getFailureChartColor(reason) {
  const tagType = getFailureTagType(reason)
  if (tagType === 'danger') {
    return '#f56c6c'
  }
  if (tagType === 'warning') {
    return '#e6a23c'
  }
  return '#409eff'
}

function buildKidChartBarData(item, value, color) {
  const isSelected = !selectedKid.value || selectedKid.value === item.kid
  return {
    value: Number(value || 0),
    itemStyle: {
      color,
      opacity: isSelected ? 1 : 0.3,
    },
  }
}

function bindFailureReasonChartEvents(chartInstance) {
  chartInstance.off('click')
  chartInstance.on('click', (params) => {
    const targetReason = failureReasonRows.value[params?.dataIndex]?.reason
    if (!targetReason) {
      return
    }
    selectedFailureReason.value = selectedFailureReason.value === targetReason ? '' : targetReason
  })
}

function bindKidStatsChartEvents(chartInstance) {
  chartInstance.off('click')
  chartInstance.on('click', (params) => {
    const targetKid = kidStatRows.value[params?.dataIndex]?.kid
    if (!targetKid) {
      return
    }
    selectedKid.value = selectedKid.value === targetKid ? '' : targetKid
  })
}

function initFailureReasonChart() {
  if (!failureReasonChartRef.value) {
    if (failureReasonChartInstance) {
      failureReasonChartInstance.dispose()
      failureReasonChartInstance = null
    }
    return null
  }
  if (!failureReasonChartInstance) {
    failureReasonChartInstance = echarts.init(failureReasonChartRef.value)
    bindFailureReasonChartEvents(failureReasonChartInstance)
  }
  return failureReasonChartInstance
}

function initKidStatsChart() {
  if (!kidStatsChartRef.value) {
    if (kidStatsChartInstance) {
      kidStatsChartInstance.dispose()
      kidStatsChartInstance = null
    }
    return null
  }
  if (!kidStatsChartInstance) {
    kidStatsChartInstance = echarts.init(kidStatsChartRef.value)
    bindKidStatsChartEvents(kidStatsChartInstance)
  }
  return kidStatsChartInstance
}

function renderFailureReasonChart() {
  if (!failureReasonRows.value.length) {
    if (failureReasonChartInstance) {
      failureReasonChartInstance.dispose()
      failureReasonChartInstance = null
    }
    return
  }
  const chartInstance = initFailureReasonChart()
  if (!chartInstance) {
    return
  }

  chartInstance.setOption({
    animationDuration: 400,
    color: failureReasonRows.value.map((item) => getFailureChartColor(item.reason)),
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
      formatter(params) {
        const currentItem = params?.[0]
        if (!currentItem) {
          return ''
        }
        const currentRow = failureReasonRows.value[currentItem.dataIndex]
        return t('monitor:valueBrCountValueBrShareValue', {
          reason: currentRow.reason,
          count: currentRow.count,
          arg2: formatPercent(currentRow.count, totalFailureReasonCount.value),
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
      data: failureReasonRows.value.map((item) => item.reason),
      axisTick: {
        show: false,
      },
    },
    series: [
      {
        get name() {
          return t('monitor:failureCount')
        },
        type: 'bar',
        barMaxWidth: 22,
        data: failureReasonRows.value.map((item) => ({
          value: Number(item.count || 0),
          itemStyle: {
            color: getFailureChartColor(item.reason),
            opacity:
              !selectedFailureReason.value || selectedFailureReason.value === item.reason
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
}

function renderKidStatsChart() {
  if (!kidStatRows.value.length) {
    if (kidStatsChartInstance) {
      kidStatsChartInstance.dispose()
      kidStatsChartInstance = null
    }
    return
  }
  const chartInstance = initKidStatsChart()
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
        rotate: kidStatRows.value.length > 4 ? 20 : 0,
      },
      data: kidStatRows.value.map((item) => item.kid || '-'),
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
        get name() {
          return t('monitor:encryptedRequests')
        },
        type: 'bar',
        barMaxWidth: 18,
        data: kidStatRows.value.map((item) =>
          buildKidChartBarData(item, item.encryptedRequests, '#409eff')
        ),
      },
      {
        get name() {
          return t('monitor:decryptionSucceeded')
        },
        type: 'bar',
        barMaxWidth: 18,
        data: kidStatRows.value.map((item) =>
          buildKidChartBarData(item, item.decryptSuccess, '#67c23a')
        ),
      },
      {
        get name() {
          return t('monitor:decryptionFailed')
        },
        type: 'bar',
        barMaxWidth: 18,
        data: kidStatRows.value.map((item) =>
          buildKidChartBarData(item, item.decryptFailure, '#f56c6c')
        ),
      },
      {
        get name() {
          return t('monitor:encryptedResponses')
        },
        type: 'bar',
        barMaxWidth: 18,
        data: kidStatRows.value.map((item) =>
          buildKidChartBarData(item, item.encryptedResponses, '#909399')
        ),
      },
    ],
  })
}

function resizeCharts() {
  failureReasonChartInstance?.resize()
  kidStatsChartInstance?.resize()
}

function destroyCharts() {
  if (failureReasonChartInstance) {
    failureReasonChartInstance.dispose()
    failureReasonChartInstance = null
  }
  if (kidStatsChartInstance) {
    kidStatsChartInstance.dispose()
    kidStatsChartInstance = null
  }
}

function clearFailureReasonSelection() {
  selectedFailureReason.value = ''
}

function clearKidSelection() {
  selectedKid.value = ''
}

function handleFailureReasonRowClick(row) {
  const targetReason = row?.reason || ''
  selectedFailureReason.value = selectedFailureReason.value === targetReason ? '' : targetReason
}

function handleKidStatRowClick(row) {
  const targetKid = row?.kid || ''
  selectedKid.value = selectedKid.value === targetKid ? '' : targetKid
}

function getFailureReasonRowClassName({ row }) {
  return selectedFailureReason.value && row.reason === selectedFailureReason.value
    ? 'selected-table-row'
    : ''
}

function getKidStatRowClassName({ row }) {
  return selectedKid.value && row.kid === selectedKid.value ? 'selected-table-row' : ''
}

watch(autoRefresh, () => {
  resetRefreshTimer()
})

watch(selectedFailureReason, () => {
  nextTick(() => {
    renderFailureReasonChart()
  })
})

watch(selectedKid, () => {
  nextTick(() => {
    renderKidStatsChart()
  })
})

watch(
  locale,
  () => {
    renderFailureReasonChart()
    renderKidStatsChart()
  },
  { flush: 'post' }
)

onMounted(() => {
  loadMonitorData()
  resetRefreshTimer()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  window.removeEventListener('resize', resizeCharts)
  destroyCharts()
})
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
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.summary-value {
  color: var(--el-text-color-primary);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
}

.summary-desc {
  margin-top: 10px;
  color: var(--el-text-color-secondary);
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

.compact-actions {
  justify-content: flex-end;
}

.card-subtitle {
  color: var(--el-text-color-secondary);
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
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.chart-panel {
  width: 100%;
  height: 300px;
  margin-bottom: 16px;
}

.chart-empty {
  padding: 16px 0 8px;
}

.table-title {
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 500;
}

:deep(.selected-table-row) {
  --el-table-tr-bg-color: var(--el-color-primary-light-9);
}

@media (max-width: 768px) {
  .summary-card {
    height: auto;
  }

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
