<template>
  <div class="app-container">
    <el-form
      :validate-on-rule-change="false"
      :model="queryParams"
      ref="queryForm"
      size="small"
      :inline="true"
      v-show="showSearch"
    >
      <el-form-item
        :label="$t('system:user.username')"
        prop="userName"
      >
        <el-input
          v-model="queryParams.userName"
          :placeholder="$t('system:user.usernamePlaceholder')"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:user.phone')"
        prop="phonenumber"
      >
        <el-input
          v-model="queryParams.phonenumber"
          :placeholder="$t('system:user.phonePlaceholder')"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item>
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
          icon="el-icon-plus"
          size="mini"
          @click="openSelectUser"
          v-hasPermi="['system:role:add']"
          >{{ $t('system:addUser') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="el-icon-circle-close"
          size="mini"
          :disabled="multiple"
          @click="cancelAuthUserAll"
          v-hasPermi="['system:role:remove']"
          >{{ $t('system:revokeSelectedAuthorizations') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="el-icon-close"
          size="mini"
          @click="handleClose"
          >{{ $t('layout:search.close') }}</el-button
        >
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-loading="loading"
      :data="userList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('system:user.username')"
        prop="userName"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:user.nickname')"
        prop="nickName"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:user.email')"
        prop="email"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:phone')"
        prop="phonenumber"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('common:status')"
        align="center"
        prop="status"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.sys_normal_disable"
            :value="scope.row.status"
          />
        </template>
      </el-table-column>
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
      <el-table-column
        :label="$t('common:actions')"
        align="center"
        class-name="small-padding fixed-width"
      >
        <template slot-scope="scope">
          <el-button
            size="mini"
            type="text"
            icon="el-icon-circle-close"
            @click="cancelAuthUser(scope.row)"
            v-hasPermi="['system:role:remove']"
            >{{ $t('system:revokeAuthorization') }}</el-button
          >
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
    <select-user
      ref="select"
      :roleId="queryParams.roleId"
      @ok="handleQuery"
    />
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { allocatedUserList, authUserCancel, authUserCancelAll } from '@/api/system/role'
import selectUser from './selectUser'

export default {
  name: 'AuthUser',
  dicts: ['sys_normal_disable'],
  components: { selectUser },
  data() {
    return {
      // 遮罩层
      loading: true,
      // 选中用户组
      userIds: [],
      // 非多个禁用
      multiple: true,
      // 显示搜索条件
      showSearch: true,
      // 总条数
      total: 0,
      // 用户表格数据
      userList: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        roleId: undefined,
        userName: undefined,
        phonenumber: undefined,
      },
    }
  },
  created() {
    const roleId = this.$route.params && this.$route.params.roleId
    if (roleId) {
      this.queryParams.roleId = roleId
      this.getList()
    }
  },
  methods: {
    /** 查询授权用户列表 */
    getList() {
      this.loading = true
      allocatedUserList(this.queryParams).then((response) => {
        this.userList = response.rows
        this.total = response.total
        this.loading = false
      })
    },
    // 返回按钮
    handleClose() {
      const obj = { path: '/system/role' }
      this.$tab.closeOpenPage(obj)
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm('queryForm')
      this.handleQuery()
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.userIds = selection.map((item) => item.userId)
      this.multiple = !selection.length
    },
    /** 打开授权用户表弹窗 */
    openSelectUser() {
      this.$refs.select.show()
    },
    /** 取消授权按钮操作 */
    cancelAuthUser(row) {
      const roleId = this.queryParams.roleId
      this.$modal
        .confirm(t('system:confirmation.revokeThisRoleFromUserValue', { value0: row.userName }))
        .then(function () {
          return authUserCancel({ userId: row.userId, roleId: roleId })
        })
        .then(() => {
          this.getList()
          this.$modal.msgSuccess(t('system:authorizationRevoked'))
        })
        .catch(() => {})
    },
    /** 批量取消授权按钮操作 */
    cancelAuthUserAll() {
      const roleId = this.queryParams.roleId
      const userIds = this.userIds.join(',')
      this.$modal
        .confirm(t('system:interface.revokeAuthorizationForTheSelectedUsers'))
        .then(function () {
          return authUserCancelAll({ roleId: roleId, userIds: userIds })
        })
        .then(() => {
          this.getList()
          this.$modal.msgSuccess(t('system:authorizationRevoked'))
        })
        .catch(() => {})
    },
  },
}
</script>
