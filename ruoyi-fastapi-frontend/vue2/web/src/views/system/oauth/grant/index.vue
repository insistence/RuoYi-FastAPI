<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('authCenter:help.accessControl')"
      :title="$t('authCenter:messages.userGrants')"
      :description="
        $t(
          'authCenter:messages.manageUserAccessGrantsToApplicationsRevokeCurrentAccessOrPreventFuture'
        )
      "
      :filter-hint="
        $t(
          'authCenter:messages.grantStatusAndApplicationAccessPoliciesAreManagedSeparatelyRemovingARestriction'
        )
      "
    >
      <template #actions>
        <el-button
          type="primary"
          plain
          icon="el-icon-lock"
          @click="policyOpen = true"
          >{{ $t('authCenter:messages.accessPolicies') }}</el-button
        >
        <el-button
          type="danger"
          plain
          icon="el-icon-circle-close"
          :disabled="!selected.length"
          v-hasPermi="['system:oauthGrant:revoke']"
          @click="openRevoke()"
        >
          {{ $t('authCenter:messages.revokeSelected')
          }}{{ selected.length ? `（${selected.length}）` : '' }}
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
                :label="$t('authCenter:messages.stillValid')"
                value="active"
              />
              <el-option
                :label="$t('authCenter:messages.revoked')"
                value="revoked"
              />
              <el-option
                :label="$t('common:expired')"
                value="expired"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('authCenter:messages.applicationAccess')"
            prop="accessStatus"
          >
            <el-select
              v-model="queryParams.accessStatus"
              clearable
              :placeholder="$t('authCenter:messages.allPolicies')"
              style="width: 200px"
            >
              <el-option
                :label="$t('authCenter:messages.consentAllowed')"
                value="allowed"
              />
              <el-option
                :label="$t('authCenter:messages.blockAccess')"
                value="blocked"
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
          >{{ $t('layout:interface.found') }} <strong>{{ total }}</strong>
          {{ $t('authCenter:messages.grants') }}</span
        >
        <right-toolbar
          :showSearch.sync="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="grantId"
        @selection-change="selected = $event"
      >
        <el-table-column
          type="selection"
          width="48"
          :selectable="(row) => row.status === 'active'"
        />
        <el-table-column
          :label="$t('system:user.user')"
          min-width="180"
        >
          <template #default="scope">
            <div class="person-cell">
              <span class="person-mark"
                ><i
                  class="el-icon el-icon-user"
                  aria-hidden="true"
                ></i
              ></span>
              <span
                ><strong>{{
                  scope.row.userName || $t('auth:user.fallbackName', { id: scope.row.userId })
                }}</strong
                ><small>{{ scope.row.userId || short(scope.row.subjectId) }}</small></span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.grantedToApplication')"
          min-width="210"
        >
          <template #default="scope"
            ><div class="stacked-cell">
              <strong>{{ scope.row.clientName || scope.row.clientId }}</strong
              ><code>{{ scope.row.clientId }}</code>
            </div></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.allowedPermissions')"
          min-width="260"
        >
          <template #default="scope">
            <div class="tag-summary">
              <el-tag
                v-for="item in (scope.row.grantedScopes || []).slice(0, 3)"
                :key="item"
                size="small"
                effect="plain"
                >{{ item }}</el-tag
              >
              <span
                v-if="(scope.row.grantedScopes || []).length > 3"
                class="muted-value"
                >+{{ scope.row.grantedScopes.length - 3 }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('pluginAdmin:accessibleServices')"
          min-width="170"
          show-overflow-tooltip
        >
          <template #default="scope">{{
            (scope.row.grantedResources || []).join('、') ||
            $t('authCenter:interface.identityInformationOnly')
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.lastUsed')"
          width="170"
        >
          <template #default="scope">{{
            parseTime(scope.row.lastUsedAt) || $t('authCenter:expression.notUsedYet')
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('common:status')"
          width="105"
          align="center"
        >
          <template #default="scope"
            ><el-tag :type="statusType(scope.row.status)">{{
              statusText(scope.row.status)
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.applicationAccess')"
          width="110"
          align="center"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.accessStatus === 'blocked' ? 'danger' : 'info'"
              effect="plain"
            >
              {{
                scope.row.accessStatus === 'blocked'
                  ? $t('authCenter:messages.blockAccess')
                  : $t('authCenter:messages.consentAllowed')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:actions')"
          fixed="right"
          width="260"
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
              <el-button
                class="oauth-button-danger"
                type="text"
                v-if="scope.row.status === 'active'"
                icon="el-icon-circle-close"
                v-hasPermi="['system:oauthGrant:revoke']"
                @click="openRevoke(scope.row)"
                >{{ $t('authCenter:messages.revoke') }}</el-button
              >
              <el-button
                type="text"
                :class="{ 'oauth-button-danger': scope.row.accessStatus !== 'blocked' }"
                :icon="scope.row.accessStatus === 'blocked' ? 'el-icon-unlock' : 'el-icon-lock'"
                v-hasPermi="['system:oauthGrant:revoke']"
                @click="openAccess(scope.row)"
                >{{
                  scope.row.accessStatus === 'blocked'
                    ? $t('authCenter:expression.removeRestriction')
                    : $t('authCenter:messages.blockAccess')
                }}</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty
          ><el-empty :description="$t('authCenter:messages.noMatchingUserGrants')"
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

    <AccessPolicyDrawer
      v-model="policyOpen"
      @changed="getList"
    />

    <el-dialog
      custom-class="oauth-overlay"
      :visible.sync="revokeOpen"
      :title="$t('authCenter:messages.revokeUserGrants')"
      width="min(540px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="impact-summary">
        <i
          class="el-icon el-icon-warning"
          aria-hidden="true"
        ></i>
        <div>
          <strong>{{ $t('auth:grant.revokeCount', { count: revokeTargetCount }) }}</strong>
          <p>
            {{
              $t(
                'authCenter:messages.thisIncludesOneTimeRememberedAndOfflineAccessGrantsResourcesUsingOnline'
              )
            }}
          </p>
        </div>
      </div>
      <label
        class="reason-label"
        for="grant-revoke-reason"
        >{{ $t('authCenter:messages.revocationReason') }}</label
      >
      <el-input
        id="grant-revoke-reason"
        v-model="reason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        :placeholder="$t('authCenter:messages.explainTheRevocationForTheAuditTrail')"
      />
      <template #footer>
        <el-button @click="revokeOpen = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="danger"
          :disabled="!reason.trim()"
          :loading="revoking"
          @click="revoke"
          >{{ $t('authCenter:messages.confirmRevocation') }}</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      custom-class="oauth-overlay"
      :visible.sync="accessOpen"
      :title="
        accessBlocked
          ? $t('authCenter:expression.blockUserAccessToApplication')
          : $t('authCenter:expression.removeApplicationAccessRestriction')
      "
      width="min(540px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="impact-summary">
        <i
          class="el-icon el-icon-warning"
          aria-hidden="true"
        ></i>
        <div>
          <strong
            >{{
              accessTarget.userName || $t('auth:user.fallbackName', { id: accessTarget.userId })
            }}
            · {{ accessTarget.clientName || accessTarget.clientId }}</strong
          >
          <p v-if="accessBlocked">
            {{
              $t(
                'authCenter:messages.thisRevokesAllExistingGrantsForThisUserAndApplicationAndPrevents'
              )
            }}
          </p>
          <p v-else>
            {{
              $t(
                'authCenter:messages.theUserMayGrantConsentAgainAfterTheRestrictionIsRemovedRevoked'
              )
            }}
          </p>
        </div>
      </div>
      <label
        class="reason-label"
        for="grant-access-reason"
        >{{ $t('common:operationReason') }}</label
      >
      <el-input
        id="grant-access-reason"
        v-model="accessReason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        :placeholder="$t('authCenter:messages.explainTheOperationForTheAuditTrail')"
      />
      <template #footer>
        <el-button @click="accessOpen = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          :type="accessBlocked ? 'danger' : 'primary'"
          :disabled="!accessReason.trim()"
          :loading="savingAccess"
          @click="saveAccess"
          >{{
            accessBlocked
              ? $t('authCenter:expression.confirmRestriction')
              : $t('authCenter:expression.confirmRemoval')
          }}</el-button
        >
      </template>
    </el-dialog>

    <el-drawer
      custom-class="oauth-overlay"
      :visible.sync="detailOpen"
      :title="$t('authCenter:messages.userGrantDetails')"
      size="min(640px, 92vw)"
    >
      <div class="detail-hero">
        <span class="person-mark large"
          ><i
            class="el-icon el-icon-user"
            aria-hidden="true"
          ></i
        ></span>
        <div>
          <strong>{{ detail.userName || detail.userId || $t('system:user.user') }}</strong>
          <p>
            {{ $t('authCenter:messages.grantedTo') }} {{ detail.clientName || detail.clientId }}
          </p>
        </div>
        <el-tag :type="statusType(detail.status)">{{ statusText(detail.status) }}</el-tag>
      </div>
      <section class="detail-section">
        <h4>{{ $t('authCenter:messages.allowedPermissions') }}</h4>
        <div class="tag-summary">
          <el-tag
            v-for="item in detail.grantedScopes || []"
            :key="item"
            effect="plain"
            >{{ item }}</el-tag
          >
        </div>
      </section>
      <section class="detail-section">
        <h4>{{ $t('pluginAdmin:accessibleServices') }}</h4>
        <p>
          {{
            (detail.grantedResources || []).join('、') ||
            $t('authCenter:expression.usedOnlyToObtainSignInIdentityInformation')
          }}
        </p>
      </section>
      <el-descriptions
        :column="1"
        border
        class="detail-descriptions"
      >
        <el-descriptions-item :label="$t('authCenter:messages.grantedAt')">{{
          parseTime(detail.consentedAt) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.lastUsed')">{{
          parseTime(detail.lastUsedAt) || $t('authCenter:expression.notUsedYet')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.skipFutureConfirmation')">{{
          (detail.rememberedScopes || []).join('、') ||
          $t('authCenter:expression.notRememberedFutureConfirmationFollowsThePolicy')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.applicationAccess')">{{
          detail.accessStatus === 'blocked'
            ? $t('authCenter:expression.accessBlockedAnAdministratorMustRemoveTheRestriction')
            : $t('authCenter:expression.newConsentAllowed')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.accessPolicyReason')">{{
          detail.accessReason || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.revocationReason')">{{
          detail.revokeReason || '—'
        }}</el-descriptions-item>
      </el-descriptions>
      <el-collapse class="technical-details">
        <el-collapse-item
          :title="$t('authCenter:messages.showTechnicalIdentifiers')"
          name="technical"
        >
          <dl>
            <dt>{{ $t('monitor:messages.authorizationID') }}</dt>
            <dd>{{ detail.grantId }}</dd>
            <dt>{{ $t('authCenter:userPrincipal') }}</dt>
            <dd>{{ detail.subjectId }}</dd>
            <dt>{{ $t('authCenter:messages.policyVersion') }}</dt>
            <dd>{{ detail.clientPolicyVersion || '—' }}</dd>
          </dl>
        </el-collapse-item>
      </el-collapse>
    </el-drawer>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'OAuthGrant' }
</script>

<script setup>
import { getCurrentInstance, reactive, ref } from 'vue'
import {
  getOAuthGrant,
  listOAuthGrants,
  revokeOAuthGrants,
  setOAuthClientAccess,
} from '@/api/system/oauthSession'
import PageFrame from '@/components/OAuthWorkspace/PageFrame.vue'
import AccessPolicyDrawer from './AccessPolicyDrawer.vue'

const { proxy } = getCurrentInstance()
const rows = ref([])
const selected = ref([])
const detail = ref({})
const total = ref(0)
const loading = ref(false)
const revoking = ref(false)
const showSearch = ref(true)
const revokeOpen = ref(false)
const detailOpen = ref(false)
const revokeIds = ref([])
const reason = ref('')
const revokeTargetCount = ref(0)
const policyOpen = ref(false)
const accessOpen = ref(false)
const accessTarget = ref({})
const accessBlocked = ref(true)
const accessReason = ref('')
const savingAccess = ref(false)
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  userId: undefined,
  clientId: undefined,
  status: undefined,
  accessStatus: undefined,
})

/** 缩略显示授权标识 */
function short(value) {
  if (!value) {
    return '—'
  }
  return value.length > 12 ? `${value.slice(0, 12)}…` : value
}

/** 获取授权状态名称 */
function statusText(value) {
  return (
    {
      active: t('authCenter:messages.stillValid'),
      revoked: t('authCenter:messages.revoked'),
      expired: t('common:expired'),
    }[value] || t('authCenter:messages.unknownStatus')
  )
}

/** 获取授权状态标签类型 */
function statusType(value) {
  return { active: 'success', revoked: 'danger', expired: 'info' }[value] || 'info'
}

/** 查询用户授权列表 */
async function getList() {
  loading.value = true
  try {
    const response = await listOAuthGrants(queryParams)
    selected.value = []
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

/** 打开授权撤销对话框 */
function openRevoke(row) {
  const targets = row ? [row] : selected.value
  revokeIds.value = targets.map((item) => item.grantId)
  revokeTargetCount.value = new Set(targets.map((item) => `${item.userId}:${item.clientId}`)).size
  reason.value = ''
  revokeOpen.value = true
}

/** 提交选中授权的撤销原因 */
async function revoke() {
  revoking.value = true
  try {
    await revokeOAuthGrants(revokeIds.value.join(','), {
      reason: reason.value.trim(),
    })
    proxy.$modal.msgSuccess(t('authCenter:messages.grantRevoked'))
    revokeOpen.value = false
    await getList()
  } finally {
    revoking.value = false
  }
}

/** 打开用户应用访问控制对话框 */
function openAccess(row) {
  accessTarget.value = row
  accessBlocked.value = row.accessStatus !== 'blocked'
  accessReason.value = ''
  accessOpen.value = true
}

/** 保存访问策略并刷新授权状态 */
async function saveAccess() {
  savingAccess.value = true
  try {
    await setOAuthClientAccess(accessTarget.value.userId, accessTarget.value.clientId, {
      blocked: accessBlocked.value,
      reason: accessReason.value.trim(),
    })
    proxy.$modal.msgSuccess(
      accessBlocked.value
        ? t('authCenter:messages.accessToThisApplicationHasBeenBlocked')
        : t('authCenter:messages.restrictionRemovedGrantConsentAgain')
    )
    accessOpen.value = false
    await getList()
  } finally {
    savingAccess.value = false
  }
}

/** 查询并展示授权详情 */
async function showDetail(row) {
  const response = await getOAuthGrant(row.grantId)
  detail.value = response.data
  detailOpen.value = true
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

.person-cell,
.detail-hero {
  display: flex;
  align-items: center;
  gap: 10px;
}

.person-mark {
  display: grid;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  color: var(--oauth-color-primary);
  background: var(--oauth-color-primary-light-9);
  border-radius: 50%;
  place-items: center;
}

.person-mark.large {
  flex-basis: 42px;
  width: 42px;
  height: 42px;
}

.person-cell strong,
.person-cell small,
.stacked-cell strong,
.stacked-cell code {
  display: block;
}

.person-cell strong,
.stacked-cell strong {
  color: var(--oauth-text-color-primary);
}

.person-cell small,
.stacked-cell code {
  margin-top: 3px;
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.tag-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.muted-value {
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.impact-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 14px 16px;
  color: var(--oauth-color-warning-dark-2);
  background: var(--oauth-color-warning-light-9);
  border: 1px solid var(--oauth-color-warning-light-7);
  border-radius: 8px;
}

.impact-summary > .el-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  font-size: 18px;
}

.impact-summary strong {
  color: var(--oauth-text-color-primary);
}

.impact-summary p {
  margin: 5px 0 0;
  color: var(--oauth-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.reason-label {
  display: block;
  margin-bottom: 8px;
  color: var(--oauth-text-color-primary);
  font-weight: 600;
}

.detail-hero {
  padding: 0 0 20px;
  border-bottom: 1px solid var(--oauth-border-color-lighter);
}

.detail-hero > div {
  flex: 1;
}

.detail-hero strong {
  color: var(--oauth-text-color-primary);
  font-size: 17px;
}

.detail-hero p {
  margin: 5px 0 0;
  color: var(--oauth-text-color-secondary);
}

.detail-section {
  padding: 18px 0;
  border-bottom: 1px solid var(--oauth-border-color-lighter);
}

.detail-section h4 {
  margin: 0 0 10px;
  color: var(--oauth-text-color-primary);
}

.detail-section p {
  margin: 0;
  color: var(--oauth-text-color-regular);
  line-height: 1.6;
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
</style>
