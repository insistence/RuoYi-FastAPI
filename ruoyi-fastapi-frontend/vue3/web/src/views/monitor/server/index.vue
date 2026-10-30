<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col
        :span="12"
        class="card-box"
      >
        <el-card>
          <template #header
            ><Cpu style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">CPU</span></template
          >
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <thead>
                <tr>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:property') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:value') }}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:cPUCores') }}</div>
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
                    <div class="cell">{{ $t('monitor:userCPUUsage') }}</div>
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
                    <div class="cell">{{ $t('monitor:systemCPUUsage') }}</div>
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
                    <div class="cell">{{ $t('monitor:idleCPU') }}</div>
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
          <template #header
            ><Tickets style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{ $t('monitor:memory') }}</span></template
          >
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <thead>
                <tr>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:property') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:memory') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf"><div class="cell">Python</div></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:totalMemory') }}</div>
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
                    <div class="cell">{{ $t('monitor:usedMemoryLabel') }}</div>
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
                    <div class="cell">{{ $t('monitor:availableMemory') }}</div>
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
                    <div class="cell">{{ $t('monitor:usage') }}</div>
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
          <template #header
            ><Monitor style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{
              $t('monitor:serverInformation')
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
                    <div class="cell">{{ $t('monitor:serverName') }}</div>
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
                    <div class="cell">{{ $t('monitor:operatingSystem') }}</div>
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
                    <div class="cell">{{ $t('monitor:serverIP') }}</div>
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
                    <div class="cell">{{ $t('monitor:systemArchitecture') }}</div>
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
          <template #header
            ><CoffeeCup style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{
              $t('monitor:pythonInterpreter')
            }}</span></template
          >
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%; table-layout: fixed"
            >
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:pythonName') }}</div>
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
                    <div class="cell">{{ $t('monitor:pythonVersion') }}</div>
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
                    <div class="cell">{{ $t('monitor:startedAt') }}</div>
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
                    <div class="cell">{{ $t('monitor:uptime') }}</div>
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
                    <div class="cell">{{ $t('monitor:installationPath') }}</div>
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
                    <div class="cell">{{ $t('monitor:projectPath') }}</div>
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
          <template #header
            ><MessageBox style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{ $t('monitor:diskStatus') }}</span></template
          >
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table
              cellspacing="0"
              style="width: 100%"
            >
              <thead>
                <tr>
                  <th class="el-table__cell el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:mountPath') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:fileSystem') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:volumeName') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:totalSize') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:availableSpace') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:usedSpace') }}</div>
                  </th>
                  <th class="el-table__cell is-leaf">
                    <div class="cell">{{ $t('monitor:usedPercentage') }}</div>
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

<script setup>
import { t } from '@/i18n/adapter'
import { getServer } from '@/api/monitor/server'

const server = ref([])
const { proxy } = getCurrentInstance()

function getList() {
  proxy.$modal.loading(t('monitor:loadingServerMonitoringDataPleaseWait'))
  getServer().then((response) => {
    server.value = response.data
    proxy.$modal.closeLoading()
  })
}

getList()
</script>
