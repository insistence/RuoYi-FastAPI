<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('authCenter:help.securityOperations')"
      :title="$t('monitor:messages.securityLogs')"
      :description="
        $t(
          'monitor:messages.reviewSignInsAuthorizationsIssuedCredentialsAndPolicyChangesOverTimeTo'
        )
      "
      :filter-hint="
        $t('monitor:messages.logsAreSanitizedAndContainNoPasswordsSecretsOrCompleteCredentials')
      "
    >
      <template #actions>
        <el-button
          type="primary"
          plain
          icon="el-icon-download"
          v-hasPermi="['monitor:oauthAudit:export']"
          @click="exportRows"
        >
          {{ $t('monitor:messages.exportCurrentResults') }}
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
            :label="$t('monitor:messages.operation')"
            prop="eventType"
          >
            <el-select
              v-model="queryParams.eventType"
              clearable
              filterable
              :placeholder="$t('monitor:messages.allOperations')"
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
            :label="$t('common:apply')"
            prop="clientId"
          >
            <el-input
              v-model="queryParams.clientId"
              clearable
              :placeholder="$t('authCenter:appId')"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item
            :label="$t('system:user.user')"
            prop="userId"
          >
            <el-input
              v-model="queryParams.userId"
              clearable
              :placeholder="$t('system:user.id')"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item
            :label="$t('monitor:messages.result')"
            prop="result"
          >
            <el-select
              v-model="queryParams.result"
              clearable
              :placeholder="$t('monitor:messages.allResults')"
              style="width: 200px"
            >
              <el-option
                :label="$t('common:completed')"
                value="success"
              />
              <el-option
                :label="$t('monitor:messages.incomplete')"
                value="failure"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('monitor:messages.riskLevel')"
            prop="riskLevel"
          >
            <el-select
              v-model="queryParams.riskLevel"
              clearable
              :placeholder="$t('monitor:messages.allRiskLevels')"
              style="width: 200px"
            >
              <el-option
                :label="$t('common:general')"
                value="normal"
              />
              <el-option
                :label="$t('monitor:messages.needsAttention')"
                value="medium"
              />
              <el-option
                :label="$t('monitor:messages.highRisk')"
                value="high"
              />
              <el-option
                :label="$t('common:critical')"
                value="critical"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="$t('monitor:messages.occurredAt')">
            <el-date-picker
              v-model="dateRange"
              type="datetimerange"
              value-format="yyyy-MM-dd HH:mm:ss"
              :range-separator="$t('authCenter:help.to')"
              :start-placeholder="$t('monitor:messages.start')"
              :end-placeholder="$t('monitor:messages.end')"
              style="width: 200px"
            />
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
          >{{ $t('layout:interface.found') }} <strong>{{ total }}</strong>
          {{ $t('monitor:messages.records') }}</span
        >
        <right-toolbar
          :showSearch.sync="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="auditId"
      >
        <el-table-column
          :label="$t('monitor:messages.occurredAt')"
          width="170"
        >
          <template #default="scope">{{
            parseTime(scope.row.occurredAt || scope.row.createTime)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:messages.operation')"
          min-width="230"
        >
          <template #default="scope">
            <div class="event-cell">
              <span
                class="event-mark"
                :class="`is-${eventTone(scope.row)}`"
                ><i
                  class="el-icon el-icon-key"
                  aria-hidden="true"
                ></i
              ></span>
              <span
                ><strong>{{ eventLabel(scope.row.eventType) }}</strong
                ><small>{{ eventSummary(scope.row) }}</small></span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:messages.relatedEntities')"
          min-width="200"
        >
          <template #default="scope">
            <div class="subject-cell">
              <span>{{
                scope.row.userName ||
                scope.row.userId ||
                $t('monitor:expression.systemOrMachineIdentity')
              }}</span>
              <small>{{
                scope.row.clientName ||
                scope.row.clientId ||
                $t('monitor:expression.noApplicationLinked')
              }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:source')"
          min-width="150"
        >
          <template #default="scope"
            ><div class="subject-cell">
              <span>{{ scope.row.ipAddress || $t('monitor:expression.internal') }}</span
              ><small>{{ sourceText(scope.row) }}</small>
            </div></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('monitor:messages.result')"
          width="105"
          align="center"
        >
          <template #default="scope"
            ><el-tag :type="scope.row.result === 'success' ? 'success' : 'danger'">{{
              scope.row.result === 'success'
                ? $t('common:completed')
                : $t('monitor:messages.incomplete')
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('monitor:messages.risk')"
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
          :label="$t('monitor:messages.needsAttention')"
          min-width="210"
          show-overflow-tooltip
        >
          <template #default="scope">{{
            failureText(scope.row.failureCode, scope.row.result)
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('common:actions')"
          width="100"
          fixed="right"
          align="center"
        >
          <template #default="scope">
            <div class="table-actions">
              <el-button
                type="text"
                icon="el-icon-view"
                @click="showDetail(scope.row)"
                >{{ $t('common:view') }}</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty
          ><el-empty :description="$t('monitor:messages.noSecurityLogsMatchTheCurrentFilters')"
        /></template>
      </el-table>
      <pagination
        v-show="total > 0"
        :page.sync="queryParams.pageNum"
        :limit.sync="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </PageFrame>

    <el-drawer
      custom-class="oauth-overlay"
      :visible.sync="detailOpen"
      :title="$t('monitor:messages.securityEventDetails')"
      size="min(660px, 92vw)"
    >
      <div class="detail-hero">
        <span
          class="event-mark large"
          :class="`is-${eventTone(detail)}`"
          ><i
            class="el-icon el-icon-key"
            aria-hidden="true"
          ></i
        ></span>
        <div>
          <strong>{{ eventLabel(detail.eventType) }}</strong>
          <p>
            {{
              parseTime(detail.occurredAt || detail.createTime) ||
              $t('monitor:expression.timeUnknown')
            }}
          </p>
        </div>
        <div class="detail-tags">
          <el-tag :type="detail.result === 'success' ? 'success' : 'danger'">{{
            detail.result === 'success' ? $t('common:completed') : $t('monitor:messages.incomplete')
          }}</el-tag>
          <el-tag :type="riskType(detail.riskLevel)">{{ riskText(detail.riskLevel) }}</el-tag>
        </div>
      </div>
      <section class="detail-section">
        <h4>{{ $t('monitor:messages.whatHappened') }}</h4>
        <p>
          {{ eventSummary(detail)
          }}{{
            detail.result === 'failure' || detail.failureCode
              ? $t('monitor:audit.failureSuffix', {
                  message: failureText(detail.failureCode, detail.result),
                })
              : ''
          }}
        </p>
      </section>
      <el-descriptions
        :column="1"
        border
        class="detail-descriptions"
      >
        <el-descriptions-item :label="$t('monitor:messages.relatedUser')">{{
          detail.userName || detail.userId || $t('monitor:expression.systemOrMachineIdentity')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('monitor:messages.relatedApp')">{{
          detail.clientName || detail.clientId || $t('monitor:expression.noApplicationLinked')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('monitor:messages.relatedService')">{{
          detail.resourceId || $t('monitor:expression.noServiceLinked')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('monitor:messages.sourceAddress')">{{
          detail.ipAddress || $t('monitor:expression.internal')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('common:failureReason')">{{
          failureText(detail.failureCode, detail.result)
        }}</el-descriptions-item>
      </el-descriptions>
      <el-collapse class="technical-details">
        <el-collapse-item
          :title="$t('monitor:messages.viewTroubleshootingDetails')"
          name="technical"
        >
          <dl>
            <dt>{{ $t('monitor:messages.eventCode') }}</dt>
            <dd>{{ detail.eventType || '—' }}</dd>
            <dt>{{ $t('monitor:messages.eventID') }}</dt>
            <dd>{{ detail.auditId || detail.eventId || '—' }}</dd>
            <dt>{{ $t('monitor:messages.traceID') }}</dt>
            <dd>{{ detail.traceId || '—' }}</dd>
            <dt>{{ $t('authCenter:userPrincipal') }}</dt>
            <dd>{{ detail.subjectId || '—' }}</dd>
            <dt>{{ $t('monitor:messages.sessionID') }}</dt>
            <dd>{{ detail.sid || '—' }}</dd>
            <dt>{{ $t('monitor:messages.authorizationID') }}</dt>
            <dd>{{ detail.grantId || '—' }}</dd>
            <dt>{{ $t('monitor:messages.tokenID') }}</dt>
            <dd>{{ detail.tokenId || '—' }}</dd>
            <dt>{{ $t('monitor:messages.errorCode') }}</dt>
            <dd>{{ detail.failureCode || '—' }}</dd>
            <dt>{{ $t('monitor:messages.browserInformation') }}</dt>
            <dd>{{ detail.userAgent || '—' }}</dd>
          </dl>
        </el-collapse-item>
      </el-collapse>
    </el-drawer>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'OAuthAudit' }
</script>

<script setup>
import { getCurrentInstance, reactive, ref } from 'vue'
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
      return t('monitor:messages.signInAndAuthorization')
    },
    options: [
      {
        get label() {
          return t('monitor:messages.signInAuthorizationRequested')
        },
        value: 'authorize_requested',
      },
      {
        get label() {
          return t('monitor:messages.signInAuthorizationCompleted')
        },
        value: 'authorize_succeeded',
      },
      {
        get label() {
          return t('monitor:messages.signInAuthorizationDeclined')
        },
        value: 'authorize_denied',
      },
      {
        get label() {
          return t('monitor:messages.userSignedIn')
        },
        value: 'login_succeeded',
      },
      {
        get label() {
          return t('monitor:messages.userSignInFailed')
        },
        value: 'login_failed',
      },
      {
        get label() {
          return t('monitor:messages.userGrantedAuthorization')
        },
        value: 'consent_granted',
      },
      {
        get label() {
          return t('monitor:messages.userWithdrewAuthorization')
        },
        value: 'consent_revoked',
      },
    ],
  },
  {
    get label() {
      return t('monitor:messages.credentialsAndSessions')
    },
    options: [
      {
        get label() {
          return t('monitor:messages.accessTokenIssued')
        },
        value: 'token_issued',
      },
      {
        get label() {
          return t('monitor:messages.accessTokenProcessingFailed')
        },
        value: 'token_failed',
      },
      {
        get label() {
          return t('monitor:messages.refreshTokenRenewed')
        },
        value: 'refresh_rotated',
      },
      {
        get label() {
          return t('monitor:messages.refreshTokenReuseDetected')
        },
        value: 'refresh_reuse_detected',
      },
      {
        get label() {
          return t('monitor:messages.accessTokenRevoked')
        },
        value: 'token_revoked',
      },
      {
        get label() {
          return t('monitor:messages.sessionEnded')
        },
        value: 'session_revoked',
      },
      {
        get label() {
          return t('monitor:messages.userAuthorizationRevoked')
        },
        value: 'grant_revoked',
      },
      {
        get label() {
          return t('monitor:messages.userAccessToAppBlocked')
        },
        value: 'client_access_blocked',
      },
      {
        get label() {
          return t('monitor:messages.userAccessToAppAllowed')
        },
        value: 'client_access_allowed',
      },
      {
        get label() {
          return t('monitor:messages.appSignOutNotificationDelivered')
        },
        value: 'backchannel_logout_succeeded',
      },
      {
        get label() {
          return t('monitor:messages.appSignOutNotificationFailed')
        },
        value: 'backchannel_logout_failed',
      },
    ],
  },
  {
    get label() {
      return t('monitor:messages.configurationAndSecurity')
    },
    options: [
      {
        get label() {
          return t('monitor:messages.appRegistered')
        },
        value: 'client_created',
      },
      {
        get label() {
          return t('monitor:messages.appDisabled')
        },
        value: 'client_disabled',
      },
      {
        get label() {
          return t('monitor:messages.appSecretUpdated')
        },
        value: 'client_secret_rotated',
      },
      {
        get label() {
          return t('monitor:messages.signingKeyRotated')
        },
        value: 'signing_key_rotated',
      },
      {
        get label() {
          return t('monitor:messages.serviceAccessPolicyChanged')
        },
        value: 'resource_policy_changed',
      },
      {
        get label() {
          return t('monitor:messages.permissionPolicyChanged')
        },
        value: 'scope_policy_changed',
      },
      {
        get label() {
          return t('monitor:messages.authorizationCodeReuseDetected')
        },
        value: 'authorization_code_reused',
      },
      {
        get label() {
          return t('monitor:messages.appAuthenticationFailed')
        },
        value: 'invalid_client',
      },
      {
        get label() {
          return t('monitor:messages.userIdentityMissing')
        },
        value: 'identity_subject_missing',
      },
      {
        get label() {
          return t('monitor:messages.accountSecurityVersionChanged')
        },
        value: 'security_version_changed',
      },
    ],
  },
]

