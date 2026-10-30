<template>
  <el-drawer
    :title="$t('files:fileRetentionPolicies')"
    v-model="visible"
    size="900px"
    append-to-body
  >
    <el-alert
      :title="$t('files:policiesApplyOnlyToNewOrRecreatedBusinessReferencesBusiness')"
      type="info"
      :closable="false"
      show-icon
      class="mb8"
    />
    <el-row
      :gutter="10"
      class="mb8"
    >
      <el-col :span="1.5">
        <el-button
          type="primary"
          plain
          icon="Plus"
          @click="handleAdd"
        >
          {{ $t('system:add') }}</el-button
        >
      </el-col>
    </el-row>
    <el-table
      v-loading="loading"
      :data="policyList"
    >
      <el-table-column
        :label="$t('monitor:businessType')"
        align="center"
        prop="businessType"
        min-width="140"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('files:retentionDays')"
        align="center"
        prop="retentionDays"
        width="100"
      />
      <el-table-column
        :label="$t('system:status')"
        align="center"
        prop="status"
        width="90"
      >
        <template #default="scope">
          <el-tag :type="scope.row.status === '0' ? 'success' : 'info'">
            {{ scope.row.status === '0' ? $t('system:enable') : $t('system:disabled') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:remarks')"
        align="left"
        prop="remark"
        min-width="160"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">{{ scope.row.remark || '-' }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('monitor:updatedAt')"
        align="center"
        prop="updateTime"
        width="180"
      >
        <template #default="scope">
          {{ parseTime(scope.row.updateTime) || '-' }}
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        width="90"
        fixed="right"
      >
        <template #default="scope">
          <el-tooltip
            :content="$t('system:edit')"
            placement="top"
          >
            <el-button
              link
              type="primary"
              icon="Edit"
              @click="handleEdit(scope.row)"
            />
          </el-tooltip>
          <el-tooltip
            :content="$t('system:delete')"
            placement="top"
          >
            <el-button
              link
              type="danger"
              icon="Delete"
              @click="handleDelete(scope.row)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </el-drawer>

  <el-dialog
    :title="formTitle"
    v-model="formOpen"
    width="520px"
    append-to-body
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      :validate-on-rule-change="false"
      label-width="90px"
    >
      <el-form-item
        :label="$t('monitor:businessType')"
        prop="businessType"
      >
        <el-input
          v-model="form.businessType"
          :disabled="editing"
          maxlength="50"
          :placeholder="$t('files:enterABusinessType')"
        />
      </el-form-item>
      <el-form-item
        :label="$t('files:retentionDays')"
        prop="retentionDays"
      >
        <el-input-number
          v-model="form.retentionDays"
          controls-position="right"
          :min="1"
          :max="36500"
          :precision="0"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:status')"
        prop="status"
      >
        <el-radio-group v-model="form.status">
          <el-radio value="0">{{ $t('system:enable') }}</el-radio>
          <el-radio value="1">{{ $t('system:disabled') }}</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item
        :label="$t('system:remarks')"
        prop="remark"
      >
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          :placeholder="$t('components:enterARemark')"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          type="primary"
          :loading="saving"
          @click="submit"
        >
          {{ $t('system:confirm') }}</el-button
        >
        <el-button @click="formOpen = false">{{ $t('system:cancel') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { useLocaleForm } from '@/composables/useLocaleForm'
import { t } from '@/i18n/adapter'
import {
  addFileRetentionPolicy,
  delFileRetentionPolicy,
  listFileRetentionPolicy,
  updateFileRetentionPolicy,
} from '@/api/system/file'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.formRef))
const visible = ref(false)
const loading = ref(false)
const policyList = ref([])
const formOpen = ref(false)
const editing = ref(false)
const saving = ref(false)
const formRef = ref()
const formTitle = computed(() =>
  editing.value ? t('files:editFileRetentionPolicy') : t('files:addFileRetentionPolicy')
)
const form = reactive({
  businessType: undefined,
  retentionDays: 30,
  status: '0',
  remark: undefined,
})
const rules = {
  businessType: [
    {
      required: true,
      get message() {
        return t('files:enterABusinessType')
      },
      trigger: 'blur',
    },
  ],
  retentionDays: [
    {
      required: true,
      get message() {
        return t('files:enterRetentionDays')
      },
      trigger: 'blur',
    },
  ],
}

function open() {
  visible.value = true
  getList()
}

function getList() {
  loading.value = true
  listFileRetentionPolicy()
    .then((response) => {
      policyList.value = response.data
    })
    .finally(() => {
      loading.value = false
    })
}

function resetForm() {
  Object.assign(form, {
    businessType: undefined,
    retentionDays: 30,
    status: '0',
    remark: undefined,
  })
  nextTick(() => formRef.value?.clearValidate())
}

function handleAdd() {
  editing.value = false
  resetForm()
  formOpen.value = true
}

function handleEdit(row) {
  editing.value = true
  Object.assign(form, {
    businessType: row.businessType,
    retentionDays: row.retentionDays,
    status: row.status,
    remark: row.remark,
  })
  formOpen.value = true
  nextTick(() => formRef.value?.clearValidate())
}

function submit() {
  formRef.value.validate((valid) => {
    if (!valid) return
    saving.value = true
    const submitRequest = editing.value
      ? updateFileRetentionPolicy(form)
      : addFileRetentionPolicy(form)
    submitRequest
      .then(() => {
        proxy.$modal.msgSuccess(
          editing.value ? t('system:updatedSuccessfully') : t('system:addedSuccessfully')
        )
        formOpen.value = false
        getList()
      })
      .finally(() => {
        saving.value = false
      })
  })
}

function handleDelete(row) {
  proxy.$modal
    .confirm(
      t('files:deleteTheRetentionPolicyForBusinessTypeValue', { businessType: row.businessType })
    )
    .then(() => delFileRetentionPolicy(row.businessType))
    .then(() => {
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
      getList()
    })
    .catch(() => {})
}

defineExpose({ open })
</script>
