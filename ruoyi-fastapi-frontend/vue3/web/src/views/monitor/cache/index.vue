<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col
        :span="24"
        class="card-box"
      >
        <el-card>
          <template #header
            ><Monitor style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{
              $t('system:basicInformation')
            }}</span></template
          >
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:redisVersion') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.redis_version }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:runMode') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{
                        cache.info.redis_mode == 'standalone'
                          ? $t('monitor:standalone')
                          : $t('monitor:cluster')
                      }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:port') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.tcp_port }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:clients') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.connected_clients }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:uptimeDays') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.uptime_in_days }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:usedMemory') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.used_memory_human }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:cPUUsage') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ parseFloat(cache.info.used_cpu_user_children).toFixed(2) }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:memoryConfiguration') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.maxmemory_human }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:aOFEnabled') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.aof_enabled == '0' ? $t('system:no') : $t('system:yes') }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:rDBSuccessful') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.rdb_last_bgsave_status }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:keyCount') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.dbSize"
                    >
                      {{ cache.dbSize }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:networkInOut') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.instantaneous_input_kbps }}kps/{{
                        cache.info.instantaneous_output_kbps
                      }}kps
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col
        :span="12"
        class="card-box"
      >
        <el-card>
          <template #header
            ><PieChart style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{
              $t('monitor:commandStatistics')
            }}</span></template
          >
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <div
              ref="commandstats"
              style="height: 420px"
            />
          </div>
        </el-card>
      </el-col>

      <el-col
        :span="12"
        class="card-box"
      >
        <el-card>
          <template #header
            ><Odometer style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{
              $t('monitor:memoryInformation')
            }}</span></template
          >
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <div
              ref="usedmemory"
              style="height: 420px"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Cache">
import { t, useI18n } from '@/i18n/adapter'
import { getCache } from '@/api/monitor/cache'
import * as echarts from 'echarts'

const { locale } = useI18n()
const cache = ref([])
const commandstats = ref(null)
const usedmemory = ref(null)
const { proxy } = getCurrentInstance()

function getList() {
  proxy.$modal.loading(t('monitor:loadingCacheMonitoringDataPleaseWait'))
  getCache().then((response) => {
    proxy.$modal.closeLoading()
    cache.value = response.data

    renderCharts()
  })
}

function renderCharts() {
  if (!cache.value.info || !commandstats.value || !usedmemory.value) return
  const commandstatsIntance =
    echarts.getInstanceByDom(commandstats.value) || echarts.init(commandstats.value, 'macarons')
  commandstatsIntance.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b} : {c} ({d}%)',
    },
    series: [
      {
        get name() {
          return t('monitor:command')
        },
        type: 'pie',
        roseType: 'radius',
        radius: [15, 95],
        center: ['50%', '38%'],
        data: cache.value.commandStats,
        animationEasing: 'cubicInOut',
        animationDuration: 1000,
      },
    ],
  })
  const usedmemoryInstance =
    echarts.getInstanceByDom(usedmemory.value) || echarts.init(usedmemory.value, 'macarons')
  usedmemoryInstance.setOption({
    tooltip: {
      formatter: '{b} <br/>{a} : ' + cache.value.info.used_memory_human,
    },
    series: [
      {
        get name() {
          return t('monitor:peak')
        },
        type: 'gauge',
        min: 0,
        max: 1000,
        detail: {
          formatter: cache.value.info.used_memory_human,
        },
        data: [
          {
            value: parseFloat(cache.value.info.used_memory_human),
            get name() {
              return t('monitor:memoryUsage')
            },
          },
        ],
      },
    ],
  })
}

function resizeCharts() {
  if (commandstats.value) echarts.getInstanceByDom(commandstats.value)?.resize()
  if (usedmemory.value) echarts.getInstanceByDom(usedmemory.value)?.resize()
}

watch(locale, renderCharts, { flush: 'post' })
onMounted(() => window.addEventListener('resize', resizeCharts))
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  if (commandstats.value) echarts.getInstanceByDom(commandstats.value)?.dispose()
  if (usedmemory.value) echarts.getInstanceByDom(usedmemory.value)?.dispose()
})

getList()
</script>
