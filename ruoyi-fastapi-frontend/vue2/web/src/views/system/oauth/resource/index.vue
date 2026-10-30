<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('authCenter:help.integrationManagement')"
      :title="$t('common:service')"
      :description="
        $t(
          'authCenter:messages.registerAPIServicesThatReceiveAccessCredentialsAndLimitTheUserInformation'
        )
      "
      :filter-hint="$t('authCenter:messages.findServicesByNameOrStatus')"
    >
      <template #actions>
        <el-button
          type="primary"
          icon="el-icon-plus"
          v-hasPermi="['system:oauthResource:add']"
          @click="handleAdd"
          >{{ $t('authCenter:messages.addService') }}</el-button
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
            :label="$t('authCenter:messages.serviceName')"
            prop="resourceName"
          >
            <el-input
              v-model="queryParams.resourceName"
              clearable
              :placeholder="$t('authCenter:messages.enterServiceName')"
              style="width: 200px"
              @keyup.enter.native="handleQuery"
            />
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
                :label="$t('authCenter:messages.inUse')"
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
          >{{ $t('authCenter:messages.registered') }} <strong>{{ total }}</strong>
          {{ $t('authCenter:messages.services') }}</span
        >
        <right-toolbar
          :showSearch.sync="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="resourceList"
        row-key="resourceId"
      >
        <el-table-column
          :label="$t('common:service')"
          min-width="230"
        >
          <template #default="scope">
            <div class="entity-cell">
              <span class="service-mark"
                ><i
                  class="el-icon el-icon-connection"
                  aria-hidden="true"
                ></i
              ></span>
              <span class="entity-copy">
                <strong>{{ scope.row.resourceName }}</strong>
                <code>{{ scope.row.resourceId }}</code>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.tokenAudience')"
          prop="audience"
          min-width="250"
          show-overflow-tooltip
        >
          <template #default="scope"
            ><code class="audience-value">{{ scope.row.audience }}</code></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.returnedUserInformation')"
          min-width="240"
        >
          <template #default="scope">
            <div class="tag-summary">
              <el-tag
                v-for="claim in (scope.row.allowedClaims || []).slice(0, 3)"
                :key="claim"
                size="small"
                effect="plain"
                >{{ claimLabel(claim) }}</el-tag
              >
              <span
                v-if="(scope.row.allowedClaims || []).length > 3"
                class="muted-value"
                >+{{ scope.row.allowedClaims.length - 3 }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.validityPeriods')"
          width="120"
          align="center"
        >
          <template #default="scope">{{
            scope.row.accessTokenTtlSeconds
              ? formatDuration(scope.row.accessTokenTtlSeconds)
              : $t('pluginAdmin:platformDefault')
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('common:status')"
          width="105"
          align="center"
        >
          <template #default="scope">
            <el-tag :type="scope.row.status === '0' ? 'success' : 'info'">{{
              scope.row.status === '0'
                ? $t('authCenter:messages.inUse')
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
                v-hasPermi="['system:oauthResource:edit']"
                @click="handleUpdate(scope.row)"
                >{{ $t('common:editAction') }}</el-button
              >
              <el-dropdown
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
                      v-hasPermi="['system:oauthResource:edit']"
                      >{{ $t('authCenter:messages.reEnable') }}</el-dropdown-item
                    >
                    <el-dropdown-item
                      v-else
                      command="disable"
                      icon="el-icon-circle-close"
                      v-hasPermi="['system:oauthResource:remove']"
                      >{{ $t('authCenter:messages.disableService') }}</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('authCenter:messages.noMatchingServices')">
            <el-button
              type="primary"
              v-hasPermi="['system:oauthResource:add']"
              @click="handleAdd"
              >{{ $t('authCenter:messages.addYourFirstService') }}</el-button
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
      :title="
        form.persisted
          ? $t('authCenter:expression.editService')
          : $t('authCenter:messages.addService')
      "
      width="min(820px, calc(100vw - 48px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form
        :validate-on-rule-change="false"
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="160px"
        class="resource-form"
      >
        <section class="form-section">
          <div class="section-heading">
            <h3>{{ $t('authCenter:messages.serviceIdentity') }}</h3>
            <p>
              {{
                $t(
                  'authCenter:messages.applicationsRequestAccessUsingTheServiceIdentifierServicesUseTheTokenAudience'
                )
              }}
            </p>
          </div>
          <el-row :gutter="18">
            <el-col
              :xs="24"
              :sm="12"
            >
              <el-form-item prop="resourceName">
                <template #label
                  ><FieldLabel
                    :label="$t('authCenter:messages.serviceName')"
                    :help="
                      $t('authCenter:help.aDisplayNameThatHelpsAdministratorsIdentifyThisService')
                    "
                /></template>
                <el-input
                  v-model="form.resourceName"
                  :placeholder="$t('authCenter:messages.forExampleOrderService')"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col
              :xs="24"
              :sm="12"
            >
              <el-form-item prop="resourceId">
                <template #label
                  ><FieldLabel
                    :label="$t('authCenter:messages.serviceIdentifier')"
                    :help="
                      $t(
                        'authCenter:help.applicationsAssociateThisServiceWithItsUniqueIdentifierWhichCannotBeChanged'
                      )
                    "
                /></template>
                <el-input
                  v-model="form.resourceId"
                  :disabled="form.persisted"
                  :placeholder="$t('authCenter:messages.forExampleOrdersApi')"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item prop="audience">
            <template #label
              ><FieldLabel
                :label="$t('authCenter:messages.tokenAudience')"
                :help="
                  $t('authCenter:help.theUniqueValueUsedByTheServiceToValidateAccessTokensIt')
                "
            /></template>
            <el-input
              v-model="form.audience"
              :disabled="form.persisted"
              :placeholder="$t('authCenter:messages.forExampleHttpsApiExampleCom')"
              style="width: 100%"
            />
          </el-form-item>
        </section>

        <section class="form-section">
          <div class="section-heading">
            <h3>{{ $t('authCenter:messages.credentialsAndUserInformation') }}</h3>
            <p>
              {{
                $t(
                  'authCenter:messages.controlAccessCredentialLifetimesAndTheMaximumUserInformationThisServiceMay'
                )
              }}
            </p>
          </div>
          <el-row :gutter="18">
            <el-col
              :xs="24"
              :sm="12"
            >
              <el-form-item class="duration-field">
                <template #label
                  ><FieldLabel
                    :label="$t('authCenter:messages.validityPeriods')"
                    :help="
                      $t(
                        'authCenter:help.theMaximumLifetimeOfAccessTokensReceivedByTheServiceLeaveEmpty'
                      )
                    "
                /></template>
                <el-input-number
                  :value="form.accessTokenTtlSeconds ?? undefined"
                  @input="form.accessTokenTtlSeconds = $event ?? null"
                  :min="1"
                  :placeholder="$t('pluginAdmin:platformDefault')"
                  controls-position="right"
                  style="width: 100%"
                />
                <span class="input-unit">{{ $t('common:seconds') }}</span>
              </el-form-item>
            </el-col>
            <el-col
              :xs="24"
              :sm="12"
            >
              <el-form-item>
                <template #label
                  ><FieldLabel
                    :label="$t('authCenter:messages.tokenIntrospectionApplication')"
                    :help="
                      $t(
                        'authCenter:help.optionalEnterABackendApplicationIDToCheckWhetherTokensRemainValid'
                      )
                    "
                /></template>
                <el-input
                  v-model="form.introspectionClientId"
                  :placeholder="$t('authCenter:messages.optionalBackendApplicationID')"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item prop="allowedClaims">
            <template #label
              ><FieldLabel
                :label="$t('authCenter:messages.allowedUserInformation')"
                :help="
                  $t(
                    'authCenter:help.limitsTheUserInformationThisServiceCanReceiveTheFinalResultAlso'
                  )
                "
            /></template>
            <el-select
              v-model="form.allowedClaims"
              multiple
              filterable
              allow-create
              default-first-option
              :placeholder="$t('authCenter:messages.selectOrEnterUserFields')"
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
                :label="$t('common:remark')"
                :help="
                  $t(
                    'authCenter:help.forAdministratorsRecordsOnlyThisIsNotSentToExternalApplicationsOr'
                  )
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
        </section>
      </el-form>
      <template #footer>
        <el-button @click="open = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="submitForm"
          >{{ $t('authCenter:messages.saveService') }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'OAuthResource' }
</script>

<script setup>
import { getCurrentInstance, reactive, ref } from 'vue'
import {
  addOAuthResource,
  changeOAuthResourceStatus,
  deleteOAuthResources,
  getOAuthResource,
  listOAuthResources,
  updateOAuthResource,
} from '@/api/system/oauthResource'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel.vue'
import PageFrame from '@/components/OAuthWorkspace/PageFrame.vue'

const { proxy } = getCurrentInstance()
const resourceList = ref([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const showSearch = ref(true)
const open = ref(false)
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  resourceName: undefined,
  status: undefined,
})
const form = reactive(emptyForm())
const claimOptions = [
  {
    value: 'sub',
    get label() {
      return t('auth:interface.userIdentifierSub')
    },
  },
  {
    value: 'name',
    get label() {
      return t('auth:interface.nameName')
    },
  },
  {
    value: 'email',
    get label() {
      return t('auth:interface.emailEmail')
    },
  },
  {
    value: 'roles',
    get label() {
      return t('auth:interface.rolesRoles')
    },
  },
  {
    value: 'client_id',
    get label() {
      return t('auth:interface.clientIDClientId')
    },
  },
  {
    value: 'scope',
    get label() {
      return t('auth:interface.grantedPermissionsScope')
    },
  },
  {
    value: 'sid',
    get label() {
      return t('auth:interface.sessionIDSid')
    },
  },
]
const rules = {
  resourceId: [
    {
      required: true,
      get message() {
        return t('auth:interface.enterAServiceIdentifier')
      },
      trigger: 'blur',
    },
  ],
  resourceName: [
    {
      required: true,
      get message() {
        return t('auth:interface.enterAServiceName')
      },
      trigger: 'blur',
    },
  ],
  audience: [
    {
      required: true,
      get message() {
        return t('auth:interface.enterTheTokenAudienceUsuallyTheServiceURL')
      },
      trigger: 'blur',
    },
  ],
  allowedClaims: [
    {
      required: true,
      type: 'array',
      min: 1,
      message: () => t('authCenter:messages.selectAtLeastOneAllowedUserInformationField'),
      trigger: 'change',
    },
  ],
}

/** 创建资源服务表单默认值 */
function emptyForm() {
  return {
    persisted: false,
    resourceId: '',
    resourceName: '',
    audience: '',
    tokenFormat: 'jwt',
    signingAlg: 'RS256',
    accessTokenTtlSeconds: null,
    introspectionClientId: null,
    allowedClaims: ['sub', 'client_id', 'scope', 'sid'],
    status: '0',
    remark: '',
  }
}

/** 重置资源服务表单 */
function resetForm() {
  Object.assign(form, emptyForm())
  proxy.resetForm('formRef')
}

/** 查询资源服务列表 */
async function getList() {
  loading.value = true
  try {
    const response = await listOAuthResources(queryParams)
    resourceList.value = response.rows || []
    total.value = response.total || 0
  } finally {
    loading.value = false
  }
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
  open.value = true
}

/** 修改按钮操作 */
async function handleUpdate(row) {
  resetForm()
  const response = await getOAuthResource(row.resourceId)
  Object.assign(form, response.data, {
    persisted: true,
    allowedClaims: [...(response.data.allowedClaims || [])],
  })
  open.value = true
}

/** 校验并保存资源服务配置 */
async function submitForm() {
  await proxy.$refs.formRef.validate()
  saving.value = true
  try {
    const { persisted, ...data } = form
    data.allowedClaims = [...form.allowedClaims]
    if (!persisted) {
      delete data.status
    }
    await (persisted ? updateOAuthResource(data) : addOAuthResource(data))
    proxy.$modal.msgSuccess(t('authCenter:messages.resourceSettingsSaved'))
    open.value = false
    await getList()
  } finally {
    saving.value = false
  }
}

/** 修改资源服务状态 */
async function changeStatus(row, status) {
  try {
    await proxy.$modal.confirm(
      t('auth:interface.valueResourceValue', {
        value0: status === '0' ? t('system:oauth.enable') : t('system:oauth.disabled'),
        value1: row.resourceName,
      })
    )
    await changeOAuthResourceStatus({ resourceId: row.resourceId, status })
    getList()
  } catch {
    getList()
  }
}

/** 删除按钮操作 */
async function handleDelete(row) {
  await proxy.$modal.confirm(
    t('auth:interface.disablingValueStopsIssuanceAndRefreshOfAccessTokensForThisServiceContinue', {
      value0: row.resourceName,
    })
  )
  await deleteOAuthResources(row.resourceId)
  proxy.$modal.msgSuccess(t('authCenter:messages.resourceDisabled'))
  await getList()
}

/** 处理资源服务行操作 */
function handleRowCommand(command, row) {
  if (command === 'enable') {
    return changeStatus(row, '0')
  }
  if (command === 'disable') {
    return handleDelete(row)
  }
}

/** 获取声明字段的展示名称 */
function claimLabel(value) {
  return claimOptions.find((item) => item.value === value)?.label?.replace(/（.*）$/, '') || value
}

/** 显示访问令牌有效期 */
function formatDuration(value) {
  const seconds = Number(value) || 0
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return t('auth:interface.valueHours', { value0: seconds / 3600 })
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return t('auth:interface.valueMinutes', { value0: seconds / 60 })
  }
  return t('auth:interface.valueSeconds', { value0: seconds })
}

getList()
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

.entity-cell {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.service-mark {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  color: var(--oauth-color-success);
  background: var(--oauth-color-success-light-9);
  border: 1px solid var(--oauth-color-success-light-7);
  border-radius: 8px;
  place-items: center;
}

.entity-copy {
  min-width: 0;
}

.entity-copy strong,
.entity-copy code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entity-copy strong {
  color: var(--oauth-text-color-primary);
}

.entity-copy code,
.audience-value {
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.entity-copy code {
  margin-top: 4px;
}

.tag-summary {
  display: flex;
  align-items: center;
  gap: 5px;
}

.muted-value {
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.form-section + .form-section {
  margin-top: 6px;
  padding-top: 22px;
  border-top: 1px solid var(--oauth-border-color-lighter);
}

.section-heading {
  margin-bottom: 22px;
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

.resource-form :deep(.el-input-number) {
  flex: 1;
  width: auto !important;
}

.duration-field :deep(.el-form-item__content) {
  display: flex;
  align-items: center;
}

.input-unit {
  flex: 0 0 auto;
  margin-left: 8px;
  color: var(--oauth-text-color-secondary);
}

@media (max-width: 768px) {
  .resource-form :deep(.el-form-item) {
    display: block;
  }

  .resource-form :deep(.el-form-item__label) {
    width: auto !important;
    margin-bottom: 6px;
  }

  .resource-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
