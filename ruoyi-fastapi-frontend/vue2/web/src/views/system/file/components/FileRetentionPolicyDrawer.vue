<template>
  <div>
    <el-drawer
      :title="$t('file:messages.fileRetentionPolicies')"
      :visible.sync="visible"
      size="900px"
      append-to-body
    >
      <div class="drawer-content">
        <el-alert
          :title="
            $t(
              'file:messages.policiesApplyOnlyToNewOrRecreatedBusinessReferencesBusinessTypesWithout'
            )
          "
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
              size="mini"
              icon="el-icon-plus"
              @click="handleAdd"
              >{{ $t('common:add') }}</el-button
            >
          </el-col>
        </el-row>
        <el-table
          v-loading="loading"
          :data="policyList"
        >
          <el-table-column
            :label="$t('monitor:log.businessType')"
            align="center"
            prop="businessType"
            min-width="140"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('file:messages.retentionDays')"
            align="center"
            prop="retentionDays"
            width="100"
          />
          <el-table-column
            :label="$t('common:status')"
            align="center"
            prop="status"
            width="90"
          >
            <template slot-scope="scope">
              <el-tag :type="scope.row.status === '0' ? 'success' : 'info'">
                {{
                  scope.row.status === '0' ? $t('system:oauth.enable') : $t('system:oauth.disabled')
                }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('common:remark')"
            align="left"
            prop="remark"
            min-width="160"
            :show-overflow-tooltip="true"
          >
            <template slot-scope="scope">{{ scope.row.remark || '-' }}</template>
          </el-table-column>
          <el-table-column
            :label="$t('common:updatedTime')"
            align="center"
            prop="updateTime"
            width="180"
          >
            <template slot-scope="scope">
              {{ parseTime(scope.row.updateTime) || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('common:actions')"
            align="center"
            width="90"
            fixed="right"
          >
            <template slot-scope="scope">
              <el-tooltip
                :content="$t('common:edit')"
                placement="top"
              >
                <el-button
                  type="text"
                  icon="el-icon-edit"
                  @click="handleEdit(scope.row)"
                />
              </el-tooltip>
              <el-tooltip
                :content="$t('common:delete')"
                placement="top"
              >
                <el-button
                  type="text"
                  class="file-action-danger"
                  icon="el-icon-delete"
                  @click="handleDelete(scope.row)"
                />
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <el-dialog
      :title="formTitle"
      :visible.sync="formOpen"
      width="520px"
      append-to-body
    >
      <el-form
        :validate-on-rule-change="false"
        ref="form"
        :model="form"
        :rules="rules"
        label-width="90px"
      >
        <el-form-item
          :label="$t('monitor:log.businessType')"
          prop="businessType"
        >
          <el-input
            v-model="form.businessType"
            :disabled="editing"
            maxlength="50"
            :placeholder="$t('file:messages.enterABusinessType')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('file:messages.retentionDays')"
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
          :label="$t('common:status')"
          prop="status"
        >
          <el-radio-group v-model="form.status">
            <el-radio label="0">{{ $t('common:enable') }}</el-radio>
            <el-radio label="1">{{ $t('common:disable') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          :label="$t('common:remark')"
          prop="remark"
        >
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            :placeholder="$t('system:dict.remarkPlaceholder')"
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
        <el-button @click="formOpen = false">{{ $t('common:cancel') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import {
  addFileRetentionPolicy,
  delFileRetentionPolicy,
  listFileRetentionPolicy,
  updateFileRetentionPolicy,
} from '@/api/system/file'

export default {
  name: 'FileRetentionPolicyDrawer',
  data() {
    return {
      visible: false,
      loading: false,
      policyList: [],
      formOpen: false,
      editing: false,
      saving: false,
      form: {
        businessType: undefined,
        retentionDays: 30,
        status: '0',
        remark: undefined,
      },
      rules: {
        businessType: [
          { required: true, message: () => t('file:messages.enterABusinessType'), trigger: 'blur' },
        ],
        retentionDays: [
          { required: true, message: () => t('file:messages.enterRetentionDays'), trigger: 'blur' },
        ],
      },
    }
  },
  computed: {
    formTitle() {
      return this.editing
        ? t('file:messages.editFileRetentionPolicy')
        : t('file:messages.addFileRetentionPolicy')
    },
  },
  methods: {
    open() {
      this.visible = true
      this.getList()
    },
    getList() {
      this.loading = true
      listFileRetentionPolicy()
        .then((response) => {
          this.policyList = response.data
        })
        .finally(() => {
          this.loading = false
        })
    },
    resetForm() {
      Object.assign(this.form, {
        businessType: undefined,
        retentionDays: 30,
        status: '0',
        remark: undefined,
      })
      this.$nextTick(() => this.$refs.form.clearValidate())
    },
    handleAdd() {
      this.editing = false
      this.resetForm()
      this.formOpen = true
    },
    handleEdit(row) {
      this.editing = true
      Object.assign(this.form, {
        businessType: row.businessType,
        retentionDays: row.retentionDays,
        status: row.status,
        remark: row.remark,
      })
      this.formOpen = true
      this.$nextTick(() => this.$refs.form.clearValidate())
    },
    submit() {
      this.$refs.form.validate((valid) => {
        if (!valid) {
          return
        }
        this.saving = true
        const submitRequest = this.editing
          ? updateFileRetentionPolicy(this.form)
          : addFileRetentionPolicy(this.form)
        submitRequest
          .then(() => {
            this.$modal.msgSuccess(
              this.editing ? t('common:updateSuccess') : t('common:addSuccess')
            )
            this.formOpen = false
            this.getList()
          })
          .finally(() => {
            this.saving = false
          })
      })
    },
    handleDelete(row) {
      this.$modal
        .confirm(
          t('file:messages.deleteTheRetentionPolicyForBusinessType', {
            businessType: row.businessType,
          })
        )
        .then(() => delFileRetentionPolicy(row.businessType))
        .then(() => {
          this.$modal.msgSuccess(t('common:deleteSuccess'))
          this.getList()
        })
        .catch(() => {})
    },
  },
}
</script>

<style scoped>
.drawer-content {
  padding: 0 20px 20px;
}

.file-action-danger {
  color: #f56c6c;
}
</style>
