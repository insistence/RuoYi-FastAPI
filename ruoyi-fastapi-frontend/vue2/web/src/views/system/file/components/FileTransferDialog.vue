<template>
  <el-dialog
    :title="$t('file:dialog.transferFile', { name: fileName })"
    :visible.sync="visible"
    width="620px"
    append-to-body
  >
    <el-form
      :validate-on-rule-change="false"
      ref="form"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item
        :label="$t('file:messages.newOwner')"
        prop="ownerUserId"
      >
        <el-select
          v-model="form.ownerUserId"
          filterable
          remote
          clearable
          :loading="userLoading"
          :remote-method="searchUsers"
          :placeholder="$t('file:messages.searchByUsername')"
          style="width: 100%"
          @visible-change="handleUserVisible"
          @change="handleUserChange"
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
        :label="$t('system:user.department')"
        prop="deptId"
      >
        <treeselect
          v-model="form.deptId"
          :options="deptOptions"
          :normalizer="normalizer"
          :placeholder="$t('file:messages.selectADepartment')"
          :clearable="true"
          :searchable="true"
        />
      </el-form-item>
      <el-form-item :label="$t('file:messages.uploaderPermissions')">
        <el-switch
          v-model="form.retainUploaderAccess"
          :active-text="$t('file:messages.retain')"
          :inactive-text="$t('file:messages.remove')"
        />
        <div class="form-tip">
          {{
            form.retainUploaderAccess
              ? $t(
                  'file:expression.theOriginalUploaderRetainsBuiltInDownloadAccessAMatchingExplicitDeny'
                )
              : $t(
                  'file:expression.theOriginalUploaderNoLongerReceivesDownloadAccessThroughUploaderStatusThe'
                )
          }}
        </div>
      </el-form-item>
      <el-form-item
        :label="$t('file:messages.transferReason')"
        prop="reason"
      >
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          :placeholder="$t('file:messages.enterATransferReason')"
        />
      </el-form-item>
    </el-form>
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button
        type="primary"
        :loading="saving"
        @click="submit"
      >
        {{ $t('common:confirm') }}
      </el-button>
      <el-button @click="visible = false">{{ $t('common:cancel') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'

import Treeselect from '@riophae/vue-treeselect'
import '@riophae/vue-treeselect/dist/vue-treeselect.css'
import { getFileAclDeptTree, searchFileAclSubjects, transferFile } from '@/api/system/file'

export default {
  name: 'FileTransferDialog',
  components: { Treeselect },
  data() {
    return {
      visible: false,
      saving: false,
      userLoading: false,
      fileIds: '',
      fileName: '',
      userOptions: [],
      deptOptions: [],
      form: {
        ownerUserId: undefined,
        deptId: undefined,
        retainUploaderAccess: true,
        reason: undefined,
      },
      rules: {
        ownerUserId: [
          { required: true, message: () => t('file:messages.selectANewOwner'), trigger: 'change' },
        ],
        deptId: [
          {
            required: true,
            message: () => t('file:messages.selectADepartment'),
            trigger: 'change',
          },
        ],
        reason: [
          {
            required: true,
            message: () => t('file:messages.enterATransferReason'),
            trigger: 'blur',
          },
        ],
      },
    }
  },
  methods: {
    normalizer(node) {
      return {
        id: node.id,
        label: node.label,
        children: node.children,
      }
    },
    open(row, selectedIds) {
      const isSingle = row && row.fileId
      this.fileIds = isSingle ? row.fileId : selectedIds.join(',')
      this.fileName = isSingle
        ? row.originalName
        : t('file:messages.files', { length: selectedIds.length })
      Object.assign(this.form, {
        ownerUserId: undefined,
        deptId: undefined,
        retainUploaderAccess: true,
        reason: undefined,
      })
      this.userOptions = []
      this.visible = true
      this.$nextTick(() => this.$refs.form.clearValidate())
      getFileAclDeptTree().then((response) => {
        this.deptOptions = response.data
      })
      this.searchUsers('')
    },
    searchUsers(keyword) {
      this.userLoading = true
      searchFileAclSubjects({ subjectType: 'user', keyword })
        .then((response) => {
          this.userOptions = response.data
        })
        .finally(() => {
          this.userLoading = false
        })
    },
    handleUserVisible(visible) {
      if (visible) {
        this.searchUsers('')
      }
    },
    handleUserChange(userId) {
      const targetUser = this.userOptions.find((item) => item.subjectId === userId)
      if (targetUser && targetUser.deptId) {
        this.form.deptId = targetUser.deptId
      }
    },
    submit() {
      this.$refs.form.validate((valid) => {
        if (!valid) {
          return
        }
        this.saving = true
        transferFile(this.fileIds, this.form)
          .then(() => {
            this.visible = false
            this.$emit('refresh')
            this.$modal.msgSuccess(t('file:messages.filesTransferredSuccessfully'))
          })
          .finally(() => {
            this.saving = false
          })
      })
    },
  },
}
</script>

<style scoped>
.form-tip {
  width: 100%;
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 20px;
}
</style>
