<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
    >
      <el-form-item
        :label="$t('system:announcementTitle')"
        prop="noticeTitle"
      >
        <el-input
          v-model="queryParams.noticeTitle"
          :placeholder="$t('system:enterAnnouncementTitle')"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:operator')"
        prop="createBy"
      >
        <el-input
          v-model="queryParams.createBy"
          :placeholder="$t('system:enterOperatorName')"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:type')"
        prop="noticeType"
      >
        <el-select
          v-model="queryParams.noticeType"
          :placeholder="$t('system:announcementType')"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="dict in sys_notice_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          icon="Search"
          @click="handleQuery"
          >{{ $t('system:search') }}</el-button
        >
        <el-button
          icon="Refresh"
          @click="resetQuery"
          >{{ $t('system:reset') }}</el-button
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
          icon="Plus"
          @click="handleAdd"
          v-hasPermi="['system:notice:add']"
          >{{ $t('system:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="success"
          plain
          icon="Edit"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['system:notice:edit']"
          >{{ $t('system:edit') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          plain
          icon="Delete"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['system:notice:remove']"
          >{{ $t('system:delete') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
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
        :label="$t('system:noLabel')"
        align="center"
        prop="noticeId"
        width="100"
      />
      <el-table-column
        :label="$t('system:announcementTitle')"
        align="center"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">
          <a
            class="link-type"
            style="cursor: pointer"
            @click="handleViewData(scope.row)"
            >{{ scope.row.noticeTitle }}</a
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:announcementType')"
        align="center"
        prop="noticeType"
        width="100"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_notice_type"
            :value="scope.row.noticeType"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:status')"
        align="center"
        prop="status"
        width="100"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_notice_status"
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
        :label="$t('system:createdAt')"
        align="center"
        prop="createTime"
        width="100"
      >
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-button
            link
            type="primary"
            icon="User"
            @click="handleReadUsers(scope.row)"
            v-hasPermi="['system:notice:list']"
            >{{ $t('system:readersLabel') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:notice:edit']"
            >{{ $t('system:edit') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:notice:remove']"
            >{{ $t('system:delete') }}</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <!-- 添加或修改公告对话框 -->
    <el-dialog
      :title="typeof title === 'function' ? title() : title"
      v-model="open"
      width="780px"
      append-to-body
    >
      <el-form
        ref="noticeRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="auto"
      >
        <el-row>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:announcementTitle')"
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
              :label="$t('system:announcementType')"
              prop="noticeType"
            >
              <el-select
                v-model="form.noticeType"
                :placeholder="$t('system:select')"
              >
                <el-option
                  v-for="dict in sys_notice_type"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="$t('system:status')">
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in sys_notice_status"
                  :key="dict.value"
                  :value="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="$t('system:content')">
              <editor
                v-model="form.noticeContent"
                :min-height="192"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            type="primary"
            @click="submitForm"
            >{{ $t('system:confirm') }}</el-button
          >
          <el-button @click="cancel">{{ $t('system:cancel') }}</el-button>
        </div>
      </template>
    </el-dialog>
    <notice-detail-view ref="noticeViewRef" />
    <read-users-dialog ref="readUsersRef" />
  </div>
</template>

<script setup name="Notice">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import NoticeDetailView from '@/layout/components/HeaderNotice/DetailView'
import ReadUsersDialog from './ReadUsers'
import { listNotice, getNotice, delNotice, addNotice, updateNotice } from '@/api/system/notice'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.noticeRef))
const { sys_notice_status, sys_notice_type } = proxy.useDict('sys_notice_status', 'sys_notice_type')

const noticeList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    noticeTitle: undefined,
    createBy: undefined,
    status: undefined,
  },
  rules: {
    noticeTitle: [
      {
        required: true,
        get message() {
          return t('system:announcementTitleIsRequired')
        },
        trigger: 'blur',
      },
    ],
    noticeType: [
      {
        required: true,
        get message() {
          return t('system:announcementTypeIsRequired')
        },
        trigger: 'change',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询公告列表 */
function getList() {
  loading.value = true
  listNotice(queryParams.value).then((response) => {
    noticeList.value = response.rows
    total.value = response.total
    loading.value = false
  })
}
/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}
/** 表单重置 */
function reset() {
  form.value = {
    noticeId: undefined,
    noticeTitle: undefined,
    noticeType: undefined,
    noticeContent: undefined,
    status: '0',
  }
  proxy.resetForm('noticeRef')
}
/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}
/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}
/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.noticeId)
  single.value = selection.length != 1
  multiple.value = !selection.length
}
/** 新增按钮操作 */
function handleAdd() {
  reset()
  open.value = true
  title.value = () => t('system:addAnnouncement')
}
/**修改按钮操作 */
function handleUpdate(row) {
  reset()
  const noticeId = row.noticeId || ids.value
  getNotice(noticeId).then((response) => {
    form.value = response.data
    open.value = true
    title.value = () => t('system:editAnnouncement')
  })
}
/** 提交按钮 */
function submitForm() {
  proxy.$refs['noticeRef'].validate((valid) => {
    if (valid) {
      if (form.value.noticeId != undefined) {
        updateNotice(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
          open.value = false
          getList()
        })
      } else {
        addNotice(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('system:addedSuccessfully'))
          open.value = false
          getList()
        })
      }
    }
  })
}

/** 查看公告详情 */
function handleViewData(row) {
  proxy.$refs['noticeViewRef'].open(row)
}

/** 查看已读用户 */
function handleReadUsers(row) {
  proxy.$refs['readUsersRef'].open(row)
}

/** 删除按钮操作 */
function handleDelete(row) {
  const noticeIds = row.noticeId || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: noticeIds }))
    .then(function () {
      return delNotice(noticeIds)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
    })
    .catch(() => {})
}

getList()
</script>
