<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('oauth:integrationManagement')"
      :title="$t('components:service')"
      :description="$t('oauth:registerAPIServicesThatReceiveAccessCredentialsAndLimitThe')"
      :filter-hint="$t('oauth:findServicesByNameOrStatus')"
    >
      <template #actions>
        <el-button
          type="primary"
          icon="Plus"
          v-hasPermi="['system:oauthResource:add']"
          @click="handleAdd"
          >{{ $t('oauth:addService') }}</el-button
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
            :label="$t('oauth:serviceName')"
            prop="resourceName"
          >
            <el-input
              v-model="queryParams.resourceName"
              clearable
              :placeholder="$t('oauth:enterServiceName')"
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
          >{{ $t('oauth:registered') }}<strong>{{ total }}</strong> {{ $t('oauth:services') }}</span
        >
        <right-toolbar
          v-model:showSearch="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="resourceList"
        row-key="resourceId"
      >
        <el-table-column
          :label="$t('components:service')"
          min-width="230"
        >
          <template #default="scope">
            <div class="entity-cell">
              <span class="service-mark"
                ><el-icon><Connection /></el-icon
              ></span>
              <span class="entity-copy">
                <strong>{{ scope.row.resourceName }}</strong>
                <code>{{ scope.row.resourceId }}</code>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:tokenAudience')"
          prop="audience"
          min-width="250"
          show-overflow-tooltip
        >
          <template #default="scope"
            ><code class="audience-value">{{ scope.row.audience }}</code></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('oauth:returnedUserInformation')"
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
          :label="$t('oauth:validityPeriods')"
          width="120"
          align="center"
        >
          <template #default="scope">{{
            scope.row.accessTokenTtlSeconds
              ? formatDuration(scope.row.accessTokenTtlSeconds)
              : $t('oauth:platformDefault')
          }}</template>
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
                v-hasPermi="['system:oauthResource:edit']"
                @click="handleUpdate(scope.row)"
                >{{ $t('oauth:edit') }}</el-button
              >
              <el-dropdown
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
                      v-hasPermi="['system:oauthResource:edit']"
                      >{{ $t('oauth:reEnable') }}</el-dropdown-item
                    >
                    <el-dropdown-item
                      v-else
                      command="disable"
                      icon="CircleClose"
                      v-hasPermi="['system:oauthResource:remove']"
                      >{{ $t('oauth:disableService') }}</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('oauth:noMatchingServices')">
            <el-button
              type="primary"
              v-hasPermi="['system:oauthResource:add']"
              @click="handleAdd"
              >{{ $t('oauth:addYourFirstService') }}</el-button
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
      :title="form.persisted ? $t('oauth:editService') : $t('oauth:addService')"
      width="min(820px, calc(100vw - 48px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="160px"
        class="resource-form"
      >
        <section class="form-section">
          <div class="section-heading">
            <h3>{{ $t('oauth:serviceIdentity') }}</h3>
            <p>
              {{ $t('oauth:applicationsRequestAccessUsingTheServiceIdentifierServicesUseThe') }}
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
                    :label="$t('oauth:serviceName')"
                    :help="
                      $t('oauth:displayNameInTheManagementConsoleToHelpAdministratorsIdentify')
                    "
                /></template>
                <el-input
                  v-model="form.resourceName"
                  :placeholder="$t('oauth:forExampleOrderService')"
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
                    :label="$t('oauth:serviceIdentifier')"
                    :help="$t('oauth:appsUseThisUniqueIdentifierToReferenceTheServiceIt')"
                /></template>
                <el-input
                  v-model="form.resourceId"
                  :disabled="form.persisted"
                  :placeholder="$t('oauth:forExampleOrdersApi')"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item prop="audience">
            <template #label
              ><FieldLabel
                :label="$t('oauth:tokenAudience')"
                :help="$t('oauth:uniqueValueUsedByTheServiceToValidateAccessTokens')"
            /></template>
            <el-input
              v-model="form.audience"
              :disabled="form.persisted"
              :placeholder="$t('oauth:forExampleHttpsApiExampleCom')"
              style="width: 100%"
            />
          </el-form-item>
        </section>

        <section class="form-section">
          <div class="section-heading">
            <h3>{{ $t('oauth:credentialsAndUserInformation') }}</h3>
            <p>
              {{ $t('oauth:controlAccessCredentialLifetimesAndTheMaximumUserInformationThis') }}
            </p>
          </div>
          <el-row :gutter="18">
            <el-col
              :xs="24"
              :sm="12"
            >
              <el-form-item>
                <template #label
                  ><FieldLabel
                    :label="$t('oauth:validityPeriods')"
                    :help="$t('oauth:maximumLifetimeOfAccessTokensReceivedByTheServiceLeave')"
                /></template>
                <el-input-number
                  v-model="form.accessTokenTtlSeconds"
                  :min="1"
                  :placeholder="$t('oauth:platformDefault')"
                  controls-position="right"
                  style="width: 100%"
                />
                <span class="input-unit">{{ $t('components:seconds') }}</span>
              </el-form-item>
            </el-col>
            <el-col
              :xs="24"
              :sm="12"
            >
              <el-form-item>
                <template #label
                  ><FieldLabel
                    :label="$t('oauth:tokenIntrospectionApplication')"
                    :help="$t('oauth:optionalBackendAppIDUsedToCheckWhetherCredentialsAre')"
                /></template>
                <el-input
                  v-model="form.introspectionClientId"
                  :placeholder="$t('oauth:optionalBackendApplicationID')"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item prop="allowedClaims">
            <template #label
              ><FieldLabel
                :label="$t('oauth:allowedUserInformation')"
                :help="
                  $t('oauth:limitsTheUserInformationThisServiceCanReceiveIndividualPermissions')
                "
            /></template>
            <el-select
              v-model="form.allowedClaims"
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
                :label="$t('system:remarks')"
                :help="$t('oauth:forAdministratorNotesOnlyNotSentToExternalAppsOr')"
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
          >{{ $t('oauth:saveService') }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="OAuthResource">
import { useLocaleForm } from '@/composables/useLocaleForm'
import { t } from '@/i18n/adapter'
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
useLocaleForm(computed(() => proxy.$refs.formRef))
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
    value: 'client_id',
    get label() {
      return t('oauth:appIDClientId')
    },
  },
  {
    value: 'scope',
    get label() {
      return t('oauth:grantedPermissionsScope')
    },
  },
  {
    value: 'sid',
    get label() {
      return t('oauth:sessionIDSid')
    },
  },
]
const rules = {
  resourceId: [
    {
      required: true,
      get message() {
        return t('oauth:enterServiceIdentifier')
      },
      trigger: 'blur',
    },
  ],
  resourceName: [
    {
      required: true,
      get message() {
        return t('oauth:enterServiceNameLabel')
      },
      trigger: 'blur',
    },
  ],
  audience: [
    {
      required: true,
      get message() {
        return t('oauth:enterTokenAudienceUsuallyTheServiceAddress')
      },
      trigger: 'blur',
    },
  ],
  allowedClaims: [
    {
      required: true,
      type: 'array',
      min: 1,
      get message() {
        return t('oauth:selectAtLeastOneAllowedUserInformationField')
      },
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
    proxy.$modal.msgSuccess(t('oauth:resourceSettingsSaved'))
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
      t('oauth:valueResourceValue', {
        arg0: status === '0' ? t('system:enable') : t('system:disabled'),
        resourceName: row.resourceName,
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
    t('oauth:disablingValueWillStopIssuingAndRefreshingAccessTokensFor', {
      resourceName: row.resourceName,
    })
  )
  await deleteOAuthResources(row.resourceId)
  proxy.$modal.msgSuccess(t('oauth:resourceDisabled'))
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
    return t('oauth:valueHours', { arg0: seconds / 3600 })
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return t('oauth:valueMinutes', { arg0: seconds / 60 })
  }
  return t('oauth:valueSeconds', { seconds })
}

getList()
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
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-7);
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
  color: var(--el-text-color-primary);
}

.entity-copy code,
.audience-value {
  color: var(--el-text-color-secondary);
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
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.form-section + .form-section {
  margin-top: 6px;
  padding-top: 22px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.section-heading {
  margin-bottom: 22px;
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

.resource-form :deep(.el-input-number) {
  flex: 1;
  width: auto !important;
}

.input-unit {
  flex: 0 0 auto;
  margin-left: 8px;
  color: var(--el-text-color-secondary);
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
