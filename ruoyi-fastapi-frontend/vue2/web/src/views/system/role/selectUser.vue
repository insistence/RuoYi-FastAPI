<template>
  <!-- 授权用户 -->
  <el-dialog
    :title="$t('system:selectUsers')"
    :visible.sync="visible"
    width="800px"
    top="5vh"
    append-to-body
  >
    <el-form
      :validate-on-rule-change="false"
      :model="queryParams"
      ref="queryForm"
      size="small"
      :inline="true"
    >
      <el-form-item
        :label="$t('system:user.username')"
        prop="userName"
      >
        <el-input
          v-model="queryParams.userName"
          :placeholder="$t('system:user.usernamePlaceholder')"
          clearable
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
    <el-row>
      <el-table
        @row-click="clickRow"
        ref="table"
        :data="userList"
        @selection-change="handleSelectionChange"
        height="260px"
      >
        <el-table-column
          type="selection"
          width="55"
        ></el-table-column>
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
      </el-table>
      <pagination
        v-show="total > 0"
        :total="total"
        :page.sync="queryParams.pageNum"
        :limit.sync="queryParams.pageSize"
        @pagination="getList"
      />
    </el-row>
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button
        type="primary"
        @click="handleSelectUser"
        >{{ $t('common:confirm') }}</el-button
      >
      <el-button @click="visible = false">{{ $t('common:cancel') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'

import { unallocatedUserList, authUserSelectAll } from '@/api/system/role'
export default {
  dicts: ['sys_normal_disable'],
  props: {
    // 角色编号
    roleId: {
      type: [Number, String],
    },
  },
  data() {
    return {
      // 遮罩层
      visible: false,
      // 选中数组值
      userIds: [],
      // 总条数
      total: 0,
      // 未授权用户数据
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
  methods: {
    // 显示弹框
    show() {
      this.queryParams.roleId = this.roleId
      this.getList()
      this.visible = true
    },
    clickRow(row) {
      this.$refs.table.toggleRowSelection(row)
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.userIds = selection.map((item) => item.userId)
    },
    // 查询表数据
    getList() {
      unallocatedUserList(this.queryParams).then((res) => {
        this.userList = res.rows
        this.total = res.total
      })
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
    /** 选择授权用户操作 */
    handleSelectUser() {
      const roleId = this.queryParams.roleId
      const userIds = this.userIds.join(',')
      if (userIds == '') {
        this.$modal.msgError(t('system:selectUsersToAssign'))
        return
      }
      authUserSelectAll({ roleId: roleId, userIds: userIds }).then((res) => {
        this.$modal.msgSuccess(res.msg)
        this.visible = false
        this.$emit('ok')
      })
    },
  },
}
</script>
