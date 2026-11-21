<template>
  <el-drawer
    :title="drawerTitle"
    v-model="visible"
    size="70%"
    append-to-body
    :close-on-click-modal="!saving"
  >
    <el-alert
      :title="
        batchMode
          ? $t('files:batchOperationsAffectOnlyExplicitGrantsForTheSelectedFiles')
          : $t('files:builtInPermissionsAreReadOnlyAdministratorsAndOwnersCannot')
      "
      type="info"
      :closable="false"
      show-icon
      class="mb8"
    />
    <div
      v-if="!batchMode"
      class="permission-section"
    >
      <div class="permission-section__title">{{ $t('files:builtInPermissions') }}</div>
      <el-table
        v-loading="loading"
        :data="builtinPermissions"
        border
      >
        <el-table-column
          :label="$t('files:permissionSource')"
          align="center"
          width="110"
        >
          <template #default="scope">
            <el-tag
              :type="builtinSourceType(scope.row.source)"
              effect="plain"
            >
              {{ builtinSourceLabel(scope.row.source) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('files:permissionPrincipal')"
          align="center"
          min-width="180"
        >
          <template #default="scope">
            {{ scope.row.subjectName || scope.row.subjectId || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('files:rule')"
          align="center"
          width="110"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.enabled ? 'success' : 'info'"
              effect="plain"
            >
              {{ scope.row.enabled ? $t('files:allowDownload') : $t('files:removed') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('files:denyTakesPrecedence')"
          align="center"
          width="135"
        >
          <template #default="scope">
            <el-tag
              v-if="scope.row.enabled"
              :type="scope.row.denyOverridable ? 'warning' : 'info'"
              effect="plain"
            >
              {{
                scope.row.denyOverridable
                  ? $t('files:canBeOverridden')
                  : $t('files:cannotBeOverridden')
              }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="description"
          :label="$t('files:permissionDetails')"
          align="left"
          min-width="320"
          show-overflow-tooltip
        />
      </el-table>
    </div>
    <div class="permission-section__header">
      <span class="permission-section__title">{{ $t('files:explicitPermissions') }}</span>
      <el-button
        type="primary"
        plain
        icon="Plus"
        @click="addEntry"
      >
        {{ $t('files:addPermission') }}</el-button
      >
    </div>
    <el-table
      v-loading="loading"
      :data="entries"
    >
      <el-table-column
        :label="$t('files:principalType')"
        align="center"
        width="125"
      >
        <template #default="scope">
          <el-select
            v-model="scope.row.subjectType"
            @change="handleSubjectTypeChange(scope.row)"
          >
            <el-option
              :label="$t('monitor:user')"
              value="user"
            />
            <el-option
              :label="$t('system:role')"
              value="role"
            />
            <el-option
              :label="$t('system:departmentLabel')"
              value="dept"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('files:principal')"
        align="center"
        min-width="230"
      >
        <template #default="scope">
          <el-tree-select
            v-if="scope.row.subjectType === 'dept'"
            v-model="scope.row.subjectId"
            :data="deptOptions"
            :props="{ value: 'id', label: 'label', children: 'children' }"
            value-key="id"
            :placeholder="$t('files:selectADepartment')"
            filterable
            clearable
            check-strictly
            :render-after-expand="false"
            style="width: 100%"
          />
          <el-select
            v-else
            v-model="scope.row.subjectId"
            filterable
            remote
            clearable
            :loading="scope.row.subjectLoading"
            :remote-method="(keyword) => searchSubjectOptions(scope.row, keyword)"
            @visible-change="(visible) => handleSubjectVisible(scope.row, visible)"
            :placeholder="$t('files:searchByName')"
            style="width: 100%"
          >
            <el-option
              v-for="item in scope.row.subjectOptions"
              :key="item.subjectId"
              :label="item.subjectName"
              :value="item.subjectId"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('files:rule')"
        align="center"
        width="120"
      >
        <template #default="scope">
          <el-select v-model="scope.row.effect">
            <el-option
              :label="$t('files:allowDownload')"
              value="allow"
            />
            <el-option
              :label="$t('files:denyDownload')"
              value="deny"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('files:includeSubdepartments')"
        align="center"
        width="125"
      >
        <template #default="scope">
          <el-switch
            v-if="scope.row.subjectType === 'dept'"
            v-model="scope.row.includeChildren"
          />
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('files:validUntil')"
        align="center"
        width="310"
      >
        <template #default="scope">
          <BusinessDateTimePicker
            v-model="scope.row.expireTime"
            :label="$t('files:validUntilLeaveEmptyForNoExpiry')"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        width="70"
      >
        <template #default="scope">
          <el-tooltip
            :content="$t('system:delete')"
            placement="top"
          >
            <el-button
              link
              type="danger"
              icon="Delete"
              @click="removeEntry(scope.$index)"
            />
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          type="primary"
          :loading="saving"
          @click="submit"
        >
          {{ $t('files:save') }}</el-button
        >
        <el-button @click="visible = false">{{ $t('system:cancel') }}</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import {
  batchSaveFileAcl,
  getFileAclDeptTree,
  listFileAcl,
  saveFileAcl,
  searchFileAclSubjects,
} from '@/api/system/file'
import { prepareTimeFields, serializeTimeFieldsForSubmit } from '@/utils/time'
import BusinessDateTimePicker from '@/components/BusinessDateTimePicker'

const emit = defineEmits(['refresh'])
const { proxy } = getCurrentInstance()
const visible = ref(false)
const loading = ref(false)
const saving = ref(false)
const fileId = ref('')
const fileName = ref('')
const fileIds = ref('')
const batchMode = ref(false)
const batchCount = ref(0)
const aclVersion = ref(0)
const builtinPermissions = ref([])
const entries = ref([])
const deptOptions = ref([])
const drawerTitle = computed(() =>
  batchMode.value
    ? t('files:batchPermissionsValueFiles', { value: batchCount.value })
    : t('files:accessPermissionsValue', { value: fileName.value })
)

function open(row, selectedIds, selectedPrivateIds) {
  batchMode.value = !row?.fileId
  if (batchMode.value && !selectedPrivateIds.length) {
    proxy.$modal.msgWarning(t('files:selectActiveProtectedFiles'))
    return
  }
  fileId.value = row?.fileId || ''
  fileIds.value = batchMode.value ? selectedPrivateIds.join(',') : row.fileId
  batchCount.value = batchMode.value ? selectedPrivateIds.length : 0
  fileName.value = row?.originalName || ''
  if (batchMode.value && selectedPrivateIds.length < selectedIds.length) {
    proxy.$modal.msgWarning(
      t('files:skippedValuePublicOrInactiveFiles', {
        arg0: selectedIds.length - selectedPrivateIds.length,
      })
    )
  }
  visible.value = true
  loading.value = true
  builtinPermissions.value = []
  if (batchMode.value) {
    aclVersion.value = 0
    entries.value = []
    getFileAclDeptTree()
      .then((response) => {
        deptOptions.value = response.data
      })
      .finally(() => {
        loading.value = false
      })
    return
  }
  Promise.all([listFileAcl(row.fileId), getFileAclDeptTree()])
    .then(([aclResponse, deptResponse]) => {
      deptOptions.value = deptResponse.data
      aclVersion.value = aclResponse.data.aclVersion
      builtinPermissions.value = aclResponse.data.builtinPermissions || []
      entries.value = aclResponse.data.entries.map((item) =>
        prepareTimeFields(
          {
            subjectType: item.subjectType,
            subjectId: item.subjectId,
            effect: item.effect,
            includeChildren: item.includeChildren,
            expireTime: item.expireTime,
            subjectLoading: false,
            subjectOptions: [{ subjectId: item.subjectId, subjectName: item.subjectName }],
          },
          ['expireTime']
        )
      )
    })
    .finally(() => {
      loading.value = false
    })
}

function builtinSourceLabel(source) {
  return (
    {
      get admin() {
        return t('files:platformAdministrator')
      },
      get owner() {
        return t('files:fileOwner')
      },
      get uploader() {
        return t('files:fileUploader')
      },
    }[source] || source
  )
}

function builtinSourceType(source) {
  return (
    {
      admin: 'danger',
      owner: 'primary',
      uploader: 'warning',
    }[source] || 'info'
  )
}

function addEntry() {
  entries.value.push({
    subjectType: 'user',
    subjectId: undefined,
    effect: 'allow',
    includeChildren: false,
    expireTime: undefined,
    subjectLoading: false,
    subjectOptions: [],
  })
}

function removeEntry(index) {
  entries.value.splice(index, 1)
}

function handleSubjectTypeChange(row) {
  row.subjectId = undefined
  row.includeChildren = false
  row.subjectOptions = []
}

function handleSubjectVisible(row, visible) {
  if (visible && !row.subjectOptions.length) {
    searchSubjectOptions(row, '')
  }
}

function searchSubjectOptions(row, keyword) {
  const subjectType = row.subjectType
  row.subjectLoading = true
  searchFileAclSubjects({ subjectType, keyword })
    .then((response) => {
      if (row.subjectType === subjectType) {
        row.subjectOptions = response.data
      }
      row.subjectLoading = false
    })
    .catch(() => {
      row.subjectLoading = false
    })
}

async function submit() {
  if (entries.value.some((item) => !item.subjectId)) {
    proxy.$modal.msgError(t('files:selectACompletePermissionPrincipal'))
    return
  }
  const convertedEntries = []
  for (const item of entries.value) {
    const converted = await serializeTimeFieldsForSubmit(item, ['expireTime'])
    if (!converted) return
    convertedEntries.push(converted)
  }
  const aclEntries = convertedEntries.map((item) => ({
    subjectType: item.subjectType,
    subjectId: item.subjectId,
    effect: item.effect,
    includeChildren: item.subjectType === 'dept' && item.includeChildren,
    expireTime: item.expireTime,
  }))
  const saveAcl = () => {
    saving.value = true
    const saveRequest = batchMode.value
      ? batchSaveFileAcl({ fileIds: fileIds.value, entries: aclEntries })
      : saveFileAcl(fileId.value, {
          aclVersion: aclVersion.value,
          entries: aclEntries,
        })
    saveRequest
      .then(() => {
        proxy.$modal.msgSuccess(
          batchMode.value
            ? t('files:filePermissionsSavedForAllSelectedFiles')
            : t('files:filePermissionsSaved')
        )
        visible.value = false
        emit('refresh')
      })
      .finally(() => {
        saving.value = false
      })
  }
  if (batchMode.value) {
    proxy.$modal
      .confirm(
        t('files:replaceAllPermissionsForTheValueSelectedFiles', { value: batchCount.value })
      )
      .then(saveAcl)
      .catch(() => {})
  } else {
    saveAcl()
  }
}

defineExpose({ open })
</script>

<style scoped>
.permission-section {
  margin-bottom: 20px;
}

.permission-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 0 8px;
}

.permission-section__title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
}
</style>
