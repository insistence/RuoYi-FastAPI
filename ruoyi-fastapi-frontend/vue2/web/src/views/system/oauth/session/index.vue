<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('authCenter:help.accessControl')"
      :title="$t('authCenter:messages.signInSessions')"
      :description="
        $t(
          'authCenter:messages.viewUsersOfUnifiedSignInTheirSourceLocationsAndAssociatedApplications'
        )
      "
      :filter-hint="$t('authCenter:messages.onlyActiveSessionsAreShownByDefault')"
    >
      <template #actions>
        <el-button
          type="danger"
          plain
          icon="el-icon-switch-button"
          :disabled="!selected.length"
          v-hasPermi="['system:oauthSession:revoke']"
          @click="openRevoke()"
        >
          {{ $t('authCenter:messages.forceSignOut')
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
            :label="$t('monitor:messages.sourceAddress')"
            prop="ipAddress"
          >
            <el-input
              v-model="queryParams.ipAddress"
              clearable
              :placeholder="$t('authCenter:messages.iPAddress')"
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
                :label="$t('authCenter:messages.online')"
                value="active"
              />
              <el-option
                :label="$t('authCenter:messages.signedOut')"
                value="revoked"
              />
              <el-option
                :label="$t('common:expired')"
                value="expired"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              icon="el-icon-search"
              @click="handleQuery"
              >{{ $t('common:find') }}
            </el-button>
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
          {{ $t('authCenter:messages.sessions') }}
        </span>
        <right-toolbar
          :showSearch.sync="showSearch"
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
          :label="$t('system:user.user')"
          min-width="190"
        >
          <template #default="scope">
            <div class="person-cell">
              <span class="person-mark">
                <i
                  class="el-icon el-icon-user"
                  aria-hidden="true"
                ></i>
              </span>
              <span>
                <strong>{{
                  scope.row.userName || $t('auth:user.fallbackName', { id: scope.row.userId })
                }}</strong>
                <small>{{ scope.row.userId || shortId(scope.row.subjectId) }}</small>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:source')"
          min-width="160"
        >
          <template #default="scope">
            <div class="stacked-cell">
              <strong>{{
                scope.row.ipAddress || $t('authCenter:expression.unknownAddress')
              }}</strong>
              <small>{{ authMethodText(scope.row.amr) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.associatedApplications')"
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
                >{{ $t('authCenter:messages.noAssociatedApplications') }}</span
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
          :label="$t('authCenter:messages.lastActivity')"
          width="170"
        >
          <template #default="scope">
            {{ parseTime(scope.row.lastSeenAt) || '—' }}
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('authCenter:messages.latestEndTime')"
          width="170"
        >
          <template #default="scope">
            {{ parseTime(scope.row.absoluteExpiresAt) || '—' }}
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:status')"
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
          :label="$t('common:actions')"
          width="160"
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
              <el-button
                class="oauth-button-danger"
                type="text"
                v-if="scope.row.status !== 'revoked'"
                icon="el-icon-switch-button"
                v-hasPermi="['system:oauthSession:revoke']"
                @click="openRevoke(scope.row)"
                >{{ $t('authCenter:messages.signOut') }}</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('authCenter:messages.noMatchingSignInSessions')" />
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
      :visible.sync="revokeOpen"
      :title="$t('authCenter:messages.forceSignInSessionsToEnd')"
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
          <strong>{{ $t('auth:session.endCount', { count: revokeIds.length }) }}</strong>
          <p>
            {{
              $t(
                'authCenter:messages.thisEndsTheseSessionsAndTheirOfflineAccessCredentialsResourceServicesDetect'
              )
            }}
          </p>
        </div>
      </div>
      <label
        class="reason-label"
        for="session-revoke-reason"
        >{{ $t('authCenter:messages.signOutReason') }}</label
      >
      <el-input
        id="session-revoke-reason"
        v-model="reason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        :placeholder="$t('authCenter:messages.explainTheForcedSignOutForTheAuditTrail')"
      />
      <template #footer>
        <el-button @click="revokeOpen = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="danger"
          :disabled="!reason.trim()"
          :loading="revoking"
          @click="revoke"
          >{{ $t('authCenter:messages.confirmSignOut') }}</el-button
        >
      </template>
    </el-dialog>

    <el-drawer
      custom-class="oauth-overlay"
      :visible.sync="detailOpen"
      :title="$t('authCenter:messages.signInSessionDetails')"
      size="min(640px, 92vw)"
    >
      <div class="detail-hero">
        <span class="person-mark large">
          <i
            class="el-icon el-icon-user"
            aria-hidden="true"
          ></i>
        </span>
        <div>
          <strong>{{ detail.userName || detail.userId || $t('system:user.user') }}</strong>
          <p>
            {{ detail.ipAddress || $t('authCenter:expression.unknownSourceAddress') }} ·
            {{ authMethodText(detail.amr) }}
          </p>
        </div>
        <el-tag :type="statusType(detail.status)">{{ statusText(detail.status) }}</el-tag>
      </div>
      <section class="detail-section">
        <h4>{{ $t('authCenter:messages.associatedApplications') }}</h4>
        <div class="tag-summary">
          <el-tag
            v-for="item in detail.clientIds || []"
            :key="item"
            effect="plain"
            >{{ item }}</el-tag
          ><span
            v-if="!(detail.clientIds || []).length"
            class="muted-value"
            >{{ $t('authCenter:messages.noAssociatedApplications') }}</span
          >
        </div>
      </section>
      <el-descriptions
        :column="1"
        border
        class="detail-descriptions"
      >
        <el-descriptions-item :label="$t('monitor:login.time')">{{
          parseTime(detail.authTime) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.lastActivity')">{{
          parseTime(detail.lastSeenAt) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.expiresAfterInactivity')">{{
          parseTime(detail.idleExpiresAt) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.latestEndTime')">{{
          parseTime(detail.absoluteExpiresAt) || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="$t('authCenter:messages.signOutReason')">{{
          detail.revokeReason || '—'
        }}</el-descriptions-item>
      </el-descriptions>
      <el-collapse class="technical-details"
        ><el-collapse-item
          :title="$t('authCenter:messages.showTechnicalIdentifiers')"
          name="technical"
          ><dl>
            <dt>{{ $t('monitor:messages.sessionID') }}</dt>
            <dd>{{ detail.sid }}</dd>
            <dt>{{ $t('authCenter:userPrincipal') }}</dt>
            <dd>{{ detail.subjectId }}</dd>
            <dt>{{ $t('authCenter:messages.identityVersion') }}</dt>
            <dd>{{ detail.authVersion || '—' }}</dd>
            <dt>{{ $t('authCenter:messages.authenticationLevel') }}</dt>
            <dd>{{ detail.acr || '—' }}</dd>
          </dl></el-collapse-item
        ></el-collapse
      >
    </el-drawer>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'OAuthSession' }
</script>

<script setup>
import { getCurrentInstance, reactive, ref } from 'vue'
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
      active: t('authCenter:messages.online'),
      revoked: t('authCenter:messages.signedOut'),
      expired: t('common:expired'),
    }[value] || t('authCenter:messages.unknownStatus')
  )
}

/** 获取会话状态标签类型 */
function statusType(value) {
  return { active: 'success', revoked: 'danger', expired: 'info' }[value] || 'info'
}

/** 获取认证方式的展示名称 */
function authMethodText(methods = []) {
  const labels = {
    pwd: t('authCenter:messages.passwordSignIn'),
    password: t('authCenter:messages.passwordSignIn'),
    otp: t('authCenter:messages.oneTimeCode'),
    mfa: t('authCenter:messages.multiFactorAuthentication'),
    sms: t('authCenter:messages.sMSVerification'),
  }
  return methods.length
    ? methods.map((item) => labels[item] || item).join(' + ')
    : t('authCenter:messages.unknownSignInMethod')
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
    proxy.$modal.msgSuccess(t('authCenter:messages.sessionRevoked'))
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
.stacked-cell small {
  display: block;
}

.person-cell strong,
.stacked-cell strong {
  color: var(--oauth-text-color-primary);
}

.person-cell small,
.stacked-cell small {
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
