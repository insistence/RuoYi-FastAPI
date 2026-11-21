<template>
  <el-drawer
    :title="$t('files:fileRetentionReminders')"
    v-model="visible"
    size="70%"
    append-to-body
  >
    <el-alert
      :title="$t('files:retentionCanBeExtendedBeforeExpiryAfterExpiryAFile')"
      type="info"
      :closable="false"
      show-icon
      class="mb8"
    />
    <el-form
      ref="queryRef"
      :model="queryParams"
      :inline="true"
      label-width="68px"
    >
      <el-form-item
        :label="$t('components:fileName')"
        prop="originalName"
      >
        <el-input
          v-model="queryParams.originalName"
          :placeholder="$t('files:enterTheOriginalFileName')"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('files:reminderType')"
        prop="noticeType"
      >
        <el-select
          v-model="queryParams.noticeType"
          :placeholder="$t('files:selectAReminderType')"
          clearable
          style="width: 200px"
        >
          <el-option
            :label="$t('files:expiringSoon')"
            value="expiring"
          />
          <el-option
            :label="$t('files:expired')"
            value="expired"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('files:reminderStatus')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('files:selectAReminderStatus')"
          clearable
          style="width: 200px"
        >
          <el-option
            :label="$t('files:unread')"
            value="0"
          />
          <el-option
            :label="$t('files:read')"
            value="1"
          />
        </el-select>
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
    <el-row
      :gutter="10"
      class="mb8"
    >
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="Refresh"
          :loading="scanning"
          @click="handleScan"
          v-hasPermi="['system:file:edit']"
        >
          {{ $t('files:scan') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Check"
          :disabled="!ids.length"
          @click="handleRead"
        >
          {{ $t('files:read') }}</el-button
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
        :selectable="(row) => row.status === '0'"
      />
      <el-table-column
        :label="$t('components:fileName')"
        align="left"
        prop="originalName"
        min-width="180"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('components:owner')"
        align="center"
        prop="ownerName"
        width="120"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">{{ scope.row.ownerName || '-' }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('system:department')"
        align="center"
        prop="deptName"
        width="140"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">{{ scope.row.deptName || '-' }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('files:reminderType')"
        align="center"
        prop="noticeType"
        width="110"
      >
        <template #default="scope">
          <el-tag :type="scope.row.noticeType === 'expired' ? 'danger' : 'warning'">
            {{
              scope.row.noticeType === 'expired' ? $t('files:expired') : $t('files:expiringSoon')
            }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('files:expiryTime')"
        align="center"
        prop="expireTime"
        width="180"
      >
        <template #default="scope">{{ parseTime(scope.row.expireTime) }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('system:status')"
        align="center"
        prop="status"
        width="90"
      >
        <template #default="scope">
          <el-tag :type="scope.row.status === '0' ? 'warning' : 'success'">
            {{ scope.row.status === '0' ? $t('files:unread') : $t('files:read') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('files:businessReferences')"
        align="center"
        prop="referenceCount"
        width="90"
      />
      <el-table-column
        :label="$t('files:reminderTime')"
        align="center"
        prop="createTime"
        width="180"
      >
        <template #default="scope">{{ parseTime(scope.row.createTime) }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('files:readBy')"
        align="center"
        prop="readBy"
        width="110"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">{{ scope.row.readBy || '-' }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        width="100"
        fixed="right"
      >
        <template #default="scope">
          <el-tooltip
            :content="$t('files:extendRetention')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="Clock"
              @click="handleExtend(scope.row)"
              v-hasPermi="['system:file:edit']"
            />
          </el-tooltip>
          <el-tooltip
            v-if="isExpired(scope.row)"
            :content="
              scope.row.canDispose
                ? $t('files:moveToRecycleBin')
                : $t('files:aPermanentOrUnexpiredBusinessReferencePreventsDisposal')
            "
            placement="top"
          >
            <span>
              <el-button
                link
                type="danger"
                icon="Delete"
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
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </el-drawer>

  <el-dialog
    :title="$t('files:extendFileRetention')"
    v-model="extendOpen"
    width="520px"
    append-to-body
  >
    <el-form
      ref="extendRef"
      :model="extendForm"
      :rules="extendRules"
      label-width="92px"
    >
      <el-form-item :label="$t('components:fileName')">
        <span>{{ currentRow.originalName }}</span>
      </el-form-item>
      <el-form-item :label="$t('files:previousExpiryTime')">
        <span>{{ parseTime(currentRow.expireTime) }}</span>
      </el-form-item>
      <el-form-item
        :label="$t('files:newExpiryTime')"
        prop="expireTime"
      >
        <BusinessDateTimePicker
          v-model="extendForm.expireTime"
          :label="$t('files:newExpiryTime')"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item
        :label="$t('files:extensionReason')"
        prop="reason"
      >
        <el-input
          v-model="extendForm.reason"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          :placeholder="$t('files:enterAnExtensionReason')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          type="primary"
          :loading="submitting"
          @click="submitExtend"
        >
          {{ $t('system:confirm') }}</el-button
        >
        <el-button @click="extendOpen = false">{{ $t('system:cancel') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import {
  disposeExpiredFile,
  extendFileRetention,
  listFileRetentionReminder,
  readFileRetentionReminder,
  scanFileRetentionReminder,
} from '@/api/system/file'
import { toBusinessDateTimeInput, serializeTimeFieldsForSubmit } from '@/utils/time'
import BusinessDateTimePicker from '@/components/BusinessDateTimePicker'

const emit = defineEmits(['refresh'])
const { proxy } = getCurrentInstance()
const visible = ref(false)
const loading = ref(false)
const scanning = ref(false)
const reminderList = ref([])
const total = ref(0)
const ids = ref([])
const queryRef = ref()
const extendRef = ref()
const extendOpen = ref(false)
const submitting = ref(false)
const currentRow = ref({})
const extendForm = reactive({
  expireTime: undefined,
  reason: undefined,
})
const extendRules = {
  expireTime: [
    {
      required: true,
      get message() {
        return t('files:enterANewExpiryTime')
      },
      trigger: 'change',
    },
  ],
  reason: [
    {
      required: true,
      get message() {
        return t('files:enterAReasonForTheExtension')
      },
      trigger: 'blur',
    },
  ],
}
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  originalName: undefined,
  noticeType: undefined,
  status: '0',
})

function open() {
  visible.value = true
  queryParams.pageNum = 1
  getList()
}

function getList() {
  loading.value = true
  listFileRetentionReminder(queryParams)
    .then((response) => {
      reminderList.value = response.rows
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
  queryRef.value?.resetFields()
  queryParams.pageNum = 1
  getList()
}

function handleScan() {
  scanning.value = true
  scanFileRetentionReminder()
    .then((response) => {
      const { expiringCount, expiredCount } = response.data
      proxy.$modal.msgSuccess(
        t('files:scanCompleteValueNewUpcomingExpiryRemindersAndValueNew', {
          expiringCount,
          expiredCount,
        })
      )
      getList()
      emit('refresh')
    })
    .finally(() => {
      scanning.value = false
    })
}

function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.noticeId)
}

function handleRead() {
  readFileRetentionReminder(ids.value.join(',')).then(() => {
    proxy.$modal.msgSuccess(t('files:reminderMarkedAsRead'))
    getList()
  })
}

function isExpired(row) {
  return new Date(row.expireTime).getTime() <= Date.now()
}

function handleExtend(row) {
  currentRow.value = row
  Object.assign(extendForm, {
    expireTime: defaultExtendTime(row.expireTime),
    reason: undefined,
  })
  extendOpen.value = true
  nextTick(() => extendRef.value?.clearValidate())
}

function submitExtend() {
  extendRef.value.validate(async (valid) => {
    if (!valid) return
    const submitData = await serializeTimeFieldsForSubmit(extendForm, ['expireTime'])
    if (!submitData) return
    submitting.value = true
    extendFileRetention(currentRow.value.noticeId, submitData)
      .then(() => {
        proxy.$modal.msgSuccess(t('files:fileRetentionExtended'))
        extendOpen.value = false
        getList()
        emit('refresh')
      })
      .finally(() => {
        submitting.value = false
      })
  })
}

function handleDispose(row) {
  proxy
    .$prompt(
      t('files:disposalWillMoveValueToTheRecycleBinAndRemove', {
        originalName: row.originalName,
        arg1: row.referenceCount || 0,
      }),
      t('files:disposeOfExpiredFile'),
      {
        get confirmButtonText() {
          return t('files:confirmDisposal')
        },
        get cancelButtonText() {
          return t('common:cancel')
        },
        closeOnClickModal: false,
        inputType: 'textarea',
        get inputPlaceholder() {
          return t('files:enterADisposalReason')
        },
        inputValidator: (value) => {
          const reason = value?.trim()
          if (!reason) return t('files:enterADisposalReasonLabel')
          if (reason.length > 500) return t('files:theDisposalReasonMustNotExceed500Characters')
          return true
        },
      }
    )
    .then(({ value }) => {
      disposeExpiredFile(row.noticeId, { reason: value.trim() }).then(() => {
        proxy.$modal.msgSuccess(t('files:expiredFileMovedToRecycleBin'))
        getList()
        emit('refresh')
      })
    })
    .catch(() => {})
}

function defaultExtendTime(expireTime) {
  const baseTime = Math.max(Date.now(), new Date(expireTime).getTime())
  const target = new Date(baseTime + 30 * 24 * 60 * 60 * 1000)
  return toBusinessDateTimeInput(target)
}

defineExpose({ open })
</script>
