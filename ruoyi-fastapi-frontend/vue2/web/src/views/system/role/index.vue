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
        :label="$t('system:role.name')"
        prop="roleName"
      >
        <el-input
          v-model="queryParams.roleName"
          :placeholder="$t('system:enterRoleName')"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('system:permission.code')"
        prop="roleKey"
      >
        <el-input
          v-model="queryParams.roleKey"
          :placeholder="$t('system:enterPermissionString')"
          clearable
          style="width: 240px"
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('common:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('system:role.status')"
          clearable
          style="width: 240px"
        >
          <el-option
            v-for="dict in dict.type.sys_normal_disable"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="$t('common:createdTime')">
        <el-date-picker
          v-model="dateRange"
          style="width: 240px"
          value-format="yyyy-MM-dd"
          type="daterange"
          :aria-label="$t('common:time.dateRangeInZone', { zone: getDisplayTimezone() })"
          range-separator="-"
          :start-placeholder="$t('common:startDate')"
          :end-placeholder="$t('common:endDate')"
        ></el-date-picker>
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
          v-hasPermi="['system:role:add']"
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
          v-hasPermi="['system:role:edit']"
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
          v-hasPermi="['system:role:remove']"
          >{{ $t('common:delete') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="el-icon-download"
          size="mini"
          @click="handleExport"
          v-hasPermi="['system:role:export']"
          >{{ $t('common:export') }}</el-button
        >
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

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
        :label="$t('system:role.name')"
        prop="roleName"
        :show-overflow-tooltip="true"
        width="150"
      />
      <el-table-column
        :label="$t('system:permission.code')"
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
        :label="$t('common:status')"
        align="center"
        width="100"
      >
        <template slot-scope="scope">
          <el-switch
            v-model="scope.row.status"
            active-value="0"
            inactive-value="1"
            @change="handleStatusChange(scope.row)"
          ></el-switch>
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
        <template
          slot-scope="scope"
          v-if="scope.row.roleId !== 1"
        >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:role:edit']"
            >{{ $t('common:edit') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:role:remove']"
            >{{ $t('common:delete') }}</el-button
          >
          <el-dropdown
            size="mini"
            @command="(command) => handleCommand(command, scope.row)"
            v-hasPermi="['system:role:edit']"
          >
            <el-button
              size="mini"
              type="text"
              icon="el-icon-d-arrow-right"
              >{{ $t('common:more') }}</el-button
            >
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item
                command="handleDataScope"
                icon="el-icon-circle-check"
                v-hasPermi="['system:role:edit']"
                >{{ $t('system:role.dataScope') }}</el-dropdown-item
              >
              <el-dropdown-item
                command="handleAuthUser"
                icon="el-icon-user"
                v-hasPermi="['system:role:edit']"
                >{{ $t('layout:routes.assignUser') }}</el-dropdown-item
              >
            </el-dropdown-menu>
          </el-dropdown>
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

    <!-- 添加或修改角色配置对话框 -->
    <el-dialog
      :title="$t(titleKey)"
      :visible.sync="open"
      width="500px"
      append-to-body
    >
      <el-form
        :validate-on-rule-change="false"
        ref="form"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item
          :label="$t('system:role.name')"
          prop="roleName"
        >
          <el-input
            v-model="form.roleName"
            :placeholder="$t('system:enterRoleName')"
          />
        </el-form-item>
        <el-form-item prop="roleKey">
          <span slot="label">
            <el-tooltip
              :content="
                $t('system:rolePermissionDefinedInTheControllerEGRoleInterfaceAuthDependencyAdmin')
              "
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
            {{ $t('system:permission.code') }}
          </span>
          <el-input
            v-model="form.roleKey"
            :placeholder="$t('system:enterPermissionString')"
          />
        </el-form-item>
        <el-form-item
          :label="$t('system:role.order')"
          prop="roleSort"
        >
          <el-input-number
            v-model="form.roleSort"
            controls-position="right"
            :min="0"
          />
        </el-form-item>
        <el-form-item :label="$t('common:status')">
          <el-radio-group v-model="form.status">
            <el-radio
              v-for="dict in dict.type.sys_normal_disable"
              :key="dict.value"
              :label="dict.value"
              >{{ dict.label }}</el-radio
            >
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="$t('system:menuPermissions')">
          <el-checkbox
            v-model="menuExpand"
            @change="handleCheckedTreeExpand($event, 'menu')"
            >{{ $t('common:expandCollapse') }}</el-checkbox
          >
          <el-checkbox
            v-model="menuNodeAll"
            @change="handleCheckedTreeNodeAll($event, 'menu')"
            >{{ $t('common:checkAll') }}</el-checkbox
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
            ref="menu"
            node-key="id"
            :check-strictly="!form.menuCheckStrictly"
            :empty-text="$t('system:loadingPleaseWait')"
            :props="defaultProps"
          ></el-tree>
        </el-form-item>
        <el-form-item :label="$t('common:remark')">
          <el-input
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('common:contentPlaceholder')"
          ></el-input>
        </el-form-item>
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

    <!-- 分配角色数据权限对话框 -->
    <el-dialog
      :title="$t(titleKey)"
      :visible.sync="openDataScope"
      width="500px"
      append-to-body
    >
      <el-form
        :validate-on-rule-change="false"
        :model="form"
        label-width="80px"
      >
        <el-form-item :label="$t('system:role.name')">
          <el-input
            v-model="form.roleName"
            :disabled="true"
          />
        </el-form-item>
        <el-form-item :label="$t('system:permission.code')">
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
          :label="$t('system:role.dataScope')"
          v-show="form.dataScope == 2"
        >
          <el-checkbox
            v-model="deptExpand"
            @change="handleCheckedTreeExpand($event, 'dept')"
            >{{ $t('common:expandCollapse') }}</el-checkbox
          >
          <el-checkbox
            v-model="deptNodeAll"
            @change="handleCheckedTreeNodeAll($event, 'dept')"
            >{{ $t('common:checkAll') }}</el-checkbox
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
            ref="dept"
            node-key="id"
            :check-strictly="!form.deptCheckStrictly"
            :empty-text="$t('system:loadingPleaseWait')"
            :props="defaultProps"
          ></el-tree>
        </el-form-item>
      </el-form>
      <div
        slot="footer"
        class="dialog-footer"
      >
        <el-button
          type="primary"
          @click="submitDataScope"
          >{{ $t('common:confirm') }}</el-button
        >
        <el-button @click="cancelDataScope">{{ $t('common:cancel') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getDisplayTimezone } from '@/utils/time'
import {
  listRole,
  getRole,
  delRole,
  addRole,
  updateRole,
  dataScope,
  changeRoleStatus,
  deptTreeSelect,
} from '@/api/system/role'
import { treeselect as menuTreeselect, roleMenuTreeselect } from '@/api/system/menu'

export default {
  name: 'Role',
  dicts: ['sys_normal_disable'],
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
      // 角色表格数据
      roleList: [],
      // 弹出层标题
      titleKey: '',
      // 是否显示弹出层
      open: false,
      // 是否显示弹出层（数据权限）
      openDataScope: false,
      menuExpand: false,
      menuNodeAll: false,
      deptExpand: true,
      deptNodeAll: false,
      // 日期范围
      dateRange: [],
      // 数据范围选项
      dataScopeOptions: [
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
      ],
      // 菜单列表
      menuOptions: [],
      // 部门列表
      deptOptions: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        roleName: undefined,
        roleKey: undefined,
        status: undefined,
      },
      // 表单参数
      form: {},
      defaultProps: {
        children: 'children',
        label: (node) => this.$resolveText(node.label, node.labelI18n),
      },
      // 表单校验
      rules: {
        roleName: [
          { required: true, message: () => t('system:roleNameIsRequired'), trigger: 'blur' },
        ],
        roleKey: [
          {
            required: true,
            message: () => t('system:permissionStringIsRequired'),
            trigger: 'blur',
          },
        ],
        roleSort: [
          { required: true, message: () => t('system:roleOrderIsRequired'), trigger: 'blur' },
        ],
      },
    }
  },
  created() {
    // 时区切换后重新解释日期筛选，保留当前表单。
    this.$watch(getDisplayTimezone, () => {
      if (this.dateRange && this.dateRange.length) this.handleQuery()
    })
    this.getList()
  },
  methods: {
    getDisplayTimezone,
    /** 查询角色列表 */
    getList() {
      this.loading = true
      listRole(this.addDateRange(this.queryParams, this.dateRange)).then((response) => {
        this.roleList = response.rows
        this.total = response.total
        this.loading = false
      })
    },
    /** 查询菜单树结构 */
    getMenuTreeselect() {
      menuTreeselect().then((response) => {
        this.menuOptions = response.data
      })
    },
    // 所有菜单节点数据
    getMenuAllCheckedKeys() {
      // 目前被选中的菜单节点
      let checkedKeys = this.$refs.menu.getCheckedKeys()
      // 半选中的菜单节点
      let halfCheckedKeys = this.$refs.menu.getHalfCheckedKeys()
      checkedKeys.unshift.apply(checkedKeys, halfCheckedKeys)
      return checkedKeys
    },
    // 所有部门节点数据
    getDeptAllCheckedKeys() {
      // 目前被选中的部门节点
      let checkedKeys = this.$refs.dept.getCheckedKeys()
      // 半选中的部门节点
      let halfCheckedKeys = this.$refs.dept.getHalfCheckedKeys()
      checkedKeys.unshift.apply(checkedKeys, halfCheckedKeys)
      return checkedKeys
    },
    /** 根据角色ID查询菜单树结构 */
    getRoleMenuTreeselect(roleId) {
      return roleMenuTreeselect(roleId).then((response) => {
        this.menuOptions = response.menus
        return response
      })
    },
    /** 根据角色ID查询部门树结构 */
    getDeptTree(roleId) {
      return deptTreeSelect(roleId).then((response) => {
        this.deptOptions = response.depts
        return response
      })
    },
    // 角色状态修改
    handleStatusChange(row) {
      let text = row.status === '0' ? t('common:enable') : t('common:disable')
      this.$modal
        .confirm(t('system:confirmation.valueRoleValue', { value0: text, value1: row.roleName }))
        .then(function () {
          return changeRoleStatus(row.roleId, row.status)
        })
        .then(() => {
          this.$modal.msgSuccess(t('system:confirmation.valueSucceeded', { value0: text }))
        })
        .catch(function () {
          row.status = row.status === '0' ? '1' : '0'
        })
    },
    // 取消按钮
    cancel() {
      this.open = false
      this.reset()
    },
    // 取消按钮（数据权限）
    cancelDataScope() {
      this.openDataScope = false
      this.reset()
    },
    // 表单重置
    reset() {
      if (this.$refs.menu != undefined) {
        this.$refs.menu.setCheckedKeys([])
      }
      ;((this.menuExpand = false),
        (this.menuNodeAll = false),
        (this.deptExpand = true),
        (this.deptNodeAll = false),
        (this.form = {
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
        }))
      this.resetForm('form')
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.dateRange = []
      this.resetForm('queryForm')
      this.handleQuery()
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map((item) => item.roleId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    // 更多操作触发
    handleCommand(command, row) {
      switch (command) {
        case 'handleDataScope':
          this.handleDataScope(row)
          break
        case 'handleAuthUser':
          this.handleAuthUser(row)
          break
        default:
          break
      }
    },
    // 树权限（展开/折叠）
    handleCheckedTreeExpand(value, type) {
      if (type == 'menu') {
        let treeList = this.menuOptions
        for (let i = 0; i < treeList.length; i++) {
          this.$refs.menu.store.nodesMap[treeList[i].id].expanded = value
        }
      } else if (type == 'dept') {
        let treeList = this.deptOptions
        for (let i = 0; i < treeList.length; i++) {
          this.$refs.dept.store.nodesMap[treeList[i].id].expanded = value
        }
      }
    },
    // 树权限（全选/全不选）
    handleCheckedTreeNodeAll(value, type) {
      if (type == 'menu') {
        this.$refs.menu.setCheckedNodes(value ? this.menuOptions : [])
      } else if (type == 'dept') {
        this.$refs.dept.setCheckedNodes(value ? this.deptOptions : [])
      }
    },
    // 树权限（父子联动）
    handleCheckedTreeConnect(value, type) {
      if (type == 'menu') {
        this.form.menuCheckStrictly = value ? true : false
      } else if (type == 'dept') {
        this.form.deptCheckStrictly = value ? true : false
      }
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset()
      this.getMenuTreeselect()
      this.open = true
      this.titleKey = 'system:addRole'
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      const roleId = row.roleId || this.ids
      const roleMenu = this.getRoleMenuTreeselect(roleId)
      getRole(roleId).then((response) => {
        this.form = response.data
        this.open = true
        this.$nextTick(() => {
          roleMenu.then((res) => {
            let checkedKeys = res.checkedKeys
            checkedKeys.forEach((v) => {
              this.$nextTick(() => {
                this.$refs.menu.setChecked(v, true, false)
              })
            })
          })
        })
      })
      this.titleKey = 'system:editRole'
    },
    /** 选择角色权限范围触发 */
    dataScopeSelectChange(value) {
      if (value !== '2') {
        this.$refs.dept.setCheckedKeys([])
      }
    },
    /** 分配数据权限操作 */
    handleDataScope(row) {
      this.reset()
      const deptTreeSelect = this.getDeptTree(row.roleId)
      getRole(row.roleId).then((response) => {
        this.form = response.data
        this.openDataScope = true
        this.$nextTick(() => {
          deptTreeSelect.then((res) => {
            this.$refs.dept.setCheckedKeys(res.checkedKeys)
          })
        })
      })
      this.titleKey = 'system:assignDataScope'
    },
    /** 分配用户操作 */
    handleAuthUser(row) {
      const roleId = row.roleId
      this.$router.push('/system/role-auth/user/' + roleId)
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          if (this.form.roleId != undefined) {
            this.form.menuIds = this.getMenuAllCheckedKeys()
            updateRole(this.form).then(() => {
              this.$modal.msgSuccess(t('common:updateSuccess'))
              this.open = false
              this.getList()
            })
          } else {
            this.form.menuIds = this.getMenuAllCheckedKeys()
            addRole(this.form).then(() => {
              this.$modal.msgSuccess(t('common:addSuccess'))
              this.open = false
              this.getList()
            })
          }
        }
      })
    },
    /** 提交按钮（数据权限） */
    submitDataScope() {
      if (this.form.roleId != undefined) {
        this.form.deptIds = this.getDeptAllCheckedKeys()
        dataScope(this.form).then(() => {
          this.$modal.msgSuccess(t('common:updateSuccess'))
          this.openDataScope = false
          this.getList()
        })
      }
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      const roleIds = row.roleId || this.ids
      this.$modal
        .confirm(t('system:confirmation.deleteRolesWithIDsValue', { value0: roleIds }))
        .then(function () {
          return delRole(roleIds)
        })
        .then(() => {
          this.getList()
          this.$modal.msgSuccess(t('common:deleteSuccess'))
        })
        .catch(() => {})
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download(
        'system/role/export',
        {
          ...this.queryParams,
        },
        `role_${new Date().getTime()}.xlsx`
      )
    },
  },
}
</script>