const eventLabels = Object.fromEntries(
  eventGroups.flatMap((group) => group.options).map((item) => [item.value, item.label])
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
  return eventLabels[value] || value || t('monitor:messages.unknownSecurityOperation')
}

/** 获取安全事件的业务说明 */
function eventSummary(row = {}) {
  const labels = {
    authorize_requested: t('monitor:messages.anAppRequestedUserSignInOrPermissionAuthorization'),
    authorize_succeeded: t('monitor:messages.identityVerificationAndAppAuthorizationCompleted'),
    authorize_denied: t('monitor:messages.theSignInOrAuthorizationRequestWasNotContinued'),
    login_succeeded: t('monitor:messages.theUserPassedAuthentication'),
    login_failed: t('monitor:messages.theUserDidNotPassAuthentication'),
    consent_granted: t('monitor:messages.theUserAllowedTheAppToAccessTheRequestedInformation'),
    consent_revoked: t('monitor:messages.theUserWithdrewTheAppSOngoingAccess'),
    token_issued: t('monitor:messages.theSystemIssuedANewShortLivedAccessTokenToTheApp'),
    token_failed: t('monitor:messages.theSystemDidNotIssueAnAccessTokenToTheApp'),
    refresh_rotated: t('monitor:messages.theAppSRefreshTokenWasSecurelyRenewed'),
    refresh_reuse_detected: t(
      'monitor:messages.anOldRefreshTokenWasReusedAndMayHaveBeenCompromised'
    ),
    token_revoked: t('monitor:messages.anAccessTokenWasInvalidated'),
    session_revoked: t('monitor:messages.anExternalSignInSessionWasForciblyEnded'),
    grant_revoked: t('monitor:messages.aUserSAuthorizationForAnAppWasRevoked'),
    client_access_blocked: t(
      'monitor:messages.anAdministratorBlockedTheUserSAccessToTheAppAndRevoked'
    ),
    client_access_allowed: t(
      'monitor:messages.anAdministratorUnblockedTheUserSAccessToTheAppNewAuthorization'
    ),
    backchannel_logout_succeeded: t(
      'monitor:messages.theSystemNotifiedRelatedAppsToEndTheirLocalSessions'
    ),
    backchannel_logout_failed: t('monitor:messages.aRelatedAppDidNotReceiveTheSignOutNotification'),
    client_created: t('monitor:messages.aNewAppRegisteredWithTheAuthenticationService'),
    client_disabled: t('monitor:messages.anAppWasBlockedFromUsingTheAuthenticationService'),
    client_secret_rotated: t('monitor:messages.theSecretUsedToAuthenticateTheAppWasUpdated'),
    signing_key_rotated: t('monitor:messages.theKeyUsedToSignIdentityCredentialsWasUpdated'),
    resource_policy_changed: t(
      'monitor:messages.aServiceSAllowedCredentialsOrUserInformationSettingsChanged'
    ),
    scope_policy_changed: t(
      'monitor:messages.aPermissionSScopeOrUserConfirmationRequirementsChanged'
    ),
    authorization_code_reused: t(
      'monitor:messages.aOneTimeAuthorizationCodeWasReusedIndicatingAPossibleAttack'
    ),
    invalid_client: t('monitor:messages.theAppCouldNotAuthenticateItself'),
    identity_subject_missing: t(
      'monitor:messages.theUserLacksTheStableIdentityRequiredForAuthentication'
    ),
    security_version_changed: t(
      'monitor:messages.accountSecurityInformationChangedExistingSessionsWillGraduallyExpire'
    ),
  }
  return (
    labels[row.eventType] ||
    t('monitor:messages.theSystemRecordedAnAuthenticationSecurityOperation')
  )
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
  return row.ipAddress
    ? t('monitor:messages.externalRequest')
    : t('monitor:messages.administrativeAction')
}

