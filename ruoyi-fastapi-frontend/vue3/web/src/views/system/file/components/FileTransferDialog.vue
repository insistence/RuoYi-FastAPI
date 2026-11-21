<template>
  <el-dialog
    :title="$t('files:transferFileValue', { fileName: fileName })"
    v-model="visible"
    width="620px"
    append-to-body
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      :validate-on-rule-change="false"
      label-width="100px"
    >
      <el-form-item
        :label="$t('files:newOwner')"
        prop="ownerUserId"
      >
        <el-select
          v-model="form.ownerUserId"
          filterable
          remote
          clearable
          :loading="userLoading"
          :remote-method="searchUsers"
          @visible-change="(visible) => visible && searchUsers('')"
          @change="handleUserChange"
          :placeholder="$t('files:searchByUsername')"
          style="width: 100%"
        >
          <el-option
            v-for="item in userOptions"
            :key="item.subjectId"
            :label="item.subjectName"
            :value="item.subjectId"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        :label="$t('system:department')"
        prop="deptId"
      >
        <el-tree-select
          v-model="form.deptId"
          :data="deptOptions"
          :props="{ value: 'id', label: 'label', children: 'children' }"
          value-key="id"
          :placeholder="$t('files:selectADepartmentLabel')"
          filterable
          clearable
          check-strictly
          :render-after-expand="false"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item :label="$t('files:uploaderPermissions')">
        <el-switch
          v-model="form.retainUploaderAccess"
          :active-text="$t('files:retain')"
          :inactive-text="$t('files:remove')"
        />
        <div class="form-tip">
          {{
            form.retainUploaderAccess
              ? $t('files:theOriginalUploaderKeepsBuiltInDownloadPermissionAMatching')
              : $t('files:theOriginalUploaderLosesDownloadPermissionBasedOnUploaderStatus')
          }}
        </div>
      </el-form-item>
      <el-form-item
        :label="$t('files:transferReason')"
        prop="reason"
      >
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          :placeholder="$t('files:enterATransferReason')"
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
        <el-button @click="visible = false">{{ $t('system:cancel') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { getFileAclDeptTree, searchFileAclSubjects, transferFile } from '@/api/system/file'

const emit = defineEmits(['refresh'])
const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.formRef))
const visible = ref(false)
const saving = ref(false)
const userLoading = ref(false)
const fileIds = ref('')
const fileName = ref('')
const userOptions = ref([])
const deptOptions = ref([])
const formRef = ref()
const form = reactive({
  ownerUserId: undefined,
  deptId: undefined,
  retainUploaderAccess: true,
  reason: undefined,
})
const rules = {
  ownerUserId: [
    {
      required: true,
      get message() {
        return t('files:selectANewOwner')
      },
      trigger: 'change',
    },
  ],
  deptId: [
    {
      required: true,
      get message() {
        return t('files:selectADepartmentLabel')
      },
      trigger: 'change',
    },
  ],
  reason: [
    {
      required: true,
      get message() {
        return t('files:enterATransferReason')
      },
      trigger: 'blur',
    },
  ],
}

function open(row, selectedIds) {
  const isSingle = row?.fileId
  fileIds.value = isSingle ? row.fileId : selectedIds.join(',')
  fileName.value = isSingle
    ? row.originalName
    : t('files:valueFiles', { length: selectedIds.length })
  Object.assign(form, {
    ownerUserId: undefined,
    deptId: undefined,
    retainUploaderAccess: true,
    reason: undefined,
  })
  userOptions.value = []
  visible.value = true
  nextTick(() => formRef.value?.clearValidate())
  getFileAclDeptTree().then((response) => {
    deptOptions.value = response.data
  })
  searchUsers('')
}

function searchUsers(keyword) {
  userLoading.value = true
  searchFileAclSubjects({ subjectType: 'user', keyword })
    .then((response) => {
      userOptions.value = response.data
    })
    .finally(() => {
      userLoading.value = false
    })
}

function handleUserChange(userId) {
  const targetUser = userOptions.value.find((item) => item.subjectId === userId)
  if (targetUser?.deptId) {
    form.deptId = targetUser.deptId
  }
}

function submit() {
  formRef.value.validate((valid) => {
    if (!valid) return
    saving.value = true
    transferFile(fileIds.value, form)
      .then(() => {
        visible.value = false
        emit('refresh')
        proxy.$modal.msgSuccess(t('files:filesTransferredSuccessfully'))
      })
      .finally(() => {
        saving.value = false
      })
  })
}

defineExpose({ open })
</script>

<style scoped>
.form-tip {
  width: 100%;
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}
</style>
