<template>
  <el-drawer
    :title="drawerTitle"
    :visible.sync="visible"
    size="70%"
    append-to-body
    :wrapper-closable="!saving"
  >
    <div class="drawer-content">
      <el-alert
        :title="
          batchMode
            ? $t(
                'file:expression.batchOperationsReplaceOnlyExplicitPermissionsOnSelectedFilesBuiltInPermissions'
              )
            : $t(
                'file:expression.builtInPermissionsAreReadOnlyAdministratorsAndOwnersCannotBeDenied'
              )
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
        <div class="permission-section__title">{{ $t('file:messages.builtInPermissions') }}</div>
        <el-table
          v-loading="loading"
          :data="builtinPermissions"
          border
        >
          <el-table-column
            :label="$t('file:messages.permissionSource')"
            align="center"
            width="110"
          >
            <template slot-scope="scope">
              <el-tag
                :type="builtinSourceType(scope.row.source)"
                effect="plain"
                >{{ builtinSourceLabel(scope.row.source) }}</el-tag
              >
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('file:messages.permissionPrincipal')"
            align="center"
            min-width="180"
          >
            <template slot-scope="scope">
              {{ scope.row.subjectName || scope.row.subjectId || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('file:messages.rule')"
            align="center"
            width="110"
          >
            <template slot-scope="scope">
              <el-tag
                :type="scope.row.enabled ? 'success' : 'info'"
                effect="plain"
                >{{
                  scope.row.enabled
                    ? $t('file:messages.allowDownload')
                    : $t('file:expression.removed')
                }}</el-tag
              >
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('file:messages.denyTakesPrecedence')"
            align="center"
            width="135"
          >
            <template slot-scope="scope">
              <el-tag
                v-if="scope.row.enabled"
                :type="scope.row.denyOverridable ? 'warning' : 'info'"
                effect="plain"
                >{{
                  scope.row.denyOverridable
                    ? $t('file:expression.canBeOverridden')
                    : $t('file:expression.cannotBeOverridden')
                }}</el-tag
              >
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="description"
            :label="$t('file:messages.permissionDetails')"
            align="left"
            min-width="320"
            show-overflow-tooltip
          />
        </el-table>
      </div>
      <div class="permission-section__header">
        <span class="permission-section__title">{{ $t('file:messages.explicitPermissions') }}</span>
        <el-button
          type="primary"
          plain
          size="mini"
          icon="el-icon-plus"
          @click="addEntry"
          >{{ $t('file:messages.addPermission') }}</el-button
        >
      </div>
      <el-table
        v-loading="loading"
        :data="entries"
      >
        <el-table-column
          :label="$t('file:messages.principalType')"
          align="center"
          width="125"
        >
          <template slot-scope="scope">
            <el-select
              v-model="scope.row.subjectType"
              @change="handleSubjectTypeChange(scope.row)"
            >
              <el-option
                :label="$t('system:user.user')"
                value="user"
              />
              <el-option
                :label="$t('system:user.role')"
                value="role"
              />
              <el-option
                :label="$t('system:dept.nameShort')"
                value="dept"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.principal')"
          align="center"
          min-width="230"
        >
          <template slot-scope="scope">
            <treeselect
              v-if="scope.row.subjectType === 'dept'"
              v-model="scope.row.subjectId"
              :options="deptOptions"
              :normalizer="normalizer"
              :append-to-body="true"
              :z-index="3000"
              :placeholder="$t('file:messages.selectADepartment')"
              :clearable="true"
              :searchable="true"
              style="width: 100%"
            />
            <el-select
              v-else
              v-model="scope.row.subjectId"
              filterable
              remote
              clearable
              :loading="scope.row.subjectLoading"
              :remote-method="getSubjectRemoteMethod(scope.row)"
              :placeholder="$t('file:messages.searchByName')"
              style="width: 100%"
              @visible-change="handleSubjectVisible(scope.row, $event)"
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
          :label="$t('file:messages.rule')"
          align="center"
          width="120"
        >
          <template slot-scope="scope">
            <el-select v-model="scope.row.effect">
              <el-option
                :label="$t('file:messages.allowDownload')"
                value="allow"
              />
              <el-option
                :label="$t('file:messages.denyDownload')"
                value="deny"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.includeSubdepartments')"
          align="center"
          width="125"
        >
          <template slot-scope="scope">
            <el-switch
              v-if="scope.row.subjectType === 'dept'"
              v-model="scope.row.includeChildren"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.validUntil')"
          align="center"
          width="310"
        >
          <template slot-scope="scope">
            <BusinessDateTimePicker
              v-model="scope.row.expireTime"
              :label="$t('file:messages.validUntilLeaveEmptyForNoExpiry')"
            />
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:actions')"
          align="center"
          width="70"
        >
          <template slot-scope="scope">
            <el-tooltip
              :content="$t('common:delete')"
              placement="top"
            >
              <el-button
                type="text"
                class="file-action-danger"
                icon="el-icon-delete"
                @click="removeEntry(scope.$index)"
              />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <div class="drawer-footer">
        <el-button
          type="primary"
          :loading="saving"
          @click="submit"
        >
          {{ $t('file:messages.save') }}
        </el-button>
        <el-button @click="visible = false">{{ $t('common:cancel') }}</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script>
import { t } from '@/i18n/adapter'

import { prepareTimeFields, serializeTimeFieldsForSubmit } from '@/utils/time'
import BusinessDateTimePicker from '@/components/BusinessDateTimePicker'
import Treeselect from '@riophae/vue-treeselect'
import '@riophae/vue-treeselect/dist/vue-treeselect.css'
import {
  batchSaveFileAcl,
  getFileAclDeptTree,
  listFileAcl,
  saveFileAcl,
  searchFileAclSubjects,
} from '@/api/system/file'

export default {
  name: 'FileAclDrawer',
  components: { Treeselect, BusinessDateTimePicker },
  data() {
    return {
      visible: false,
      loading: false,
      saving: false,
      fileId: '',
      fileName: '',
      fileIds: '',
      batchMode: false,
      batchCount: 0,
      aclVersion: 0,
      builtinPermissions: [],
      entries: [],
      deptOptions: [],
    }
  },
  computed: {
    drawerTitle() {
      return this.batchMode
        ? t('file:messages.batchPermissionsFiles', { batchCount: this.batchCount })
        : t('file:messages.accessPermissions', { fileName: this.fileName })
    },
  },
  methods: {
    normalizer(node) {
      return {
        id: node.id,
        label: node.label,
        children: node.children,
      }
    },
    open(row, selectedIds, selectedPrivateIds) {
      this.batchMode = !(row && row.fileId)
      if (this.batchMode && !selectedPrivateIds.length) {
        this.$modal.msgWarning(t('file:messages.selectActiveProtectedFiles'))
        return
      }
      this.fileId = row && row.fileId ? row.fileId : ''
      this.fileIds = this.batchMode ? selectedPrivateIds.join(',') : row.fileId
      this.batchCount = this.batchMode ? selectedPrivateIds.length : 0
      this.fileName = row && row.originalName ? row.originalName : ''
      if (this.batchMode && selectedPrivateIds.length < selectedIds.length) {
        this.$modal.msgWarning(
          t('file:messages.skippedPublicOrInactiveFiles', {
            arg0: selectedIds.length - selectedPrivateIds.length,
          })
        )
      }
      this.visible = true
      this.loading = true
      this.builtinPermissions = []
      if (this.batchMode) {
        this.aclVersion = 0
        this.entries = []
        getFileAclDeptTree()
          .then((response) => {
            this.deptOptions = response.data
          })
          .finally(() => {
            this.loading = false
          })
        return
      }
      Promise.all([listFileAcl(row.fileId), getFileAclDeptTree()])
        .then(([aclResponse, deptResponse]) => {
          this.deptOptions = deptResponse.data
          this.aclVersion = aclResponse.data.aclVersion
          this.builtinPermissions = aclResponse.data.builtinPermissions || []
          this.entries = aclResponse.data.entries.map((item) =>
            prepareTimeFields(
              {
                subjectType: item.subjectType,
                subjectId: item.subjectId,
                effect: item.effect,
                includeChildren: item.includeChildren,
                expireTime: item.expireTime,
                subjectLoading: false,
                subjectOptions: [
                  {
                    subjectId: item.subjectId,
                    subjectName: item.subjectName,
                  },
                ],
              },
              ['expireTime']
            )
          )
        })
        .finally(() => {
          this.loading = false
        })
    },
    builtinSourceLabel(source) {
      return (
        {
          admin: t('file:messages.platformAdministrator'),
          owner: t('file:messages.fileOwner'),
          uploader: t('file:messages.fileUploader'),
        }[source] || source
      )
    },
    builtinSourceType(source) {
      return (
        {
          admin: 'danger',
          owner: 'primary',
          uploader: 'warning',
        }[source] || 'info'
      )
    },
    addEntry() {
      this.entries.push({
        subjectType: 'user',
        subjectId: undefined,
        effect: 'allow',
        includeChildren: false,
        expireTime: undefined,
        subjectLoading: false,
        subjectOptions: [],
      })
    },
    removeEntry(index) {
      this.entries.splice(index, 1)
    },
    handleSubjectTypeChange(row) {
      row.subjectId = undefined
      row.includeChildren = false
      row.subjectOptions = []
    },
    handleSubjectVisible(row, visible) {
      if (visible && !row.subjectOptions.length) {
        this.searchSubjectOptions(row, '')
      }
    },
    getSubjectRemoteMethod(row) {
      return (keyword) => this.searchSubjectOptions(row, keyword)
    },
    searchSubjectOptions(row, keyword) {
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
    },
    async submit() {
      if (this.entries.some((item) => !item.subjectId)) {
        this.$modal.msgError(t('file:messages.selectACompletePermissionPrincipal'))
        return
      }
      const convertedEntries = []
      for (const item of this.entries) {
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
        this.saving = true
        const saveRequest = this.batchMode
          ? batchSaveFileAcl({
              fileIds: this.fileIds,
              entries: aclEntries,
            })
          : saveFileAcl(this.fileId, {
              aclVersion: this.aclVersion,
              entries: aclEntries,
            })
        saveRequest
          .then(() => {
            this.$modal.msgSuccess(
              this.batchMode
                ? t('file:messages.filePermissionsSavedForAllSelectedFiles')
                : t('file:messages.filePermissionsSaved')
            )
            this.visible = false
            this.$emit('refresh')
          })
          .finally(() => {
            this.saving = false
          })
      }
      if (this.batchMode) {
        this.$modal
          .confirm(
            t('file:messages.replaceAllPermissionsForTheSelectedFiles', {
              batchCount: this.batchCount,
            })
          )
          .then(saveAcl)
          .catch(() => {})
      } else {
        saveAcl()
      }
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
  color: #303133;
  font-size: 15px;
  font-weight: 600;
}

.file-action-danger {
  color: #f56c6c;
}
</style>
