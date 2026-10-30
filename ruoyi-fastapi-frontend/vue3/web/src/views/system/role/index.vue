<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      v-show="showSearch"
      :inline="true"
      label-width="auto"
    >
      <el-form-item
        :label="$t('system:roleName')"
        prop="roleName"
      >
        <el-input
          v-model="queryParams.roleName"
          :placeholder="$t('system:enterRoleName')"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:permissionString')"
        prop="roleKey"
      >
        <el-input
          v-model="queryParams.roleKey"
          :placeholder="$t('system:enterPermissionString')"
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
          :placeholder="$t('system:roleStatus')"
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
          v-hasPermi="['system:role:add']"
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
          v-hasPermi="['system:role:edit']"
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
          v-hasPermi="['system:role:remove']"
          >{{ $t('system:delete') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Download"
          @click="handleExport"
          v-hasPermi="['system:role:export']"
          >{{ $t('system:export') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <!-- 表格数据 -->
    <el-table
      v-loading="loading"
      :data="roleList"
      @selection-change="handleSelectionChange"
    >
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      <el-table-column
        :label="$t('system:roleID')"
        prop="roleId"
        width="120"
      />
      <el-table-column
        :label="$t('system:roleName')"
        prop="roleName"
        :show-overflow-tooltip="true"
        width="150"
      />
      <el-table-column
        :label="$t('system:permissionString')"
        prop="roleKey"
        :show-overflow-tooltip="true"
        width="150"
      />
      <el-table-column
        :label="$t('system:displayOrderLabel')"
        prop="roleSort"
        width="100"
      />
      <el-table-column
        :label="$t('system:status')"
        align="center"
        width="100"
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
      >
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-tooltip
            :content="$t('system:edit')"
            placement="top"
            :disabled="!pageActive || open || openDataScope"
            v-if="scope.row.roleId !== 1"
          >
            <el-button
              link
              type="primary"
              icon="Edit"
              @click="handleUpdate(scope.row)"
              v-hasPermi="['system:role:edit']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('system:delete')"
            placement="top"
            :disabled="!pageActive || open || openDataScope"
            v-if="scope.row.roleId !== 1"
          >
            <el-button
              link
              type="primary"
              icon="Delete"
              @click="handleDelete(scope.row)"
              v-hasPermi="['system:role:remove']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('system:dataScope')"
            placement="top"
            :disabled="!pageActive || open || openDataScope"
            v-if="scope.row.roleId !== 1"
          >
            <el-button
              link
              type="primary"
              icon="CircleCheck"
              @click="handleDataScope(scope.row)"
              v-hasPermi="['system:role:edit']"
            ></el-button>
          </el-tooltip>
          <el-tooltip
            :content="$t('layout:routes.assignUser')"
            placement="top"
            :disabled="!pageActive || open || openDataScope"
            v-if="scope.row.roleId !== 1"
          >
            <el-button
              link
              type="primary"
              icon="User"
              @click="handleAuthUser(scope.row)"
              v-hasPermi="['system:role:edit']"
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

    <!-- 添加或修改角色配置对话框 -->
    <el-dialog
      :title="typeof title === 'function' ? title() : title"
      v-model="open"
      width="500px"
      append-to-body
    >
      <el-form
        ref="roleRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="auto"
      >
        <el-form-item
          :label="$t('system:roleName')"
          prop="roleName"
        >
          <el-input
            v-model="form.roleName"
            :placeholder="$t('system:enterRoleName')"
          />
        </el-form-item>
        <el-form-item prop="roleKey">
          <template #label>
            <span>
              <el-tooltip
                :content="
                  $t(
                    'system:rolePermissionDefinedInTheControllerEGRoleInterfaceAuthDependencyAdmin'
                  )
                "
                placement="top"
              >
                <el-icon><question-filled /></el-icon>
              </el-tooltip>
              {{ $t('system:permissionString') }}</span
            >
          </template>
          <el-input
            v-model="form.roleKey"
            :placeholder="$t('system:enterPermissionString')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:roleOrder')"
          prop="roleSort"
        >
          <el-input-number
            v-model="form.roleSort"
            controls-position="right"
            :min="0"
          />
        </el-form-item>
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
        <el-form-item :label="$t('system:menuPermissions')">
          <el-checkbox
            v-model="menuExpand"
            @change="handleCheckedTreeExpand($event, 'menu')"
            >{{ $t('system:expandCollapse') }}</el-checkbox
          >
          <el-checkbox
            v-model="menuNodeAll"
            @change="handleCheckedTreeNodeAll($event, 'menu')"
            >{{ $t('system:selectDeselectAll') }}</el-checkbox
          >
          <el-checkbox
            v-model="form.menuCheckStrictly"
            @change="handleCheckedTreeConnect($event, 'menu')"
            >{{ $t('system:linkParentAndChildSelection') }}</el-checkbox
          >
          <el-tree
            class="tree-border"
            :data="menuOptions"
            show-checkbox
            ref="menuRef"
            node-key="id"
            :check-strictly="!form.menuCheckStrictly"
            :empty-text="$t('system:loadingPleaseWait')"
            :props="{
              label: (item) => resolveText(item.label, item.labelI18n),
              children: 'children',
            }"
          ></el-tree>
        </el-form-item>
        <el-form-item :label="$t('system:remarks')">
          <el-input
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('system:enterContent')"
          ></el-input>
        </el-form-item>
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

    <!-- 分配角色数据权限对话框 -->
    <el-dialog
      :title="title"
      v-model="openDataScope"
      width="500px"
      append-to-body
    >
      <el-form
        :model="form"
        label-width="auto"
      >
        <el-form-item :label="$t('system:roleName')">
          <el-input
            v-model="form.roleName"
            :disabled="true"
          />
        </el-form-item>
        <el-form-item :label="$t('system:permissionString')">
          <el-input
            v-model="form.roleKey"
            :disabled="true"
          />
        </el-form-item>
        <el-form-item :label="$t('system:permissionScope')">
          <el-select
            v-model="form.dataScope"
            @change="dataScopeSelectChange"
          >
            <el-option
              v-for="item in dataScopeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item
          :label="$t('system:dataScope')"
          v-show="form.dataScope == 2"
        >
          <el-checkbox
            v-model="deptExpand"
            @change="handleCheckedTreeExpand($event, 'dept')"
            >{{ $t('system:expandCollapse') }}</el-checkbox
          >
          <el-checkbox
            v-model="deptNodeAll"
            @change="handleCheckedTreeNodeAll($event, 'dept')"
            >{{ $t('system:selectDeselectAll') }}</el-checkbox
          >
          <el-checkbox
            v-model="form.deptCheckStrictly"
            @change="handleCheckedTreeConnect($event, 'dept')"
            >{{ $t('system:linkParentAndChildSelection') }}</el-checkbox
          >
          <el-tree
            class="tree-border"
            :data="deptOptions"
            show-checkbox
            default-expand-all
            ref="deptRef"
            node-key="id"
            :check-strictly="!form.deptCheckStrictly"
            :empty-text="$t('system:loadingPleaseWait')"
            :props="{
              label: (item) => resolveText(item.label, item.labelI18n),
              children: 'children',
            }"
          ></el-tree>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            type="primary"
            @click="submitDataScope"
            >{{ $t('system:confirm') }}</el-button
          >
          <el-button @click="cancelDataScope">{{ $t('system:cancel') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Role">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { resolveText } from '@/i18n/adapter'
import { getDisplayTimezone } from '@/utils/time'
import {
  addRole,
  changeRoleStatus,
  dataScope,
  delRole,
  getRole,
  listRole,
  updateRole,
  deptTreeSelect,
} from '@/api/system/role'
import { roleMenuTreeselect, treeselect as menuTreeselect } from '@/api/system/menu'

const router = useRouter()
const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.roleRef))
const { sys_normal_disable } = proxy.useDict('sys_normal_disable')

const roleList = ref([])
const pageActive = ref(true)
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const dateRange = ref([])
const menuOptions = ref([])
const menuExpand = ref(false)
const menuNodeAll = ref(false)
const deptExpand = ref(true)
const deptNodeAll = ref(false)
const deptOptions = ref([])
const openDataScope = ref(false)
const menuRef = ref(null)
const deptRef = ref(null)

// 缓存页离开或打开表单时关闭行操作提示，避免传送到 body 的浮层遮挡下一页。
onActivated(() => {
  pageActive.value = true
})
onDeactivated(() => {
  pageActive.value = false
})

/** 数据范围选项*/
const dataScopeOptions = ref([
  {
    value: '1',
    get label() {
      return t('system:allData')
    },
  },
  {
    value: '2',
    get label() {
      return t('system:customDataScope')
    },
  },
  {
    value: '3',
    get label() {
      return t('system:thisDepartment')
    },
  },
  {
    value: '4',
    get label() {
      return t('system:thisDepartmentAndItsSubdepartments')
    },
  },
  {
    value: '5',
    get label() {
      return t('system:ownDataOnly')
    },
  },
])

const data = reactive({
  form: {},
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    roleName: undefined,
    roleKey: undefined,
    status: undefined,
  },
  rules: {
    roleName: [
      {
        required: true,
        get message() {
          return t('system:roleNameIsRequired')
        },
        trigger: 'blur',
      },
    ],
    roleKey: [
      {
        required: true,
        get message() {
          return t('system:permissionStringIsRequired')
        },
        trigger: 'blur',
      },
    ],
    roleSort: [
      {
        required: true,
        get message() {
          return t('system:roleOrderIsRequired')
        },
        trigger: 'blur',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询角色列表 */
function getList() {
  loading.value = true
  listRole(proxy.addDateRange(queryParams.value, dateRange.value)).then((response) => {
    roleList.value = response.rows
    total.value = response.total
    loading.value = false
  })
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
  handleQuery()
}
/** 删除按钮操作 */
function handleDelete(row) {
  const roleIds = row.roleId || ids.value
  proxy.$modal
    .confirm(t('system:confirmation.deleteIds', { ids: roleIds }))
    .then(function () {
      return delRole(roleIds)
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
    'system/role/export',
    {
      ...queryParams.value,
    },
    `role_${new Date().getTime()}.xlsx`
  )
}
/** 多选框选中数据 */
function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.roleId)
  single.value = selection.length != 1
  multiple.value = !selection.length
}
/** 角色状态修改 */
function handleStatusChange(row) {
  let text = row.status === '0' ? t('system:enable') : t('system:disabled')
  proxy.$modal
    .confirm(t('system:confirmation.roleStatus', { action: text, name: row.roleName }))
    .then(function () {
      return changeRoleStatus(row.roleId, row.status)
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
    case 'handleDataScope':
      handleDataScope(row)
      break
    case 'handleAuthUser':
      handleAuthUser(row)
      break
    default:
      break
  }
}
/** 分配用户 */
function handleAuthUser(row) {
  router.push('/system/role-auth/user/' + row.roleId)
}
/** 查询菜单树结构 */
function getMenuTreeselect() {
  menuTreeselect().then((response) => {
    menuOptions.value = response.data
  })
}
/** 所有部门节点数据 */
function getDeptAllCheckedKeys() {
  // 目前被选中的部门节点
  let checkedKeys = deptRef.value.getCheckedKeys()
  // 半选中的部门节点
  let halfCheckedKeys = deptRef.value.getHalfCheckedKeys()
  checkedKeys.unshift.apply(checkedKeys, halfCheckedKeys)
  return checkedKeys
}
/** 重置新增的表单以及其他数据  */
function reset() {
  if (menuRef.value != undefined) {
    menuRef.value.setCheckedKeys([])
  }
  menuExpand.value = false
  menuNodeAll.value = false
  deptExpand.value = true
  deptNodeAll.value = false
  form.value = {
    roleId: undefined,
    roleName: undefined,
    roleKey: undefined,
    roleSort: 0,
    status: '0',
    menuIds: [],
    deptIds: [],
    menuCheckStrictly: true,
    deptCheckStrictly: true,
    remark: undefined,
  }
  proxy.resetForm('roleRef')
}
/** 添加角色 */
function handleAdd() {
  reset()
  getMenuTreeselect()
  open.value = true
  title.value = () => t('system:addRole')
}
/** 修改角色 */
function handleUpdate(row) {
  reset()
  const roleId = row.roleId || ids.value
  const roleMenu = getRoleMenuTreeselect(roleId)
  getRole(roleId).then((response) => {
    form.value = response.data
    form.value.roleSort = Number(form.value.roleSort)
    open.value = true
    nextTick(() => {
      roleMenu.then((res) => {
        let checkedKeys = res.checkedKeys
        checkedKeys.forEach((v) => {
          nextTick(() => {
            menuRef.value.setChecked(v, true, false)
          })
        })
      })
    })
  })
  title.value = () => t('system:editRole')
}
/** 根据角色ID查询菜单树结构 */
function getRoleMenuTreeselect(roleId) {
  return roleMenuTreeselect(roleId).then((response) => {
    menuOptions.value = response.menus
    return response
  })
}
/** 根据角色ID查询部门树结构 */
function getDeptTree(roleId) {
  return deptTreeSelect(roleId).then((response) => {
    deptOptions.value = response.depts
    return response
  })
}
/** 树权限（展开/折叠）*/
function handleCheckedTreeExpand(value, type) {
  if (type == 'menu') {
    let treeList = menuOptions.value
    for (let i = 0; i < treeList.length; i++) {
      menuRef.value.store.nodesMap[treeList[i].id].expanded = value
    }
  } else if (type == 'dept') {
    let treeList = deptOptions.value
    for (let i = 0; i < treeList.length; i++) {
      deptRef.value.store.nodesMap[treeList[i].id].expanded = value
    }
  }
}
/** 树权限（全选/全不选） */
function handleCheckedTreeNodeAll(value, type) {
  if (type == 'menu') {
    menuRef.value.setCheckedNodes(value ? menuOptions.value : [])
  } else if (type == 'dept') {
    deptRef.value.setCheckedNodes(value ? deptOptions.value : [])
  }
}
/** 树权限（父子联动） */
function handleCheckedTreeConnect(value, type) {
  if (type == 'menu') {
    form.value.menuCheckStrictly = value ? true : false
  } else if (type == 'dept') {
    form.value.deptCheckStrictly = value ? true : false
  }
}
/** 所有菜单节点数据 */
function getMenuAllCheckedKeys() {
  // 目前被选中的菜单节点
  let checkedKeys = menuRef.value.getCheckedKeys()
  // 半选中的菜单节点
  let halfCheckedKeys = menuRef.value.getHalfCheckedKeys()
  checkedKeys.unshift.apply(checkedKeys, halfCheckedKeys)
  return checkedKeys
}
/** 提交按钮 */
function submitForm() {
  proxy.$refs['roleRef'].validate((valid) => {
    if (valid) {
      if (form.value.roleId != undefined) {
        form.value.menuIds = getMenuAllCheckedKeys()
        updateRole(form.value).then(() => {
          proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
          open.value = false
          getList()
        })
      } else {
        form.value.menuIds = getMenuAllCheckedKeys()
        addRole(form.value).then(() => {
          proxy.$modal.msgSuccess(t('system:addedSuccessfully'))
          open.value = false
          getList()
        })
      }
    }
  })
}
/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}
/** 选择角色权限范围触发 */
function dataScopeSelectChange(value) {
  if (value !== '2') {
    deptRef.value.setCheckedKeys([])
  }
}
/** 分配数据权限操作 */
function handleDataScope(row) {
  reset()
  const deptTreeSelect = getDeptTree(row.roleId)
  getRole(row.roleId).then((response) => {
    form.value = response.data
    openDataScope.value = true
    nextTick(() => {
      deptTreeSelect.then((res) => {
        nextTick(() => {
          if (deptRef.value) {
            deptRef.value.setCheckedKeys(res.checkedKeys)
          }
        })
      })
    })
  })
  title.value = () => t('system:assignDataScope')
}
/** 提交按钮（数据权限） */
function submitDataScope() {
  if (form.value.roleId != undefined) {
    form.value.deptIds = getDeptAllCheckedKeys()
    dataScope(form.value).then(() => {
      proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
      openDataScope.value = false
      getList()
    })
  }
}
/** 取消按钮（数据权限）*/
function cancelDataScope() {
  openDataScope.value = false
  reset()
}

getList()
// 时区变化后重新查询日期范围，保留正在编辑的表单。
watch(getDisplayTimezone, () => {
  if (dateRange.value?.length) {
    handleQuery()
  }
})
</script>
