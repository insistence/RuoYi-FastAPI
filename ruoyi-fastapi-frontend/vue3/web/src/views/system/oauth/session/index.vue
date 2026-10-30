<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('oauth:accessControl')"
      :title="$t('oauth:signInSessions')"
      :description="$t('oauth:viewUsersOfUnifiedSignInTheirSourceLocationsAnd')"
      :filter-hint="$t('oauth:onlyActiveSessionsAreShownByDefault')"
    >
      <template #actions>
        <el-button
          type="danger"
          plain
          icon="SwitchButton"
          :disabled="!selected.length"
          v-hasPermi="['system:oauthSession:revoke']"
          @click="openRevoke()"
        >
          {{ $t('oauth:forceSignOut') }}{{ selected.length ? `（${selected.length}）` : '' }}
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
            :label="$t('monitor:sourceAddress')"
            prop="ipAddress"
          >
            <el-input
              v-model="queryParams.ipAddress"
              clearable
              :placeholder="$t('oauth:iPAddress')"
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
                :label="$t('oauth:online')"
                value="active"
              />
              <el-option
                :label="$t('oauth:signedOut')"
                value="revoked"
              />
              <el-option
                :label="$t('components:expired')"
                value="expired"
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
          >{{ $t('monitor:found') }}<strong>{{ total }}</strong> {{ $t('oauth:sessions') }}</span
        >
        <right-toolbar
          v-model:showSearch="showSearch"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="sid"
        @selection-change="selected = $event"
      >
        <el-table-column
          type="selection"
          width="48"
          :selectable="(row) => row.status !== 'revoked'"
        />
        <el-table-column
          :label="$t('monitor:user')"
          min-width="190"
        >
          <template #default="scope">
            <div class="person-cell">
              <span class="person-mark">
                <el-icon><User /></el-icon>
              </span>
              <span>
                <strong>{{
                  scope.row.userName || $t('oauth:userValue', { userId: scope.row.userId })
                }}</strong>
                <small>{{ scope.row.userId || shortId(scope.row.subjectId) }}</small>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('monitor:source')"
          min-width="160"
        >
          <template #default="scope">
            <div class="stacked-cell">
              <strong>{{ scope.row.ipAddress || $t('oauth:unknownAddress') }}</strong>
              <small>{{ authMethodText(scope.row.amr) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:associatedApplications')"
          min-width="210"
        >
          <template #default="scope">
            <div class="tag-summary">
              <el-tag
                v-for="item in (scope.row.clientIds || []).slice(0, 2)"
                :key="item"
                size="small"
                effect="plain"
                >{{ item }}</el-tag
              >
              <span
                v-if="!(scope.row.clientIds || []).length"
                class="muted-value"
                >{{ $t('oauth:noAssociatedApplications') }}</span
              >
              <span
                v-else-if="scope.row.clientIds.length > 2"
                class="muted-value"
                >+{{ scope.row.clientIds.length - 2 }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:lastActivity')"
          width="170"
        >
          <template #default="scope">
            {{ parseTime(scope.row.lastSeenAt) || '—' }}
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:latestEndTime')"
          width="170"
        >
          <template #default="scope">
            {{ parseTime(scope.row.absoluteExpiresAt) || '—' }}
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('system:status')"
          width="105"
          align="center"
        >
          <template #default="scope">
            <el-tag :type="statusType(scope.row.status)">
              {{ statusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('system:actions')"
          width="160"
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
              <el-button
                v-if="scope.row.status !== 'revoked'"
                link
                type="danger"
                icon="SwitchButton"
                v-hasPermi="['system:oauthSession:revoke']"
                @click="openRevoke(scope.row)"
                >{{ $t('oauth:signOut') }}</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('oauth:noMatchingSignInSessions')" />
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
      v-model="revokeOpen"
      :title="$t('oauth:forceSignInSessionsToEnd')"
      width="min(540px, calc(100vw - 32px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="impact-summary">
        <el-icon><WarningFilled /></el-icon>
        <div>
          <strong>{{ $t('oauth:revokeSessionCount', { count: revokeIds.length }) }}</strong>
          <p>
            {{ $t('oauth:thisEndsTheseSessionsAndTheirOfflineAccessCredentialsResource') }}
          </p>
        </div>
      </div>
      <label
        class="reason-label"
        for="session-revoke-reason"
        >{{ $t('oauth:signOutReason') }}</label
      >
      <el-input
        id="session-revoke-reason"
        v-model="reason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        :placeholder="$t('oauth:explainTheForcedSignOutForTheAuditTrail')"
      />
      <template #footer>
        <el-button @click="revokeOpen = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="danger"
          :disabled="!reason.trim()"
          :loading="revoking"
          @click="revoke"
          >{{ $t('oauth:confirmSignOut') }}</el-button
        >
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailOpen"
      :title="$t('oauth:signInSessionDetails')"
      size="min(640px, 92vw)"
    >
      <div class="detail-hero">
        <span class="person-mark large">
          <el-icon><User /></el-icon>
        </span>
        <div>
          <strong>{{ detail.userName || detail.userId || $t('monitor:user') }}</strong>
          <p>
            {{ detail.ipAddress || $t('oauth:unknownSourceAddress') }} ·
            {{ authMethodText(detail.amr) }}
          </p>
        </div>
        <el-tag :type="statusType(detail.status)">{{ statusText(detail.status) }}</el-tag>
      </div>
      <section class="detail-section">
        <h4>{{ $t('oauth:associatedApplications') }}</h4>
        <div class="tag-summary">
          <el-tag
            v-for="item in detail.clientIds || []"
            :key="item"
            effect="plain"
            >{{ item }}</el-tag
          ><span
            v-if="!(detail.clientIds || []).length"
            class="muted-value"
            >{{ $t('oauth:noAssociatedApplications') }}</span
          >
        </div>
      </section>
      <el-descriptions
        :column="1"
        border
        class="detail-descriptions"
      >
        <el-descriptions-item :label="$t('monitor:signInTime')">{{
          parseTime(detail.authTime) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:lastActivity')">{{
          parseTime(detail.lastSeenAt) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:expiresAfterInactivity')">{{
          parseTime(detail.idleExpiresAt) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:latestEndTime')">{{
          parseTime(detail.absoluteExpiresAt) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('oauth:signOutReason')">{{
          detail.revokeReason || '—'
        }}</el-descriptions-item>
      </el-descriptions>
      <el-collapse class="technical-details"
        ><el-collapse-item
          :title="$t('oauth:showTechnicalIdentifiers')"
          name="technical"
          ><dl>
            <dt>{{ $t('monitor:sessionID') }}</dt>
            <dd>{{ detail.sid }}</dd>
            <dt>{{ $t('monitor:userPrincipal') }}</dt>
            <dd>{{ detail.subjectId }}</dd>
            <dt>{{ $t('oauth:identityVersion') }}</dt>
            <dd>{{ detail.authVersion || '—' }}</dd>
            <dt>{{ $t('oauth:authenticationLevel') }}</dt>
            <dd>{{ detail.acr || '—' }}</dd>
          </dl></el-collapse-item
        ></el-collapse
      >
    </el-drawer>
  </div>
</template>

<script setup name="OAuthSession">
import { t } from '@/i18n/adapter'
import { getOAuthSession, listOAuthSessions, revokeOAuthSessions } from '@/api/system/oauthSession'
import PageFrame from '@/components/OAuthWorkspace/PageFrame.vue'

const { proxy } = getCurrentInstance()
const rows = ref([])
const selected = ref([])
const total = ref(0)
const loading = ref(false)
const revoking = ref(false)
const showSearch = ref(true)
const revokeOpen = ref(false)
const detailOpen = ref(false)
const revokeIds = ref([])
const reason = ref('')
const detail = ref({})
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  userId: undefined,
  ipAddress: undefined,
  status: 'active',
})

/** 缩略显示会话标识 */
function shortId(value, size = 12) {
  if (!value) {
    return '—'
  }
  return value.length > size ? `${value.slice(0, size)}…` : value
}

/** 获取会话状态名称 */
function statusText(value) {
  return (
    {
      get active() {
        return t('oauth:online')
      },
      get revoked() {
        return t('oauth:signedOut')
      },
      get expired() {
        return t('components:expired')
      },
    }[value] || t('oauth:unknownStatus')
  )
}

/** 获取会话状态标签类型 */
function statusType(value) {
  return { active: 'success', revoked: 'danger', expired: 'info' }[value] || 'info'
}

/** 获取认证方式的展示名称 */
function authMethodText(methods = []) {
  const labels = {
    get pwd() {
      return t('oauth:passwordSignIn')
    },
    get password() {
      return t('oauth:passwordSignIn')
    },
    get otp() {
      return t('oauth:oneTimeCode')
    },
    get mfa() {
      return t('oauth:multiFactorAuthentication')
    },
    get sms() {
      return t('oauth:sMSVerification')
    },
  }
  return methods.length
    ? methods.map((item) => labels[item] || item).join(' + ')
    : t('oauth:unknownSignInMethod')
}

/** 查询认证会话列表 */
async function getList() {
  loading.value = true
  try {
    const response = await listOAuthSessions(queryParams)
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

/** 打开会话下线对话框 */
function openRevoke(row) {
  revokeIds.value = row ? [row.sid] : selected.value.map((item) => item.sid)
  reason.value = ''
  revokeOpen.value = true
}

/** 提交选中会话的下线原因 */
async function revoke() {
  revoking.value = true
  try {
    await revokeOAuthSessions(revokeIds.value.join(','), {
      reason: reason.value.trim(),
    })
    proxy.$modal.msgSuccess(t('oauth:sessionRevoked'))
    revokeOpen.value = false
    await getList()
  } finally {
    revoking.value = false
  }
}

/** 查询并展示会话详情 */
async function showDetail(row) {
  const response = await getOAuthSession(row.sid)
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
.stacked-cell small {
  display: block;
}

.person-cell strong,
.stacked-cell strong {
  color: var(--el-text-color-primary);
}

.person-cell small,
.stacked-cell small {
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
