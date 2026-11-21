<template>
  <el-drawer
    :title="$t('files:fileAuditValue', { fileName: fileName })"
    v-model="visible"
    size="80%"
    append-to-body
    @closed="detailOpen = false"
  >
    <el-form
      ref="queryRef"
      :model="queryParams"
      :inline="true"
      label-width="68px"
    >
      <el-form-item
        :label="$t('monitor:operationType')"
        prop="action"
      >
        <el-select
          v-model="queryParams.action"
          :placeholder="$t('monitor:allOperations')"
          clearable
          style="width: 200px"
        >
          <el-option
            :label="$t('components:uploadLabel')"
            value="upload"
          />
          <el-option
            :label="$t('components:download')"
            value="download"
          />
          <el-option
            :label="$t('files:permissionChange')"
            value="acl_update"
          />
          <el-option
            :label="$t('files:ownershipTransfer')"
            value="transfer"
          />
          <el-option
            :label="$t('files:moveToRecycleBin')"
            value="delete"
          />
          <el-option
            :label="$t('components:restore')"
            value="restore"
          />
          <el-option
            :label="$t('files:permanentlyDelete')"
            value="purge"
          />
          <el-option
            :label="$t('files:storageReconciliation')"
            value="reconcile"
          />
          <el-option
            :label="$t('files:retentionExtension')"
            value="retention_extend"
          />
          <el-option
            :label="$t('files:expiryDisposal')"
            value="retention_dispose"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('files:operationResult')"
        prop="result"
      >
        <el-select
          v-model="queryParams.result"
          :placeholder="$t('monitor:allResults')"
          clearable
          style="width: 200px"
        >
          <el-option
            :label="$t('files:allowed')"
            value="allowed"
          />
          <el-option
            :label="$t('files:denied')"
            value="denied"
          />
          <el-option
            :label="$t('monitor:completed')"
            value="completed"
          />
          <el-option
            :label="$t('monitor:failed')"
            value="failed"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('files:actingUser')"
        prop="actorName"
      >
        <el-input
          v-model="queryParams.actorName"
          :placeholder="$t('files:enterAUsername')"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item :label="$t('monitor:operationTime')">
        <el-date-picker
          v-model="dateRange"
          value-format="YYYY-MM-DD HH:mm:ss"
          type="datetimerange"
          range-separator="-"
          :start-placeholder="$t('monitor:startTime')"
          :end-placeholder="$t('monitor:endTime')"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label-width="0">
        <el-button
          type="primary"
          icon="Search"
          @click="handleQuery"
        >
          {{ $t('system:search') }}</el-button
        >
        <el-button
          icon="Refresh"
          @click="resetQuery"
          >{{ $t('system:reset') }}</el-button
        >
      </el-form-item>
    </el-form>
    <el-table
      v-loading="loading"
      :data="auditList"
    >
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        prop="action"
        width="105"
      >
        <template #default="scope">{{ actionLabel(scope.row.action) }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('files:result')"
        align="center"
        prop="result"
        width="100"
      >
        <template #default="scope">
          <el-tag :type="resultTagType(scope.row.result)">
            {{ resultLabel(scope.row.result) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('files:actingUser')"
        align="center"
        prop="actorName"
        width="120"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('files:clientAddress')"
        align="center"
        prop="ipAddress"
        width="140"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('files:bytesTransferred')"
        align="right"
        prop="bytesSent"
        width="110"
      >
        <template #default="scope">
          {{ scope.row.bytesSent ? formatFileSize(scope.row.bytesSent) : '-' }}
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('monitor:failureReason')"
        align="left"
        prop="errorMessage"
        min-width="140"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:accessedAt')"
        align="center"
        prop="accessTime"
        width="180"
      >
        <template #default="scope">{{ parseTime(scope.row.accessTime) }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('components:details')"
        align="center"
        width="70"
      >
        <template #default="scope">
          <el-tooltip
            :content="$t('files:viewAuditDetails')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="View"
              @click="handleDetail(scope.row)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">{{ $t('monitor:close') }}</el-button>
      </div>
    </template>
  </el-drawer>

  <el-dialog
    :title="$t('files:auditDetails')"
    v-model="detailOpen"
    width="720px"
    append-to-body
  >
    <el-descriptions
      :column="2"
      border
      label-width="110px"
      class="audit-descriptions"
    >
      <el-descriptions-item :label="$t('monitor:operationType')">
        {{ actionLabel(detail.action) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:operationResult')">
        {{ resultLabel(detail.result) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:actingUser')">
        {{ detail.actorName || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:clientAddress')">
        {{ detail.ipAddress || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:requestID')">
        {{ detail.requestId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:traceID')">
        {{ detail.traceId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item
        :label="$t('monitor:operationTime')"
        :span="2"
      >
        {{ parseTime(detail.accessTime) }}
      </el-descriptions-item>
      <el-descriptions-item
        :label="$t('files:userAgent')"
        :span="2"
      >
        {{ detail.userAgent || '-' }}
      </el-descriptions-item>
      <el-descriptions-item
        :label="$t('monitor:failureReason')"
        :span="2"
      >
        {{ detail.errorMessage || '-' }}
      </el-descriptions-item>
    </el-descriptions>
    <el-table
      v-if="detailEntries.length"
      :data="detailEntries"
      border
      class="mt20"
    >
      <el-table-column
        :label="$t('files:detailItem')"
        prop="label"
        width="180"
      />
      <el-table-column
        :label="$t('system:content')"
        prop="value"
        :show-overflow-tooltip="true"
      />
    </el-table>
    <el-empty
      v-else
      :description="$t('files:noOperationDetails')"
      :image-size="60"
    />
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="detailOpen = false">{{ $t('monitor:close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { listFileAccessLog } from '@/api/system/file'
import {
  actionLabel,
  formatFileSize,
  parseOperationDetail,
  resultLabel,
  resultTagType,
} from './fileFormatters'

const { proxy } = getCurrentInstance()
const visible = ref(false)
const loading = ref(false)
const fileId = ref('')
const fileName = ref('')
const auditList = ref([])
const total = ref(0)
const dateRange = ref([])
const queryRef = ref()
const detailOpen = ref(false)
const detail = ref({})
const detailEntries = computed(() => parseOperationDetail(detail.value.operationDetail))
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  action: undefined,
  result: undefined,
  actorName: undefined,
})

function open(row) {
  fileId.value = row.fileId
  fileName.value = row.originalName
  Object.assign(queryParams, {
    pageNum: 1,
    action: undefined,
    result: undefined,
    actorName: undefined,
  })
  dateRange.value = []
  visible.value = true
  getList()
}

function getList() {
  loading.value = true
  listFileAccessLog(fileId.value, proxy.addDateRange({ ...queryParams }, dateRange.value))
    .then((response) => {
      auditList.value = response.rows
      total.value = response.total
    })
    .finally(() => {
      loading.value = false
    })
}

function handleQuery() {
  queryParams.pageNum = 1
  getList()
}

function resetQuery() {
  dateRange.value = []
  queryRef.value?.resetFields()
  queryParams.pageNum = 1
  getList()
}

function handleDetail(row) {
  detail.value = row
  detailOpen.value = true
}

defineExpose({ open })
</script>

<style scoped>
.audit-descriptions :deep(.el-descriptions__label) {
  white-space: nowrap;
}

.audit-descriptions :deep(.el-descriptions__content) {
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
