<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col
        :span="24"
        class="card-box"
      >
        <el-card>
          <div slot="header">
            <span><i class="el-icon-monitor"></i> {{ $t('common:basicInfo') }}</span>
          </div>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.redisVersion') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.runMode') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{
                        cache.info.redis_mode == 'standalone'
                          ? $t('monitor:expression.standalone')
                          : $t('monitor:expression.cluster')
                      }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.port') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.clients') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.uptimeDays') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.usedMemory') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.cPUUsage') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.memoryConfiguration') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.aOFEnabled') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="cache.info"
                    >
                      {{ cache.info.aof_enabled == '0' ? $t('common:no') : $t('common:yes') }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.rDBSuccessful') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.keyCount') }}</div>
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
                    <div class="cell">{{ $t('monitor:messages.networkInOut') }}</div>
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
          <div slot="header">
            <span
              ><i class="el-icon-pie-chart"></i>
              {{ $t('monitor:messages.commandStatistics') }}</span
            >
          </div>
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
          <div slot="header">
            <span
              ><i class="el-icon-odometer"></i> {{ $t('monitor:messages.memoryInformation') }}</span
            >
          </div>
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

<script>
import { t } from '@/i18n/adapter'

import { getCache } from '@/api/monitor/cache'
import * as echarts from 'echarts'

export default {
  name: 'Cache',
  data() {
    return {
      // 统计命令信息
      commandstats: null,
      // 使用内存
      usedmemory: null,
      // cache信息
      cache: [],
    }
  },
  created() {
    this.getList()
    this.openLoading()
  },
  methods: {
    /** 查缓存询信息 */
    getList() {
      getCache().then((response) => {
        this.cache = response.data
        this.$modal.closeLoading()

        this.commandstats = echarts.init(this.$refs.commandstats, 'macarons')
        this.commandstats.setOption({
          tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b} : {c} ({d}%)',
          },
          series: [
            {
              name: t('monitor:messages.command'),
              type: 'pie',
              roseType: 'radius',
              radius: [15, 95],
              center: ['50%', '38%'],
              data: response.data.commandStats,
              animationEasing: 'cubicInOut',
              animationDuration: 1000,
            },
          ],
        })
        this.usedmemory = echarts.init(this.$refs.usedmemory, 'macarons')
        this.usedmemory.setOption({
          tooltip: {
            formatter: '{b} <br/>{a} : ' + this.cache.info.used_memory_human,
          },
          series: [
            {
              name: t('monitor:messages.peak'),
              type: 'gauge',
              min: 0,
              max: 1000,
              detail: {
                formatter: this.cache.info.used_memory_human,
              },
              data: [
                {
                  value: parseFloat(this.cache.info.used_memory_human),
                  name: t('monitor:messages.memoryUsage'),
                },
              ],
            },
          ],
        })
        window.addEventListener('resize', () => {
          this.commandstats.resize()
          this.usedmemory.resize()
        })
      })
    },
    // 打开加载层
    openLoading() {
      this.$modal.loading(t('monitor:messages.loadingCacheMonitoringDataPleaseWait'))
    },
  },
}
</script>
