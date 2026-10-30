<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('oauth:integrationManagement')"
      :title="$t('components:apply')"
      :description="$t('oauth:manageWhichWebsitesMobileApplicationsAndBackendServicesMayUse')"
      :filter-hint="$t('oauth:findApplicationsByNameTypeOrStatus')"
    >
      <template #actions>
        <el-button
          type="primary"
          icon="Plus"
          v-hasPermi="['system:oauthClient:add']"
          @click="handleAdd"
        >
          {{ $t('oauth:registerApplication') }}</el-button
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
            :label="$t('oauth:applicationName')"
            prop="clientName"
          >
            <el-input
              v-model="queryParams.clientName"
              clearable
              :placeholder="$t('oauth:enterApplicationName')"
              style="width: 200px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item
            :label="$t('oauth:applicationType')"
            prop="clientType"
          >
            <el-select
              v-model="queryParams.clientType"
              clearable
              :placeholder="$t('oauth:allTypes')"
              style="width: 200px"
            >
              <el-option
                :label="$t('oauth:backendService')"
                value="confidential"
              />
              <el-option
                :label="$t('oauth:webOrMobileApplication')"
                value="public"
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
          >{{ $t('oauth:registered') }}<strong>{{ total }}</strong>
          {{ $t('oauth:applications') }}</span
        >
        <right-toolbar
          v-model:showSearch="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="clientId"
      >
        <el-table-column
          :label="$t('components:apply')"
          min-width="250"
        >
          <template #default="scope">
            <div class="entity-cell">
              <span class="entity-avatar">{{
                (scope.row.clientName || $t('oauth:app')).slice(0, 1)
              }}</span>
              <span class="entity-copy">
                <strong>{{ scope.row.clientName }}</strong>
                <code>{{ scope.row.clientId }}</code>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:applicationType')"
          width="130"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.clientType === 'confidential' ? 'primary' : 'info'"
              effect="plain"
            >
              {{
                scope.row.clientType === 'confidential'
                  ? $t('oauth:backendService')
                  : $t('oauth:webMobile')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:signInAndAccessMethods')"
          min-width="240"
        >
          <template #default="scope">
            <span class="plain-summary">{{ grantTypeText(scope.row.grantTypes) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:accessibleServices')"
          min-width="200"
        >
          <template #default="scope">
            <div class="tag-summary">
              <el-tag
                v-for="item in (scope.row.resourceIds || []).slice(0, 2)"
                :key="item"
                size="small"
                effect="plain"
                >{{ item }}</el-tag
              >
              <span
                v-if="!(scope.row.resourceIds || []).length"
                class="muted-value"
                >{{ $t('components:identityInformationOnly') }}</span
              >
              <span
                v-else-if="scope.row.resourceIds.length > 2"
                class="muted-value"
                >+{{ scope.row.resourceIds.length - 2 }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('system:status')"
          width="105"
          align="center"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.status === '0' ? 'success' : 'info'"
              effect="light"
            >
              {{ scope.row.status === '0' ? $t('oauth:inUse') : $t('components:disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:recentUpdates')"
          width="170"
        >
          <template #default="scope">{{ parseTime(scope.row.updateTime) || '—' }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('system:actions')"
          fixed="right"
          width="180"
          align="center"
        >
          <template #default="scope">
            <div class="table-actions">
              <el-button
                link
                type="primary"
                icon="Edit"
                v-hasPermi="['system:oauthClient:edit']"
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
                      v-if="scope.row.clientType === 'confidential'"
                      command="rotate"
                      icon="Key"
                      v-hasPermi="['system:oauthClient:rotateSecret']"
                    >
                      {{ $t('oauth:rotateApplicationSecret') }}</el-dropdown-item
                    >
                    <el-dropdown-item
                      v-if="scope.row.status !== '0'"
                      command="enable"
                      icon="CircleCheck"
                      v-hasPermi="['system:oauthClient:edit']"
                    >
                      {{ $t('oauth:reEnable') }}</el-dropdown-item
                    >
                    <el-dropdown-item
                      v-else
                      command="disable"
                      icon="CircleClose"
                      divided
                      v-hasPermi="['system:oauthClient:remove']"
                    >
                      {{ $t('oauth:disableApplication') }}</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('oauth:noMatchingApplications')">
            <el-button
              type="primary"
              v-hasPermi="['system:oauthClient:add']"
              @click="handleAdd"
              >{{ $t('oauth:registerYourFirstApplication') }}</el-button
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
      v-model="editorOpen"
      :title="form.clientId ? $t('oauth:editApplication') : $t('oauth:registerApplication')"
      width="min(960px, calc(100vw - 48px))"
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
      class="oauth-editor-dialog"
    >
      <div class="editor-map">
        <span class="editor-map-title">{{ $t('oauth:accessRelationshipPreview') }}</span>
        <AccessMap
          :application="form.clientName"
          :type="form.clientType"
          :permissions="form.scopeCodes"
          :resources="form.resourceIds"
        />
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="160px"
        class="sectioned-form"
      >
        <el-tabs
          v-model="activeEditorSection"
          tab-position="left"
          class="editor-tabs"
        >
          <el-tab-pane
            :label="$t('system:basicInformation')"
            name="basic"
          >
            <div class="section-heading">
              <h3>{{ $t('oauth:applicationIdentity') }}</h3>
              <p>{{ $t('oauth:theNameIdentifiesTheApplicationInTheConsoleItsType') }}</p>
            </div>
            <el-form-item prop="clientName">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:applicationName')"
                  :help="$t('oauth:helpsAdministratorsIdentifyTheAppWithoutAffectingSignIn')"
              /></template>
              <el-input
                v-model="form.clientName"
                maxlength="100"
                show-word-limit
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item prop="clientType">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:applicationType')"
                  :help="$t('oauth:webAndMobileClientsCannotSafelyStoreASecretBackend')"
              /></template>
              <el-radio-group
                v-model="form.clientType"
                class="choice-grid"
                :disabled="Boolean(form.clientId)"
                @change="syncClientType"
              >
                <el-radio
                  value="confidential"
                  border
                >
                  <span class="choice-title">{{ $t('oauth:backendService') }}</span>
                  <small>{{ $t('oauth:canSafelyStoreAnApplicationSecret') }}</small>
                </el-radio>
                <el-radio
                  value="public"
                  border
                >
                  <span class="choice-title">{{ $t('oauth:webOrMobileApplication') }}</span>
                  <small>{{ $t('oauth:cannotStoreASecretSecurelyOnTheDevice') }}</small>
                </el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item>
              <template #label
                ><FieldLabel
                  :label="$t('system:remarks')"
                  :help="$t('oauth:forAdministratorNotesOnlyNotSentToExternalApps')"
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
          </el-tab-pane>

          <el-tab-pane
            :label="$t('oauth:signInMethods')"
            name="login"
          >
            <div class="section-heading">
              <h3>{{ $t('oauth:howTheApplicationSignsInOrCallsServices') }}</h3>
              <p>{{ $t('oauth:selectOnlyTheMethodsTheApplicationNeedsToLimitUnnecessary') }}</p>
            </div>
            <el-form-item prop="grantTypes">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:allowedMethods')"
                  :help="$t('oauth:webAndMobileClientsTypicallyUseUserSignInBackground')"
              /></template>
              <el-checkbox-group
                v-model="form.grantTypes"
                class="option-stack"
              >
                <el-checkbox value="authorization_code">{{ $t('oauth:userSignIn') }}</el-checkbox>
                <small>{{ $t('oauth:usersSignInAtTheAuthenticationCenterThenReturnTo') }}</small>
                <el-checkbox
                  value="refresh_token"
                  :disabled="!form.grantTypes.includes('authorization_code')"
                  >{{ $t('oauth:staySignedIn') }}</el-checkbox
                >
                <small>{{ $t('oauth:allowTheApplicationToExtendASessionAfterTheUser') }}</small>
                <el-checkbox
                  value="client_credentials"
                  :disabled="form.clientType === 'public'"
                  >{{ $t('oauth:serviceToServiceCalls') }}</el-checkbox
                >
                <small>{{
                  $t('oauth:aBackendServiceCallsOtherServicesAsItselfWithoutRepresenting')
                }}</small>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item>
              <template #label
                ><FieldLabel
                  :label="$t('oauth:signInSecurity')"
                  :help="$t('oauth:signInSecurityIsEnabledAutomaticallyOtherOptionsControlUser')"
              /></template>
              <div class="option-stack">
                <el-checkbox
                  v-model="form.requirePkce"
                  disabled
                  >{{ $t('oauth:signInProtectionEnabledAutomatically') }}</el-checkbox
                >
                <el-checkbox v-model="form.requireConsent">{{
                  $t('oauth:askUsersToConfirmPermissionsAtSignIn')
                }}</el-checkbox>
                <el-checkbox v-model="form.trustedClient">{{
                  $t('oauth:markAsATrustedApplication')
                }}</el-checkbox>
              </div>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane
            :label="$t('oauth:permissionsAndServices')"
            name="access"
          >
            <div class="section-heading">
              <h3>{{ $t('oauth:whatTheApplicationMayRequest') }}</h3>
              <p>
                {{ $t('oauth:chooseEnabledPermissionsAndServicesToAvoidSavingUnknownIdentifiers') }}
              </p>
            </div>
            <el-form-item prop="scopeCodes">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:availablePermissions')"
                  :help="$t('oauth:theAppMayRequestOnlyThesePermissionsWhenSigningIn')"
              /></template>
              <el-select
                v-model="form.scopeCodes"
                multiple
                filterable
                :placeholder="$t('oauth:selectPermissionsTheApplicationMayRequest')"
                style="width: 100%"
              >
                <el-option
                  v-for="item in scopeOptions"
                  :key="item.scopeCode"
                  :label="item.scopeName"
                  :value="item.scopeCode"
                >
                  <span>{{ item.scopeName }}</span
                  ><code class="option-code">{{ item.scopeCode }}</code>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item
              v-if="form.scopeCodes.includes('roles')"
              prop="allowedRoleKeys"
            >
              <template #label
                ><FieldLabel
                  :label="$t('oauth:disclosableRoles')"
                  :help="$t('oauth:onlyRolesAlreadyHeldByTheUserAndListedHere')"
              /></template>
              <el-select
                v-model="form.allowedRoleKeys"
                multiple
                filterable
                allow-create
                default-first-option
                :placeholder="$t('oauth:enterRoleIdentifiersThatMayBeDisclosedToThisApplication')"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item>
              <template #label
                ><FieldLabel
                  :label="$t('oauth:skipRepeatedConfirmation')"
                  :help="$t('oauth:thesePermissionsReduceRepeatedConsentAndMustBeIncludedIn')"
              /></template>
              <el-select
                v-model="form.preAuthorizedScopeCodes"
                multiple
                filterable
                :placeholder="$t('oauth:chooseFromSelectedPermissions')"
                style="width: 100%"
              >
                <el-option
                  v-for="item in selectedScopeOptions"
                  :key="item.scopeCode"
                  :label="item.scopeName"
                  :value="item.scopeCode"
                >
                  <span>{{ item.scopeName }}</span
                  ><code class="option-code">{{ item.scopeCode }}</code>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label
                ><FieldLabel
                  :label="$t('oauth:accessibleServices')"
                  :help="$t('oauth:enterAnExistingServiceIdentifierFromServicesAndPermissionsNot')"
              /></template>
              <el-select
                v-model="form.resourceIds"
                multiple
                filterable
                :placeholder="$t('oauth:selectServicesTheApplicationMayAccess')"
                style="width: 100%"
              >
                <el-option
                  v-for="item in resourceOptions"
                  :key="item.resourceId"
                  :label="item.resourceName"
                  :value="item.resourceId"
                >
                  <span>{{ item.resourceName }}</span
                  ><code class="option-code">{{ item.resourceId }}</code>
                </el-option>
              </el-select>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane
            :label="$t('oauth:callbackURLs')"
            name="uri"
          >
            <div class="section-heading">
              <h3>{{ $t('oauth:whereUsersMayGoAfterSignIn') }}</h3>
              <p>{{ $t('oauth:enterAndValidateEachURLSeparatelyUseCompleteHTTPSURLs') }}</p>
            </div>
            <el-form-item prop="redirectUris">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:signInReturnURLs')"
                  :help="$t('oauth:afterSignInTheSystemRedirectsUsersOnlyToURLs')"
              /></template>
              <StringListInput
                v-model="form.redirectUris"
                placeholder="https://portal.example.com/callback"
                :add-text="$t('oauth:addSignInReturnURL')"
              />
            </el-form-item>
            <el-form-item prop="postLogoutRedirectUris">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:signOutReturnURLs')"
                  :help="$t('oauth:uRLsUsersMayReturnToAfterSigningOut')"
              /></template>
              <StringListInput
                v-model="form.postLogoutRedirectUris"
                placeholder="https://portal.example.com/signed-out"
                :add-text="$t('oauth:addSignOutReturnURL')"
              />
            </el-form-item>
            <el-form-item prop="backchannelLogoutUris">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:backChannelSignOutNotifications')"
                  :help="$t('oauth:enterAURLIfTheApplicationNeedsBackChannelSign')"
              /></template>
              <StringListInput
                v-model="form.backchannelLogoutUris"
                placeholder="https://portal.example.com/backchannel-logout"
                :add-text="$t('oauth:addBackChannelNotificationURL')"
              />
            </el-form-item>
            <el-form-item prop="corsOrigins">
              <template #label
                ><FieldLabel
                  :label="$t('oauth:allowedWebOrigins')"
                  :help="$t('oauth:webOriginsAllowedToCallDirectlyFromABrowserEnter')"
              /></template>
              <StringListInput
                v-model="form.corsOrigins"
                placeholder="https://portal.example.com"
                :add-text="$t('oauth:addWebOrigin')"
              />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane
            :label="$t('oauth:validityPeriods')"
            name="duration"
          >
            <div class="section-heading">
              <h3>{{ $t('oauth:howLongSignInCredentialsRemainValid') }}</h3>
              <p>{{ $t('oauth:leaveBlankToUsePlatformDefaultsExtendLifetimesOnlyWhen') }}</p>
            </div>
            <el-row :gutter="18">
              <el-col
                :xs="24"
                :sm="12"
              >
                <el-form-item>
                  <template #label
                    ><FieldLabel
                      :label="$t('oauth:accessCredentials')"
                      :help="$t('oauth:howLongShortLivedCredentialsRemainValidWhenTheApplication')"
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
                      :label="$t('oauth:expireAfterInactivity')"
                      :help="$t('oauth:howLongPersistentSignInCredentialsMayRemainUnusedBefore')"
                  /></template>
                  <el-input-number
                    v-model="form.refreshTokenIdleSeconds"
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
                      :label="$t('oauth:maximumLifetime')"
                      :help="$t('oauth:maximumLifetimeOfPersistentSignInCredentialsFromIssuance')"
                  /></template>
                  <el-input-number
                    v-model="form.refreshTokenAbsoluteSeconds"
                    :min="1"
                    :placeholder="$t('oauth:platformDefault')"
                    controls-position="right"
                    style="width: 100%"
                  />
                  <span class="input-unit">{{ $t('components:seconds') }}</span>
                </el-form-item>
              </el-col>
            </el-row>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <el-button @click="editorOpen = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="submit"
          >{{ $t('oauth:saveApplication') }}</el-button
        >
      </template>
    </el-dialog>

    <secret-dialog
      v-model="secretOpen"
      :secret="secret"
    />
  </div>
</template>

<script setup name="OAuthClient">
import { useLocaleForm } from '@/composables/useLocaleForm'
import { t } from '@/i18n/adapter'
import {
  addOAuthClient,
  changeOAuthClientStatus,
  deleteOAuthClients,
  getOAuthClient,
  listOAuthClients,
  rotateOAuthClientSecret,
  updateOAuthClient,
} from '@/api/system/oauthClient'
import { listOAuthResources, listOAuthScopes } from '@/api/system/oauthResource'
import { splitRegisteredUris, validateRegisteredUriList } from '@/utils/oauthUri'
import AccessMap from '@/components/OAuthWorkspace/AccessMap.vue'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel.vue'
import PageFrame from '@/components/OAuthWorkspace/PageFrame.vue'
import StringListInput from '@/components/OAuthWorkspace/StringListInput.vue'
import SecretDialog from './secret.vue'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.formRef))
const loading = ref(false)
const submitting = ref(false)
const showSearch = ref(true)
const editorOpen = ref(false)
const activeEditorSection = ref('basic')
const secretOpen = ref(false)
const rows = ref([])
const scopeOptions = ref([])
const resourceOptions = ref([])
const total = ref(0)
const secret = ref({})
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  clientName: undefined,
  clientType: undefined,
  status: undefined,
})
const form = reactive(emptyForm())
const selectedScopeOptions = computed(() => {
  const known = new Map(scopeOptions.value.map((item) => [item.scopeCode, item]))
  return form.scopeCodes.map((code) => known.get(code) || { scopeCode: code, scopeName: code })
})
const rules = {
  clientName: [
    {
      required: true,
      get message() {
        return t('oauth:enterAnApplicationName')
      },
      trigger: 'blur',
    },
  ],
  clientType: [
    {
      required: true,
      get message() {
        return t('oauth:selectAppType')
      },
      trigger: 'change',
    },
  ],
  grantTypes: [
    {
      required: true,
      type: 'array',
      min: 1,
      get message() {
        return t('oauth:selectAtLeastOneSignInOrServiceAccessMethod')
      },
      trigger: 'change',
    },
  ],
  scopeCodes: [
    {
      required: true,
      type: 'array',
      min: 1,
      get message() {
        return t('oauth:addAtLeastOneAvailablePermission')
      },
      trigger: 'change',
    },
  ],
  redirectUris: [
    registeredUriRule('redirect', () => form.grantTypes.includes('authorization_code')),
  ],
  postLogoutRedirectUris: [registeredUriRule('post_logout')],
  backchannelLogoutUris: [registeredUriRule('backchannel_logout')],
  corsOrigins: [registeredUriRule('cors_origin')],
}

/** 创建客户端表单默认值 */
function emptyForm() {
  return {
    clientId: undefined,
    clientName: '',
    clientType: 'confidential',
    tokenEndpointAuthMethod: 'client_secret_basic',
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    requirePkce: true,
    requireConsent: true,
    trustedClient: false,
    scopeCodes: ['openid'],
    allowedRoleKeys: [],
    preAuthorizedScopeCodes: [],
    resourceIds: [],
    redirectUris: [],
    postLogoutRedirectUris: [],
    backchannelLogoutUris: [],
    corsOrigins: [],
    accessTokenTtlSeconds: null,
    refreshTokenIdleSeconds: null,
    refreshTokenAbsoluteSeconds: null,
    logoUri: null,
    policyUri: null,
    tosUri: null,
    remark: '',
  }
}

/** 生成注册地址的表单校验规则 */
function registeredUriRule(uriType, required = false) {
  return {
    trigger: 'blur',
    validator: (_rule, value, callback) => {
      try {
        validateRegisteredUriList(
          (value || []).join('\n'),
          uriType,
          typeof required === 'function' ? required() : required
        )
        callback()
      } catch (error) {
        callback(error)
      }
    },
  }
}

/** 重置客户端表单 */
function resetForm() {
  Object.assign(form, emptyForm())
  activeEditorSection.value = 'basic'
  proxy.resetForm('formRef')
}

/** 同步客户端类型对应的认证方式和授权类型 */
function syncClientType() {
  form.tokenEndpointAuthMethod = form.clientType === 'public' ? 'none' : 'client_secret_basic'
  if (form.clientType === 'public') {
    form.grantTypes = form.grantTypes.filter((item) => item !== 'client_credentials')
  }
}

/** 加载可选权限和资源 */
async function loadAccessOptions() {
  const [scopes, resources] = await Promise.all([
    listOAuthScopes({ pageNum: 1, pageSize: 200, status: '0' }),
    listOAuthResources({ pageNum: 1, pageSize: 200, status: '0' }),
  ])
  scopeOptions.value = scopes.rows || []
  resourceOptions.value = resources.rows || []
}

/** 将客户端详情转换为编辑表单 */
function toEditor(data) {
  return {
    ...emptyForm(),
    ...data,
    scopeCodes: [...(data.scopeCodes || [])],
    allowedRoleKeys: [...(data.allowedRoleKeys || [])],
    preAuthorizedScopeCodes: [...(data.preAuthorizedScopeCodes || [])],
    resourceIds: [...(data.resourceIds || [])],
    redirectUris: [...(data.redirectUris || [])],
    postLogoutRedirectUris: [...(data.postLogoutRedirectUris || [])],
    backchannelLogoutUris: [...(data.backchannelLogoutUris || [])],
    corsOrigins: [...(data.corsOrigins || [])],
  }
}

/** 构造客户端保存请求 */
function payload() {
  const values = {
    clientId: form.clientId,
    clientName: form.clientName,
    clientType: form.clientType,
    tokenEndpointAuthMethod: form.tokenEndpointAuthMethod,
    grantTypes: [...form.grantTypes],
    responseTypes: form.grantTypes.includes('authorization_code') ? ['code'] : [],
    requirePkce: form.requirePkce,
    requireConsent: form.requireConsent,
    trustedClient: form.trustedClient,
    scopeCodes: [...form.scopeCodes],
    allowedRoleKeys: [...form.allowedRoleKeys],
    preAuthorizedScopeCodes: [...form.preAuthorizedScopeCodes],
    resourceIds: [...form.resourceIds],
    redirectUris: splitRegisteredUris(form.redirectUris.join('\n')),
    postLogoutRedirectUris: splitRegisteredUris(form.postLogoutRedirectUris.join('\n')),
    backchannelLogoutUris: splitRegisteredUris(form.backchannelLogoutUris.join('\n')),
    corsOrigins: splitRegisteredUris(form.corsOrigins.join('\n')),
    accessTokenTtlSeconds: form.accessTokenTtlSeconds,
    refreshTokenIdleSeconds: form.refreshTokenIdleSeconds,
    refreshTokenAbsoluteSeconds: form.refreshTokenAbsoluteSeconds,
    logoUri: form.logoUri,
    policyUri: form.policyUri,
    tosUri: form.tosUri,
    remark: form.remark,
  }
  if (!values.clientId) {
    delete values.clientId
  }
  return values
}

/** 查询客户端列表 */
async function getList() {
  loading.value = true
  try {
    const response = await listOAuthClients(queryParams)
    rows.value = response.rows || []
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
  loadAccessOptions().catch(() => {})
  editorOpen.value = true
}

/** 修改按钮操作 */
async function handleUpdate(row) {
  resetForm()
  const [response] = await Promise.all([
    getOAuthClient(row.clientId),
    loadAccessOptions().catch(() => {}),
  ])
  Object.assign(form, toEditor(response.data))
  editorOpen.value = true
}

/** 获取授权类型名称 */
function grantTypeText(types = []) {
  const labels = {
    get authorization_code() {
      return t('oauth:userSignIn')
    },
    get refresh_token() {
      return t('oauth:staySignedIn')
    },
    get client_credentials() {
      return t('oauth:serviceToServiceCalls')
    },
  }
  return types.map((item) => labels[item] || item).join(' · ') || t('oauth:notConfigured')
}

/** 处理客户端行操作 */
function handleRowCommand(command, row) {
  if (command === 'rotate') {
    return rotateSecret(row)
  }
  if (command === 'enable') {
    return changeStatus(row, '0')
  }
  if (command === 'disable') {
    return handleDelete(row)
  }
}

/** 校验并保存客户端配置 */
async function submit() {
  try {
    await proxy.$refs.formRef.validate()
  } catch (fields) {
    const firstField = Object.keys(fields || {})[0]
    const sectionByField = {
      clientName: 'basic',
      clientType: 'basic',
      grantTypes: 'login',
      scopeCodes: 'access',
      redirectUris: 'uri',
      postLogoutRedirectUris: 'uri',
      backchannelLogoutUris: 'uri',
      corsOrigins: 'uri',
    }
    activeEditorSection.value = sectionByField[firstField] || activeEditorSection.value
    return
  }
  submitting.value = true
  try {
    const action = form.clientId ? updateOAuthClient : addOAuthClient
    await action(payload())
    proxy.$modal.msgSuccess(t('oauth:applicationSettingsSaved'))
    editorOpen.value = false
    await getList()
  } finally {
    submitting.value = false
  }
}

/** 修改客户端状态 */
async function changeStatus(row, status) {
  const verb = status === '0' ? t('system:enable') : t('system:disabled')
  try {
    await proxy.$modal.confirm(t('oauth:valueAppValue', { verb, clientName: row.clientName }))
    await changeOAuthClientStatus({ clientId: row.clientId, status })
    proxy.$modal.msgSuccess(t('oauth:valueSuccessfully', { verb }))
    await getList()
  } catch {
    // 用户取消或请求失败时刷新事实状态，避免保留乐观 UI
    await getList()
  }
}

/** 删除按钮操作 */
async function handleDelete(row) {
  await proxy.$modal.confirm(
    t('oauth:disablingValueWillAlsoRevokeItsAuthorizationsAndRefreshTokens', {
      clientName: row.clientName,
    })
  )
  await deleteOAuthClients(row.clientId)
  proxy.$modal.msgSuccess(t('monitor:appDisabled'))
  await getList()
}

/** 轮换客户端密钥并显示一次性明文 */
async function rotateSecret(row) {
  await proxy.$modal.confirm(
    t('oauth:generateANewSecretForValueTheOldSecretWill', { clientName: row.clientName })
  )
  const response = await rotateOAuthClientSecret(row.clientId)
  secret.value = response.data
  secretOpen.value = true
  await getList()
}

watch(secretOpen, (visible) => {
  if (!visible) {
    secret.value = {}
  }
})

watch(
  () => [...form.grantTypes],
  (grantTypes) => {
    if (!grantTypes.includes('authorization_code') && grantTypes.includes('refresh_token')) {
      form.grantTypes = grantTypes.filter((item) => item !== 'refresh_token')
    }
  }
)

watch(
  () => [...form.scopeCodes],
  (scopeCodes) => {
    const allowed = new Set(scopeCodes)
    form.preAuthorizedScopeCodes = form.preAuthorizedScopeCodes.filter((code) => allowed.has(code))
  }
)

Promise.all([getList(), loadAccessOptions().catch(() => {})])
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

.entity-avatar {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  color: var(--el-color-primary);
  font-weight: 700;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
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
  font-weight: 600;
}

.entity-copy code {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.plain-summary {
  color: var(--el-text-color-regular);
}

.tag-summary {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.muted-value {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.editor-map {
  margin-bottom: 20px;
  padding: 14px;
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color-overlay));
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 30%, var(--el-bg-color-overlay));
  border-radius: 9px;
}

.editor-map-title {
  display: block;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 600;
}

.editor-tabs {
  min-height: 470px;
}

.editor-tabs :deep(.el-tabs__header.is-left) {
  width: 132px;
  margin-right: 24px;
}

.editor-tabs :deep(.el-tabs__item.is-left) {
  height: 46px;
  text-align: left;
}

.editor-tabs :deep(.el-tabs__content) {
  min-width: 0;
}

.section-heading {
  margin: 2px 0 24px;
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
  min-height: 70px;
  margin: 0;
  padding: 13px 14px;
  white-space: normal;
}

.choice-grid :deep(.el-radio__label) {
  display: block;
  min-width: 0;
}

.choice-title,
.choice-grid small {
  display: block;
}

.choice-title {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.choice-grid small {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.option-stack {
  display: grid;
  grid-template-columns: 1fr;
  width: 100%;
}

.option-stack :deep(.el-checkbox) {
  margin-right: 0;
}

.option-stack > small {
  margin: -3px 0 10px 24px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.sectioned-form :deep(.el-input-number) {
  flex: 1;
  width: auto !important;
}

.input-unit {
  flex: 0 0 auto;
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.option-code {
  float: right;
  margin-left: 18px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 768px) {
  .editor-map {
    display: none;
  }

  .editor-tabs :deep(.el-tabs__header.is-left) {
    float: none;
    width: 100%;
    margin: 0 0 18px;
  }

  .editor-tabs :deep(.el-tabs__nav-wrap.is-left) {
    padding: 0;
  }

  .editor-tabs :deep(.el-tabs__nav.is-left) {
    display: flex;
    overflow-x: auto;
  }

  .editor-tabs :deep(.el-tabs__item.is-left) {
    flex: 0 0 auto;
    padding: 0 14px;
  }

  .editor-tabs :deep(.el-tabs__active-bar.is-left) {
    display: none;
  }

  .sectioned-form :deep(.el-form-item) {
    display: block;
  }

  .sectioned-form :deep(.el-form-item__label) {
    width: auto !important;
    margin-bottom: 6px;
  }

  .sectioned-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }

  .choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
