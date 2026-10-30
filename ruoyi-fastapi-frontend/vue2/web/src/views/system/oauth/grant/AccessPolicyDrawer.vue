<template>
  <div>
    <el-drawer
      custom-class="oauth-overlay"
      :visible.sync="visible"
      :title="$t('authCenter:messages.applicationAccessPolicies')"
      size="min(960px, 96vw)"
      @open="handleQuery"
    >
      <el-alert
        :title="
          $t('authCenter:messages.blockAccessBeforeAUserFirstGrantsConsentAccessIsAllowedWhen')
        "
        type="info"
        :closable="false"
        show-icon
        class="policy-note"
      />
      <el-form
        :validate-on-rule-change="false"
        ref="queryRef"
        :model="queryParams"
        :inline="true"
        @submit.native.prevent="handleQuery"
      >
        <el-form-item
          :label="$t('system:user.user')"
          prop="userId"
        >
          <el-input
            v-model="queryParams.userId"
            clearable
            :placeholder="$t('system:user.id')"
            class="filter-input"
          />
        </el-form-item>
        <el-form-item
          :label="$t('common:apply')"
          prop="clientId"
        >
          <el-input
            v-model="queryParams.clientId"
            clearable
            placeholder="Client ID"
            class="filter-input"
          />
        </el-form-item>
        <el-form-item
          :label="$t('file:messages.policy')"
          prop="accessStatus"
        >
          <el-select
            v-model="queryParams.accessStatus"
            clearable
            :placeholder="$t('authCenter:messages.allPolicies')"
            class="filter-input"
          >
            <el-option
              :label="$t('authCenter:messages.blockAccess')"
              value="blocked"
            />
            <el-option
              :label="$t('authCenter:messages.allowAccess')"
              value="allowed"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            icon="el-icon-search"
            native-type="submit"
            >{{ $t('common:find') }}</el-button
          >
          <el-button
            icon="el-icon-refresh"
            @click="resetQuery"
            >{{ $t('common:clear') }}</el-button
          >
        </el-form-item>
      </el-form>
      <div class="policy-toolbar">
        <span
          >{{ $t('authCenter:messages.configured') }} {{ total }}
          {{ $t('authCenter:messages.policies') }}</span
        >
        <el-button
          type="primary"
          icon="el-icon-plus"
          v-hasPermi="['system:oauthGrant:revoke']"
          @click="openAccess()"
        >
          {{ $t('authCenter:messages.addAccessRestriction') }}
        </el-button>
      </div>
      <el-table
        v-loading="loading"
        :data="rows"
      >
        <el-table-column
          :label="$t('system:user.user')"
          min-width="140"
        >
          <template #default="scope">
            <div class="policy-target">
              <strong>{{ scope.row.userName }}</strong
              ><small>{{ scope.row.userId }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:apply')"
          min-width="160"
        >
          <template #default="scope">
            <div class="policy-target">
              <strong>{{ scope.row.clientName }}</strong
              ><small>{{ scope.row.clientId }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.policy')"
          width="110"
        >
          <template #default="scope">
            <el-tag :type="scope.row.accessStatus === 'blocked' ? 'danger' : 'success'">
              {{
                scope.row.accessStatus === 'blocked'
                  ? $t('authCenter:messages.blockAccess')
                  : $t('authCenter:messages.allowAccess')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="reason"
          :label="$t('common:operationReason')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="updateBy"
          :label="$t('authCenter:messages.operator')"
          width="110"
        />
        <el-table-column
          :label="$t('authCenter:messages.lastOperation')"
          width="170"
        >
          <template #default="scope">{{ parseTime(scope.row.updateTime) || '—' }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('common:actions')"
          width="110"
          fixed="right"
          align="center"
        >
          <template #default="scope">
            <el-button
              type="text"
              :class="{ 'oauth-button-danger': scope.row.accessStatus !== 'blocked' }"
              v-hasPermi="['system:oauthGrant:revoke']"
              @click="openAccess(scope.row)"
              >{{
                scope.row.accessStatus === 'blocked'
                  ? $t('authCenter:expression.removeRestriction')
                  : $t('authCenter:messages.blockAccess')
              }}</el-button
            >
          </template>
        </el-table-column>
        <template #empty
          ><el-empty :description="$t('authCenter:messages.noMatchingAccessPolicies')"
        /></template>
      </el-table>
      <pagination
        v-show="total > 0"
        :page.sync="queryParams.pageNum"
        :limit.sync="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
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
        :close-on-press-escape="!saving"
        :show-close="!saving"
      >
        <el-alert
          :title="
            accessBlocked
              ? $t(
                  'authCenter:expression.thisRevokesAllExistingGrantsForThisUserAndApplicationAndPrevents'
                )
              : $t(
                  'authCenter:expression.usersMayGrantConsentAgainAfterTheRestrictionIsRemovedExistingGrants'
                )
          "
          :type="accessBlocked ? 'warning' : 'info'"
          :closable="false"
          show-icon
          class="policy-note"
        />
        <el-form
          :validate-on-rule-change="false"
          ref="accessRef"
          :model="accessForm"
          :rules="accessRules"
          label-position="top"
        >
          <el-form-item
            :label="$t('system:user.id')"
            prop="userId"
          >
            <el-input
              v-model="accessForm.userId"
              :disabled="!creating || saving"
              maxlength="19"
              inputmode="numeric"
              :placeholder="$t('authCenter:messages.enterTheUserIDFromUserManagement')"
            />
          </el-form-item>
          <el-form-item
            label="Client ID"
            prop="clientId"
          >
            <el-input
              v-model="accessForm.clientId"
              :disabled="!creating || saving"
              maxlength="128"
              :placeholder="$t('authCenter:messages.enterTheClientIDFromClientManagement')"
            />
          </el-form-item>
          <el-form-item
            :label="$t('common:operationReason')"
            prop="reason"
          >
            <el-input
              v-model="accessForm.reason"
              :disabled="saving"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              :placeholder="$t('authCenter:messages.provideAReasonForTheAuditTrail')"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button
            :disabled="saving"
            @click="accessOpen = false"
            >{{ $t('common:cancel') }}</el-button
          >
          <el-button
            :type="accessBlocked ? 'danger' : 'primary'"
            :loading="saving"
            @click="saveAccess"
          >
            {{
              accessBlocked
                ? $t('authCenter:expression.confirmRestriction')
                : $t('authCenter:expression.confirmRemoval')
            }}
          </el-button>
        </template>
      </el-dialog>
    </el-drawer>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'OAuthAccessPolicyDrawer' }
</script>

<script setup>
import { computed, getCurrentInstance, nextTick, reactive, ref } from 'vue'
import { listOAuthAccessPolicies, setOAuthClientAccess } from '@/api/system/oauthSession'

const props = defineProps({ value: { type: Boolean, default: false } })
const emit = defineEmits(['input', 'changed'])
const visible = computed({
  get: () => props.value,
  set: (value) => emit('input', value),
})
const { proxy } = getCurrentInstance()
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const accessOpen = ref(false)
const accessBlocked = ref(true)
const creating = ref(false)
const saving = ref(false)
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  userId: undefined,
  clientId: undefined,
  accessStatus: undefined,
})
const accessForm = reactive({ userId: '', clientId: '', reason: '' })
const accessRules = {
  userId: [
    {
      required: true,
      pattern: /^[1-9]\d{0,18}$/,
      message: () => t('authCenter:messages.enterAValidUserID'),
      trigger: 'blur',
    },
  ],
  clientId: [
    {
      required: true,
      whitespace: true,
      message: () => t('authCenter:messages.enterAClientID'),
      trigger: 'blur',
    },
  ],
  reason: [
    {
      required: true,
      whitespace: true,
      message: () => t('authCenter:messages.enterAReasonForThisOperation'),
      trigger: 'blur',
    },
  ],
}

/** 查询已配置的独立访问策略 */
async function getList() {
  loading.value = true
  try {
    const response = await listOAuthAccessPolicies(queryParams)
    rows.value = response.rows || []
    total.value = response.total || 0
  } finally {
    loading.value = false
  }
}

/** 从第一页查询访问策略 */
function handleQuery() {
  queryParams.pageNum = 1
  getList()
}

/** 清空查询条件 */
function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}

