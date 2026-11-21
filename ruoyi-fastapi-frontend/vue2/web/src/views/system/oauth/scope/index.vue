<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('oauth:shared.integrationManagement')"
      :title="$t('system:permission.title')"
      :description="
        $t(
          'oauth:scope.describeTheIdentityInformationAndServiceOperationsApplicationsMayRequestInBusiness'
        )
      "
      :filter-hint="
        $t('oauth:scope.protocolCodesAppearAsSecondaryInformationSearchByNameForEverydayUse')
      "
    >
      <template #actions>
        <el-button
          type="primary"
          icon="el-icon-plus"
          v-hasPermi="['system:oauthScope:add']"
          @click="handleAdd"
          >{{ $t('oauth:scope.addPermission') }}</el-button
        >
      </template>

      <template #filters>
        <el-form
          :validate-on-rule-change="false"
          v-show="showSearch"
          ref="queryRef"
          :model="queryParams"
          :inline="true"
        >
          <el-form-item
            :label="$t('oauth:scope.permissionName')"
            prop="scopeName"
          >
            <el-input
              v-model="queryParams.scopeName"
              clearable
              :placeholder="$t('oauth:scope.enterPermissionName')"
              style="width: 200px"
              @keyup.enter.native="handleQuery"
            />
          </el-form-item>
          <el-form-item
            :label="$t('oauth:scope.purpose')"
            prop="scopeType"
          >
            <el-select
              v-model="queryParams.scopeType"
              clearable
              :placeholder="$t('oauth:scope.allPurposes')"
              style="width: 200px"
            >
              <el-option
                :label="$t('oauth:scope.signInIdentityInformation')"
                value="identity"
              />
              <el-option
                :label="$t('oauth:scope.serviceAccess')"
                value="resource"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('common:status')"
            prop="status"
          >
            <el-select
              v-model="queryParams.status"
              clearable
              :placeholder="$t('common:allStatuses')"
              style="width: 200px"
            >
              <el-option
                :label="$t('oauth:shared.inUse')"
                value="0"
              />
              <el-option
                :label="$t('common:disabled')"
                value="1"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              icon="el-icon-search"
              @click="handleQuery"
              >{{ $t('common:find') }}</el-button
            >
            <el-button
              icon="el-icon-refresh"
              @click="resetQuery"
              >{{ $t('common:clear') }}</el-button
            >
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <span class="result-count"
          >{{ $t('oauth:scope.defined') }} <strong>{{ total }}</strong>
          {{ $t('oauth:scope.permissions') }}</span
        >
        <right-toolbar
          :showSearch.sync="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="scopeCode"
      >
        <el-table-column
          :label="$t('system:permission.title')"
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
          :label="$t('oauth:scope.purpose')"
          width="135"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.scopeType === 'identity' ? 'primary' : 'success'"
              effect="plain"
            >
              {{
                scope.row.scopeType === 'identity'
                  ? $t('oauth:scope.signInIdentityInformation')
                  : $t('oauth:scope.serviceAccess')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:scope.service')"
          min-width="180"
        >
          <template #default="scope">{{ resourceName(scope.row.resourceId) }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:shared.returnedUserInformation')"
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
                >{{ $t('oauth:scope.noAdditionalInformationReturned') }}</span
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
          :label="$t('oauth:scope.userConfirmation')"
          width="145"
        >
          <template #default="scope">
            <div class="policy-cell">
              <el-tag
                v-if="scope.row.sensitive"
                type="warning"
                size="small"
                >{{ $t('oauth:scope.sensitivePermission') }}</el-tag
              >
              <span>{{
                scope.row.consentRequired
                  ? $t('oauth:scope.confirmationRequired')
                  : $t('oauth:scope.skipRepeatedConfirmation')
              }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:status')"
          width="105"
          align="center"
        >
          <template #default="scope">
            <el-tag :type="scope.row.status === '0' ? 'success' : 'info'">{{
              scope.row.status === '0'
                ? $t('oauth:shared.inUse')
                : $t('pluginAdmin:release.disabled')
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:actions')"
          width="180"
          fixed="right"
          align="center"
        >
          <template #default="scope">
            <div class="table-actions">
              <el-button
                type="text"
                icon="el-icon-edit"
                v-hasPermi="['system:oauthScope:edit']"
                @click="handleUpdate(scope.row)"
                >{{ $t('common:editAction') }}</el-button
              >
              <el-dropdown
                v-if="scope.row.scopeCode !== 'openid'"
                trigger="click"
                @command="(command) => handleRowCommand(command, scope.row)"
              >
                <el-button
                  type="text"
                  icon="el-icon-arrow-down"
                  >{{ $t('common:more') }}</el-button
                >
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-if="scope.row.status !== '0'"
                      command="enable"
                      icon="el-icon-circle-check"
                      v-hasPermi="['system:oauthScope:edit']"
                      >{{ $t('oauth:shared.reEnable') }}</el-dropdown-item
                    >
                    <el-dropdown-item
                      v-else
                      command="disable"
                      icon="el-icon-circle-close"
                      v-hasPermi="['system:oauthScope:remove']"
                      >{{ $t('oauth:scope.disablePermission') }}</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('oauth:scope.noMatchingPermissions')">
            <el-button
              type="primary"
              v-hasPermi="['system:oauthScope:add']"
              @click="handleAdd"
              >{{ $t('oauth:scope.addYourFirstPermission') }}</el-button
            >
          </el-empty>
        </template>
      </el-table>
      <pagination
        v-show="total > 0"
        :page.sync="queryParams.pageNum"
        :limit.sync="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </PageFrame>

    <el-dialog
      custom-class="oauth-overlay"
      :visible.sync="open"
      :title="form.persisted ? $t('oauth:scope.editPermission') : $t('oauth:scope.addPermission')"
      width="min(780px, calc(100vw - 48px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form
        :validate-on-rule-change="false"
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="160px"
        class="permission-form"
      >
        <div class="section-heading">
          <h3>{{ $t('oauth:scope.permissionMeaning') }}</h3>
          <p>
            {{
              $t(
                'oauth:scope.chooseWhetherThisPermissionProvidesSignInInformationOrServiceAccessThen'
              )
            }}
          </p>
        </div>
        <el-form-item prop="scopeType">
          <template #label
            ><FieldLabel
              :label="$t('oauth:scope.permissionPurpose')"
              :help="
                $t(
                  'oauth:scope.identityPermissionsReturnUserProfileInformationServiceAccessPermissionsAllowApplicationsTo'
                )
              "
          /></template>
          <el-radio-group
            v-model="form.scopeType"
            class="choice-grid"
            :disabled="form.scopeCode === 'openid'"
          >
            <el-radio
              label="identity"
              border
            >
              <strong>{{ $t('oauth:scope.signInIdentityInformation') }}</strong>
              <small>{{ $t('oauth:scope.forExampleNameEmailAndRoles') }}</small>
            </el-radio>
            <el-radio
              label="resource"
              border
            >
              <strong>{{ $t('oauth:scope.serviceAccess') }}</strong>
              <small>{{ $t('oauth:scope.forExampleViewingOrdersOrUpdatingInventory') }}</small>
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
                  :label="$t('oauth:scope.displayName')"
                  :help="$t('oauth:scope.theNameShownToUsersDuringConsentAndInAdminListsIt')"
              /></template>
              <el-input
                v-model="form.scopeName"
                :placeholder="$t('oauth:scope.forExampleViewOrders')"
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
                  :label="$t('oauth:scope.permissionCode')"
                  :help="
                    $t('oauth:scope.theProtocolCodeTheApplicationUsesInSignInRequestsItCannot')
                  "
              /></template>
              <el-input
                v-model="form.scopeCode"
                :disabled="form.persisted"
                :placeholder="$t('oauth:scope.forExampleOrdersRead')"
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
              :label="$t('oauth:scope.service')"
              :help="$t('oauth:scope.chooseTheServiceTheApplicationCanAccessWithThisPermission')"
          /></template>
          <el-select
            v-model="form.resourceId"
            filterable
            :placeholder="$t('oauth:scope.chooseAService')"
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
              :label="$t('oauth:scope.returnUserInformation')"
              :help="
                $t(
                  'oauth:scope.theUserInformationAnApplicationCanReceiveWithThisPermissionMultipleSelections'
                )
              "
          /></template>
          <el-select
            v-model="form.claims"
            multiple
            filterable
            allow-create
            default-first-option
            :placeholder="$t('oauth:shared.selectOrEnterUserFields')"
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
              :label="$t('oauth:scope.userConfirmation')"
              :help="
                $t(
                  'oauth:scope.sensitivePermissionsShouldRequireExplicitUserConfirmationAndBeEmphasizedOnThe'
                )
              "
          /></template>
          <div class="policy-options">
            <el-checkbox v-model="form.consentRequired">{{
              $t('oauth:scope.askTheUserToConfirmBeforeUse')
            }}</el-checkbox>
            <el-checkbox v-model="form.sensitive">{{
              $t('oauth:scope.markAsSensitivePermission')
            }}</el-checkbox>
          </div>
        </el-form-item>
        <el-form-item>
          <template #label
            ><FieldLabel
              :label="$t('common:remark')"
              :help="
                $t('oauth:scope.forAdministratorsRecordsOnlyThisIsNotShownToExternalApplications')
              "
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
          >{{ $t('oauth:scope.savePermission') }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'OAuthScope' }
</script>

<script setup>
import { getCurrentInstance, reactive, ref } from 'vue'
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
      return t('oauth:shared.userIdentifierSub')
    },
  },
  {
    value: 'name',
    get label() {
      return t('oauth:shared.nameName')
    },
  },
  {
    value: 'email',
    get label() {
      return t('oauth:shared.emailEmail')
    },
  },
  {
    value: 'roles',
    get label() {
      return t('oauth:shared.rolesRoles')
    },
  },
  {
    value: 'preferred_username',
    get label() {
      return t('oauth:scope.loginAccountPreferredUsername')
    },
  },
]
const rules = {
  scopeCode: [
    {
      required: true,
      get message() {
        return t('oauth:scope.enterAPermissionCode')
      },
      trigger: 'blur',
    },
  ],
  scopeName: [
    {
      required: true,
      get message() {
        return t('oauth:scope.enterADisplayName')
      },
      trigger: 'blur',
    },
  ],
  scopeType: [
    {
      required: true,
      get message() {
        return t('oauth:scope.selectAPermissionPurpose')
      },
      trigger: 'change',
    },
  ],
  resourceId: [
    {
      required: true,
      message: () => t('oauth:scope.chooseTheServiceThisPermissionBelongsTo'),
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
    proxy.$modal.msgSuccess(t('oauth:scope.permissionSaved'))
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
      t('oauth:scope.confirmStatus', {
        action: status === '0' ? t('system:oauth.enable') : t('system:oauth.disabled'),
        code: row.scopeCode,
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
    t('oauth:scope.disablingPermissionValuePreventsApplicationsFromRequestingItContinue', {
      value0: row.scopeName,
    })
  )
  await deleteOAuthScopes(row.scopeCode)
  proxy.$modal.msgSuccess(t('oauth:scope.permissionDisabled'))
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
    return t('oauth:scope.unifiedIdentityInformation')
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
  color: var(--oauth-text-color-regular);
  font-size: 13px;
}

.result-count strong {
  color: var(--oauth-text-color-primary);
  font-size: 16px;
}

.permission-cell strong,
.permission-cell code {
  display: block;
}

.permission-cell strong {
  color: var(--oauth-text-color-primary);
}

.permission-cell code {
  margin-top: 4px;
  color: var(--oauth-text-color-secondary);
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
  color: var(--oauth-text-color-regular);
  font-size: 12px;
}

.muted-value {
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.section-heading {
  margin-bottom: 22px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--oauth-border-color-lighter);
}

.section-heading h3 {
  margin: 0;
  color: var(--oauth-text-color-primary);
  font-size: 17px;
  font-weight: 650;
}

.section-heading p {
  margin: 7px 0 0;
  color: var(--oauth-text-color-secondary);
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
  color: var(--oauth-text-color-primary);
}

.choice-grid small {
  margin-top: 4px;
  color: var(--oauth-text-color-secondary);
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
  color: var(--oauth-text-color-secondary);
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
