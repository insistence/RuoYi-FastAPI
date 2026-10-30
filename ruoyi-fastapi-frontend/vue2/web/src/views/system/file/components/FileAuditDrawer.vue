<template>
  <div>
    <el-drawer
      :title="$t('file:dialog.auditFile', { name: fileName })"
      :visible.sync="visible"
      size="80%"
      append-to-body
      @closed="detailOpen = false"
    >
      <div class="drawer-content">
        <el-form
          :validate-on-rule-change="false"
          ref="queryForm"
          :model="queryParams"
          size="small"
          :inline="true"
          label-width="68px"
        >
          <el-form-item
            :label="$t('monitor:log.operationType')"
            prop="action"
          >
            <el-select
              v-model="queryParams.action"
              :placeholder="$t('monitor:messages.allOperations')"
              clearable
              style="width: 200px"
            >
              <el-option
                :label="$t('common:upload')"
                value="upload"
              />
              <el-option
                :label="$t('common:download')"
                value="download"
              />
              <el-option
                :label="$t('file:messages.permissionChange')"
                value="acl_update"
              />
              <el-option
                :label="$t('file:messages.ownershipTransfer')"
                value="transfer"
              />
              <el-option
                :label="$t('file:messages.moveToRecycleBin')"
                value="delete"
              />
              <el-option
                :label="$t('common:restore')"
                value="restore"
              />
              <el-option
                :label="$t('file:messages.permanentlyDelete')"
                value="purge"
              />
              <el-option
                :label="$t('file:messages.storageReconciliation')"
                value="reconcile"
              />
              <el-option
                :label="$t('file:messages.retentionExtension')"
                value="retention_extend"
              />
              <el-option
                :label="$t('file:messages.expiryDisposal')"
                value="retention_dispose"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('file:messages.operationResult')"
            prop="result"
          >
            <el-select
              v-model="queryParams.result"
              :placeholder="$t('monitor:messages.allResults')"
              clearable
              style="width: 200px"
            >
              <el-option
                :label="$t('file:messages.allowed')"
                value="allowed"
              />
              <el-option
                :label="$t('file:messages.denied')"
                value="denied"
              />
              <el-option
                :label="$t('common:completed')"
                value="completed"
              />
              <el-option
                :label="$t('common:failed')"
                value="failed"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('file:messages.actingUser')"
            prop="actorName"
          >
            <el-input
              v-model="queryParams.actorName"
              :placeholder="$t('file:messages.enterAUsername')"
              clearable
              style="width: 200px"
              @keyup.enter.native="handleQuery"
            />
          </el-form-item>
          <el-form-item :label="$t('monitor:log.operationTime')">
            <el-date-picker
              v-model="dateRange"
              value-format="yyyy-MM-dd HH:mm:ss"
              type="datetimerange"
              range-separator="-"
              :start-placeholder="$t('common:startTime')"
              :end-placeholder="$t('common:endTime')"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label-width="0">
            <el-button
              type="primary"
              icon="el-icon-search"
              size="mini"
              @click="handleQuery"
              >{{ $t('common:search') }}</el-button
            >
            <el-button
              icon="el-icon-refresh"
              size="mini"
              @click="resetQuery"
              >{{ $t('common:reset') }}</el-button
            >
          </el-form-item>
        </el-form>
        <el-table
          v-loading="loading"
          :data="auditList"
        >
          <el-table-column
            :label="$t('common:actions')"
            align="center"
            prop="action"
            width="105"
          >
            <template slot-scope="scope">
              {{ actionLabel(scope.row.action) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('file:messages.result')"
            align="center"
            prop="result"
            width="100"
          >
            <template slot-scope="scope">
              <el-tag :type="resultTagType(scope.row.result)">
                {{ resultLabel(scope.row.result) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('file:messages.actingUser')"
            align="center"
            prop="actorName"
            width="120"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('file:messages.clientAddress')"
            align="center"
            prop="ipAddress"
            width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('file:messages.bytesTransferred')"
            align="right"
            prop="bytesSent"
            width="110"
          >
            <template slot-scope="scope">
              {{ scope.row.bytesSent ? formatFileSize(scope.row.bytesSent) : '-' }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('common:failureReason')"
            align="left"
            prop="errorMessage"
            min-width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('file:messages.accessedAt')"
            align="center"
            prop="accessTime"
            width="180"
          >
            <template slot-scope="scope">
              {{ parseTime(scope.row.accessTime) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('common:details')"
            align="center"
            width="70"
          >
            <template slot-scope="scope">
              <el-tooltip
                :content="$t('file:messages.viewAuditDetails')"
                placement="top"
              >
                <el-button
                  type="text"
                  icon="el-icon-view"
                  @click="handleDetail(scope.row)"
                />
              </el-tooltip>
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
        <div class="drawer-footer">
          <el-button @click="visible = false">{{ $t('common:close') }}</el-button>
        </div>
      </div>
    </el-drawer>

    <el-dialog
      :title="$t('file:messages.auditDetails')"
      :visible.sync="detailOpen"
      width="720px"
      append-to-body
    >
      <el-descriptions
        :column="2"
        border
      >
        <el-descriptions-item :label="$t('monitor:log.operationType')">
          {{ actionLabel(detail.action) }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('file:messages.operationResult')">
          {{ resultLabel(detail.result) }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('file:messages.actingUser')">
          {{ detail.actorName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('file:messages.clientAddress')">
          {{ detail.ipAddress || '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('file:messages.requestID')">
          {{ detail.requestId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('file:messages.traceID')">
          {{ detail.traceId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item
          :label="$t('monitor:log.operationTime')"
          :span="2"
        >
          {{ parseTime(detail.accessTime) }}
        </el-descriptions-item>
        <el-descriptions-item
          :label="$t('file:messages.userAgent')"
          :span="2"
        >
          {{ detail.userAgent || '-' }}
        </el-descriptions-item>
        <el-descriptions-item
          :label="$t('common:failureReason')"
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
          :label="$t('file:messages.detailItem')"
          prop="label"
          width="180"
        />
        <el-table-column
          :label="$t('system:file.content')"
          prop="value"
          :show-overflow-tooltip="true"
        />
      </el-table>
      <el-empty
        v-else
        :description="$t('file:messages.noOperationDetails')"
        :image-size="60"
      />
      <div
        slot="footer"
        class="dialog-footer"
      >
        <el-button @click="detailOpen = false">{{ $t('common:close') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { listFileAccessLog } from '@/api/system/file'
import {
  actionLabel,
  formatFileSize,
  parseOperationDetail,
  resultLabel,
  resultTagType,
} from './fileFormatters'

export default {
  name: 'FileAuditDrawer',
  data() {
    return {
      visible: false,
      loading: false,
      fileId: '',
      fileName: '',
      auditList: [],
      total: 0,
      dateRange: [],
      detailOpen: false,
      detail: {},
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        action: undefined,
        result: undefined,
        actorName: undefined,
      },
    }
  },
  computed: {
    detailEntries() {
      return parseOperationDetail(this.detail.operationDetail)
    },
  },
  methods: {
    actionLabel,
    formatFileSize,
    resultLabel,
    resultTagType,
    open(row) {
      this.fileId = row.fileId
      this.fileName = row.originalName
      Object.assign(this.queryParams, {
        pageNum: 1,
        action: undefined,
        result: undefined,
        actorName: undefined,
      })
      this.dateRange = []
      this.visible = true
      this.getList()
    },
    getList() {
      this.loading = true
      listFileAccessLog(this.fileId, this.addDateRange({ ...this.queryParams }, this.dateRange))
        .then((response) => {
          this.auditList = response.rows
          this.total = response.total
        })
        .finally(() => {
          this.loading = false
        })
    },
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    resetQuery() {
      this.dateRange = []
      this.$refs.queryForm.resetFields()
      this.queryParams.pageNum = 1
      this.getList()
    },
    handleDetail(row) {
      this.detail = row
      this.detailOpen = true
    },
  },
}
</script>

<style scoped>
.drawer-content {
  padding: 0 20px 20px;
}

.drawer-footer {
  padding-top: 20px;
  text-align: right;
}
</style>
