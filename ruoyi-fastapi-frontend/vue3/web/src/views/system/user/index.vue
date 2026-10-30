<template>
  <div class="app-container tree-sidebar-manage-wrap">
    <tree-panel
      :title="$t('system:organization')"
      :tree-data="deptOptions"
      :search-placeholder="$t('system:enterDepartmentName')"
      storage-key="dept-sidebar-width"
      :defaultExpandAll="true"
      @node-click="handleNodeClick"
      @refresh="getDeptTree"
      ref="deptTreeRef"
    />
    <div class="tree-sidebar-content">
      <div class="content-inner">
        <el-form
          :model="queryParams"
          ref="queryRef"
          :inline="true"
          v-show="showSearch"
          label-width="auto"
        >
          <el-form-item
            :label="$t('system:userName')"
            prop="userName"
          >
            <el-input
              v-model="queryParams.userName"
              :placeholder="$t('system:enterUserName')"
              clearable
              style="width: 240px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item
            :label="$t('system:phoneNumber')"
            prop="phonenumber"
          >
            <el-input
              v-model="queryParams.phonenumber"
              :placeholder="$t('system:enterPhoneNumber')"
              clearable
              style="width: 240px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item
            :label="$t('system:status')"
            prop="status"
          >
            <el-select
              v-model="queryParams.status"
              :placeholder="$t('system:userStatus')"
              clearable
              style="width: 240px"
            >
              <el-option
                v-for="dict in sys_normal_disable"
                :key="dict.value"
                :label="dict.label"
                :value="dict.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('system:createdAt')"
            style="width: 308px"
          >
            <el-date-picker
              v-model="dateRange"
              value-format="YYYY-MM-DD"
              type="daterange"
              :aria-label="$t('system:dateRangeLabel', { timezone: getDisplayTimezone() })"
              range-separator="-"
              :start-placeholder="$t('system:startDate')"
              :end-placeholder="$t('system:endDate')"
            ></el-date-picker>
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
              v-hasPermi="['system:user:add']"
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
              v-hasPermi="['system:user:edit']"
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
              v-hasPermi="['system:user:remove']"
              >{{ $t('system:delete') }}</el-button
            >
          </el-col>
          <el-col :span="1.5">
            <el-button
              type="info"
              plain
              icon="Upload"
              @click="handleImport"
              v-hasPermi="['system:user:import']"
              >{{ $t('system:import') }}</el-button
            >
          </el-col>
          <el-col :span="1.5">
            <el-button
              type="warning"
              plain
              icon="Download"
              @click="handleExport"
              v-hasPermi="['system:user:export']"
              >{{ $t('system:export') }}</el-button
            >
          </el-col>
          <right-toolbar
            v-model:showSearch="showSearch"
            @queryTable="getList"
            :columns="columns"
            storageKey="xxxxxxxx"
          ></right-toolbar>
        </el-row>

        <el-table
          v-loading="loading"
          :data="userList"
          @selection-change="handleSelectionChange"
        >
          <el-table-column
            type="selection"
            width="50"
            align="center"
          />
          <el-table-column
            :label="$t('system:userID')"
            align="center"
            key="userId"
            prop="userId"
            v-if="columns.userId.visible"
          />
          <el-table-column
            :label="$t('system:userName')"
            align="center"
            key="userName"
            v-if="columns.userName.visible"
            :show-overflow-tooltip="true"
          >
            <template #default="scope">
              <a
                class="link-type"
                style="cursor: pointer"
                @click="handleViewData(scope.row)"
                >{{ scope.row.userName }}</a
              >
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:nickname')"
            align="center"
            key="nickName"
            prop="nickName"
            v-if="columns.nickName.visible"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('system:departmentLabel')"
            align="center"
            key="deptName"
            prop="dept.deptName"
            v-if="columns.deptName.visible"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('system:phoneNumber')"
            align="center"
            key="phonenumber"
            prop="phonenumber"
            v-if="columns.phonenumber.visible"
            width="120"
          />
          <el-table-column
            :label="$t('system:status')"
            align="center"
            key="status"
            v-if="columns.status.visible"
          >
            <template #default="scope">
              <el-switch
                v-model="scope.row.status"
                active-value="0"
                inactive-value="1"
                @change="handleStatusChange(scope.row)"
              ></el-switch>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:createdAt')"
            align="center"
            prop="createTime"
            v-if="columns.createTime.visible"
            width="160"
          >
            <template #default="scope">
              <span>{{ parseTime(scope.row.createTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:actions')"
            align="center"
            width="150"
            class-name="small-padding fixed-width"
          >
            <template #default="scope">
              <el-tooltip
                :content="$t('system:edit')"
                placement="top"
                v-if="scope.row.userId !== 1"
              >
                <el-button
                  link
                  type="primary"
                  icon="Edit"
                  @click="handleUpdate(scope.row)"
                  v-hasPermi="['system:user:edit']"
                ></el-button>
              </el-tooltip>
              <el-tooltip
                :content="$t('system:delete')"
                placement="top"
                v-if="scope.row.userId !== 1"
              >
                <el-button
                  link
                  type="primary"
                  icon="Delete"
                  @click="handleDelete(scope.row)"
                  v-hasPermi="['system:user:remove']"
                ></el-button>
              </el-tooltip>
              <el-tooltip
                :content="$t('system:resetPassword')"
                placement="top"
                v-if="scope.row.userId !== 1"
              >
                <el-button
                  link
                  type="primary"
                  icon="Key"
                  @click="handleResetPwd(scope.row)"
                  v-hasPermi="['system:user:resetPwd']"
                ></el-button>
              </el-tooltip>
              <el-tooltip
                :content="$t('layout:routes.assignRole')"
                placement="top"
                v-if="scope.row.userId !== 1"
              >
                <el-button
                  link
                  type="primary"
                  icon="CircleCheck"
                  @click="handleAuthRole(scope.row)"
                  v-hasPermi="['system:user:edit']"
                ></el-button>
              </el-tooltip>
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
      </div>
    </div>

    <!-- 添加或修改用户配置对话框 -->
    <el-dialog
      :title="typeof title === 'function' ? title() : title"
      v-model="open"
      width="600px"
      append-to-body
    >
      <el-form
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        ref="userRef"
        label-width="auto"
      >
        <el-row>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:nickname')"
              prop="nickName"
            >
              <el-input
                v-model="form.nickName"
                :placeholder="$t('system:enterNickname')"
                maxlength="30"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:departmentLabelText')"
              prop="deptId"
            >
              <el-tree-select
                v-model="form.deptId"
                :data="enabledDeptOptions"
                :props="{ value: 'id', label: 'label', children: 'children' }"
                value-key="id"
                :placeholder="$t('system:selectDepartment')"
                clearable
                check-strictly
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:phoneNumber')"
              prop="phonenumber"
            >
              <el-input
                v-model="form.phonenumber"
                :placeholder="$t('system:enterPhoneNumber')"
                maxlength="11"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:email')"
              prop="email"
            >
              <el-input
                v-model="form.email"
                :placeholder="$t('system:enterEmailAddress')"
                maxlength="50"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item
              v-if="form.userId == undefined"
              :label="$t('system:userName')"
              prop="userName"
            >
              <el-input
                v-model="form.userName"
                :placeholder="$t('system:enterUserName')"
                maxlength="30"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              v-if="form.userId == undefined"
              :label="$t('system:password')"
              prop="password"
              :rules="pwdValidator"
            >
              <el-input
                v-model="form.password"
                :placeholder="$t('system:enterPassword')"
                type="password"
                maxlength="20"
                show-password
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item :label="$t('system:gender')">
              <el-select
                v-model="form.sex"
                :placeholder="$t('system:select')"
              >
                <el-option
                  v-for="dict in sys_user_sex"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('system:status')">
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in sys_normal_disable"
                  :key="dict.value"
                  :value="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item :label="$t('system:post')">
              <el-select
                v-model="form.postIds"
                multiple
                :placeholder="$t('system:select')"
              >
                <el-option
                  v-for="item in postOptions"
                  :key="item.postId"
                  :label="item.postName"
                  :value="item.postId"
                  :disabled="item.status == 1"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('system:role')">
              <el-select
                v-model="form.roleIds"
                multiple
                :placeholder="$t('system:select')"
              >
                <el-option
                  v-for="item in roleOptions"
                  :key="item.roleId"
                  :label="item.roleName"
                  :value="item.roleId"
                  :disabled="item.status == 1"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item :label="$t('system:remarks')">
              <el-input
                v-model="form.remark"
                type="textarea"
                :placeholder="$t('system:enterContent')"
              ></el-input>
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

    <!-- 用户详情抽屉 -->
    <user-view-drawer ref="userViewRef" />
    <!-- 用户导入对话框 -->
    <excel-import-dialog
      ref="importUserRef"
      :title="$t('system:importUsers')"
      action="/system/user/importData"
      template-action="/system/user/importTemplate"
      template-file-name="user_template"
      :update-support-label="$t('system:updateExistingUsers')"
      @success="getList"
    />
  </div>
</template>

<script setup name="User">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { getDisplayTimezone } from '@/utils/time'
import TreePanel from '@/components/TreePanel'
import ExcelImportDialog from '@/components/ExcelImportDialog'
import UserViewDrawer from './view'
import { usePasswordRule } from '@/utils/passwordRule'
import {
  changeUserStatus,
  listUser,
  resetUserPwd,
  delUser,
  getUser,
  updateUser,
  addUser,
  deptTreeSelect,
} from '@/api/system/user'

const router = useRouter()
const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.userRef))
const { pwdValidator, pwdPromptValidator } = usePasswordRule()
const { sys_normal_disable, sys_user_sex } = proxy.useDict('sys_normal_disable', 'sys_user_sex')

const userList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const dateRange = ref([])
const deptOptions = ref(undefined)
const enabledDeptOptions = ref(undefined)
const initPassword = ref(undefined)
const postOptions = ref([])
const roleOptions = ref([])
// 列显隐信息

const columns = ref({
  userId: {
    get label() {
      return t('system:userID')
    },
    visible: true,
  },
  userName: {
    get label() {
      return t('system:userName')
    },
    visible: true,
  },
  nickName: {
    get label() {
      return t('system:nickname')
    },
    visible: true,
  },
  deptName: {
    get label() {
      return t('system:departmentLabel')
    },
    visible: true,
  },
  phonenumber: {
    get label() {
      return t('system:phoneNumber')
    },
    visible: true,
  },
  status: {
    get label() {
      return t('system:status')
    },
    visible: true,
  },
  createTime: {
    get label() {
      return t('system:createdAt')
    },
    visible: true,
  },
})

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    userName: undefined,
    phonenumber: undefined,
    status: undefined,
    deptId: undefined,
  },
  rules: {
    userName: [
      {
        required: true,
        get message() {
          return t('system:userNameIsRequired')
        },
        trigger: 'blur',
      },
      {
        min: 2,
        max: 20,
        get message() {
          return t('system:userNameMustBeBetween2And20Characters')
        },
        trigger: 'blur',
      },
    ],
    nickName: [
      {
        required: true,
        get message() {
          return t('system:nicknameIsRequired')
        },
        trigger: 'blur',
      },
    ],
    email: [
      {
        type: 'email',
        get message() {
          return t('system:enterAValidEmailAddress')
        },
        trigger: ['blur', 'change'],
      },
    ],
    phonenumber: [
      {
        pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/,
        get message() {
          return t('system:enterAValidPhoneNumber')
        },
        trigger: 'blur',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询用户列表 */
function getList() {
  loading.value = true
  listUser(proxy.addDateRange(queryParams.value, dateRange.value)).then((res) => {
    loading.value = false
    userList.value = res.rows
    total.value = res.total
  })
}
/** 查询部门下拉树结构 */
function getDeptTree() {
  deptTreeSelect().then((response) => {
    deptOptions.value = response.data
    enabledDeptOptions.value = filterDisabledDept(JSON.parse(JSON.stringify(response.data)))
  })
}
/** 过滤禁用的部门 */
function filterDisabledDept(deptList) {
  return deptList.filter((dept) => {
    if (dept.disabled) {
      return false
    }
    if (dept.children && dept.children.length) {
      dept.children = filterDisabledDept(dept.children)
    }
    return true
  })
}
/** 节点单击事件 */
function handleNodeClick(data) {
  queryParams.value.deptId = data.id
  handleQuery()
}
/** 搜索按钮操作 */
function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}
/** 重置按钮操作 */
function resetQuery() {
  dateRange.value = []
  proxy.resetForm('queryRef')
  queryParams.value.deptId = undefined
  proxy.$refs.deptTreeRef.setCurrentKey(null)
  handleQuery()
}
/** 删除按钮操作 */
function handleDelete(row) {
  const userIds = row.userId || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: userIds }))
    .then(function () {
      return delUser(userIds)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
    })
    .catch(() => {})
}
/** 导出按钮操作 */
function handleExport() {
  proxy.download(
    'system/user/export',
    {
      ...queryParams.value,
    },
    `user_${new Date().getTime()}.xlsx`
  )
}
/** 用户状态修改  */
function handleStatusChange(row) {
  let text = row.status === '0' ? t('system:enable') : t('system:disabled')
  proxy.$modal
    .confirm(t('system:confirmation.userStatus', { action: text, name: row.userName }))
    .then(function () {
      return changeUserStatus(row.userId, row.status)
    })
    .then(() => {
      proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
    })
    .catch(function () {
      row.status = row.status === '0' ? '1' : '0'
    })
}
/** 更多操作 */
function handleCommand(command, row) {
  switch (command) {
    case 'handleResetPwd':
      handleResetPwd(row)
      break
    case 'handleAuthRole':
      handleAuthRole(row)
      break
    default:
      break
  }
}
/** 跳转角色分配 */
function handleAuthRole(row) {
  const userId = row.userId
  router.push('/system/user-auth/role/' + userId)
}
/** 重置密码按钮操作 */
function handleResetPwd(row) {
  proxy
    .$prompt(t('system:password.prompt', { name: row.userName }), t('system:resetPassword'), {
      confirmButtonText: t('common:confirm'),
      cancelButtonText: t('common:cancel'),
      closeOnClickModal: false,
      inputValidator: pwdPromptValidator,
    })
    .then(({ value }) => {
      resetUserPwd(row.userId, value).then(() => {
        proxy.$modal.msgSuccess(t('system:password.updated', { password: value }))
      })
    })
    .catch(() => {})
}
/** 选择条数  */
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.userId)
  single.value = selection.length != 1
  multiple.value = !selection.length
}
/** 详情按钮操作 */
function handleViewData(row) {
  proxy.$refs['userViewRef'].open(row.userId)
}
/** 导入按钮操作 */
function handleImport() {
  proxy.$refs['importUserRef'].open()
}
/** 重置操作表单 */
function reset() {
  form.value = {
    userId: undefined,
    deptId: undefined,
    userName: undefined,
    nickName: undefined,
    password: undefined,
    phonenumber: undefined,
    email: undefined,
    sex: undefined,
    status: '0',
    remark: undefined,
    postIds: [],
    roleIds: [],
  }
  proxy.resetForm('userRef')
}
/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}
/** 新增按钮操作 */
function handleAdd() {
  reset()
  getUser().then((response) => {
    postOptions.value = response.posts
    roleOptions.value = response.roles
    open.value = true
    title.value = () => t('system:addUser')
    form.value.password = initPassword.value
  })
}
/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  const userId = row.userId || ids.value
  getUser(userId).then((response) => {
    form.value = response.data
    postOptions.value = response.posts
    roleOptions.value = response.roles
    form.value.postIds = response.postIds
    form.value.roleIds = response.roleIds
    open.value = true
    title.value = () => t('system:editUser')
    form.value.password = undefined
  })
}
/** 提交按钮 */
function submitForm() {
  proxy.$refs['userRef'].validate((valid) => {
    if (valid) {
      if (form.value.userId != undefined) {
        updateUser(form.value).then(() => {
          proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
          open.value = false
          getList()
        })
      } else {
        addUser(form.value).then(() => {
          proxy.$modal.msgSuccess(t('system:addedSuccessfully'))
          open.value = false
          getList()
        })
      }
    }
  })
}

onMounted(() => {
  getDeptTree()
  getList()
  proxy.getConfigKey('sys.user.initPassword').then((response) => {
    initPassword.value = response.msg
  })
})
// 时区变化后重新查询日期范围，保留正在编辑的表单。
watch(getDisplayTimezone, () => {
  if (dateRange.value?.length) {
    handleQuery()
  }
})
</script>
