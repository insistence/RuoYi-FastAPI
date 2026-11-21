<template>
  <div class="app-container">
    <el-form
      :validate-on-rule-change="false"
      :model="queryParams"
      ref="queryForm"
      size="small"
      :inline="true"
      v-show="showSearch"
      label-width="68px"
    >
      <el-form-item
        :label="$t('system:notice.titleLabel')"
        prop="noticeTitle"
      >
        <el-input
          v-model="queryParams.noticeTitle"
          :placeholder="$t('system:enterAnnouncementTitle')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('monitor:log.operator')"
        prop="createBy"
      >
        <el-input
          v-model="queryParams.createBy"
          :placeholder="$t('system:enterOperatorName')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('common:type')"
        prop="noticeType"
      >
        <el-select
          v-model="queryParams.noticeType"
          :placeholder="$t('system:notice.type')"
          clearable
        >
          <el-option
            v-for="dict in dict.type.sys_notice_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
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
          @click="handleAdd"
          v-hasPermi="['system:notice:add']"
          >{{ $t('common:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="el-icon-edit"
          size="mini"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['system:notice:edit']"
          >{{ $t('common:edit') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="el-icon-delete"
          size="mini"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['system:notice:remove']"
          >{{ $t('common:delete') }}</el-button
        >
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-loading="loading"
      :data="noticeList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('common:index')"
        align="center"
        prop="noticeId"
        width="100"
      />
      <el-table-column
        :label="$t('system:notice.titleLabel')"
        align="center"
        :show-overflow-tooltip="true"
      >
        <template slot-scope="scope">
          <a
            class="link-type"
            style="cursor: pointer"
            @click="handleViewData(scope.row)"
            >{{ scope.row.noticeTitle }}</a
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:notice.type')"
        align="center"
        prop="noticeType"
        width="100"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.sys_notice_type"
            :value="scope.row.noticeType"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('common:status')"
        align="center"
        prop="status"
        width="100"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.sys_notice_status"
            :value="scope.row.status"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:createdBy')"
        align="center"
        prop="createBy"
        width="100"
      />
      <el-table-column
        :label="$t('common:createdTime')"
        align="center"
        prop="createTime"
        width="100"
      >
        <template slot-scope="scope">
          <span>{{ parseTime(scope.row.createTime, '{y}-{m}-{d}') }}</span>
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
            icon="el-icon-user"
            @click="handleReadUsers(scope.row)"
            v-hasPermi="['system:notice:list']"
            >{{ $t('system:readersLabel') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:notice:edit']"
            >{{ $t('common:edit') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:notice:remove']"
            >{{ $t('common:delete') }}</el-button
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

    <!-- 添加或修改公告对话框 -->
    <el-dialog
      :title="$t(titleKey)"
      :visible.sync="open"
      width="780px"
      append-to-body
    >
      <el-form
        :validate-on-rule-change="false"
        ref="form"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <el-row>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:notice.titleLabel')"
              prop="noticeTitle"
            >
              <el-input
                v-model="form.noticeTitle"
                :placeholder="$t('system:enterAnnouncementTitle')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:notice.type')"
              prop="noticeType"
            >
              <el-select
                v-model="form.noticeType"
                :placeholder="$t('system:interface.selectAnAnnouncementType')"
              >
                <el-option
                  v-for="dict in dict.type.sys_notice_type"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="$t('common:status')">
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in dict.type.sys_notice_status"
                  :key="dict.value"
                  :label="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="$t('system:file.content')">
              <editor
                v-model="form.noticeContent"
                :min-height="192"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <div
        slot="footer"
        class="dialog-footer"
      >
        <el-button
          type="primary"
          @click="submitForm"
          >{{ $t('common:confirm') }}</el-button
        >
        <el-button @click="cancel">{{ $t('common:cancel') }}</el-button>
      </div>
    </el-dialog>

    <notice-detail-view ref="noticeViewRef" />
    <read-users-dialog ref="readUsersRef" />
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import NoticeDetailView from '@/layout/components/HeaderNotice/DetailView'
import ReadUsersDialog from './ReadUsers'
import { listNotice, getNotice, delNotice, addNotice, updateNotice } from '@/api/system/notice'

export default {
  name: 'Notice',
  components: { NoticeDetailView, ReadUsersDialog },
  dicts: ['sys_notice_status', 'sys_notice_type'],
  data() {
    return {
      // 遮罩层
      loading: true,
      // 选中数组
      ids: [],
      // 非单个禁用
      single: true,
      // 非多个禁用
      multiple: true,
      // 显示搜索条件
      showSearch: true,
      // 总条数
      total: 0,
      // 公告表格数据
      noticeList: [],
      // 弹出层标题
      titleKey: '',
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        noticeTitle: undefined,
        createBy: undefined,
        status: undefined,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        noticeTitle: [
          {
            required: true,
            message: () => t('system:announcementTitleIsRequired'),
            trigger: 'blur',
          },
        ],
        noticeType: [
          {
            required: true,
            message: () => t('system:announcementTypeIsRequired'),
            trigger: 'change',
          },
        ],
      },
    }
  },
  created() {
    this.getList()
  },
  methods: {
    /** 查询公告列表 */
    getList() {
      this.loading = true
      listNotice(this.queryParams).then((response) => {
        this.noticeList = response.rows
        this.total = response.total
        this.loading = false
      })
    },
    // 取消按钮
    cancel() {
      this.open = false
      this.reset()
    },
    // 表单重置
    reset() {
      this.form = {
        noticeId: undefined,
        noticeTitle: undefined,
        noticeType: undefined,
        noticeContent: undefined,
        status: '0',
      }
      this.resetForm('form')
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
      this.ids = selection.map((item) => item.noticeId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset()
      this.open = true
      this.titleKey = 'system:addAnnouncement'
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      const noticeId = row.noticeId || this.ids
      getNotice(noticeId).then((response) => {
        this.form = response.data
        this.open = true
        this.titleKey = 'system:editAnnouncement'
      })
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          if (this.form.noticeId != undefined) {
            updateNotice(this.form).then(() => {
              this.$modal.msgSuccess(t('common:updateSuccess'))
              this.open = false
              this.getList()
            })
          } else {
            addNotice(this.form).then(() => {
              this.$modal.msgSuccess(t('common:addSuccess'))
              this.open = false
              this.getList()
            })
          }
        }
      })
    },
    /** 查看公告详情 */
    handleViewData(row) {
      this.$refs.noticeViewRef.open(row)
    },
    /** 查看已读用户 */
    handleReadUsers(row) {
      this.$refs.readUsersRef.open(row)
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      const noticeIds = row.noticeId || this.ids
      this.$modal
        .confirm(t('system:confirmation.deleteAnnouncementsWithIDsValue', { value0: noticeIds }))
        .then(function () {
          return delNotice(noticeIds)
        })
        .then(() => {
          this.getList()
          this.$modal.msgSuccess(t('common:deleteSuccess'))
        })
        .catch(() => {})
    },
  },
}
</script>
