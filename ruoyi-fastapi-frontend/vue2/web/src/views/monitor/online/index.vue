<template>
  <div class="app-container">
    <el-form
      :validate-on-rule-change="false"
      :model="queryParams"
      ref="queryForm"
      size="small"
      :inline="true"
      label-width="68px"
    >
      <el-form-item
        :label="$t('monitor:login.location')"
        prop="ipaddr"
      >
        <el-input
          v-model="queryParams.ipaddr"
          :placeholder="$t('monitor:messages.enterSignInAddress')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
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
    <el-table
      v-loading="loading"
      :data="list.slice((pageNum - 1) * pageSize, pageNum * pageSize)"
      style="width: 100%"
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
        :label="$t('monitor:messages.sessionID')"
        align="center"
        prop="tokenId"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:loginName')"
        align="center"
        prop="userName"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:dept.name')"
        align="center"
        prop="deptName"
      />
      <el-table-column
        :label="$t('monitor:messages.host')"
        align="center"
        prop="ipaddr"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:messages.signInLocation')"
        align="center"
        prop="loginLocation"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('monitor:messages.browser')"
        align="center"
        prop="browser"
      />
      <el-table-column
        :label="$t('monitor:server.os')"
        align="center"
        prop="os"
      />
      <el-table-column
        :label="$t('monitor:login.time')"
        align="center"
        prop="loginTime"
        width="180"
      >
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.loginTime) }}</span>
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
            icon="el-icon-delete"
            @click="handleForceLogout(scope.row)"
            v-hasPermi="['monitor:online:forceLogout']"
            >{{ $t('monitor:messages.forceSignOut') }}</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="pageNum"
      :limit.sync="pageSize"
    />
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { list, forceLogout } from '@/api/monitor/online'

export default {
  name: 'Online',
  data() {
    return {
      // 遮罩层
      loading: true,
      // 总条数
      total: 0,
      // 表格数据
      list: [],
      pageNum: 1,
      pageSize: 10,
      // 查询参数
      queryParams: {
        ipaddr: undefined,
        userName: undefined,
      },
    }
  },
  created() {
    this.getList()
  },
  methods: {
    /** 查询登录日志列表 */
    getList() {
      this.loading = true
      list(this.queryParams).then((response) => {
        this.list = response.rows
        this.total = response.total
        this.loading = false
      })
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm('queryForm')
      this.handleQuery()
    },
    /** 强退按钮操作 */
    handleForceLogout(row) {
      this.$modal
        .confirm(t('monitor:confirmation.forceUserValueToSignOut', { value0: row.userName }))
        .then(function () {
          return forceLogout(row.tokenId)
        })
        .then(() => {
          this.getList()
          this.$modal.msgSuccess(t('monitor:interface.userSignedOut'))
        })
        .catch(() => {})
    },
  },
}
</script>
