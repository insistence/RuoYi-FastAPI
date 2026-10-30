<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col
        :span="12"
        class="card-box"
      >
        <el-card>
          <div slot="header">
            <span><i class="el-icon-cpu"></i> CPU</span>
          </div>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <thead>
                <tr>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.property') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.value') }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.cPUCores') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.cpu"
                    >
                      {{ server.cpu.cpuNum }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.userCPUUsage') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.cpu"
                    >
                      {{ server.cpu.used }}%
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.systemCPUUsage') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.cpu"
                    >
                      {{ server.cpu.sys }}%
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.idleCPU') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.cpu"
                    >
                      {{ server.cpu.free }}%
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
            <span><i class="el-icon-tickets"></i> {{ $t('monitor:messages.memory') }}</span>
          </div>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <thead>
                <tr>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.property') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.memory') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf"><div class="cell">Python</div></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.totalMemory') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.mem"
                    >
                      {{ server.mem.total }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.py"
                    >
                      {{ server.py.total }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.usedMemory') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.mem"
                    >
                      {{ server.mem.used }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.py"
                    >
                      {{ server.py.used }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.availableMemory') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.mem"
                    >
                      {{ server.mem.free }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.py"
                    >
                      {{ server.py.free }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.usage') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.mem"
                      :class="{ 'text-danger': server.mem.usage > 80 }"
                    >
                      {{ server.mem.usage }}%
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.py"
                      :class="{ 'text-danger': server.py.usage > 80 }"
                    >
                      {{ server.py.usage }}%
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col
        :span="24"
        class="card-box"
      >
        <el-card>
          <div slot="header">
            <span
              ><i class="el-icon-monitor"></i> {{ $t('monitor:messages.serverInformation') }}</span
            >
          </div>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.serverName') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.sys"
                    >
                      {{ server.sys.computerName }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:server.os') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.sys"
                    >
                      {{ server.sys.osName }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.serverIP') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.sys"
                    >
                      {{ server.sys.computerIp }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.systemArchitecture') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.sys"
                    >
                      {{ server.sys.osArch }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col
        :span="24"
        class="card-box"
      >
        <el-card>
          <div slot="header">
            <span
              ><i class="el-icon-coffee-cup"></i>
              {{ $t('monitor:messages.pythonInterpreter') }}</span
            >
          </div>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%; table-layout: fixed"
            >
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.pythonName') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.py"
                    >
                      {{ server.py.name }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.pythonVersion') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.py"
                    >
                      {{ server.py.version }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.startedAt') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.py"
                    >
                      {{ parseTime(server.py.startTime) }}
                    </div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.uptime') }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      v-if="server.py"
                    >
                      {{ server.py.runTime }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td
                    colspan="1"
                    class="el-table__cell is-leaf"
                  >
                    <div class="cell">{{ $t('monitor:messages.installationPath') }}</div>
                  </td>
                  <td
                    colspan="3"
                    class="el-table__cell is-leaf"
                  >
                    <div
                      class="cell"
                      v-if="server.py"
                    >
                      {{ server.py.home }}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td
                    colspan="1"
                    class="el-table__cell is-leaf"
                  >
                    <div class="cell">{{ $t('monitor:messages.projectPath') }}</div>
                  </td>
                  <td
                    colspan="3"
                    class="el-table__cell is-leaf"
                  >
                    <div
                      class="cell"
                      v-if="server.sys"
                    >
                      {{ server.sys.userDir }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col
        :span="24"
        class="card-box"
      >
        <el-card>
          <div slot="header">
            <span><i class="el-icon-receiving"></i> {{ $t('monitor:messages.diskStatus') }}</span>
          </div>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <thead>
                <tr>
                  <th class="el-table__cell el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.mountPath') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.fileSystem') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.volumeName') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.totalSize') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.availableSpace') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.usedSpace') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:messages.usedPercentage') }}</div>
                  </th>
                </tr>
              </thead>
              <tbody v-if="server.sysFiles">
                <tr
                  v-for="(sysFile, index) in server.sysFiles"
                  :key="index"
                >
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ sysFile.dirName }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ sysFile.sysTypeName }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ sysFile.typeName }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ sysFile.total }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ sysFile.free }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ sysFile.used }}</div>
                  </td>
                  <td class="el-table__cell is-leaf">
                    <div
                      class="cell"
                      :class="{ 'text-danger': sysFile.usage > 80 }"
                    >
                      {{ sysFile.usage }}%
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getServer } from '@/api/monitor/server'

export default {
  name: 'Server',
  data() {
    return {
      // 服务器信息
      server: [],
    }
  },
  created() {
    this.getList()
    this.openLoading()
  },
  methods: {
    /** 查询服务器信息 */
    getList() {
      getServer().then((response) => {
        this.server = response.data
        this.$modal.closeLoading()
      })
    },
    // 打开加载层
    openLoading() {
      this.$modal.loading(t('monitor:messages.loadingServerMonitoringDataPleaseWait'))
    },
  },
}
</script>
