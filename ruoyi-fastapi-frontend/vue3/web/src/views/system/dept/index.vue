<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
    >
      <el-form-item
        :label="$t('system:departmentName')"
        prop="deptName"
      >
        <el-input
          v-model="queryParams.deptName"
          :placeholder="$t('system:enterDepartmentName')"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('system:departmentStatus')"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="dict in sys_normal_disable"
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
          v-hasPermi="['system:dept:add']"
          >{{ $t('system:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Check"
          @click="handleSaveSort"
          v-hasPermi="['system:dept:edit']"
          >{{ $t('system:saveOrder') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="info"
          plain
          icon="Sort"
          @click="toggleExpandAll"
          >{{ $t('system:expandCollapse') }}</el-button
        >
      </el-col>
      <right-toolbar
        v-model:showSearch="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-if="refreshTable"
      v-loading="loading"
      :data="deptList"
      row-key="deptId"
      :default-expand-all="isExpandAll"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
    >
      <el-table-column
        prop="deptName"
        :label="$t('system:departmentName')"
        width="260"
      ></el-table-column>
      <el-table-column
        prop="orderNum"
        :label="$t('system:order')"
        width="200"
      >
        <template #default="scope">
          <el-input-number
            v-model="scope.row.orderNum"
            controls-position="right"
            :min="0"
            style="width: 88px"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="status"
        :label="$t('system:status')"
        width="100"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_normal_disable"
            :value="scope.row.status"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:createdAt')"
        align="center"
        prop="createTime"
        width="200"
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
          <el-button
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:dept:edit']"
            >{{ $t('system:edit') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Plus"
            @click="handleAdd(scope.row)"
            v-hasPermi="['system:dept:add']"
            >{{ $t('system:add') }}</el-button
          >
          <el-button
            v-if="scope.row.parentId != 0"
            link
            type="primary"
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:dept:remove']"
            >{{ $t('system:delete') }}</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加或修改部门对话框 -->
    <el-dialog
      :title="typeof title === 'function' ? title() : title"
      v-model="open"
      width="600px"
      append-to-body
    >
      <el-form
        ref="deptRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="auto"
      >
        <el-row>
          <el-col
            :span="24"
            v-if="form.parentId !== 0"
          >
            <el-form-item
              :label="$t('system:parentDepartment')"
              prop="parentId"
            >
              <el-tree-select
                v-model="form.parentId"
                :data="deptOptions"
                :props="{ value: 'deptId', label: 'deptName', children: 'children' }"
                value-key="deptId"
                :placeholder="$t('system:selectParentDepartment')"
                check-strictly
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:departmentName')"
              prop="deptName"
            >
              <el-input
                v-model="form.deptName"
                :placeholder="$t('system:enterDepartmentName')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:displayOrder')"
              prop="orderNum"
            >
              <el-input-number
                v-model="form.orderNum"
                controls-position="right"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:manager')"
              prop="leader"
            >
              <el-input
                v-model="form.leader"
                :placeholder="$t('system:enterManagerName')"
                maxlength="20"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:contactNumber')"
              prop="phone"
            >
              <el-input
                v-model="form.phone"
                :placeholder="$t('system:enterContactNumber')"
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
          <el-col :span="12">
            <el-form-item :label="$t('system:departmentStatus')">
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
  </div>
</template>

<script setup name="Dept">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import {
  listDept,
  getDept,
  delDept,
  addDept,
  updateDept,
  updateDeptSort,
  listDeptExcludeChild,
} from '@/api/system/dept'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.deptRef))
const { sys_normal_disable } = proxy.useDict('sys_normal_disable')

const deptList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const title = ref('')
const deptOptions = ref([])
const isExpandAll = ref(true)
const refreshTable = ref(true)
const originalOrders = ref({})

const data = reactive({
  form: {},
  queryParams: {
    deptName: undefined,
    status: undefined,
  },
  rules: {
    parentId: [
      {
        required: true,
        get message() {
          return t('system:parentDepartmentIsRequired')
        },
        trigger: 'blur',
      },
    ],
    deptName: [
      {
        required: true,
        get message() {
          return t('system:departmentNameIsRequired')
        },
        trigger: 'blur',
      },
    ],
    orderNum: [
      {
        required: true,
        get message() {
          return t('system:displayOrderIsRequired')
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
    phone: [
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

/** 查询部门列表 */
function getList() {
  loading.value = true
  listDept(queryParams.value).then((response) => {
    deptList.value = proxy.handleTree(response.data, 'deptId')
    recordOriginalOrders(deptList.value)
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
    deptId: undefined,
    parentId: undefined,
    deptName: undefined,
    orderNum: 0,
    leader: undefined,
    phone: undefined,
    email: undefined,
    status: '0',
  }
  proxy.resetForm('deptRef')
}
/** 搜索按钮操作 */
function handleQuery() {
  getList()
}
/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}
/** 新增按钮操作 */
function handleAdd(row) {
  reset()
  listDept().then((response) => {
    deptOptions.value = proxy.handleTree(response.data, 'deptId')
  })
  if (row != undefined) {
    form.value.parentId = row.deptId
  }
  open.value = true
  title.value = () => t('system:addDepartment')
}
/** 展开/折叠操作 */
function toggleExpandAll() {
  refreshTable.value = false
  isExpandAll.value = !isExpandAll.value
  nextTick(() => {
    refreshTable.value = true
  })
}
/** 修改按钮操作 */
function handleUpdate(row) {
  reset()
  listDeptExcludeChild(row.deptId).then((response) => {
    deptOptions.value = proxy.handleTree(response.data, 'deptId')
  })
  getDept(row.deptId).then((response) => {
    form.value = response.data
    open.value = true
    title.value = () => t('system:editDepartment')
  })
}
/** 提交按钮 */
function submitForm() {
  proxy.$refs['deptRef'].validate((valid) => {
    if (valid) {
      if (form.value.deptId != undefined) {
        updateDept(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
          open.value = false
          getList()
        })
      } else {
        addDept(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('system:addedSuccessfully'))
          open.value = false
          getList()
        })
      }
    }
  })
}

/** 递归记录原始排序 */
function recordOriginalOrders(list) {
  list.forEach((item) => {
    originalOrders.value[item.deptId] = item.orderNum
    if (item.children && item.children.length) {
      recordOriginalOrders(item.children)
    }
  })
}

/** 保存排序 */
function handleSaveSort() {
  const changedDeptIds = []
  const changedOrderNums = []
  const collectChanged = (list) => {
    list.forEach((item) => {
      if (String(originalOrders.value[item.deptId]) !== String(item.orderNum)) {
        changedDeptIds.push(item.deptId)
        changedOrderNums.push(item.orderNum)
      }
      if (item.children && item.children.length) {
        collectChanged(item.children)
      }
    })
  }
  collectChanged(deptList.value)
  if (changedDeptIds.length === 0) {
    proxy.$modal.msgWarning(t('system:theOrderHasNotChanged'))
    return
  }
  updateDeptSort({ deptIds: changedDeptIds.join(','), orderNums: changedOrderNums.join(',') }).then(
    () => {
      proxy.$modal.msgSuccess(t('system:orderSaved'))
      recordOriginalOrders(deptList.value)
    }
  )
}

/** 删除按钮操作 */
function handleDelete(row) {
  proxy.$modal
    .confirm(t('system:confirmation.deleteName', { name: row.deptName }))
    .then(function () {
      return delDept(row.deptId)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
    })
    .catch(() => {})
}

getList()
</script>
