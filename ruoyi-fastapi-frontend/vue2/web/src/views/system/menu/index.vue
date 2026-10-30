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
        :label="$t('system:menu.name')"
        prop="menuName"
      >
        <el-input
          v-model="queryParams.menuName"
          :placeholder="$t('system:menu.placeholder')"
          clearable
          @keyup.enter.native="handleQuery"
        />
      </el-form-item>
      <el-form-item
        :label="$t('common:status')"
        prop="status"
      >
        <el-select
          v-model="queryParams.status"
          :placeholder="$t('system:menu.menuStatus')"
          clearable
        >
          <el-option
            v-for="dict in dict.type.sys_normal_disable"
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
          v-hasPermi="['system:menu:add']"
          >{{ $t('common:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="el-icon-check"
          size="mini"
          @click="handleSaveSort"
          v-hasPermi="['system:menu:edit']"
          >{{ $t('system:dept.saveSortOrder') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="info"
          plain
          icon="el-icon-sort"
          size="mini"
          @click="toggleExpandAll"
          >{{ $t('common:expandCollapse') }}</el-button
        >
      </el-col>
      <right-toolbar
        :showSearch.sync="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </el-row>

    <el-table
      v-if="refreshTable"
      v-loading="loading"
      :data="menuList"
      row-key="menuId"
      :default-expand-all="isExpandAll"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
    >
      <el-table-column
        prop="menuName"
        :label="$t('system:menu.name')"
        :show-overflow-tooltip="true"
        width="220"
      >
        <template slot-scope="scope">
          <svg-icon :icon-class="scope.row.icon" />
          <span class="ml5">{{ $resolveText(scope.row.menuName, scope.row.menuNameI18n) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="menuName"
        :label="$t('common:type')"
        :show-overflow-tooltip="true"
        width="100"
      >
        <template slot-scope="scope">
          <el-tag
            v-if="scope.row.menuType === 'M' && scope.row.isFrame === 0"
            type="danger"
            size="small"
            >{{ $t('system:menu.external') }}</el-tag
          >
          <el-tag
            v-else-if="scope.row.menuType === 'M'"
            type="primary"
            size="small"
            >{{ $t('system:menu.directory') }}</el-tag
          >
          <el-tag
            v-else-if="scope.row.menuType === 'C' && scope.row.isFrame === 0"
            type="danger"
            size="small"
            >{{ $t('system:menu.external') }}</el-tag
          >
          <el-tag
            v-else-if="scope.row.menuType === 'C'"
            type="success"
            size="small"
            >{{ $t('system:menu.menu') }}</el-tag
          >
          <el-tag
            v-else-if="scope.row.menuType === 'F'"
            type="warning"
            size="small"
            >{{ $t('system:menu.button') }}</el-tag
          >
        </template>
      </el-table-column>
      <el-table-column
        prop="orderNum"
        :label="$t('common:sort')"
        width="200"
      >
        <template slot-scope="scope">
          <el-input-number
            v-model="scope.row.orderNum"
            controls-position="right"
            :min="0"
            size="mini"
            style="width: 88px"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="perms"
        :label="$t('system:menu.permission')"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        prop="component"
        :label="$t('system:menu.component')"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        prop="status"
        :label="$t('common:status')"
        width="80"
      >
        <template slot-scope="scope">
          <dict-tag
            :options="dict.type.sys_normal_disable"
            :value="scope.row.status"
          />
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
            icon="el-icon-edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:menu:edit']"
            >{{ $t('common:edit') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-plus"
            @click="handleAdd(scope.row)"
            v-hasPermi="['system:menu:add']"
            >{{ $t('common:add') }}</el-button
          >
          <el-button
            size="mini"
            type="text"
            icon="el-icon-delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:menu:remove']"
            >{{ $t('common:delete') }}</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加或修改菜单对话框 -->
    <el-dialog
      :title="$t(titleKey)"
      :visible.sync="open"
      width="680px"
      append-to-body
    >
      <el-form
        :validate-on-rule-change="false"
        ref="form"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-row>
          <el-col :span="24">
            <el-form-item
              :label="$t('system:menu.parent')"
              prop="parentId"
            >
              <treeselect
                v-model="form.parentId"
                :options="menuOptions"
                :normalizer="normalizer"
                :show-count="true"
                :placeholder="$t('system:menu.chooseAParentMenu')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item
              :label="$t('system:menu.type')"
              prop="menuType"
            >
              <el-radio-group v-model="form.menuType">
                <el-radio label="M">{{ $t('system:menu.directory') }}</el-radio>
                <el-radio label="C">{{ $t('system:menu.menu') }}</el-radio>
                <el-radio label="F">{{ $t('system:menu.button') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col
            :span="24"
            v-if="form.menuType != 'F'"
          >
            <el-form-item
              :label="$t('system:menu.menuIcon')"
              prop="icon"
            >
              <el-popover
                placement="bottom-start"
                width="460"
                trigger="click"
                @show="$refs['iconSelect'].reset()"
              >
                <IconSelect
                  ref="iconSelect"
                  @selected="selected"
                  :active-icon="form.icon"
                />
                <el-input
                  slot="reference"
                  v-model="form.icon"
                  :placeholder="$t('system:menu.clickToChooseAnIcon')"
                  readonly
                >
                  <svg-icon
                    v-if="form.icon"
                    slot="prefix"
                    :icon-class="form.icon"
                    style="width: 25px"
                  />
                  <i
                    v-else
                    slot="prefix"
                    class="el-icon-search el-input__icon"
                  />
                </el-input>
              </el-popover>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:menu.name')"
              prop="menuName"
            >
              <el-input
                v-model="form.menuName"
                :placeholder="$t('system:menu.placeholder')"
              />
            </el-form-item>
            <locale-text-fields
              :value="form.menuNameI18n"
              :patch="form.menuNameI18nPatch"
              @input="$set(form, 'menuNameI18nPatch', $event)"
            />
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="$t('system:dept.order')"
              prop="orderNum"
            >
              <el-input-number
                v-model="form.orderNum"
                controls-position="right"
                :min="0"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col
            :span="12"
            v-if="form.menuType != 'F'"
          >
            <el-form-item prop="isFrame">
              <span slot="label">
                <el-tooltip
                  :content="$t('system:externalLinkPathsMustStartWithHttpOrHttps')"
                  placement="top"
                >
                  <i class="el-icon-question"></i>
                </el-tooltip>
                {{ $t('system:menu.externalLink') }}
              </span>
              <el-radio-group v-model="form.isFrame">
                <el-radio :label="0">{{ $t('common:yes') }}</el-radio>
                <el-radio :label="1">{{ $t('common:no') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType != 'F'"
          >
            <el-form-item prop="path">
              <span slot="label">
                <el-tooltip
                  :content="$t('system:routePathEGUserToEmbedAnExternalPage')"
                  placement="top"
                >
                  <i class="el-icon-question"></i>
                </el-tooltip>
                {{ $t('system:menu.routePath') }}
              </span>
              <el-input
                v-model="form.path"
                :placeholder="$t('system:menu.enterARoutePath')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col
            :span="24"
            v-if="form.menuType == 'C'"
          >
            <el-form-item prop="routeName">
              <span slot="label">
                <el-tooltip
                  :content="$t('system:defaultsToTheRoutePathWithItsFirstLetterCapitalized')"
                  placement="top"
                >
                  <el-icon><question-filled /></el-icon>
                </el-tooltip>
                {{ $t('system:menu.routeName') }}
              </span>
              <el-input
                v-model="form.routeName"
                :placeholder="$t('system:menu.enterARouteName')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col
            :span="12"
            v-if="form.menuType == 'C'"
          >
            <el-form-item prop="component">
              <span slot="label">
                <el-tooltip
                  :content="$t('system:componentPathRelativeToViewsEGSystemUserIndex')"
                  placement="top"
                >
                  <i class="el-icon-question"></i>
                </el-tooltip>
                {{ $t('system:menu.component') }}
              </span>
              <el-input
                v-model="form.component"
                :placeholder="$t('system:menu.enterAComponentPath')"
              />
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType != 'M'"
          >
            <el-form-item prop="perms">
              <el-input
                v-model="form.perms"
                :placeholder="$t('system:menu.enterAPermissionIdentifier')"
                maxlength="100"
              />
              <span slot="label">
                <el-tooltip
                  :content="
                    $t(
                      'system:permissionDefinedInTheControllerEGUserInterfaceAuthDependencySystemUser'
                    )
                  "
                  placement="top"
                >
                  <i class="el-icon-question"></i>
                </el-tooltip>
                {{ $t('system:permission.code') }}
              </span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col
            :span="12"
            v-if="form.menuType == 'C'"
          >
            <el-form-item prop="query">
              <el-input
                v-model="form.query"
                :placeholder="$t('system:menu.enterRouteParameters')"
                maxlength="255"
              />
              <span slot="label">
                <el-tooltip
                  :content="$t('system:menu.defaultParametersForThisRouteEG')"
                  placement="top"
                >
                  <i class="el-icon-question"></i>
                </el-tooltip>
                {{ $t('system:menu.routeParameters') }}
              </span>
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType == 'C'"
          >
            <el-form-item prop="isCache">
              <span slot="label">
                <el-tooltip
                  :content="$t('system:enableKeepAliveCachingTheComponentNameMustMatchThe')"
                  placement="top"
                >
                  <i class="el-icon-question"></i>
                </el-tooltip>
                {{ $t('system:menu.cacheEnabled') }}
              </span>
              <el-radio-group v-model="form.isCache">
                <el-radio :label="0">{{ $t('system:menu.cache') }}</el-radio>
                <el-radio :label="1">{{ $t('system:menu.doNotCache') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col
            :span="12"
            v-if="form.menuType != 'F'"
          >
            <el-form-item prop="visible">
              <span slot="label">
                <el-tooltip
                  :content="$t('system:hiddenRoutesRemainAccessibleButDoNotAppearInThe')"
                  placement="top"
                >
                  <i class="el-icon-question"></i>
                </el-tooltip>
                {{ $t('system:menu.visibility') }}
              </span>
              <el-radio-group v-model="form.visible">
                <el-radio
                  v-for="dict in dict.type.sys_show_hide"
                  :key="dict.value"
                  :label="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="status">
              <span slot="label">
                <el-tooltip
                  :content="$t('system:disabledRoutesDoNotAppearInTheSidebarAndCannot')"
                  placement="top"
                >
                  <i class="el-icon-question"></i>
                </el-tooltip>
                {{ $t('system:menu.menuStatus') }}
              </span>
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in dict.type.sys_normal_disable"
                  :key="dict.value"
                  :label="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
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
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { listMenu, getMenu, delMenu, addMenu, updateMenu, updateMenuSort } from '@/api/system/menu'
import Treeselect from '@riophae/vue-treeselect'
import '@riophae/vue-treeselect/dist/vue-treeselect.css'
import IconSelect from '@/components/IconSelect'

export default {
  name: 'Menu',
  dicts: ['sys_show_hide', 'sys_normal_disable'],
  components: { Treeselect, IconSelect },
  data() {
    return {
      // 遮罩层
      loading: true,
      // 显示搜索条件
      showSearch: true,
      // 菜单表格树数据
      menuList: [],
      // 菜单树选项
      menuOptions: [],
      // 弹出层标题
      titleKey: '',
      // 是否显示弹出层
      open: false,
      // 是否展开，默认全部折叠
      isExpandAll: false,
      // 重新渲染表格状态
      refreshTable: true,
      // 记录原始排序，用于对比变更
      originalOrders: {},
      // 查询参数
      queryParams: {
        menuName: undefined,
        visible: undefined,
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        menuName: [
          { required: true, message: () => t('system:menu.nameRequired'), trigger: 'blur' },
        ],
        orderNum: [
          { required: true, message: () => t('system:menuOrderIsRequired'), trigger: 'blur' },
        ],
        path: [{ required: true, message: () => t('system:routePathIsRequired'), trigger: 'blur' }],
      },
    }
  },
  created() {
    this.getList()
  },
  methods: {
    // 选择图标
    selected(name) {
      this.form.icon = name
    },
    /** 查询菜单列表 */
    getList() {
      this.loading = true
      listMenu(this.queryParams).then((response) => {
        this.menuList = this.handleTree(response.data, 'menuId')
        // 记录原始排序值
        this.recordOriginalOrders(this.menuList)
        this.loading = false
      })
    },
    /** 转换菜单数据结构 */
    normalizer(node) {
      if (node.children && !node.children.length) {
        delete node.children
      }
      return {
        id: node.menuId,
        label: this.$resolveText(node.menuName, node.menuNameI18n),
        children: node.children,
      }
    },
    /** 查询菜单下拉树结构 */
    getTreeselect() {
      listMenu().then((response) => {
        this.menuOptions = []
        const menu = { menuId: 0, menuName: t('system:menu.root'), children: [] }
        menu.children = this.handleTree(response.data, 'menuId')
        this.menuOptions.push(menu)
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
        menuId: undefined,
        parentId: 0,
        menuName: undefined,
        routeName: undefined,
        icon: undefined,
        menuType: 'M',
        orderNum: undefined,
        isFrame: 1,
        isCache: 0,
        visible: '0',
        status: '0',
      }
      this.resetForm('form')
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm('queryForm')
      this.handleQuery()
    },
    /** 新增按钮操作 */
    handleAdd(row) {
      this.reset()
      this.getTreeselect()
      if (row != null && row.menuId) {
        this.form.parentId = row.menuId
      } else {
        this.form.parentId = 0
      }
      this.open = true
      this.titleKey = 'system:menu.add'
    },
    /** 展开/折叠操作 */
    toggleExpandAll() {
      this.refreshTable = false
      this.isExpandAll = !this.isExpandAll
      this.$nextTick(() => {
        this.refreshTable = true
      })
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      this.getTreeselect()
      getMenu(row.menuId).then((response) => {
        this.form = response.data
        this.open = true
        this.titleKey = 'system:menu.edit'
      })
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          if (this.form.menuId != undefined) {
            updateMenu(this.form).then(() => {
              this.$modal.msgSuccess(t('common:updateSuccess'))
              this.open = false
              this.getList()
            })
          } else {
            addMenu(this.form).then(() => {
              this.$modal.msgSuccess(t('common:addSuccess'))
              this.open = false
              this.getList()
            })
          }
        }
      })
    },
    /** 递归记录原始排序 */
    recordOriginalOrders(list) {
      list.forEach((item) => {
        this.originalOrders[item.menuId] = item.orderNum
        if (item.children && item.children.length) {
          this.recordOriginalOrders(item.children)
        }
      })
    },
    /** 保存排序 */
    handleSaveSort() {
      const changedMenuIds = []
      const changedOrderNums = []
      const collectChanged = (list) => {
        list.forEach((item) => {
          if (String(this.originalOrders[item.menuId]) !== String(item.orderNum)) {
            changedMenuIds.push(item.menuId)
            changedOrderNums.push(item.orderNum)
          }
          if (item.children && item.children.length) {
            collectChanged(item.children)
          }
        })
      }
      collectChanged(this.menuList)
      if (changedMenuIds.length === 0) {
        this.$modal.msgWarning(t('system:dept.noSortOrderChangesDetected'))
        return
      }
      updateMenuSort({
        menuIds: changedMenuIds.join(','),
        orderNums: changedOrderNums.join(','),
      }).then(() => {
        this.$modal.msgSuccess(t('system:dept.sortOrderSaved'))
        this.recordOriginalOrders(this.menuList)
      })
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      this.$modal
        .confirm(t('system:confirmation.deleteValue', { value0: row.menuName }))
        .then(function () {
          return delMenu(row.menuId)
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