/** 将协议失败代码转换为处理说明 */
function failureText(code, result) {
  if (result !== 'failure' && !code) {
    return t('monitor:messages.noActionRequired')
  }
  const labels = {
    invalid_request: t('monitor:messages.theRequestIsIncompleteOrIncorrectlyFormatted'),
    invalid_client: t('monitor:messages.appAuthenticationFailedCheckTheAppCredentials'),
    invalid_grant: t('monitor:messages.theSignInOrAuthorizationCredentialsHaveExpired'),
    unauthorized_client: t('monitor:messages.theAppIsNotAllowedToUseThisSignInMethod'),
    unsupported_grant_type: t('monitor:messages.thisSignInMethodIsNotSupported'),
    invalid_scope: t('monitor:messages.theAppRequestedAPermissionThatIsNotAvailable'),
    access_denied: t('monitor:messages.theUserOrASecurityPolicyDeniedThisOperation'),
    login_required: t('monitor:messages.theUserNeedsToSignInAgain'),
    consent_required: t('monitor:messages.theUserMustConfirmTheAppSRequestedPermissions'),
    server_error: t('monitor:messages.theAuthenticationServiceCannotCompleteTheRequestRightNow'),
    temporarily_unavailable: t('monitor:messages.theAuthenticationServiceIsTemporarilyUnavailable'),
  }
  return (
    labels[code] ||
    (code
      ? t('monitor:messages.operationIncomplete', { code })
      : t('monitor:messages.theOperationDidNotCompleteNoSpecificReasonIsAvailable'))
  )
}

