<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('authCenter:help.integrationManagement')"
      :title="$t('common:apply')"
      :description="
        $t(
          'authCenter:messages.manageWhichWebsitesMobileApplicationsAndBackendServicesMayUseUnifiedSign'
        )
      "
      :filter-hint="$t('authCenter:messages.findApplicationsByNameTypeOrStatus')"
    >
      <template #actions>
        <el-button
          type="primary"
          icon="el-icon-plus"
          v-hasPermi="['system:oauthClient:add']"
          @click="handleAdd"
        >
          {{ $t('authCenter:messages.registerApplication') }}
        </el-button>
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
            :label="$t('authCenter:messages.applicationName')"
            prop="clientName"
          >
            <el-input
              v-model="queryParams.clientName"
              clearable
              :placeholder="$t('authCenter:messages.enterApplicationName')"
              style="width: 200px"
              @keyup.enter.native="handleQuery"
            />
          </el-form-item>
          <el-form-item
            :label="$t('authCenter:messages.applicationType')"
            prop="clientType"
          >
            <el-select
              v-model="queryParams.clientType"
              clearable
              :placeholder="$t('authCenter:messages.allTypes')"
              style="width: 200px"
            >
              <el-option
                :label="$t('authCenter:messages.backendService')"
                value="confidential"
              />
              <el-option
                :label="$t('authCenter:messages.webOrMobileApplication')"
                value="public"
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
          {{ $t('authCenter:messages.applications') }}</span
        >
        <right-toolbar
          :showSearch.sync="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="clientId"
      >
        <el-table-column
          :label="$t('common:apply')"
          min-width="250"
        >
          <template #default="scope">
            <div class="entity-cell">
              <span class="entity-avatar">{{
                (scope.row.clientName || $t('authCenter:expression.app')).slice(0, 1)
              }}</span>
              <span class="entity-copy">
                <strong>{{ scope.row.clientName }}</strong>
                <code>{{ scope.row.clientId }}</code>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.applicationType')"
          width="130"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.clientType === 'confidential' ? 'primary' : 'info'"
              effect="plain"
            >
              {{
                scope.row.clientType === 'confidential'
                  ? $t('authCenter:messages.backendService')
                  : $t('authCenter:expression.webMobile')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.signInAndAccessMethods')"
          min-width="240"
        >
          <template #default="scope">
            <span class="plain-summary">{{ grantTypeText(scope.row.grantTypes) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('pluginAdmin:accessibleServices')"
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
                >{{ $t('authCenter:interface.identityInformationOnly') }}</span
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
          :label="$t('common:status')"
          width="105"
          align="center"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.status === '0' ? 'success' : 'info'"
              effect="light"
            >
              {{
                scope.row.status === '0'
                  ? $t('authCenter:messages.inUse')
                  : $t('pluginAdmin:release.disabled')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('system:oauth.recentUpdates')"
          width="170"
        >
          <template #default="scope">{{ parseTime(scope.row.updateTime) || '—' }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('common:actions')"
          fixed="right"
          width="180"
          align="center"
        >
          <template #default="scope">
            <div class="table-actions">
              <el-button
                type="text"
                icon="el-icon-edit"
                v-hasPermi="['system:oauthClient:edit']"
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
                      v-if="scope.row.clientType === 'confidential'"
                      command="rotate"
                      icon="el-icon-key"
                      v-hasPermi="['system:oauthClient:rotateSecret']"
                    >
                      {{ $t('authCenter:messages.rotateApplicationSecret') }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="scope.row.status !== '0'"
                      command="enable"
                      icon="el-icon-circle-check"
                      v-hasPermi="['system:oauthClient:edit']"
                    >
                      {{ $t('authCenter:messages.reEnable') }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-else
                      command="disable"
                      icon="el-icon-circle-close"
                      divided
                      v-hasPermi="['system:oauthClient:remove']"
                    >
                      {{ $t('authCenter:messages.disableApplication') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('authCenter:messages.noMatchingApplications')">
            <el-button
              type="primary"
              v-hasPermi="['system:oauthClient:add']"
              @click="handleAdd"
              >{{ $t('authCenter:messages.registerYourFirstApplication') }}</el-button
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
      :visible.sync="editorOpen"
      :title="
        form.clientId
          ? $t('authCenter:expression.editApplication')
          : $t('authCenter:messages.registerApplication')
      "
      width="min(960px, calc(100vw - 48px))"
      append-to-body
      :close-on-click-modal="false"
      class="oauth-editor-dialog"
    >
      <div class="editor-map">
        <span class="editor-map-title">{{
          $t('authCenter:messages.accessRelationshipPreview')
        }}</span>
        <AccessMap
          :application="form.clientName"
          :type="form.clientType"
          :permissions="form.scopeCodes"
          :resources="form.resourceIds"
        />
      </div>

      <el-form
        :validate-on-rule-change="false"
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="160px"
        class="sectioned-form"
      >
        <el-tabs
          v-model="activeEditorSection"
          tab-position="left"
          class="editor-tabs"
        >
          <el-tab-pane
            :label="$t('common:basicInfo')"
            name="basic"
          >
            <div class="section-heading">
              <h3>{{ $t('authCenter:messages.applicationIdentity') }}</h3>
              <p>
                {{
                  $t(
                    'authCenter:messages.theNameIdentifiesTheApplicationInTheConsoleItsTypeDeterminesWhether'
                  )
                }}
              </p>
            </div>
            <el-form-item prop="clientName">
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.applicationName')"
                  :help="
                    $t(
                      'authCenter:help.helpsAdministratorsIdentifyThisApplicationWithoutAffectingTheSignInFlow'
                    )
                  "
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
                  :label="$t('authCenter:messages.applicationType')"
                  :help="
                    $t(
                      'authCenter:help.webAndMobileApplicationsCannotKeepSecretsSecurelyBackendServicesCanStore'
                    )
                  "
              /></template>
              <el-radio-group
                v-model="form.clientType"
                class="choice-grid"
                :disabled="Boolean(form.clientId)"
                @change="syncClientType"
              >
                <el-radio
                  label="confidential"
                  border
                >
                  <span class="choice-title">{{ $t('authCenter:messages.backendService') }}</span>
                  <small>{{ $t('authCenter:messages.canSafelyStoreAnApplicationSecret') }}</small>
                </el-radio>
                <el-radio
                  label="public"
                  border
                >
                  <span class="choice-title">{{
                    $t('authCenter:messages.webOrMobileApplication')
                  }}</span>
                  <small>{{
                    $t('authCenter:messages.cannotStoreASecretSecurelyOnTheDevice')
                  }}</small>
                </el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item>
              <template #label
                ><FieldLabel
                  :label="$t('common:remark')"
                  :help="
                    $t(
                      'authCenter:help.forAdministratorsRecordsOnlyThisIsNotSentToExternalApplications'
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
          </el-tab-pane>

          <el-tab-pane
            :label="$t('authCenter:messages.signInMethods')"
            name="login"
          >
            <div class="section-heading">
              <h3>{{ $t('authCenter:messages.howTheApplicationSignsInOrCallsServices') }}</h3>
              <p>
                {{
                  $t(
                    'authCenter:messages.selectOnlyTheMethodsTheApplicationNeedsToLimitUnnecessaryAccess'
                  )
                }}
              </p>
            </div>
            <el-form-item prop="grantTypes">
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.allowedMethods')"
                  :help="
                    $t(
                      'authCenter:help.webAndMobileApplicationsUsuallyUseUserSignInBackgroundTasksWithout'
                    )
                  "
              /></template>
              <el-checkbox-group
                v-model="form.grantTypes"
                class="option-stack"
              >
                <el-checkbox label="authorization_code">{{
                  $t('authCenter:messages.userSignIn')
                }}</el-checkbox>
                <small>{{
                  $t(
                    'authCenter:messages.usersSignInAtTheAuthenticationCenterThenReturnToTheApplication'
                  )
                }}</small>
                <el-checkbox
                  label="refresh_token"
                  :disabled="!form.grantTypes.includes('authorization_code')"
                  >{{ $t('authCenter:messages.staySignedIn') }}</el-checkbox
                >
                <small>{{
                  $t('authCenter:messages.allowTheApplicationToExtendASessionAfterTheUserLeaves')
                }}</small>
                <el-checkbox
                  label="client_credentials"
                  :disabled="form.clientType === 'public'"
                  >{{ $t('authCenter:messages.serviceToServiceCalls') }}</el-checkbox
                >
                <small>{{
                  $t(
                    'authCenter:messages.aBackendServiceCallsOtherServicesAsItselfWithoutRepresentingAUser'
                  )
                }}</small>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item>
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.signInSecurity')"
                  :help="
                    $t(
                      'authCenter:help.signInSecurityProtectionIsEnabledAutomaticallyTheRemainingOptionsControlUser'
                    )
                  "
              /></template>
              <div class="option-stack">
                <el-checkbox
                  v-model="form.requirePkce"
                  disabled
                  >{{ $t('authCenter:messages.signInProtectionEnabledAutomatically') }}</el-checkbox
                >
                <el-checkbox v-model="form.requireConsent">{{
                  $t('authCenter:messages.askUsersToConfirmPermissionsAtSignIn')
                }}</el-checkbox>
                <el-checkbox v-model="form.trustedClient">{{
                  $t('authCenter:messages.markAsATrustedApplication')
                }}</el-checkbox>
              </div>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane
            :label="$t('authCenter:messages.permissionsAndServices')"
            name="access"
          >
            <div class="section-heading">
              <h3>{{ $t('authCenter:messages.whatTheApplicationMayRequest') }}</h3>
              <p>
                {{
                  $t(
                    'authCenter:messages.chooseEnabledPermissionsAndServicesToAvoidSavingUnknownIdentifiers'
                  )
                }}
              </p>
            </div>
            <el-form-item prop="scopeCodes">
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.availablePermissions')"
                  :help="
                    $t(
                      'authCenter:help.theApplicationCanRequestOnlyThePermissionsListedHereWhenSigningIn'
                    )
                  "
              /></template>
              <el-select
                v-model="form.scopeCodes"
                multiple
                filterable
                :placeholder="$t('authCenter:messages.selectPermissionsTheApplicationMayRequest')"
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
                  :label="$t('authCenter:messages.disclosableRoles')"
                  :help="$t('authCenter:help.onlyTheRolesTheUserAlreadyHasAndThatAppearHereAre')"
              /></template>
              <el-select
                v-model="form.allowedRoleKeys"
                multiple
                filterable
                allow-create
                default-first-option
                :placeholder="
                  $t('authCenter:messages.enterRoleIdentifiersThatMayBeDisclosedToThisApplication')
                "
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item>
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.skipRepeatedConfirmation')"
                  :help="
                    $t(
                      'authCenter:help.thesePermissionsReduceRepeatedUserConfirmationsAndMustBeIncludedInThe'
                    )
                  "
              /></template>
              <el-select
                v-model="form.preAuthorizedScopeCodes"
                multiple
                filterable
                :placeholder="$t('authCenter:messages.chooseFromSelectedPermissions')"
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
                  :label="$t('pluginAdmin:accessibleServices')"
                  :help="
                    $t(
                      'authCenter:help.enterTheIdentifierOfAServiceCreatedOnTheServicesAndPermissions'
                    )
                  "
              /></template>
              <el-select
                v-model="form.resourceIds"
                multiple
                filterable
                :placeholder="$t('authCenter:messages.selectServicesTheApplicationMayAccess')"
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
            :label="$t('authCenter:messages.callbackURLs')"
            name="uri"
          >
            <div class="section-heading">
              <h3>{{ $t('authCenter:messages.whereUsersMayGoAfterSignIn') }}</h3>
              <p>
                {{
                  $t(
                    'authCenter:messages.enterAndValidateEachURLSeparatelyUseCompleteHTTPSURLsInProduction'
                  )
                }}
              </p>
            </div>
            <el-form-item prop="redirectUris">
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.signInReturnURLs')"
                  :help="
                    $t('authCenter:help.afterSignInTheSystemRedirectsUsersOnlyToURLsRegisteredHere')
                  "
              /></template>
              <StringListInput
                v-model="form.redirectUris"
                placeholder="https://portal.example.com/callback"
                :add-text="$t('authCenter:messages.addSignInReturnURL')"
              />
            </el-form-item>
            <el-form-item prop="postLogoutRedirectUris">
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.signOutReturnURLs')"
                  :help="$t('authCenter:help.uRLsUsersMayReturnToAfterSigningOut')"
              /></template>
              <StringListInput
                v-model="form.postLogoutRedirectUris"
                placeholder="https://portal.example.com/signed-out"
                :add-text="$t('authCenter:messages.addSignOutReturnURL')"
              />
            </el-form-item>
            <el-form-item prop="backchannelLogoutUris">
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.backChannelSignOutNotifications')"
                  :help="
                    $t(
                      'authCenter:help.enterAURLIfTheApplicationNeedsBackChannelSignOutNotifications'
                    )
                  "
              /></template>
              <StringListInput
                v-model="form.backchannelLogoutUris"
                placeholder="https://portal.example.com/backchannel-logout"
                :add-text="$t('authCenter:messages.addBackChannelNotificationURL')"
              />
            </el-form-item>
            <el-form-item prop="corsOrigins">
              <template #label
                ><FieldLabel
                  :label="$t('authCenter:messages.allowedWebOrigins')"
                  :help="
                    $t('authCenter:help.webOriginsAllowedToCallDirectlyFromABrowserEnterOnlyThe')
                  "
              /></template>
              <StringListInput
                v-model="form.corsOrigins"
                placeholder="https://portal.example.com"
                :add-text="$t('authCenter:messages.addWebOrigin')"
              />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane
            :label="$t('authCenter:messages.validityPeriods')"
            name="duration"
          >
            <div class="section-heading">
              <h3>{{ $t('authCenter:messages.howLongSignInCredentialsRemainValid') }}</h3>
              <p>
                {{
                  $t(
                    'authCenter:messages.leaveBlankToUsePlatformDefaultsExtendLifetimesOnlyWhenRequiredBy'
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
                      :label="$t('authCenter:messages.accessCredentials')"
                      :help="
                        $t(
                          'authCenter:help.howLongShortLivedCredentialsRemainValidWhenTheApplicationAccessesA'
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
                <el-form-item class="duration-field">
                  <template #label
                    ><FieldLabel
                      :label="$t('authCenter:messages.expireAfterInactivity')"
                      :help="
                        $t(
                          'authCenter:help.howLongPersistentSignInCredentialsMayRemainUnusedBeforeExpiring'
                        )
                      "
                  /></template>
                  <el-input-number
                    :value="form.refreshTokenIdleSeconds ?? undefined"
                    @input="form.refreshTokenIdleSeconds = $event ?? null"
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
                <el-form-item class="duration-field">
                  <template #label
                    ><FieldLabel
                      :label="$t('authCenter:messages.maximumLifetime')"
                      :help="$t('auth:client.absoluteRefreshLifetimeHelp')"
                  /></template>
                  <el-input-number
                    :value="form.refreshTokenAbsoluteSeconds ?? undefined"
                    @input="form.refreshTokenAbsoluteSeconds = $event ?? null"
                    :min="1"
                    :placeholder="$t('pluginAdmin:platformDefault')"
                    controls-position="right"
                    style="width: 100%"
                  />
                  <span class="input-unit">{{ $t('common:seconds') }}</span>
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
          >{{ $t('authCenter:messages.saveApplication') }}</el-button
        >
      </template>
    </el-dialog>

    <secret-dialog
      v-model="secretOpen"
      :secret="secret"
    />
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'OAuthClient' }
</script>

<script setup>
import { computed, getCurrentInstance, reactive, ref, watch } from 'vue'
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
      message: () => t('authCenter:messages.enterAnApplicationName'),
      trigger: 'blur',
    },
  ],
  clientType: [
    {
      required: true,
      get message() {
        return t('auth:interface.selectAnApplicationType')
      },
      trigger: 'change',
    },
  ],
  grantTypes: [
    {
      required: true,
      type: 'array',
      min: 1,
      message: () => t('authCenter:messages.selectAtLeastOneSignInOrServiceAccessMethod'),
      trigger: 'change',
    },
  ],
  scopeCodes: [
    {
      required: true,
      type: 'array',
      min: 1,
      message: () => t('authCenter:messages.addAtLeastOneAvailablePermission'),
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
    authorization_code: t('authCenter:messages.userSignIn'),
    refresh_token: t('authCenter:messages.staySignedIn'),
    client_credentials: t('authCenter:messages.serviceToServiceCalls'),
  }
  return (
    types.map((item) => labels[item] || item).join(' · ') || t('authCenter:messages.notConfigured')
  )
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
    proxy.$modal.msgSuccess(t('authCenter:messages.applicationSettingsSaved'))
    editorOpen.value = false
    await getList()
  } finally {
    submitting.value = false
  }
}

/** 修改客户端状态 */
async function changeStatus(row, status) {
  const verb = status === '0' ? t('system:oauth.enable') : t('system:oauth.disabled')
  try {
    await proxy.$modal.confirm(
      t('auth:interface.valueApplicationValue', { value0: verb, value1: row.clientName })
    )
    await changeOAuthClientStatus({ clientId: row.clientId, status })
    proxy.$modal.msgSuccess(t('auth:interface.valueSucceeded', { value0: verb }))
    await getList()
  } catch {
    // 用户取消或请求失败时刷新事实状态，避免保留乐观 UI
    await getList()
  }
}

/** 删除按钮操作 */
async function handleDelete(row) {
  await proxy.$modal.confirm(
    t('auth:interface.disablingValueAlsoRevokesItsGrantsAndRefreshCredentialsContinue', {
      value0: row.clientName,
    })
  )
  await deleteOAuthClients(row.clientId)
  proxy.$modal.msgSuccess(t('monitor:messages.appDisabled'))
  await getList()
}

/** 轮换客户端密钥并显示一次性明文 */
async function rotateSecret(row) {
  await proxy.$modal.confirm(
    t('auth:interface.generateANewSecretForValueTheOldSecretWillEnterALimitedRetirement', {
      value0: row.clientName,
    })
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

.entity-avatar {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  color: var(--oauth-color-primary);
  font-weight: 700;
  background: var(--oauth-color-primary-light-9);
  border: 1px solid var(--oauth-color-primary-light-7);
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
  font-weight: 600;
}

.entity-copy code {
  margin-top: 4px;
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.plain-summary {
  color: var(--oauth-text-color-regular);
}

.tag-summary {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.muted-value {
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.editor-map {
  margin-bottom: 20px;
  padding: 14px;
  background: color-mix(in srgb, var(--oauth-color-primary) 10%, var(--oauth-bg-color-overlay));
  border: 1px solid
    color-mix(in srgb, var(--oauth-color-primary) 30%, var(--oauth-bg-color-overlay));
  border-radius: 9px;
}

.editor-map-title {
  display: block;
  margin-bottom: 10px;
  color: var(--oauth-text-color-regular);
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
  display: flex;
  align-items: center;
  width: 100%;
  height: auto;
  min-height: 70px;
  margin: 0;
  padding: 13px 14px;
  white-space: normal;
}

.choice-grid :deep(.el-radio.is-bordered + .el-radio.is-bordered) {
  margin-left: 0;
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
  color: var(--oauth-text-color-primary);
  font-weight: 600;
}

.choice-grid small {
  margin-top: 5px;
  color: var(--oauth-text-color-secondary);
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
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.sectioned-form :deep(.el-input-number) {
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

.option-code {
  float: right;
  margin-left: 18px;
  color: var(--oauth-text-color-secondary);
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
    float: none;
    max-width: 100%;
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
