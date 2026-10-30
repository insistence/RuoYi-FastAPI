<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('monitor:securityOperations')"
      :title="$t('monitor:securityLogs')"
      :description="$t('monitor:reviewSignInsAuthorizationsIssuedCredentialsAndPolicyChangesOver')"
      :filter-hint="$t('monitor:logsAreSanitizedAndContainNoPasswordsSecretsOrComplete')"
    >
      <template #actions>
        <el-button
          type="primary"
          plain
          icon="Download"
          v-hasPermi="['monitor:oauthAudit:export']"
          @click="exportRows"
        >
          {{ $t('monitor:exportCurrentResults') }}</el-button
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
            :label="$t('monitor:operation')"
            prop="eventType"
          >
            <el-select
              v-model="queryParams.eventType"
              clearable
              filterable
              :placeholder="$t('monitor:allOperations')"
              style="width: 200px"
            >
              <el-option-group
                v-for="group in eventGroups"
                :key="group.label"
                :label="group.label"
              >
                <el-option
                  v-for="item in group.options"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('components:apply')"
            prop="clientId"
          >
            <el-input
              v-model="queryParams.clientId"
              clearable
              :placeholder="$t('monitor:applicationID')"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item
            :label="$t('monitor:user')"
            prop="userId"
          >
            <el-input
              v-model="queryParams.userId"
              clearable
              :placeholder="$t('system:userID')"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item
            :label="$t('monitor:result')"
            prop="result"
          >
            <el-select
              v-model="queryParams.result"
              clearable
              :placeholder="$t('monitor:allResults')"
              style="width: 200px"
            >
              <el-option
                :label="$t('monitor:completed')"
                value="success"
              />
              <el-option
                :label="$t('monitor:incomplete')"
                value="failure"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('monitor:riskLevel')"
            prop="riskLevel"
          >
            <el-select
              v-model="queryParams.riskLevel"
              clearable
              :placeholder="$t('monitor:allRiskLevels')"
              style="width: 200px"
            >
              <el-option
                :label="$t('monitor:general')"
                value="normal"
              />
              <el-option
                :label="$t('monitor:needsAttentionLabel')"
                value="medium"
              />
              <el-option
                :label="$t('monitor:highRisk')"
                value="high"
              />
              <el-option
                :label="$t('monitor:critical')"
                value="critical"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('monitor:occurredAt')">
            <el-date-picker
              v-model="dateRange"
              type="datetimerange"
              value-format="YYYY-MM-DD HH:mm:ss"
              :range-separator="$t('monitor:to')"
              :start-placeholder="$t('monitor:start')"
              :end-placeholder="$t('monitor:end')"
              style="width: 200px"
            />
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
          >{{ $t('monitor:found') }}<strong>{{ total }}</strong>
          {{ $t('monitor:recordsLabel') }}</span
        >
        <right-toolbar
          v-model:showSearch="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="auditId"
      >
        <el-table-column
          :label="$t('monitor:occurredAt')"
          width="170"
        >
          <template #default="scope">{{
            parseTime(scope.row.occurredAt || scope.row.createTime)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:operation')"
          min-width="230"
        >
          <template #default="scope">
            <div class="event-cell">
              <span
                class="event-mark"
                :class="`is-${eventTone(scope.row)}`"
                ><el-icon><Key /></el-icon
              ></span>
              <span
                ><strong>{{ eventLabel(scope.row.eventType) }}</strong
                ><small>{{ eventSummary(scope.row) }}</small></span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:relatedEntities')"
          min-width="200"
        >
          <template #default="scope">
            <div class="subject-cell">
              <span>{{
                scope.row.userName || scope.row.userId || $t('monitor:systemOrMachineIdentity')
              }}</span>
              <small>{{
                scope.row.clientName || scope.row.clientId || $t('monitor:noLinkedApp')
              }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:source')"
          min-width="150"
        >
          <template #default="scope"
            ><div class="subject-cell">
              <span>{{ scope.row.ipAddress || $t('monitor:internalSystem') }}</span
              ><small>{{ sourceText(scope.row) }}</small>
            </div></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('monitor:result')"
          width="105"
          align="center"
        >
          <template #default="scope"
            ><el-tag :type="scope.row.result === 'success' ? 'success' : 'danger'">{{
              scope.row.result === 'success' ? $t('monitor:completed') : $t('monitor:incomplete')
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('monitor:risk')"
          width="110"
          align="center"
        >
          <template #default="scope"
            ><el-tag :type="riskType(scope.row.riskLevel)">{{
              riskText(scope.row.riskLevel)
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('monitor:needsAttentionLabel')"
          min-width="210"
          show-overflow-tooltip
        >
          <template #default="scope">{{
            failureText(scope.row.failureCode, scope.row.result)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('system:actions')"
          width="100"
          fixed="right"
          align="center"
        >
          <template #default="scope">
            <div class="table-actions">
              <el-button
                link
                type="primary"
                icon="View"
                @click="showDetail(scope.row)"
                >{{ $t('monitor:view') }}</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty
          ><el-empty :description="$t('monitor:noSecurityLogsMatchTheCurrentFilters')"
        /></template>
      </el-table>
      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </PageFrame>

    <el-drawer
      v-model="detailOpen"
      :title="$t('monitor:securityEventDetails')"
      size="min(660px, 92vw)"
    >
      <div class="detail-hero">
        <span
          class="event-mark large"
          :class="`is-${eventTone(detail)}`"
          ><el-icon><Key /></el-icon
        ></span>
        <div>
          <strong>{{ eventLabel(detail.eventType) }}</strong>
          <p>
            {{ parseTime(detail.occurredAt || detail.createTime) || $t('monitor:unknownTime') }}
          </p>
        </div>
        <div class="detail-tags">
          <el-tag :type="detail.result === 'success' ? 'success' : 'danger'">{{
            detail.result === 'success' ? $t('monitor:completed') : $t('monitor:incomplete')
          }}</el-tag>
          <el-tag :type="riskType(detail.riskLevel)">{{ riskText(detail.riskLevel) }}</el-tag>
        </div>
      </div>
      <section class="detail-section">
        <h4>{{ $t('monitor:whatHappened') }}</h4>
        <p>
          {{ eventSummary(detail)
          }}{{
            detail.result !== 'success' ? `。${failureText(detail.failureCode, detail.result)}` : ''
          }}
        </p>
      </section>
      <el-descriptions
        :column="1"
        border
        class="detail-descriptions"
      >
        <el-descriptions-item :label="$t('monitor:relatedUser')">{{
          detail.userName || detail.userId || $t('monitor:systemOrMachineIdentity')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('monitor:relatedApp')">{{
          detail.clientName || detail.clientId || $t('monitor:noLinkedApp')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('monitor:relatedService')">{{
          detail.resourceId || $t('monitor:noLinkedService')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('monitor:sourceAddress')">{{
          detail.ipAddress || $t('monitor:internalSystem')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('monitor:failureReason')">{{
          failureText(detail.failureCode, detail.result)
        }}</el-descriptions-item>
      </el-descriptions>
      <el-collapse class="technical-details">
        <el-collapse-item
          :title="$t('monitor:viewTroubleshootingDetails')"
          name="technical"
        >
          <dl>
            <dt>{{ $t('monitor:eventCode') }}</dt>
            <dd>{{ detail.eventType || '—' }}</dd>
            <dt>{{ $t('monitor:eventID') }}</dt>
            <dd>{{ detail.auditId || detail.eventId || '—' }}</dd>
            <dt>{{ $t('monitor:traceID') }}</dt>
            <dd>{{ detail.traceId || '—' }}</dd>
            <dt>{{ $t('monitor:userPrincipal') }}</dt>
            <dd>{{ detail.subjectId || '—' }}</dd>
            <dt>{{ $t('monitor:sessionID') }}</dt>
            <dd>{{ detail.sid || '—' }}</dd>
            <dt>{{ $t('monitor:authorizationID') }}</dt>
            <dd>{{ detail.grantId || '—' }}</dd>
            <dt>{{ $t('monitor:tokenID') }}</dt>
            <dd>{{ detail.tokenId || '—' }}</dd>
            <dt>{{ $t('monitor:errorCode') }}</dt>
            <dd>{{ detail.failureCode || '—' }}</dd>
            <dt>{{ $t('monitor:browserInformation') }}</dt>
            <dd>{{ detail.userAgent || '—' }}</dd>
          </dl>
        </el-collapse-item>
      </el-collapse>
    </el-drawer>
  </div>
</template>

<script setup name="OAuthAudit">
import { t } from '@/i18n/adapter'
import { listOAuthAudit } from '@/api/monitor/oauthAudit'
import PageFrame from '@/components/OAuthWorkspace/PageFrame.vue'

const { proxy } = getCurrentInstance()
const rows = ref([])
const detail = ref({})
const dateRange = ref([])
const total = ref(0)
const loading = ref(false)
const showSearch = ref(true)
const detailOpen = ref(false)

const eventGroups = [
  {
    get label() {
      return t('monitor:signInAndAuthorization')
    },
    options: [
      {
        get label() {
          return t('monitor:signInAuthorizationRequested')
        },
        value: 'authorize_requested',
      },
      {
        get label() {
          return t('monitor:signInAuthorizationCompleted')
        },
        value: 'authorize_succeeded',
      },
      {
        get label() {
          return t('monitor:signInAuthorizationDeclined')
        },
        value: 'authorize_denied',
      },
      {
        get label() {
          return t('monitor:userSignedIn')
        },
        value: 'login_succeeded',
      },
      {
        get label() {
          return t('monitor:userSignInFailed')
        },
        value: 'login_failed',
      },
      {
        get label() {
          return t('monitor:userGrantedAuthorization')
        },
        value: 'consent_granted',
      },
      {
        get label() {
          return t('monitor:userWithdrewAuthorization')
        },
        value: 'consent_revoked',
      },
    ],
  },
  {
    get label() {
      return t('monitor:credentialsAndSessions')
    },
    options: [
      {
        get label() {
          return t('monitor:accessTokenIssued')
        },
        value: 'token_issued',
      },
      {
        get label() {
          return t('monitor:accessTokenProcessingFailed')
        },
        value: 'token_failed',
      },
      {
        get label() {
          return t('monitor:refreshTokenRenewed')
        },
        value: 'refresh_rotated',
      },
      {
        get label() {
          return t('monitor:refreshTokenReuseDetected')
        },
        value: 'refresh_reuse_detected',
      },
      {
        get label() {
          return t('monitor:accessTokenRevoked')
        },
        value: 'token_revoked',
      },
      {
        get label() {
          return t('monitor:sessionEnded')
        },
        value: 'session_revoked',
      },
      {
        get label() {
          return t('monitor:userAuthorizationRevoked')
        },
        value: 'grant_revoked',
      },
      {
        get label() {
          return t('monitor:userAccessToAppBlocked')
        },
        value: 'client_access_blocked',
      },
      {
        get label() {
          return t('monitor:userAccessToAppAllowed')
        },
        value: 'client_access_allowed',
      },
      {
        get label() {
          return t('monitor:appSignOutNotificationDelivered')
        },
        value: 'backchannel_logout_succeeded',
      },
      {
        get label() {
          return t('monitor:appSignOutNotificationFailed')
        },
        value: 'backchannel_logout_failed',
      },
    ],
  },
  {
    get label() {
      return t('monitor:configurationAndSecurity')
    },
    options: [
      {
        get label() {
          return t('monitor:appRegistered')
        },
        value: 'client_created',
      },
      {
        get label() {
          return t('monitor:appDisabled')
        },
        value: 'client_disabled',
      },
      {
        get label() {
          return t('monitor:appSecretUpdated')
        },
        value: 'client_secret_rotated',
      },
      {
        get label() {
          return t('monitor:signingKeyRotated')
        },
        value: 'signing_key_rotated',
      },
      {
        get label() {
          return t('monitor:serviceAccessPolicyChanged')
        },
        value: 'resource_policy_changed',
      },
      {
        get label() {
          return t('monitor:permissionPolicyChanged')
        },
        value: 'scope_policy_changed',
      },
      {
        get label() {
          return t('monitor:authorizationCodeReuseDetected')
        },
        value: 'authorization_code_reused',
      },
      {
        get label() {
          return t('monitor:appAuthenticationFailed')
        },
        value: 'invalid_client',
      },
      {
        get label() {
          return t('monitor:userIdentityMissing')
        },
        value: 'identity_subject_missing',
      },
      {
        get label() {
          return t('monitor:accountSecurityVersionChanged')
        },
        value: 'security_version_changed',
      },
    ],
  },
]

const eventLabels = computed(() =>
  Object.fromEntries(
    eventGroups.flatMap((group) => group.options).map((item) => [item.value, item.label])
  )
)
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  eventType: undefined,
  clientId: undefined,
  userId: undefined,
  result: undefined,
  riskLevel: undefined,
})

/** 获取安全事件名称 */
function eventLabel(value) {
  return eventLabels.value[value] || value || t('monitor:unknownSecurityOperation')
}

/** 获取安全事件的业务说明 */
function eventSummary(row = {}) {
  const labels = {
    get authorize_requested() {
      return t('monitor:anAppRequestedUserSignInOrPermissionAuthorization')
    },
    get authorize_succeeded() {
      return t('monitor:identityVerificationAndAppAuthorizationCompleted')
    },
    get authorize_denied() {
      return t('monitor:theSignInOrAuthorizationRequestWasNotContinued')
    },
    get login_succeeded() {
      return t('monitor:theUserPassedAuthentication')
    },
    get login_failed() {
      return t('monitor:theUserDidNotPassAuthentication')
    },
    get consent_granted() {
      return t('monitor:theUserAllowedTheAppToAccessTheRequestedInformation')
    },
    get consent_revoked() {
      return t('monitor:theUserWithdrewTheAppSOngoingAccess')
    },
    get token_issued() {
      return t('monitor:theSystemIssuedANewShortLivedAccessTokenTo')
    },
    get token_failed() {
      return t('monitor:theSystemDidNotIssueAnAccessTokenToThe')
    },
    get refresh_rotated() {
      return t('monitor:theAppSRefreshTokenWasSecurelyRenewed')
    },
    get refresh_reuse_detected() {
      return t('monitor:anOldRefreshTokenWasReusedAndMayHaveBeen')
    },
    get token_revoked() {
      return t('monitor:anAccessTokenWasInvalidated')
    },
    get session_revoked() {
      return t('monitor:anExternalSignInSessionWasForciblyEnded')
    },
    get grant_revoked() {
      return t('monitor:aUserSAuthorizationForAnAppWasRevoked')
    },
    get client_access_blocked() {
      return t('monitor:anAdministratorBlockedTheUserSAccessToTheApp')
    },
    get client_access_allowed() {
      return t('monitor:anAdministratorUnblockedTheUserSAccessToTheApp')
    },
    get backchannel_logout_succeeded() {
      return t('monitor:theSystemNotifiedRelatedAppsToEndTheirLocalSessions')
    },
    get backchannel_logout_failed() {
      return t('monitor:aRelatedAppDidNotReceiveTheSignOutNotification')
    },
    get client_created() {
      return t('monitor:aNewAppRegisteredWithTheAuthenticationService')
    },
    get client_disabled() {
      return t('monitor:anAppWasBlockedFromUsingTheAuthenticationService')
    },
    get client_secret_rotated() {
      return t('monitor:theSecretUsedToAuthenticateTheAppWasUpdated')
    },
    get signing_key_rotated() {
      return t('monitor:theKeyUsedToSignIdentityCredentialsWasUpdated')
    },
    get resource_policy_changed() {
      return t('monitor:aServiceSAllowedCredentialsOrUserInformationSettingsChanged')
    },
    get scope_policy_changed() {
      return t('monitor:aPermissionSScopeOrUserConfirmationRequirementsChanged')
    },
    get authorization_code_reused() {
      return t('monitor:aOneTimeAuthorizationCodeWasReusedIndicatingAPossible')
    },
    get invalid_client() {
      return t('monitor:theAppCouldNotAuthenticateItself')
    },
    get identity_subject_missing() {
      return t('monitor:theUserLacksTheStableIdentityRequiredForAuthentication')
    },
    get security_version_changed() {
      return t('monitor:accountSecurityInformationChangedExistingSessionsWillGraduallyExpire')
    },
  }
  return labels[row.eventType] || t('monitor:theSystemRecordedAnAuthenticationSecurityOperation')
}

/** 根据处理结果和风险等级显示事件颜色 */
function eventTone(row = {}) {
  if (row.result === 'failure' || ['high', 'critical'].includes(row.riskLevel)) {
    return 'danger'
  }
  if (row.riskLevel === 'medium') {
    return 'warning'
  }
  return 'normal'
}

/** 显示请求来源摘要 */
function sourceText(row = {}) {
  if (row.userAgent) {
    return row.userAgent.length > 26 ? `${row.userAgent.slice(0, 26)}…` : row.userAgent
  }
  return row.ipAddress ? t('monitor:externalRequest') : t('monitor:administrativeAction')
}

/** 将协议失败代码转换为处理说明 */
function failureText(code, result) {
  if (result !== 'failure' && !code) {
    return t('monitor:noActionRequired')
  }
  const labels = {
    get invalid_request() {
      return t('monitor:theRequestIsIncompleteOrIncorrectlyFormatted')
    },
    get invalid_client() {
      return t('monitor:appAuthenticationFailedCheckTheAppCredentials')
    },
    get invalid_grant() {
      return t('monitor:theSignInOrAuthorizationCredentialsHaveExpired')
    },
    get unauthorized_client() {
      return t('monitor:theAppIsNotAllowedToUseThisSignIn')
    },
    get unsupported_grant_type() {
      return t('monitor:thisSignInMethodIsNotSupported')
    },
    get invalid_scope() {
      return t('monitor:theAppRequestedAPermissionThatIsNotAvailable')
    },
    get access_denied() {
      return t('monitor:theUserOrASecurityPolicyDeniedThisOperation')
    },
    get login_required() {
      return t('monitor:theUserNeedsToSignInAgain')
    },
    get consent_required() {
      return t('monitor:theUserMustConfirmTheAppSRequestedPermissions')
    },
    get server_error() {
      return t('monitor:theAuthenticationServiceCannotCompleteTheRequestRightNow')
    },
    get temporarily_unavailable() {
      return t('monitor:theAuthenticationServiceIsTemporarilyUnavailable')
    },
  }
  return (
    labels[code] ||
    (code
      ? t('monitor:operationIncompleteValue', { code })
      : t('monitor:theOperationDidNotCompleteNoSpecificReasonIsAvailable'))
  )
}

/** 获取风险等级名称 */
function riskText(value) {
  return (
    {
      get normal() {
        return t('monitor:general')
      },
      get medium() {
        return t('monitor:needsAttention')
      },
      get high() {
        return t('monitor:highRisk')
      },
      get critical() {
        return t('monitor:critical')
      },
    }[value] || t('monitor:general')
  )
}
/** 获取风险等级标签类型 */
function riskType(value) {
  return { normal: 'info', medium: 'warning', high: 'danger', critical: 'danger' }[value] || 'info'
}
/** 合并分页条件和时间筛选范围 */
function params() {
  return {
    ...queryParams,
    startTime: dateRange.value?.[0],
    endTime: dateRange.value?.[1],
  }
}

/** 查询认证安全日志列表 */
async function getList() {
  loading.value = true
  try {
    const response = await listOAuthAudit(params())
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
  dateRange.value = []
  proxy.resetForm('queryRef')
  handleQuery()
}
/** 查看安全日志详情 */
function showDetail(row) {
  detail.value = row
  detailOpen.value = true
}
/** 导出当前筛选条件下的安全日志 */
function exportRows() {
  proxy.download('monitor/oauth/audit/export', params(), `oauth_audit_${Date.now()}.xlsx`)
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

.event-cell,
.detail-hero {
  display: flex;
  align-items: center;
  gap: 11px;
}

.event-mark {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 9px;
  place-items: center;
}

.event-mark.is-warning {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}

.event-mark.is-danger {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.event-mark.large {
  flex-basis: 44px;
  width: 44px;
  height: 44px;
  font-size: 19px;
}

.event-cell strong,
.event-cell small,
.subject-cell span,
.subject-cell small {
  display: block;
}

.event-cell strong,
.subject-cell span {
  color: var(--el-text-color-primary);
}

.event-cell small,
.subject-cell small {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.detail-hero {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-hero > div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.detail-hero strong {
  color: var(--el-text-color-primary);
  font-size: 17px;
}

.detail-hero p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
}

.detail-tags {
  display: flex;
  gap: 6px;
}

.detail-section {
  padding: 18px 0 0;
}

.detail-section h4 {
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
}

.detail-section p {
  margin: 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.detail-descriptions {
  margin-top: 18px;
}

.technical-details {
  margin-top: 16px;
}

.technical-details dl {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  margin: 0;
}

.technical-details dt,
.technical-details dd {
  padding: 6px 0;
}

.technical-details dt {
  color: var(--el-text-color-secondary);
}

.technical-details dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (max-width: 560px) {
  .detail-hero {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .detail-tags {
    width: 100%;
    padding-left: 55px;
  }
}
</style>
