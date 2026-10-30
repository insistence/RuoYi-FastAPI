<template>
  <div class="app-container">
    <h4 class="form-header h4">{{ $t('common:basicInfo') }}</h4>
    <el-form
      :validate-on-rule-change="false"
      ref="form"
      :model="form"
      label-width="80px"
    >
      <el-row>
        <el-col
          :span="8"
          :offset="2"
        >
          <el-form-item
            :label="$t('system:user.nickname')"
            prop="nickName"
          >
            <el-input
              v-model="form.nickName"
              disabled
            />
          </el-form-item>
        </el-col>
        <el-col
          :span="8"
          :offset="2"
        >
          <el-form-item
            :label="$t('system:loginAccount')"
            prop="userName"
          >
            <el-input
              v-model="form.userName"
              disabled
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <h4 class="form-header h4">{{ $t('system:roleInformation') }}</h4>
    <el-table
      v-loading="loading"
      :row-key="getRowKey"
      @row-click="clickRow"
      ref="table"
      @selection-change="handleSelectionChange"
      :data="roles.slice((pageNum - 1) * pageSize, pageNum * pageSize)"
    >
      <el-table-column
        :label="$t('common:index')"
        type="index"
        align="center"
      >
        <template slot-scope="scope">
          <span>{{ (pageNum - 1) * pageSize + scope.$index + 1 }}</span>
        </template>
      </el-table-column>
      <el-table-column
        type="selection"
        :reserve-selection="true"
        :selectable="checkSelectable"
        width="55"
      ></el-table-column>
      <el-table-column
        :label="$t('system:roleID')"
        align="center"
        prop="roleId"
      />
      <el-table-column
        :label="$t('system:role.name')"
        align="center"
        prop="roleName"
      />
      <el-table-column
        :label="$t('system:permission.code')"
        align="center"
        prop="roleKey"
      />
      <el-table-column
        :label="$t('common:createdTime')"
        align="center"
        prop="createTime"
        width="180"
      >
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="pageNum"
      :limit.sync="pageSize"
    />

    <el-form
      :validate-on-rule-change="false"
      label-width="100px"
    >
      <el-form-item style="text-align: center; margin-left: -120px; margin-top: 30px">
        <el-button
          type="primary"
          @click="submitForm()"
          >{{ $t('common:submit') }}</el-button
        >
        <el-button @click="close()">{{ $t('layout:error.back') }}</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getAuthRole, updateAuthRole } from '@/api/system/user'

export default {
  name: 'AuthRole',
  data() {
    return {
      // 遮罩层
      loading: true,
      // 分页信息
      total: 0,
      pageNum: 1,
      pageSize: 10,
      // 选中角色编号
      roleIds: [],
      // 角色信息
      roles: [],
      // 用户信息
      form: {},
    }
  },
  created() {
    const userId = this.$route.params && this.$route.params.userId
    if (userId) {
      this.loading = true
      getAuthRole(userId).then((response) => {
        this.form = response.user
        this.roles = response.roles
        this.total = this.roles.length
        this.$nextTick(() => {
          this.roles.forEach((row) => {
            if (row.flag) {
              this.$refs.table.toggleRowSelection(row)
            }
          })
        })
        this.loading = false
      })
    }
  },
  methods: {
    /** 单击选中行数据 */
    clickRow(row) {
      if (this.checkSelectable(row)) {
        this.$refs.table.toggleRowSelection(row)
      }
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.roleIds = selection.map((item) => item.roleId)
    },
    // 保存选中的数据编号
    getRowKey(row) {
      return row.roleId
    },
    // 检查角色状态
    checkSelectable(row) {
      return row.status === '0' ? true : false
    },
    /** 提交按钮 */
    submitForm() {
      const userId = this.form.userId
      const roleIds = this.roleIds.join(',')
      updateAuthRole({ userId: userId, roleIds: roleIds }).then(() => {
        this.$modal.msgSuccess(t('system:authorizedSuccessfully'))
        this.close()
      })
    },
    /** 关闭按钮 */
    close() {
      const obj = { path: '/system/user' }
      this.$tab.closeOpenPage(obj)
    },
  },
}
</script>
