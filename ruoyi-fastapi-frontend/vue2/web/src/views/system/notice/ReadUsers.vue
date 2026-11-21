<template>
  <el-dialog
    :title="$t('system:notice.readUsersTitle', { title: noticeTitle })"
    :visible.sync="visible"
    width="760px"
    top="6vh"
    append-to-body
    @close="handleClose"
  >
    <el-form
      :validate-on-rule-change="false"
      :model="queryParams"
      ref="queryForm"
      size="small"
      :inline="true"
      style="margin-bottom: 4px"
    >
      <el-form-item prop="searchValue">
        <el-input
          v-model="queryParams.searchValue"
          :placeholder="$t('system:loginNameUserName')"
          clearable
          prefix-icon="el-icon-search"
          style="width: 220px"
          @keyup.enter.native="handleQuery"
          @clear="handleQuery"
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
      <el-form-item style="float: right; margin-right: 0">
        <span class="read-stat">
          {{ $t('system:notice.total') }} <strong>{{ total }}</strong> {{ $t('system:readers') }}
        </span>
      </el-form-item>
    </el-form>
    <el-table
      v-loading="loading"
      :data="userList"
      size="small"
      stripe
      height="340px"
    >
      <el-table-column
        type="index"
        :label="$t('common:index')"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('system:loginName')"
        prop="userName"
        align="center"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:user.username')"
        prop="nickName"
        align="center"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:user.department')"
        prop="deptName"
        align="center"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('system:user.phone')"
        prop="phonenumber"
        align="center"
        width="120"
      />
      <el-table-column
        :label="$t('system:readAt')"
        prop="readTime"
        align="center"
        width="160"
      >
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.readTime) }}</span>
        </template>
      </el-table-column>
    </el-table>
    <pagination
      v-show="total > 0"
      :total="total"
      :page.sync="queryParams.pageNum"
      :limit.sync="queryParams.pageSize"
      @pagination="getList"
      style="padding: 6px 0px"
    />
  </el-dialog>
</template>

<script>
import { listNoticeReadUsers } from '@/api/system/notice'

export default {
  name: 'ReadUsers',
  data() {
    return {
      visible: false,
      loading: false,
      noticeId: undefined,
      noticeTitle: '',
      total: 0,
      userList: [],
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        noticeId: undefined,
        searchValue: undefined,
      },
    }
  },
  methods: {
    open(row) {
      this.noticeId = row.noticeId
      this.noticeTitle = row.noticeTitle
      this.queryParams.noticeId = row.noticeId
      this.queryParams.searchValue = undefined
      this.queryParams.pageNum = 1
      this.visible = true
      this.getList()
    },
    getList() {
      this.loading = true
      listNoticeReadUsers(this.queryParams)
        .then((res) => {
          this.userList = res.rows
          this.total = res.total
        })
        .finally(() => {
          this.loading = false
        })
    },
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    resetQuery() {
      this.resetForm('queryForm')
      this.handleQuery()
    },
    handleClose() {
      this.userList = []
      this.total = 0
      this.queryParams.searchValue = undefined
    },
  },
}
</script>

<style scoped>
.read-stat {
  font-size: 13px;
  color: #606266;
  line-height: 28px;
}
.read-stat strong {
  color: #409eff;
  font-size: 15px;
  margin: 0 2px;
}
</style>
