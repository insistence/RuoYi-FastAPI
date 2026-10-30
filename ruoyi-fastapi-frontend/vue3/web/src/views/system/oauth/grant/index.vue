<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('oauth:accessControl')"
      :title="$t('oauth:userGrants')"
      :description="$t('oauth:manageUserAccessGrantsToApplicationsRevokeCurrentAccessOr')"
      :filter-hint="$t('oauth:grantStatusAndApplicationAccessPoliciesAreManagedSeparatelyRemoving')"
    >
      <template #actions>
        <el-button
          type="primary"
          plain
          icon="Lock"
          @click="policyOpen = true"
          >{{ $t('oauth:accessPolicies') }}</el-button
        >
        <el-button
          type="danger"
          plain
          icon="CircleClose"
          :disabled="!selected.length"
          v-hasPermi="['system:oauthGrant:revoke']"
          @click="openRevoke()"
        >
          {{ $t('oauth:revokeSelected') }}{{ selected.length ? `（${selected.length}）` : '' }}
        </el-button>
      </template>
      <template #filters>
        <el-form
          v-show="showSearch"
          ref="queryRef"
          :model="queryParams"
          :inline="true"
        >
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
                :label="$t('oauth:stillValid')"
                value="active"
              />
              <el-option
                :label="$t('oauth:revoked')"
                value="revoked"
              />
              <el-option
                :label="$t('components:expired')"
                value="expired"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            :label="$t('oauth:applicationAccess')"
            prop="accessStatus"
          >
            <el-select
              v-model="queryParams.accessStatus"
              clearable
              :placeholder="$t('oauth:allPolicies')"
              style="width: 200px"
            >
              <el-option
                :label="$t('oauth:consentAllowed')"
                value="allowed"
              />
              <el-option
                :label="$t('oauth:blockAccess')"
                value="blocked"
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
          >{{ $t('monitor:found') }}<strong>{{ total }}</strong> {{ $t('oauth:grants') }}</span
        >
        <right-toolbar
          v-model:showSearch="showSearch"
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
          :label="$t('monitor:user')"
          min-width="180"
        >
          <template #default="scope">
            <div class="person-cell">
              <span class="person-mark"
                ><el-icon><User /></el-icon
              ></span>
              <span
                ><strong>{{
                  scope.row.userName || $t('oauth:userValue', { userId: scope.row.userId })
                }}</strong
                ><small>{{ scope.row.userId || short(scope.row.subjectId) }}</small></span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:grantedToApplication')"
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
          :label="$t('oauth:allowedPermissions')"
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
          :label="$t('oauth:accessibleServices')"
          min-width="170"
          show-overflow-tooltip
        >
          <template #default="scope">{{
            (scope.row.grantedResources || []).join('、') ||
            $t('components:identityInformationOnly')
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:lastUsed')"
          width="170"
        >
          <template #default="scope">{{
            parseTime(scope.row.lastUsedAt) || $t('oauth:notUsedYet')
          }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('system:status')"
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
          :label="$t('oauth:applicationAccess')"
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
                  ? $t('oauth:blockAccess')
                  : $t('oauth:consentAllowed')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('system:actions')"
          fixed="right"
          width="260"
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
              <el-button
                v-if="scope.row.status === 'active'"
                link
                type="danger"
                icon="CircleClose"
                v-hasPermi="['system:oauthGrant:revoke']"
                @click="openRevoke(scope.row)"
                >{{ $t('oauth:revoke') }}</el-button
              >
              <el-button
                link
                :type="scope.row.accessStatus === 'blocked' ? 'primary' : 'danger'"
                :icon="scope.row.accessStatus === 'blocked' ? 'Unlock' : 'Lock'"
                v-hasPermi="['system:oauthGrant:revoke']"
                @click="openAccess(scope.row)"
                >{{
                  scope.row.accessStatus === 'blocked'
                    ? $t('oauth:removeRestriction')
                    : $t('oauth:blockAccess')
                }}</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="$t('oauth:noMatchingUserGrants')" /></template>
      </el-table>
      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </PageFrame>

    <AccessPolicyDrawer
      v-model="policyOpen"
      @changed="getList"
    />

    <el-dialog
      v-model="revokeOpen"
      :title="$t('oauth:revokeUserGrants')"
      width="min(540px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="impact-summary">
        <el-icon><WarningFilled /></el-icon>
        <div>
          <strong>{{ $t('oauth:revokeGrantCount', { count: revokeTargetCount }) }}</strong>
          <p>
            {{ $t('oauth:thisIncludesOneTimeRememberedAndOfflineAccessGrantsResources') }}
          </p>
        </div>
      </div>
      <label
        class="reason-label"
        for="grant-revoke-reason"
        >{{ $t('oauth:revocationReason') }}</label
      >
      <el-input
        id="grant-revoke-reason"
        v-model="reason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        :placeholder="$t('oauth:explainTheRevocationForTheAuditTrail')"
      />
      <template #footer>
        <el-button @click="revokeOpen = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="danger"
          :disabled="!reason.trim()"
          :loading="revoking"
          @click="revoke"
          >{{ $t('oauth:confirmRevocation') }}</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="accessOpen"
      :title="
        accessBlocked
          ? $t('oauth:blockUserAccessToApplication')
          : $t('oauth:removeApplicationAccessRestriction')
      "
      width="min(540px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="impact-summary">
        <el-icon><WarningFilled /></el-icon>
        <div>
          <strong
            >{{ accessTarget.userName || $t('oauth:userValue', { userId: accessTarget.userId }) }} ·
            {{ accessTarget.clientName || accessTarget.clientId }}</strong
          >
          <p v-if="accessBlocked">
            {{ $t('oauth:thisRevokesAllExistingGrantsForThisUserAndApplication') }}
          </p>
          <p v-else>{{ $t('oauth:theUserMayGrantConsentAgainAfterTheRestrictionIs') }}</p>
        </div>
      </div>
      <label
        class="reason-label"
        for="grant-access-reason"
        >{{ $t('components:reason') }}</label
      >
      <el-input
        id="grant-access-reason"
        v-model="accessReason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        :placeholder="$t('oauth:explainTheOperationForTheAuditTrail')"
      />
      <template #footer>
        <el-button @click="accessOpen = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          :type="accessBlocked ? 'danger' : 'primary'"
          :disabled="!accessReason.trim()"
          :loading="savingAccess"
          @click="saveAccess"
          >{{
            accessBlocked ? $t('oauth:confirmRestriction') : $t('oauth:confirmRemoval')
          }}</el-button
        >
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailOpen"
      :title="$t('oauth:userGrantDetails')"
      size="min(640px, 92vw)"
    >
      <div class="detail-hero">
        <span class="person-mark large"
          ><el-icon><User /></el-icon
        ></span>
        <div>
          <strong>{{ detail.userName || detail.userId || $t('monitor:user') }}</strong>
          <p>{{ $t('oauth:grantedTo') }}{{ detail.clientName || detail.clientId }}</p>
        </div>
        <el-tag :type="statusType(detail.status)">{{ statusText(detail.status) }}</el-tag>
      </div>
      <section class="detail-section">
        <h4>{{ $t('oauth:allowedPermissions') }}</h4>
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
        <h4>{{ $t('oauth:accessibleServices') }}</h4>
        <p>
          {{
            (detail.grantedResources || []).join('、') ||
            $t('oauth:usedOnlyToObtainSignInIdentityInformation')
          }}
        </p>
      </section>
      <el-descriptions
        :column="1"
        border
        class="detail-descriptions"
      >
        <el-descriptions-item :label="$t('oauth:grantedAt')">{{
          parseTime(detail.consentedAt) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:lastUsed')">{{
          parseTime(detail.lastUsedAt) || $t('oauth:notUsedYet')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:skipFutureConfirmation')">{{
          (detail.rememberedScopes || []).join('、') ||
          $t('oauth:notRememberedFutureConfirmationFollowsThePolicy')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:applicationAccess')">{{
          detail.accessStatus === 'blocked'
            ? $t('oauth:accessBlockedAnAdministratorMustRemoveTheRestriction')
            : $t('oauth:newConsentAllowed')
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:accessPolicyReason')">{{
          detail.accessReason || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:revocationReason')">{{
          detail.revokeReason || '—'
        }}</el-descriptions-item>
      </el-descriptions>
      <el-collapse class="technical-details">
        <el-collapse-item
          :title="$t('oauth:showTechnicalIdentifiers')"
          name="technical"
        >
          <dl>
            <dt>{{ $t('monitor:authorizationID') }}</dt>
            <dd>{{ detail.grantId }}</dd>
            <dt>{{ $t('monitor:userPrincipal') }}</dt>
            <dd>{{ detail.subjectId }}</dd>
            <dt>{{ $t('oauth:policyVersion') }}</dt>
            <dd>{{ detail.clientPolicyVersion || '—' }}</dd>
          </dl>
        </el-collapse-item>
      </el-collapse>
    </el-drawer>
  </div>
