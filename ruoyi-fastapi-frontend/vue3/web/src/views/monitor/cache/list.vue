<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :span="8">
        <el-card style="height: calc(100vh - 125px)">
          <template #header>
            <Collection style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{ $t('monitor:cacheList') }}</span>
            <el-button
              style="float: right; padding: 3px 0"
              link
              type="primary"
              icon="Refresh"
              @click="refreshCacheNames()"
            ></el-button>
          </template>
          <el-table
            v-loading="loading"
            :data="cacheNames"
            :height="tableHeight"
            highlight-current-row
            @row-click="getCacheKeys"
            style="width: 100%"
          >
            <el-table-column
              :label="$t('system:noLabel')"
              width="60"
              type="index"
            ></el-table-column>

            <el-table-column
              :label="$t('monitor:cacheName')"
              align="center"
              prop="cacheName"
              :show-overflow-tooltip="true"
              :formatter="nameFormatter"
            ></el-table-column>

            <el-table-column
              :label="$t('system:remarks')"
              align="center"
              prop="remark"
              :show-overflow-tooltip="true"
            />
            <el-table-column
              :label="$t('system:actions')"
              width="60"
              align="center"
              class-name="small-padding fixed-width"
            >
              <template #default="scope">
                <el-button
                  link
                  type="primary"
                  icon="Delete"
                  @click="handleClearCacheName(scope.row)"
                ></el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card style="height: calc(100vh - 125px)">
          <template #header>
            <Key style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{ $t('monitor:keyList') }}</span>
            <el-button
              style="float: right; padding: 3px 0"
              link
              type="primary"
              icon="Refresh"
              @click="refreshCacheKeys()"
            ></el-button>
          </template>
          <el-table
            v-loading="subLoading"
            :data="cacheKeys"
            :height="tableHeight"
            highlight-current-row
            @row-click="handleCacheValue"
            style="width: 100%"
          >
            <el-table-column
              :label="$t('system:noLabel')"
              width="60"
              type="index"
            ></el-table-column>
            <el-table-column
              :label="$t('monitor:cacheKey')"
              align="center"
              :show-overflow-tooltip="true"
              :formatter="keyFormatter"
            >
            </el-table-column>
            <el-table-column
              :label="$t('system:actions')"
              width="60"
              align="center"
              class-name="small-padding fixed-width"
            >
              <template #default="scope">
                <el-button
                  link
                  type="primary"
                  icon="Delete"
                  @click="handleClearCacheKey(scope.row)"
                ></el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card
          :bordered="false"
          style="height: calc(100vh - 125px)"
        >
          <template #header>
            <Document style="width: 1em; height: 1em; vertical-align: middle" />
            <span style="vertical-align: middle">{{ $t('monitor:cacheContent') }}</span>
            <el-button
              style="float: right; padding: 3px 0"
              link
              type="primary"
              icon="Refresh"
              @click="handleClearCacheAll()"
              >{{ $t('monitor:clearAll') }}</el-button
            >
          </template>
          <el-form :model="cacheForm">
            <el-row :gutter="32">
              <el-col
                :offset="1"
                :span="22"
              >
                <el-form-item
                  :label="$t('monitor:cacheNameLabel')"
                  prop="cacheName"
                >
                  <el-input
                    v-model="cacheForm.cacheName"
                    :readOnly="true"
                  />
                </el-form-item>
              </el-col>
              <el-col
                :offset="1"
                :span="22"
              >
                <el-form-item
                  :label="$t('monitor:cacheKeyLabel')"
                  prop="cacheKey"
                >
                  <el-input
                    v-model="cacheForm.cacheKey"
                    :readOnly="true"
                  />
                </el-form-item>
              </el-col>
              <el-col
                :offset="1"
                :span="22"
              >
                <el-form-item
                  :label="$t('monitor:cacheContentLabel')"
                  prop="cacheValue"
                >
                  <el-input
                    v-model="cacheForm.cacheValue"
                    type="textarea"
                    :rows="8"
                    :readOnly="true"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="CacheList">
import { t } from '@/i18n/adapter'
import {
  listCacheName,
  listCacheKey,
  getCacheValue,
  clearCacheName,
  clearCacheKey,
  clearCacheAll,
} from '@/api/monitor/cache'

const { proxy } = getCurrentInstance()

const cacheNames = ref([])
const cacheKeys = ref([])
const cacheForm = ref({})
const loading = ref(true)
const subLoading = ref(false)
const nowCacheName = ref('')
const tableHeight = ref(window.innerHeight - 200)

/** 查询缓存名称列表 */
function getCacheNames() {
  loading.value = true
  listCacheName().then((response) => {
    cacheNames.value = response.data
    loading.value = false
  })
}

/** 刷新缓存名称列表 */
function refreshCacheNames() {
  getCacheNames()
  proxy.$modal.msgSuccess(t('monitor:cacheListRefreshed'))
}

/** 清理指定名称缓存 */
function handleClearCacheName(row) {
  clearCacheName(row.cacheName).then((response) => {
    proxy.$modal.msgSuccess(t('monitor:cache.nameCleared', { name: row.cacheName }))
    getCacheKeys()
  })
}

/** 查询缓存键名列表 */
function getCacheKeys(row) {
  const cacheName = row !== undefined ? row.cacheName : nowCacheName.value
  if (cacheName === '') {
    return
  }
  subLoading.value = true
  listCacheKey(cacheName).then((response) => {
    cacheKeys.value = response.data
    subLoading.value = false
    nowCacheName.value = cacheName
  })
}

/** 刷新缓存键名列表 */
function refreshCacheKeys() {
  getCacheKeys()
  proxy.$modal.msgSuccess(t('monitor:keyListRefreshed'))
}

/** 清理指定键名缓存 */
function handleClearCacheKey(cacheKey) {
  clearCacheKey(cacheKey).then((response) => {
    proxy.$modal.msgSuccess(t('monitor:cache.keyCleared', { key: cacheKey }))
    getCacheKeys()
  })
}

/** 列表前缀去除 */
function nameFormatter(row) {
  return row.cacheName.replace(':', '')
}

/** 键名前缀去除 */
function keyFormatter(cacheKey) {
  return cacheKey.replace(nowCacheName.value, '')
}

/** 查询缓存内容详细 */
function handleCacheValue(cacheKey) {
  getCacheValue(nowCacheName.value, cacheKey).then((response) => {
    cacheForm.value = response.data
  })
}

/** 清理全部缓存 */
function handleClearCacheAll() {
  clearCacheAll().then((response) => {
    proxy.$modal.msgSuccess(t('monitor:allCachesCleared'))
  })
}

getCacheNames()
</script>