/** 打开新增或变更访问策略的确认表单 */
function openAccess(row) {
  creating.value = !row
  accessBlocked.value = !row || row.accessStatus !== 'blocked'
  Object.assign(accessForm, {
    userId: row ? String(row.userId) : '',
    clientId: row?.clientId || '',
    reason: '',
  })
  accessOpen.value = true
  nextTick(() => proxy.$refs.accessRef?.clearValidate())
}

/** 提交独立访问策略并同步授权列表 */
async function saveAccess() {
  if (saving.value || !(await proxy.$refs.accessRef.validate().catch(() => false))) {
    return
  }
  saving.value = true
  try {
    await setOAuthClientAccess(accessForm.userId.trim(), accessForm.clientId.trim(), {
      blocked: accessBlocked.value,
      reason: accessForm.reason.trim(),
    })
    proxy.$modal.msgSuccess(
      accessBlocked.value
        ? t('authCenter:messages.theUserHasBeenBlockedFromThisApplication')
        : t('authCenter:messages.accessRestrictionRemoved')
    )
    accessOpen.value = false
    emit('changed')
    await getList()
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.policy-note {
  margin-bottom: 20px;
}

.filter-input {
  width: 180px;
}

.policy-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--oauth-text-color-regular);
}

.policy-target strong,
.policy-target small {
  display: block;
  overflow-wrap: anywhere;
}

.policy-target strong {
  color: var(--oauth-text-color-primary);
}

.policy-target small {
  margin-top: 4px;
  color: var(--oauth-text-color-secondary);
}
</style>