/** 获取风险等级名称 */
function riskText(value) {
  return (
    {
      normal: t('monitor:oauthAudit.general'),
      medium: t('monitor:messages.needsAttention'),
      high: t('monitor:messages.highRisk'),
      critical: t('monitor:oauthAudit.critical'),
    }[value] || t('monitor:oauthAudit.general')
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
  color: var(--oauth-text-color-regular);
  font-size: 13px;
}

.result-count strong {
  color: var(--oauth-text-color-primary);
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
  color: var(--oauth-color-primary);
  background: var(--oauth-color-primary-light-9);
  border-radius: 9px;
  place-items: center;
}

.event-mark.is-warning {
  color: var(--oauth-color-warning-dark-2);
  background: var(--oauth-color-warning-light-9);
}

.event-mark.is-danger {
  color: var(--oauth-color-danger);
  background: var(--oauth-color-danger-light-9);
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
  color: var(--oauth-text-color-primary);
}

.event-cell small,
.subject-cell small {
  margin-top: 4px;
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.detail-hero {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--oauth-border-color-lighter);
}

.detail-hero > div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.detail-hero strong {
  color: var(--oauth-text-color-primary);
  font-size: 17px;
}

.detail-hero p {
  margin: 5px 0 0;
  color: var(--oauth-text-color-secondary);
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
  color: var(--oauth-text-color-primary);
}

.detail-section p {
  margin: 0;
  color: var(--oauth-text-color-regular);
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
  color: var(--oauth-text-color-secondary);
}

.technical-details dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--oauth-text-color-primary);
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
