<template>
  <el-drawer
    :title="$t('file:messages.fileRetentionReminders')"
    :visible.sync="visible"
    size="70%"
    append-to-body
  >
    <div class="drawer-content">
      <el-alert
        :title="$t('file:messages.retentionCanBeExtendedBeforeExpiryAfterExpiryAFileCanBe')"
        type="info"
        :closable="false"
        show-icon
        class="mb8"
      />
      <el-form
        :validate-on-rule-change="false"
        ref="queryForm"
        :model="queryParams"
        size="small"
        :inline="true"
        label-width="68px"
      >
        <el-form-item
          :label="$t('file:name')"
          prop="originalName"
        >
          <el-input
            v-model="queryParams.originalName"
            :placeholder="$t('file:messages.enterTheOriginalFileName')"
            clearable
            style="width: 200px"
            @keyup.enter.native="handleQuery"
          />
        </el-form-item>
        <el-form-item
          :label="$t('file:messages.reminderType')"
          prop="noticeType"
        >
          <el-select
            v-model="queryParams.noticeType"
            :placeholder="$t('file:messages.selectAReminderType')"
            clearable
            style="width: 200px"
          >
            <el-option
              :label="$t('file:messages.expiringSoon')"
              value="expiring"
            />
            <el-option
              :label="$t('file:messages.expired')"
              value="expired"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          :label="$t('file:messages.reminderStatus')"
          prop="status"
        >
          <el-select
            v-model="queryParams.status"
            :placeholder="$t('file:messages.selectAReminderStatus')"
            clearable
            style="width: 200px"
          >
            <el-option
              :label="$t('file:messages.unread')"
              value="0"
            />
            <el-option
              :label="$t('file:messages.read')"
              value="1"
            />
          </el-select>
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
      <el-row
        :gutter="10"
        class="mb8"
      >
        <el-col :span="1.5">
          <el-button
            type="primary"
            plain
            size="mini"
            icon="el-icon-refresh"
            :loading="scanning"
            @click="handleScan"
            v-hasPermi="['system:file:edit']"
            >{{ $t('file:messages.scan') }}</el-button
          >
        </el-col>
        <el-col :span="1.5">
          <el-button
            type="success"
            plain
            size="mini"
            icon="el-icon-check"
            :disabled="!ids.length"
            @click="handleRead"
            >{{ $t('file:messages.read') }}</el-button
          >
        </el-col>
      </el-row>
      <el-table
        v-loading="loading"
        :data="reminderList"
        @selection-change="handleSelectionChange"
      >
        <el-table-column
          type="selection"
          width="50"
          align="center"
          :selectable="selectable"
        />
        <el-table-column
          :label="$t('file:name')"
          align="left"
          prop="originalName"
          min-width="180"
          :show-overflow-tooltip="true"
        />
        <el-table-column
          :label="$t('file:owner')"
          align="center"
          prop="ownerName"
          width="120"
          :show-overflow-tooltip="true"
        >
          <template slot-scope="scope">{{ scope.row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('system:user.department')"
          align="center"
          prop="deptName"
          width="140"
          :show-overflow-tooltip="true"
        >
          <template slot-scope="scope">{{ scope.row.deptName || '-' }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.reminderType')"
          align="center"
          prop="noticeType"
          width="110"
        >
          <template slot-scope="scope">
            <el-tag :type="scope.row.noticeType === 'expired' ? 'danger' : 'warning'">
              {{
                scope.row.noticeType === 'expired'
                  ? $t('file:messages.expired')
                  : $t('file:expression.expiringSoon')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.expiryTime')"
          align="center"
          prop="expireTime"
          width="180"
        >
          <template slot-scope="scope">{{ parseTime(scope.row.expireTime) }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('common:status')"
          align="center"
          prop="status"
          width="90"
        >
          <template slot-scope="scope">
            <el-tag :type="scope.row.status === '0' ? 'warning' : 'success'">
              {{ scope.row.status === '0' ? $t('file:messages.unread') : $t('file:messages.read') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.businessReferences')"
          align="center"
          prop="referenceCount"
          width="90"
        />
        <el-table-column
          :label="$t('file:messages.reminderTime')"
          align="center"
          prop="createTime"
          width="180"
        >
          <template slot-scope="scope">{{ parseTime(scope.row.createTime) }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.readBy')"
          align="center"
          prop="readBy"
          width="110"
          :show-overflow-tooltip="true"
        >
          <template slot-scope="scope">{{ scope.row.readBy || '-' }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('common:actions')"
          align="center"
          width="100"
          fixed="right"
        >
          <template slot-scope="scope">
            <el-tooltip
              :content="$t('file:messages.extendRetention')"
              placement="top"
            >
              <el-button
                type="text"
                icon="el-icon-time"
                @click="handleExtend(scope.row)"
                v-hasPermi="['system:file:edit']"
              />
            </el-tooltip>
            <el-tooltip
              v-if="isExpired(scope.row)"
              :content="
                scope.row.canDispose
                  ? $t('file:messages.moveToRecycleBin')
                  : $t('file:expression.permanentOrUnexpiredBusinessReferencesPreventDisposal')
              "
              placement="top"
            >
              <span>
                <el-button
                  type="text"
                  class="danger-action"
                  icon="el-icon-delete"
                  :disabled="!scope.row.canDispose"
                  @click="handleDispose(scope.row)"
                  v-hasPermi="['system:file:remove']"
                />
              </span>
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
    </div>

    <el-dialog
      :title="$t('file:messages.extendFileRetention')"
      :visible.sync="extendOpen"
      width="520px"
      append-to-body
    >
      <el-form
        :validate-on-rule-change="false"
        ref="extendForm"
        :model="extendForm"
        :rules="extendRules"
        label-width="92px"
      >
        <el-form-item :label="$t('file:name')">
          <span>{{ currentRow.originalName }}</span>
        </el-form-item>
        <el-form-item :label="$t('file:messages.previousExpiryTime')">
          <span>{{ parseTime(currentRow.expireTime) }}</span>
        </el-form-item>
        <el-form-item
          :label="$t('file:messages.newExpiryTime')"
          prop="expireTime"
        >
          <BusinessDateTimePicker
            v-model="extendForm.expireTime"
            :label="$t('file:messages.newExpiryTime')"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item
          :label="$t('file:messages.extensionReason')"
          prop="reason"
        >
          <el-input
            v-model="extendForm.reason"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            :placeholder="$t('file:messages.enterAnExtensionReason')"
          />
        </el-form-item>
      </el-form>
      <div
        slot="footer"
        class="dialog-footer"
      >
        <el-button
          type="primary"
          :loading="submitting"
          @click="submitExtend"
          >{{ $t('common:confirm') }}</el-button
        >
        <el-button @click="extendOpen = false">{{ $t('common:cancel') }}</el-button>
      </div>
    </el-dialog>
  </el-drawer>
</template>

<script>
import { t } from '@/i18n/adapter'

import { toBusinessDateTimeInput, serializeTimeFieldsForSubmit } from '@/utils/time'
import BusinessDateTimePicker from '@/components/BusinessDateTimePicker'
import {
  disposeExpiredFile,
  extendFileRetention,
  listFileRetentionReminder,
  readFileRetentionReminder,
  scanFileRetentionReminder,
} from '@/api/system/file'

export default {
  name: 'FileRetentionReminderDrawer',
  components: { BusinessDateTimePicker },
  data() {
    return {
      visible: false,
      loading: false,
      scanning: false,
      submitting: false,
      extendOpen: false,
      reminderList: [],
      total: 0,
      ids: [],
      currentRow: {},
      extendForm: {
        expireTime: undefined,
        reason: undefined,
      },
      extendRules: {
        expireTime: [
          {
            required: true,
            message: () => t('file:messages.enterANewExpiryTime'),
            trigger: 'change',
          },
        ],
        reason: [
          {
            required: true,
            message: () => t('file:messages.enterAReasonForTheExtension'),
            trigger: 'blur',
          },
        ],
      },
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        originalName: undefined,
        noticeType: undefined,
        status: '0',
      },
    }
  },
  methods: {
    open() {
      this.visible = true
      this.queryParams.pageNum = 1
      this.getList()
    },
    getList() {
      this.loading = true
      listFileRetentionReminder(this.queryParams)
        .then((response) => {
          this.reminderList = response.rows
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
      this.$refs.queryForm.resetFields()
      this.queryParams.pageNum = 1
      this.getList()
    },
    handleScan() {
      this.scanning = true
      scanFileRetentionReminder()
        .then((response) => {
          const { expiringCount, expiredCount } = response.data
          this.$modal.msgSuccess(
            t('file:messages.scanCompleteNewUpcomingExpiryRemindersAndNewExpiredReminders', {
              expiringCount,
              expiredCount,
            })
          )
          this.getList()
          this.$emit('refresh')
        })
        .finally(() => {
          this.scanning = false
        })
    },
    selectable(row) {
      return row.status === '0'
    },
    handleSelectionChange(selection) {
      this.ids = selection.map((item) => item.noticeId)
    },
    handleRead() {
      readFileRetentionReminder(this.ids.join(',')).then(() => {
        this.$modal.msgSuccess(t('file:messages.reminderMarkedAsRead'))
        this.getList()
      })
    },
    isExpired(row) {
      return new Date(row.expireTime).getTime() <= Date.now()
    },
    handleExtend(row) {
      this.currentRow = row
      this.extendForm = {
        expireTime: this.defaultExtendTime(row.expireTime),
        reason: undefined,
      }
      this.extendOpen = true
      this.$nextTick(() => this.$refs.extendForm.clearValidate())
    },
    submitExtend() {
      this.$refs.extendForm.validate(async (valid) => {
        if (!valid) return
        const submitData = await serializeTimeFieldsForSubmit(this.extendForm, ['expireTime'])
        if (!submitData) return
        this.submitting = true
        extendFileRetention(this.currentRow.noticeId, submitData)
          .then(() => {
            this.$modal.msgSuccess(t('file:messages.fileRetentionExtended'))
            this.extendOpen = false
            this.getList()
            this.$emit('refresh')
          })
          .finally(() => {
            this.submitting = false
          })
      })
    },
    handleDispose(row) {
      this.$prompt(
        t('file:messages.disposalWillMoveToTheRecycleBinAndRemoveExpiredBusinessReferences', {
          originalName: row.originalName,
          arg1: row.referenceCount || 0,
        }),
        t('file:messages.disposeOfExpiredFile'),
        {
          confirmButtonText: t('file:messages.confirmDisposal'),
          cancelButtonText: t('common:cancel'),
          closeOnClickModal: false,
          inputType: 'textarea',
          inputPlaceholder: t('file:messages.enterADisposalReason'),
          inputValidator: (value) => {
            const reason = value && value.trim()
            if (!reason) return t('file:messages.enterADisposalReason')
            if (reason.length > 500)
              return t('file:messages.theDisposalReasonMustNotExceed500Characters')
            return true
          },
        }
      )
        .then(({ value }) => {
          disposeExpiredFile(row.noticeId, { reason: value.trim() }).then(() => {
            this.$modal.msgSuccess(t('file:messages.expiredFileMovedToRecycleBin'))
            this.getList()
            this.$emit('refresh')
          })
        })
        .catch(() => {})
    },
    defaultExtendTime(expireTime) {
      const baseTime = Math.max(Date.now(), new Date(expireTime).getTime())
      const target = new Date(baseTime + 30 * 24 * 60 * 60 * 1000)
      return toBusinessDateTimeInput(target)
    },
  },
}
</script>

<style scoped>
.drawer-content {
  padding: 0 20px 20px;
}

.danger-action {
  color: #f56c6c;
}
</style>
