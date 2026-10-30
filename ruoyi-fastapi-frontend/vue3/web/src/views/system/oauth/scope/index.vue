<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('oauth:integrationManagement')"
      :title="$t('components:permissions')"
      :description="
        $t('oauth:describeTheIdentityInformationAndServiceOperationsApplicationsMayRequest')
      "
      :filter-hint="$t('oauth:protocolCodesAppearAsSecondaryInformationSearchByNameFor')"
    >
      <template #actions>
        <el-button
          type="primary"
          icon="Plus"
          v-hasPermi="['system:oauthScope:add']"
          @click="handleAdd"
          >{{ $t('oauth:addPermission') }}</el-button
        >
      </template>

      <template #filters>
        <el-form
          v-show="showSearch"
          ref="queryRef"
          :model="queryParams"
          :inline="true"
        >
          <el-form-item
            :label="$t('oauth:permissionName')"
            prop="scopeName"
          >
            <el-input
              v-model="queryParams.scopeName"
              clearable
              :placeholder="$t('oauth:enterPermissionName')"
              style="width: 200px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item
            :label="$t('oauth:purpose')"
            prop="scopeType"
          >
            <el-select
              v-model="queryParams.scopeType"
              clearable
              :placeholder="$t('oauth:allPurposes')"
              style="width: 200px"
            >
              <el-option
                :label="$t('oauth:signInIdentityInformation')"
                value="identity"
              />
              <el-option
                :label="$t('oauth:serviceAccess')"
                value="resource"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('system:status')"
            prop="status"
          >
            <el-select
              v-model="queryParams.status"
              clearable
              :placeholder="$t('components:allStatuses')"
              style="width: 200px"
            >
              <el-option
                :label="$t('oauth:inUse')"
                value="0"
              />
              <el-option
                :label="$t('components:disabled')"
                value="1"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              icon="Search"
              @click="handleQuery"
              >{{ $t('monitor:find') }}</el-button
            >
            <el-button
              icon="Refresh"
              @click="resetQuery"
              >{{ $t('monitor:clear') }}</el-button
            >
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <span class="result-count"
          >{{ $t('oauth:defined') }}<strong>{{ total }}</strong> {{ $t('oauth:permissions') }}</span
        >
        <right-toolbar
          v-model:showSearch="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="scopeCode"
      >
        <el-table-column
          :label="$t('components:permissions')"
          min-width="230"
        >
          <template #default="scope">
            <div class="permission-cell">
              <strong>{{ scope.row.scopeName }}</strong>
              <code>{{ scope.row.scopeCode }}</code>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:purpose')"
          width="135"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.scopeType === 'identity' ? 'primary' : 'success'"
              effect="plain"
            >
              {{
                scope.row.scopeType === 'identity'
                  ? $t('oauth:signInIdentityInformation')
                  : $t('oauth:serviceAccess')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:service')"
          min-width="180"
        >
          <template #default="scope">{{ resourceName(scope.row.resourceId) }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:returnedUserInformation')"
          min-width="230"
        >
          <template #default="scope">
            <div class="claim-summary">
              <el-tag
                v-for="item in (scope.row.claims || []).slice(0, 3)"
                :key="item"
                size="small"
                effect="plain"
                >{{ claimLabel(item) }}</el-tag
              >
              <span
                v-if="!(scope.row.claims || []).length"
                class="muted-value"
                >{{ $t('oauth:noAdditionalInformationReturned') }}</span
              >
              <span
                v-else-if="scope.row.claims.length > 3"
                class="muted-value"
                >+{{ scope.row.claims.length - 3 }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:userConfirmation')"
          width="145"
        >
          <template #default="scope">
            <div class="policy-cell">
              <el-tag
                v-if="scope.row.sensitive"
                type="warning"
                size="small"
                >{{ $t('oauth:sensitivePermission') }}</el-tag
              >
              <span>{{
                scope.row.consentRequired
                  ? $t('oauth:confirmationRequired')
                  : $t('oauth:skipRepeatedConfirmationLabel')
              }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('system:status')"
          width="105"
          align="center"
        >
          <template #default="scope">
            <el-tag :type="scope.row.status === '0' ? 'success' : 'info'">{{
              scope.row.status === '0' ? $t('oauth:inUse') : $t('components:disabled')
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('system:actions')"
          width="180"
          fixed="right"
          align="center"
        >
          <template #default="scope">
            <div class="table-actions">
              <el-button
                link
                type="primary"
                icon="Edit"
                v-hasPermi="['system:oauthScope:edit']"
                @click="handleUpdate(scope.row)"
                >{{ $t('oauth:edit') }}</el-button
              >
              <el-dropdown
                v-if="scope.row.scopeCode !== 'openid'"
                trigger="click"
                @command="(command) => handleRowCommand(command, scope.row)"
              >
                <el-button
                  link
                  type="primary"
                  icon="ArrowDown"
                  >{{ $t('oauth:more') }}</el-button
                >
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-if="scope.row.status !== '0'"
                      command="enable"
                      icon="CircleCheck"
                      v-hasPermi="['system:oauthScope:edit']"
                      >{{ $t('oauth:reEnable') }}</el-dropdown-item
                    >
                    <el-dropdown-item
                      v-else
                      command="disable"
                      icon="CircleClose"
                      v-hasPermi="['system:oauthScope:remove']"
                      >{{ $t('oauth:disablePermission') }}</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('oauth:noMatchingPermissions')">
            <el-button
              type="primary"
              v-hasPermi="['system:oauthScope:add']"
              @click="handleAdd"
              >{{ $t('oauth:addYourFirstPermission') }}</el-button
            >
          </el-empty>
        </template>
      </el-table>
      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </PageFrame>

    <el-dialog
      v-model="open"
      :title="form.persisted ? $t('oauth:editPermission') : $t('oauth:addPermission')"
      width="min(780px, calc(100vw - 48px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="160px"
        class="permission-form"
      >
        <div class="section-heading">
          <h3>{{ $t('oauth:permissionMeaning') }}</h3>
          <p>{{ $t('oauth:chooseWhetherThisPermissionProvidesSignInInformationOrService') }}</p>
        </div>
        <el-form-item prop="scopeType">
          <template #label
            ><FieldLabel
              :label="$t('oauth:permissionPurpose')"
              :help="
                $t('oauth:identityPermissionsReturnUserProfileInformationServicePermissionsAllowAn')
              "
          /></template>
          <el-radio-group
            v-model="form.scopeType"
            class="choice-grid"
            :disabled="form.scopeCode === 'openid'"
          >
            <el-radio
              value="identity"
              border
            >
              <strong>{{ $t('oauth:signInIdentityInformation') }}</strong>
              <small>{{ $t('oauth:forExampleNameEmailAndRoles') }}</small>
            </el-radio>
            <el-radio
              value="resource"
              border
            >
              <strong>{{ $t('oauth:serviceAccess') }}</strong>
              <small>{{ $t('oauth:forExampleViewingOrdersOrUpdatingInventory') }}</small>
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-row :gutter="18">
          <el-col
            :xs="24"
            :sm="12"
          >
            <el-form-item prop="scopeName">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:displayName')"
                  :help="$t('oauth:theNameShownDuringUserConsentAndInAdministrationLists')"
              /></template>
              <el-input
                v-model="form.scopeName"
                :placeholder="$t('oauth:forExampleViewOrders')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col
            :xs="24"
            :sm="12"
          >
            <el-form-item prop="scopeCode">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:permissionCode')"
                  :help="$t('oauth:protocolCodeUsedInSignInRequestsItCannotBe')"
              /></template>
              <el-input
                v-model="form.scopeCode"
                :disabled="form.persisted"
                :placeholder="$t('oauth:forExampleOrdersRead')"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item
          v-if="form.scopeType === 'resource'"
          prop="resourceId"
        >
          <template #label
            ><FieldLabel
              :label="$t('oauth:service')"
              :help="$t('oauth:selectTheServiceTheAppMayAccessWithThisPermission')"
          /></template>
          <el-select
            v-model="form.resourceId"
            filterable
            :placeholder="$t('oauth:chooseAService')"
            style="width: 100%"
          >
            <el-option
              v-for="item in resourceOptions"
              :key="item.resourceId"
              :label="item.resourceName"
              :value="item.resourceId"
            >
              <span>{{ item.resourceName }}</span>
              <code class="option-code">{{ item.resourceId }}</code>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label
            ><FieldLabel
              :label="$t('oauth:returnUserInformation')"
              :help="$t('oauth:userInformationTheAppMayReceiveWithThisPermissionMultiple')"
          /></template>
          <el-select
            v-model="form.claims"
            multiple
            filterable
            allow-create
            default-first-option
            :placeholder="$t('oauth:selectOrEnterUserFields')"
            style="width: 100%"
          >
            <el-option
              v-for="item in claimOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label
            ><FieldLabel
              :label="$t('oauth:userConfirmation')"
              :help="
                $t('oauth:sensitivePermissionsShouldRequireExplicitConsentAndBeHighlightedOn')
              "
          /></template>
          <div class="policy-options">
            <el-checkbox v-model="form.consentRequired">{{
              $t('oauth:askTheUserToConfirmBeforeUse')
            }}</el-checkbox>
            <el-checkbox v-model="form.sensitive">{{
              $t('oauth:markAsSensitivePermission')
            }}</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item>
          <template #label
            ><FieldLabel
              :label="$t('system:remarks')"
              :help="$t('oauth:forAdministratorNotesOnlyNotShownToExternalApps')"
          /></template>
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="submitForm"
          >{{ $t('oauth:savePermission') }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="OAuthScope">
import { useLocaleForm } from '@/composables/useLocaleForm'
import { t } from '@/i18n/adapter'
import {
  addOAuthScope,
  changeOAuthScopeStatus,
  deleteOAuthScopes,
  getOAuthScope,
  listOAuthResources,
  listOAuthScopes,
  updateOAuthScope,
} from '@/api/system/oauthResource'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel.vue'
import PageFrame from '@/components/OAuthWorkspace/PageFrame.vue'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.formRef))
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const showSearch = ref(true)
const open = ref(false)
const resourceOptions = ref([])
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  scopeName: undefined,
  scopeType: undefined,
  status: undefined,
})
const form = reactive(emptyForm())
const claimOptions = [
  {
    value: 'sub',
    get label() {
      return t('oauth:userIdentifierSub')
    },
  },
  {
    value: 'name',
    get label() {
      return t('oauth:nameName')
    },
  },
  {
    value: 'email',
    get label() {
      return t('oauth:emailEmail')
    },
  },
  {
    value: 'roles',
    get label() {
      return t('oauth:rolesRoles')
    },
  },
  {
    value: 'preferred_username',
    get label() {
      return t('oauth:accountPreferredUsername')
    },
  },
]
const rules = {
  scopeCode: [
    {
      required: true,
      get message() {
        return t('oauth:enterPermissionCode')
      },
      trigger: 'blur',
    },
  ],
  scopeName: [
    {
      required: true,
      get message() {
        return t('oauth:enterDisplayName')
      },
      trigger: 'blur',
    },
  ],
  scopeType: [
    {
      required: true,
      get message() {
        return t('oauth:selectPermissionPurpose')
      },
      trigger: 'change',
    },
  ],
  resourceId: [
    {
      required: true,
      get message() {
        return t('oauth:chooseTheServiceThisPermissionBelongsTo')
      },
      trigger: 'change',
    },
  ],
}

/** 创建权限表单默认值 */
function emptyForm() {
  return {
    persisted: false,
    scopeCode: '',
    scopeName: '',
    scopeType: 'identity',
    resourceId: null,
    claims: [],
    consentRequired: true,
    sensitive: false,
    status: '0',
    remark: '',
  }
}

/** 重置权限表单 */
function resetForm() {
  Object.assign(form, emptyForm())
  proxy.resetForm('formRef')
}

/** 查询权限列表 */
async function getList() {
  loading.value = true
  try {
    const response = await listOAuthScopes(queryParams)
    rows.value = response.rows || []
    total.value = response.total || 0
  } finally {
    loading.value = false
  }
}

/** 加载可选资源服务 */
async function loadResourceOptions() {
  const response = await listOAuthResources({
    pageNum: 1,
    pageSize: 200,
    status: '0',
  })
  resourceOptions.value = response.rows || []
}

/** 搜索按钮操作 */
function handleQuery() {
  queryParams.pageNum = 1
  getList()
}

/** 重置按钮操作 */
function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}

/** 新增按钮操作 */
function handleAdd() {
  resetForm()
  loadResourceOptions().catch(() => {})
  open.value = true
}

/** 修改按钮操作 */
async function handleUpdate(row) {
  resetForm()
  const [response] = await Promise.all([
    getOAuthScope(row.scopeCode),
    loadResourceOptions().catch(() => {}),
  ])
  Object.assign(form, response.data, {
    persisted: true,
    claims: [...(response.data.claims || [])],
  })
  open.value = true
}

/** 校验并保存权限配置 */
async function submitForm() {
  await proxy.$refs.formRef.validate()
  saving.value = true
  try {
    const { persisted, ...data } = form
    data.claims = [...form.claims]
    if (data.scopeType === 'identity') {
      data.resourceId = null
    }
    await (persisted ? updateOAuthScope(data) : addOAuthScope(data))
    proxy.$modal.msgSuccess(t('oauth:permissionSaved'))
    open.value = false
    await getList()
  } finally {
    saving.value = false
  }
}

/** 修改权限状态 */
async function changeStatus(row, status) {
  try {
    await proxy.$modal.confirm(
      t('oauth:valueScopeValue', {
        arg0: status === '0' ? t('system:enable') : t('system:disabled'),
        scopeCode: row.scopeCode,
      })
    )
    await changeOAuthScopeStatus({ scopeCode: row.scopeCode, status })
    await getList()
  } catch {
    await getList()
  }
}

/** 删除按钮操作 */
async function handleDelete(row) {
  await proxy.$modal.confirm(
    t('oauth:disablingPermissionValuePreventsAppsFromRequestingItContinue', {
      scopeName: row.scopeName,
    })
  )
  await deleteOAuthScopes(row.scopeCode)
  proxy.$modal.msgSuccess(t('oauth:permissionDisabled'))
  await getList()
}

/** 处理权限行操作 */
function handleRowCommand(command, row) {
  if (command === 'enable') {
    return changeStatus(row, '0')
  }
  if (command === 'disable') {
    return handleDelete(row)
  }
}

/** 获取权限关联的资源服务名称 */
function resourceName(resourceId) {
  if (!resourceId) {
    return t('oauth:unifiedIdentityInformation')
  }
  return (
    resourceOptions.value.find((item) => item.resourceId === resourceId)?.resourceName || resourceId
  )
}

/** 获取声明字段的展示名称 */
function claimLabel(value) {
  return claimOptions.find((item) => item.value === value)?.label?.replace(/（.*）$/, '') || value
}

Promise.all([getList(), loadResourceOptions().catch(() => {})])
</script>

<style scoped>
.result-count {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.result-count strong {
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.permission-cell strong,
.permission-cell code {
  display: block;
}

.permission-cell strong {
  color: var(--el-text-color-primary);
}

.permission-cell code {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.claim-summary,
.policy-cell {
  display: flex;
  align-items: center;
  gap: 5px;
}

.policy-cell {
  flex-wrap: wrap;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.muted-value {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.section-heading {
  margin-bottom: 22px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-heading h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 17px;
  font-weight: 650;
}

.section-heading p {
  margin: 7px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.choice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.choice-grid :deep(.el-radio) {
  width: 100%;
  height: auto;
  min-height: 68px;
  margin: 0;
  padding: 12px 14px;
  white-space: normal;
}

.choice-grid :deep(.el-radio__label),
.choice-grid strong,
.choice-grid small {
  display: block;
}

.choice-grid strong {
  color: var(--el-text-color-primary);
}

.choice-grid small {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.policy-options {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.policy-options :deep(.el-checkbox) {
  margin-right: 0;
}

.option-code {
  float: right;
  margin-left: 20px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 768px) {
  .permission-form :deep(.el-form-item) {
    display: block;
  }

  .permission-form :deep(.el-form-item__label) {
    width: auto !important;
    margin-bottom: 6px;
  }

  .permission-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }

  .choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