</template>

<script setup name="OAuthGrant">
import { t } from '@/i18n/adapter'
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
      get active() {
        return t('oauth:stillValid')
      },
      get revoked() {
        return t('oauth:revoked')
      },
      get expired() {
        return t('components:expired')
      },
    }[value] || t('oauth:unknownStatus')
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
    proxy.$modal.msgSuccess(t('oauth:grantRevoked'))
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
        ? t('oauth:accessToThisApplicationHasBeenBlocked')
        : t('oauth:restrictionRemovedGrantConsentAgain')
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
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.result-count strong {
  color: var(--el-text-color-primary);
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
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
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
  color: var(--el-text-color-primary);
}

.person-cell small,
.stacked-cell code {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.tag-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.muted-value {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.impact-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 14px 16px;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
  border-radius: 8px;
}

.impact-summary > .el-icon {
  flex: 0 0 auto;
  margin-top: 2px;
  font-size: 18px;
}

.impact-summary strong {
  color: var(--el-text-color-primary);
}

.impact-summary p {
  margin: 5px 0 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.reason-label {
  display: block;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.detail-hero {
  padding: 0 0 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-hero > div {
  flex: 1;
}

.detail-hero strong {
  color: var(--el-text-color-primary);
  font-size: 17px;
}

.detail-hero p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
}

.detail-section {
  padding: 18px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-section h4 {
  margin: 0 0 10px;
  color: var(--el-text-color-primary);
}

.detail-section p {
  margin: 0;
  color: var(--el-text-color-regular);
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
  color: var(--el-text-color-secondary);
}

.technical-details dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
