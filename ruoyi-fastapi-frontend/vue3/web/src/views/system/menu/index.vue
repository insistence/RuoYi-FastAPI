<template>
  <div class="app-container">
    <el-form
      :model="queryParams"
      ref="queryRef"
      :inline="true"
      v-show="showSearch"
    >
      <el-form-item
        :label="$t('system:menuName')"
        prop="menuName"
      >
        <el-input
          v-model="queryParams.menuName"
          :placeholder="$t('system:enterMenuName')"
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
          :placeholder="$t('system:menuStatus')"
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
          v-hasPermi="['system:menu:add']"
          >{{ $t('system:add') }}</el-button
        >
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="Check"
          @click="handleSaveSort"
          v-hasPermi="['system:menu:edit']"
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
      :data="menuList"
      row-key="menuId"
      :default-expand-all="isExpandAll"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
    >
      <el-table-column
        prop="menuName"
        :label="$t('system:menuName')"
        :show-overflow-tooltip="true"
        width="220"
      >
        <template #default="scope">
          <svg-icon :icon-class="scope.row.icon" />
          <span class="ml5">{{ resolveText(scope.row.menuName, scope.row.menuNameI18n) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="menuName"
        :label="$t('system:type')"
        :show-overflow-tooltip="true"
        width="100"
      >
        <template #default="scope">
          <el-tag
            v-if="scope.row.menuType === 'M' && scope.row.isFrame === 0"
            type="danger"
            size="small"
            >{{ $t('system:externalLink') }}</el-tag
          >
          <el-tag
            v-else-if="scope.row.menuType === 'M'"
            type="primary"
            size="small"
            >{{ $t('system:directory') }}</el-tag
          >
          <el-tag
            v-else-if="scope.row.menuType === 'C' && scope.row.isFrame === 0"
            type="danger"
            size="small"
            >{{ $t('system:externalLink') }}</el-tag
          >
          <el-tag
            v-else-if="scope.row.menuType === 'C'"
            type="success"
            size="small"
            >{{ $t('system:menu') }}</el-tag
          >
          <el-tag
            v-else-if="scope.row.menuType === 'F'"
            type="warning"
            size="small"
            >{{ $t('system:button') }}</el-tag
          >
        </template>
      </el-table-column>
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
        prop="perms"
        :label="$t('system:permissionIdentifier')"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        prop="component"
        :label="$t('system:componentPath')"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        prop="status"
        :label="$t('system:status')"
        width="80"
      >
        <template #default="scope">
          <dict-tag
            :options="sys_normal_disable"
            :value="scope.row.status"
          />
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('system:actions')"
        align="center"
        width="210"
        class-name="small-padding fixed-width"
      >
        <template #default="scope">
          <el-button
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:menu:edit']"
            >{{ $t('system:edit') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Plus"
            @click="handleAdd(scope.row)"
            v-hasPermi="['system:menu:add']"
            >{{ $t('system:add') }}</el-button
          >
          <el-button
            link
            type="primary"
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:menu:remove']"
            >{{ $t('system:delete') }}</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加或修改菜单对话框 -->
    <el-dialog
      :title="typeof title === 'function' ? title() : title"
      v-model="open"
      width="680px"
      append-to-body
    >
      <el-form
        ref="menuRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="auto"
      >
        <el-row>
          <el-col :span="24">
            <el-form-item :label="$t('system:parentMenu')">
              <el-tree-select
                v-model="form.parentId"
                :data="menuOptions"
                :props="{
                  value: 'menuId',
                  label: (item) => resolveText(item.menuName, item.menuNameI18n),
                  children: 'children',
                }"
                value-key="menuId"
                :placeholder="$t('system:selectParentMenu')"
                check-strictly
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('system:menuType')"
              prop="menuType"
            >
              <el-radio-group v-model="form.menuType">
                <el-radio value="M">{{ $t('system:directory') }}</el-radio>
                <el-radio value="C">{{ $t('system:menu') }}</el-radio>
                <el-radio value="F">{{ $t('system:button') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType != 'F'"
          >
            <el-form-item
              :label="$t('system:menuIcon')"
              prop="icon"
            >
              <el-popover
                placement="bottom-start"
                :width="540"
                trigger="click"
              >
                <template #reference>
                  <el-input
                    v-model="form.icon"
                    :placeholder="$t('system:clickToChooseAnIcon')"
                    @blur="showSelectIcon"
                    readonly
                  >
                    <template #prefix>
                      <svg-icon
                        v-if="form.icon"
                        :icon-class="form.icon"
                        class="el-input__icon"
                        style="height: 32px; width: 16px"
                      />
                      <el-icon
                        v-else
                        style="height: 32px; width: 16px"
                        ><search
                      /></el-icon>
                    </template>
                  </el-input>
                </template>
                <icon-select
                  ref="iconSelectRef"
                  @selected="selected"
                  :active-icon="form.icon"
                />
              </el-popover>
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
              :label="$t('system:menuName')"
              prop="menuName"
            >
              <el-input
                v-model="form.menuName"
                :placeholder="$t('system:enterMenuName')"
              />
            </el-form-item> </el-col
          ><el-col :span="24"
            ><locale-name-input
              v-model="form.menuNameI18n"
              :original="originalTranslations"
            />
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType == 'C'"
          >
            <el-form-item prop="routeName">
              <template #label>
                <span>
                  <el-tooltip
                    :content="$t('system:defaultsToTheRoutePathWithItsFirstLetterCapitalized')"
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system:routeName') }}</span
                >
              </template>
              <el-input
                v-model="form.routeName"
                :placeholder="$t('system:enterRouteName')"
              />
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType != 'F'"
          >
            <el-form-item>
              <template #label>
                <span>
                  <el-tooltip
                    :content="$t('system:externalLinkPathsMustStartWithHttpOrHttps')"
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon> </el-tooltip
                  >{{ $t('system:externalLinkLabel') }}</span
                >
              </template>
              <el-radio-group v-model="form.isFrame">
                <el-radio :value="0">{{ $t('system:yes') }}</el-radio>
                <el-radio :value="1">{{ $t('system:no') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType != 'F'"
          >
            <el-form-item prop="path">
              <template #label>
                <span>
                  <el-tooltip
                    :content="$t('system:routePathEGUserToEmbedAnExternalPage')"
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system:routePath') }}</span
                >
              </template>
              <el-input
                v-model="form.path"
                :placeholder="$t('system:enterRoutePath')"
              />
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType == 'C'"
          >
            <el-form-item prop="component">
              <template #label>
                <span>
                  <el-tooltip
                    :content="$t('system:componentPathRelativeToViewsEGSystemUserIndex')"
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system:componentPath') }}</span
                >
              </template>
              <el-input
                v-model="form.component"
                :placeholder="$t('system:enterComponentPath')"
              />
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType != 'M'"
          >
            <el-form-item>
              <el-input
                v-model="form.perms"
                :placeholder="$t('system:enterPermissionIdentifier')"
                maxlength="100"
              />
              <template #label>
                <span>
                  <el-tooltip
                    :content="
                      $t(
                        'system:permissionDefinedInTheControllerEGUserInterfaceAuthDependencySystemUser'
                      )
                    "
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system:permissionString') }}</span
                >
              </template>
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType == 'C'"
          >
            <el-form-item>
              <el-input
                v-model="form.query"
                :placeholder="$t('system:enterRouteParameters')"
                maxlength="255"
              />
              <template #label>
                <span>
                  <el-tooltip
                    :content="$t('system:defaultRouteParametersEGId1NameRy')"
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system:routeParameters') }}</span
                >
              </template>
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType == 'C'"
          >
            <el-form-item>
              <template #label>
                <span>
                  <el-tooltip
                    :content="$t('system:enableKeepAliveCachingTheComponentNameMustMatchThe')"
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system:cacheComponent') }}</span
                >
              </template>
              <el-radio-group v-model="form.isCache">
                <el-radio :value="0">{{ $t('system:cache') }}</el-radio>
                <el-radio :value="1">{{ $t('system:doNotCache') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col
            :span="12"
            v-if="form.menuType != 'F'"
          >
            <el-form-item>
              <template #label>
                <span>
                  <el-tooltip
                    :content="$t('system:hiddenRoutesRemainAccessibleButDoNotAppearInThe')"
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system:visibility') }}</span
                >
              </template>
              <el-radio-group v-model="form.visible">
                <el-radio
                  v-for="dict in sys_show_hide"
                  :key="dict.value"
                  :value="dict.value"
                  >{{ dict.label }}</el-radio
                >
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item>
              <template #label>
                <span>
                  <el-tooltip
                    :content="$t('system:disabledRoutesDoNotAppearInTheSidebarAndCannot')"
                    placement="top"
                  >
                    <el-icon><question-filled /></el-icon>
                  </el-tooltip>
                  {{ $t('system:menuStatus') }}</span
                >
              </template>
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

<script setup name="Menu">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { resolveText } from '@/i18n/adapter'
import LocaleNameInput from '@/components/LocaleNameInput/index.vue'
import { addMenu, delMenu, getMenu, listMenu, updateMenu, updateMenuSort } from '@/api/system/menu'
import SvgIcon from '@/components/SvgIcon'
import IconSelect from '@/components/IconSelect'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.menuRef))
const { sys_show_hide, sys_normal_disable } = proxy.useDict('sys_show_hide', 'sys_normal_disable')

const menuList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const title = ref('')
const menuOptions = ref([])
const isExpandAll = ref(false)
const refreshTable = ref(true)
const iconSelectRef = ref(null)
const originalOrders = ref({})

const originalTranslations = ref({})

const data = reactive({
  form: {},
  queryParams: {
    menuName: undefined,
    visible: undefined,
  },
  rules: {
    menuName: [
      {
        required: true,
        get message() {
          return t('system:menuNameIsRequired')
        },
        trigger: 'blur',
      },
    ],
    orderNum: [
      {
        required: true,
        get message() {
          return t('system:menuOrderIsRequired')
        },
        trigger: 'blur',
      },
    ],
    path: [
      {
        required: true,
        get message() {
          return t('system:routePathIsRequired')
        },
        trigger: 'blur',
      },
    ],
  },
})

const { queryParams, form, rules } = toRefs(data)

/** 查询菜单列表 */
function getList() {
  loading.value = true
  listMenu(queryParams.value).then((response) => {
    menuList.value = proxy.handleTree(response.data, 'menuId')
    recordOriginalOrders(menuList.value)
    loading.value = false
  })
}
/** 查询菜单下拉树结构 */
function getTreeselect() {
  menuOptions.value = []
  listMenu().then((response) => {
    const menu = {
      menuId: 0,
      get menuName() {
        return t('system:root')
      },
      children: [],
    }
    menu.children = proxy.handleTree(response.data, 'menuId')
    menuOptions.value.push(menu)
  })
}
/** 取消按钮 */
function cancel() {
  open.value = false
  reset()
}
/** 表单重置 */
function reset() {
  originalTranslations.value = {}
  form.value = {
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
  proxy.resetForm('menuRef')
}
/** 展示下拉图标 */
function showSelectIcon() {
  iconSelectRef.value.reset()
}
/** 选择图标 */
function selected(name) {
  form.value.icon = name
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
  getTreeselect()
  if (row != null && row.menuId) {
    form.value.parentId = row.menuId
  } else {
    form.value.parentId = 0
  }
  open.value = true
  title.value = () => t('system:addMenu')
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
async function handleUpdate(row) {
  reset()
  await getTreeselect()
  getMenu(row.menuId).then((response) => {
    originalTranslations.value = response.data.menuNameI18n || {}
    form.value = { ...response.data, menuNameI18n: {} }
    open.value = true
    title.value = () => t('system:editMenu')
  })
}
/** 提交按钮 */
function submitForm() {
  proxy.$refs['menuRef'].validate((valid) => {
    if (valid) {
      if (form.value.menuId != undefined) {
        updateMenu(form.value).then((response) => {
          proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
          open.value = false
          getList()
        })
      } else {
        addMenu(form.value).then((response) => {
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
    originalOrders.value[item.menuId] = item.orderNum
    if (item.children && item.children.length) {
      recordOriginalOrders(item.children)
    }
  })
}

/** 保存排序 */
function handleSaveSort() {
  const changedMenuIds = []
  const changedOrderNums = []
  const collectChanged = (list) => {
    list.forEach((item) => {
      if (String(originalOrders.value[item.menuId]) !== String(item.orderNum)) {
        changedMenuIds.push(item.menuId)
        changedOrderNums.push(item.orderNum)
      }
      if (item.children && item.children.length) {
        collectChanged(item.children)
      }
    })
  }
  collectChanged(menuList.value)
  if (changedMenuIds.length === 0) {
    proxy.$modal.msgWarning(t('system:theOrderHasNotChanged'))
    return
  }
  updateMenuSort({ menuIds: changedMenuIds.join(','), orderNums: changedOrderNums.join(',') }).then(
    () => {
      proxy.$modal.msgSuccess(t('system:orderSaved'))
      recordOriginalOrders(menuList.value)
    }
  )
}

/** 删除按钮操作 */
function handleDelete(row) {
  proxy.$modal
    .confirm(
      t('system:confirmation.deleteName', { name: resolveText(row.menuName, row.menuNameI18n) })
    )
    .then(function () {
      return delMenu(row.menuId)
    })
    .then(() => {
      getList()
      proxy.$modal.msgSuccess(t('system:deletedSuccessfully'))
    })
    .catch(() => {})
}

getList()
</script>
