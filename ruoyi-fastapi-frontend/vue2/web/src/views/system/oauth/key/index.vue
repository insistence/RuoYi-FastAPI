<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('oauth:shared.securityOperations')"
      :title="$t('oauth:key.signingKeys')"
      :description="
        $t('oauth:key.manageSigningKeysUsedToProveTheAuthenticityOfIdentityCredentialsAnd')
      "
    >
      <template #actions>
        <el-button
          type="primary"
          icon="el-icon-refresh-right"
          v-hasPermi="['system:oauthKey:rotate']"
          @click="openRotation"
        >
          {{ $t('oauth:key.scheduleKeyRotation') }}
        </el-button>
      </template>

      <template #context>
        <div class="key-overview">
          <div
            class="overview-state"
            :class="{ 'is-disabled': !ready }"
          >
            <span class="overview-icon"
              ><i
                class="el-icon el-icon-lock"
                aria-hidden="true"
              ></i
            ></span>
            <div>
              <small>{{ $t('oauth:key.authenticationService') }}</small>
              <strong>{{ serviceStatus.title }}</strong>
              <p>{{ serviceStatus.description }}</p>
            </div>
          </div>
          <div
            class="overview-divider"
            aria-hidden="true"
          >
            <i
              class="el-icon el-icon-right"
              aria-hidden="true"
            ></i>
          </div>
          <div class="overview-state">
            <span class="overview-icon is-success"
              ><i
                class="el-icon el-icon-key"
                aria-hidden="true"
              ></i
            ></span>
            <div>
              <small>{{ $t('oauth:key.currentSigningKey') }}</small>
              <strong>{{ activeKey?.kid || $t('oauth:key.notActivated') }}</strong>
              <p>
                {{
                  activeKey
                    ? $t('oauth:key.issuingSince', {
                        time: parseTime(activeKey.signingStartAt) || $t('oauth:key.scheduledTime'),
                      })
                    : $t('oauth:key.firstActivateAKeyWhosePublicKeyHasBeenPublished')
                }}
              </p>
            </div>
          </div>
          <div
            class="overview-divider"
            aria-hidden="true"
          >
            <i
              class="el-icon el-icon-right"
              aria-hidden="true"
            ></i>
          </div>
          <div class="overview-state">
            <span class="overview-icon is-next"
              ><i
                class="el-icon el-icon-time"
                aria-hidden="true"
              ></i
            ></span>
            <div>
              <small>{{ $t('oauth:key.nextRotation') }}</small>
              <strong>{{ nextKey?.kid || $t('oauth:key.notScheduled') }}</strong>
              <p>
                {{
                  nextKey
                    ? $t('oauth:key.scheduledAt', {
                        time:
                          parseTime(nextKey.signingStartAt) ||
                          $t('oauth:key.timePendingConfirmation'),
                      })
                    : $t('oauth:key.scheduleRotationBeforeTheCurrentKeyExpires')
                }}
              </p>
            </div>
          </div>
        </div>
      </template>

      <template #toolbar>
        <span class="result-count"
          >{{ $t('system:notice.total') }} <strong>{{ total }}</strong>
          {{ $t('oauth:key.keys') }}</span
        >
        <right-toolbar
          :show-search="false"
          @queryTable="getList"
        />
      </template>

      <el-table
        v-loading="loading"
        :data="rows"
        row-key="kid"
      >
        <el-table-column
          :label="$t('oauth:key.key')"
          min-width="250"
        >
          <template #default="scope">
            <div class="key-cell">
              <span
                class="key-mark"
                :class="`is-${scope.row.status}`"
                ><i
                  class="el-icon el-icon-key"
                  aria-hidden="true"
                ></i
              ></span>
              <span>
                <strong>{{ scope.row.kid }}</strong>
                <small>{{ scope.row.fingerprint || publicFingerprint(scope.row.publicJwk) }}</small>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:key.currentPurpose')"
          min-width="190"
        >
          <template #default="scope">
            <div class="role-cell">
              <el-tag :type="statusType(scope.row.status)">{{
                statusText(scope.row.status)
              }}</el-tag
              ><small>{{ roleText(scope.row.status) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:key.signingMethod')"
          width="110"
          align="center"
        >
          <template #default="scope"
            ><el-tag
              type="info"
              effect="plain"
              >{{ scope.row.alg }}</el-tag
            ></template
          >
        </el-table-column>
        <el-table-column
          :label="$t('oauth:key.lifecycle')"
          min-width="280"
        >
          <template #default="scope">
            <div class="timeline-cell">
              <span
                ><small>{{ $t('oauth:key.publishedToApplications') }}</small
                >{{ parseTime(scope.row.publishAt) || '—' }}</span
              >
              <span
                ><small>{{
                  scope.row.status === 'pending'
                    ? $t('oauth:key.scheduledSigningStart')
                    : $t('oauth:key.signingStarts')
                }}</small
                >{{ parseTime(scope.row.signingStartAt) || '—' }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:next')"
          min-width="220"
        >
          <template #default="scope">
            <div class="next-action">
              <strong>{{ nextActionText(scope.row) }}</strong
              ><small>{{ nextActionTime(scope.row) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:actions')"
          fixed="right"
          width="150"
          align="center"
        >
          <template #default="scope">
            <div class="table-actions">
              <el-tooltip
                v-if="scope.row.status === 'pending' && activationDisabledReason(scope.row)"
                :content="activationDisabledReason(scope.row)"
                placement="top"
              >
                <span>
                  <el-button
                    type="text"
                    icon="el-icon-time"
                    disabled
                    v-hasPermi="['system:oauthKey:activate']"
                  >
                    {{ $t('oauth:key.awaitingPublication') }}
                  </el-button>
                </span>
              </el-tooltip>
              <el-button
                type="text"
                v-else-if="scope.row.status === 'pending'"
                icon="el-icon-circle-check"
                v-hasPermi="['system:oauthKey:activate']"
                @click="activate(scope.row)"
                >{{ $t('oauth:key.activate') }}</el-button
              >
              <el-button
                class="oauth-button-warning"
                type="text"
                v-if="scope.row.status === 'active'"
                icon="el-icon-video-pause"
                v-hasPermi="['system:oauthKey:retire']"
                @click="retire(scope.row)"
                >{{ $t('oauth:key.stopSigning') }}</el-button
              >
              <el-button
                class="oauth-button-danger"
                type="text"
                v-if="scope.row.status === 'retired'"
                icon="el-icon-delete"
                v-hasPermi="['system:oauthKey:retire']"
                @click="handleDelete(scope.row)"
                >{{ $t('common:deleteRecord') }}</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('oauth:key.noSigningKeyPrepared')">
            <el-button
              type="primary"
              v-hasPermi="['system:oauthKey:rotate']"
              @click="openRotation"
              >{{ $t('oauth:key.createTheFirstKey') }}</el-button
            >
          </el-empty>
        </template>
      </el-table>
      <pagination
        v-show="total > 0"
        :page.sync="query.pageNum"
        :limit.sync="query.pageSize"
        :total="total"
        @pagination="getList"
      />
    </PageFrame>

    <el-dialog
      custom-class="oauth-overlay"
      :visible.sync="open"
      :title="$t('oauth:key.scheduleSigningKeyRotation')"
      width="min(780px, calc(100vw - 48px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <div
        class="rotation-preview"
        :aria-label="$t('oauth:key.keyRotationProcess')"
      >
        <div>
          <span>1</span><strong>{{ $t('oauth:key.publishFirst') }}</strong
          ><small>{{ $t('oauth:key.applicationsObtainThePublicKeyInAdvance') }}</small>
        </div>
        <i aria-hidden="true" />
        <div>
          <span>2</span><strong>{{ $t('oauth:key.thenTakeOverSigning') }}</strong
          ><small>{{ $t('oauth:key.newCredentialsUseTheNewKey') }}</small>
        </div>
        <i aria-hidden="true" />
        <div>
          <span>3</span><strong>{{ $t('oauth:key.retainTheOldPublicKey') }}</strong
          ><small>{{ $t('oauth:key.oldCredentialsRemainVerifiableUntilTheyExpire') }}</small>
        </div>
      </div>

      <el-form
        :validate-on-rule-change="false"
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="160px"
        class="rotation-form"
      >
        <section class="form-section">
          <h3>{{ $t('oauth:key.rotationIdentifier') }}</h3>
          <p>
            {{ $t('oauth:key.giveThisRotationAnIdentifiableReferenceToHelpLocateItInLogs') }}
          </p>
          <el-form-item prop="kid">
            <template #label
              ><FieldLabel
                :label="$t('oauth:key.keyID')"
                :help="$t('oauth:key.aUniqueIdentifierInThePublicKeyListConsiderIncludingTheYear')"
            /></template>
            <el-input
              v-model="form.kid"
              maxlength="128"
              :placeholder="$t('oauth:key.forExample202609Primary')"
            />
          </el-form-item>
          <el-form-item>
            <template #label
              ><FieldLabel
                :label="$t('oauth:key.signingMethod')"
                :help="
                  $t(
                    'oauth:key.rS256IsAWidelyCompatibleAsymmetricSigningAlgorithmApplicationsReceiveOnlyThe'
                  )
                "
            /></template>
            <div class="algorithm-value">
              <strong>RS256</strong
              ><span>{{ $t('oauth:key.privateKeysAreNeverShownOrExportedOnThisPage') }}</span>
            </div>
          </el-form-item>
        </section>

        <section class="form-section">
          <h3>{{ $t('oauth:key.activationSchedule') }}</h3>
          <p>
            {{ $t('oauth:key.publishThePublicKeyBeforeUsingItToSignSoApplicationsHave') }}
          </p>
          <el-form-item prop="publishAt">
            <template #label
              ><FieldLabel
                :label="$t('oauth:key.publicKeyPublicationTime')"
                :help="$t('oauth:key.fromThisTimeApplicationsCanObtainTheNewPublicKeyFromThe')"
            /></template>
            <BusinessDateTimePicker
              v-model="form.publishAt"
              :label="$t('oauth:key.publicKeyPublicationTime')"
            />
          </el-form-item>
          <el-form-item prop="activateAt">
            <template #label
              ><FieldLabel
                :label="$t('oauth:key.signingStartTime')"
                :help="$t('oauth:key.fromThisTimeNewlyIssuedIdentityAndAccessTokensUseTheNew')"
            /></template>
            <BusinessDateTimePicker
              v-model="form.activateAt"
              :label="$t('oauth:key.signingStartTime')"
            />
          </el-form-item>
          <el-form-item>
            <template #label
              ><FieldLabel
                :label="$t('oauth:key.changeDescription')"
                :help="$t('oauth:key.recordTheReasonForRotationOrARelatedTicketForAuditingThis')"
            /></template>
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              :placeholder="$t('oauth:key.forExampleRoutineQuarterlyRotationRelatedTicketSEC1024')"
            />
          </el-form-item>
        </section>
      </el-form>
      <template #footer>
        <el-button @click="open = false">{{ $t('common:cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="rotate"
          >{{ $t('oauth:key.createRotationPlan') }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'OAuthKey' }
</script>

<script setup>
import { computed, getCurrentInstance, nextTick, reactive, ref } from 'vue'
import {
  activateOidcKey,
  deleteOidcKey,
  listOidcKeys,
  retireOidcKey,
  rotateOidcKey,
} from '@/api/system/oauthSession'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel.vue'
import PageFrame from '@/components/OAuthWorkspace/PageFrame.vue'
import { parseTime } from '@/utils/ruoyi'
import BusinessDateTimePicker from '@/components/BusinessDateTimePicker'
import { serializeTimeFieldsForSubmit } from '@/utils/time'

const { proxy } = getCurrentInstance()
const rows = ref([])
const total = ref(0)
const enabled = ref(true)
const ready = ref(false)
const loading = ref(false)
const saving = ref(false)
const open = ref(false)
const query = reactive({ pageNum: 1, pageSize: 10 })
const form = reactive({
  alg: 'RS256',
  kid: '',
  publishAt: '',
  activateAt: '',
  remark: '',
})

const activeKey = computed(() => rows.value.find((item) => item.status === 'active'))
const serviceStatus = computed(() => {
  if (!enabled.value) {
    return {
      title: t('oauth:key.notEnabled'),
      description: t('oauth:key.youCanPrepareKeysFirstAndStartIssuingCredentialsWhenTheService'),
    }
  }
  if (!ready.value) {
    return {
      title: t('oauth:key.waitingForSigningKeyInitialization'),
      description: t(
        'oauth:key.theAdminConsoleRemainsAvailableAuthenticationEndpointsWillTemporarilyRejectRequests'
      ),
    }
  }
  return {
    title: t('oauth:key.enabledAndReadyForAuthentication'),
    description: t('oauth:key.identityCredentialsAreSignedWithTheCurrentSigningKey'),
  }
})
const nextKey = computed(
  () =>
    rows.value
      .filter((item) => item.status === 'pending')
      .sort((left, right) =>
        String(left.signingStartAt || '').localeCompare(String(right.signingStartAt || ''))
      )[0]
)

const validateActivationTime = (_rule, value, callback) => {
  if (!value) {
    return callback(new Error(t('oauth:key.chooseASigningStartTime')))
  }
  callback()
}

const rules = {
  kid: [
    {
      required: true,
      message: () => t('oauth:key.enterAnIdentifiableKeyID'),
      trigger: 'blur',
    },
    {
      pattern: /^[A-Za-z0-9._-]+$/,
      message: () => t('oauth:key.useOnlyLettersDigitsPeriodsHyphensAndUnderscores'),
      trigger: 'blur',
    },
  ],
  publishAt: [
    {
      required: true,
      message: () => t('oauth:key.chooseAPublicKeyPublicationTime'),
      trigger: 'change',
    },
  ],
  activateAt: [{ validator: validateActivationTime, trigger: 'change' }],
}

/** 获取签名密钥状态名称 */
function statusText(value) {
  return (
    {
      pending: t('oauth:key.awaitingActivation'),
      active: t('oauth:key.signing'),
      retiring: t('oauth:key.verifyingOldCredentials'),
      retired: t('oauth:key.retired'),
      compromised: t('oauth:key.possiblyCompromised'),
    }[value] || value
  )
}

/** 获取签名密钥状态标签类型 */
function statusType(value) {
  return (
    {
      pending: 'primary',
      active: 'success',
      retiring: 'warning',
      retired: 'info',
      compromised: 'danger',
    }[value] || 'info'
  )
}

/** 获取密钥当前承担的签名或验证用途 */
function roleText(value) {
  return (
    {
      pending: t('oauth:key.publicKeyPublishedNotYetIssuingNewCredentials'),
      active: t('oauth:key.usedToIssueNewIdentityAndAccessCredentials'),
      retiring: t('oauth:key.noLongerIssuingNewCredentialsOnlyVerifyingUnexpiredOldCredentials'),
      retired: t('oauth:key.removedFromThePublicKeyList'),
      compromised: t('oauth:key.markedAsUntrustedCompleteEmergencyRotationAsSoonAsPossible'),
    }[value] || t('oauth:key.unknownStatusInformation')
  )
}

/** 缩略显示RSA公钥模数 */
function publicFingerprint(jwk) {
  if (!jwk?.n) {
    return t('oauth:key.publicFingerprintUnavailable')
  }
  return t('oauth:key.publicFingerprintRSAValue', { value0: jwk.n.slice(0, 18) })
}

/** 获取密钥后续处理计划 */
function nextActionText(row) {
  return (
    {
      pending: t('oauth:key.waitingToStart'),
      active: t('oauth:key.stopSigningWhenTheNextKeyTakesOver'),
      retiring: t('oauth:key.waitingForAllOldCredentialsToExpire'),
      retired: t('oauth:key.metadataCanBeRemoved'),
      compromised: t('oauth:key.scheduleEmergencyRotationNow'),
    }[row.status] || t('oauth:key.noPlan')
  )
}

/** 显示密钥后续操作的时间条件 */
function nextActionTime(row) {
  if (row.status === 'pending') {
    return parseTime(row.signingStartAt) || t('oauth:key.manualActivationRequired')
  }
  if (['retiring', 'retired'].includes(row.status)) {
    return row.removeFromJwksAt
      ? t('oauth:key.earliestCleanupValue', { value0: parseTime(row.removeFromJwksAt) })
      : t('oauth:key.waitingForTheSafeVerificationWindowToEnd')
  }
  if (row.status === 'active') {
    return t('oauth:key.noAutomaticStopTimeIsSet')
  }
  return t('oauth:key.checkTheSecurityLogs')
}

/** 检查密钥是否已到允许启用的公开时间 */
function activationDisabledReason(row) {
  const publishAt = new Date(row.publishAt).getTime()
  if (!Number.isFinite(publishAt)) {
    return t('oauth:key.invalidPublicKeyPublicationTimeRefreshTheListAndTryAgain')
  }
  if (publishAt > Date.now()) {
    return t('oauth:key.thePublicKeyWillBePublishedAtValueItCanBeActivatedAfterThat', {
      value0: parseTime(row.publishAt),
    })
  }
  return ''
}

/** 查询签名密钥列表及认证服务状态 */
async function getList() {
  loading.value = true
  try {
    const response = await listOidcKeys(query)
    rows.value = response.rows || []
    total.value = response.total || 0
    enabled.value = response.enabled !== false
    ready.value = response.ready === true
  } finally {
    loading.value = false
  }
}

/** 初始化并打开密钥轮换表单 */
function openRotation() {
  Object.assign(form, {
    alg: 'RS256',
    kid: '',
    publishAt: '',
    activateAt: '',
    remark: '',
  })
  open.value = true
  nextTick(() => proxy.$refs.formRef?.clearValidate())
}

/** 校验时间并提交密钥轮换计划 */
async function rotate() {
  await proxy.$refs.formRef.validate()
  const payload = await serializeTimeFieldsForSubmit(form, ['publishAt', 'activateAt'])
  if (!payload) {
    return
  }
  if (payload.activateAt && new Date(payload.activateAt) < new Date(payload.publishAt)) {
    proxy.$modal.msgError(t('oauth:key.signingCannotStartBeforePublicKeyPublication'))
    return
  }
  saving.value = true
  try {
    await rotateOidcKey(payload)
    proxy.$modal.msgSuccess(
      t('oauth:key.rotationScheduledTheNewPublicKeyWillBePublishedFirstAsPlanned')
    )
    open.value = false
    await getList()
  } finally {
    saving.value = false
  }
}

/** 确认后启用签名密钥 */
async function activate(row) {
  const disabledReason = activationDisabledReason(row)
  if (disabledReason) {
    proxy.$modal.msgWarning(disabledReason)
    return
  }
  const signingStartAt = new Date(row.signingStartAt).getTime()
  const scheduleNotice =
    Number.isFinite(signingStartAt) && signingStartAt > Date.now()
      ? t('oauth:key.thisKeyWasScheduledToStartSigningAtValueThisActionActivatesItEarly', {
          value0: parseTime(row.signingStartAt),
        })
      : t('oauth:key.itWillImmediatelyTakeOverIssuanceOfNewCredentials')
  await proxy.$modal.confirm(
    t(
      'oauth:key.activateKeyValueValueTheCurrentSigningKeyWillEnterTheOldCredentialVerificationPeriod',
      { value0: row.kid, value1: scheduleNotice }
    )
  )
  await activateOidcKey(row.kid)
  proxy.$modal.msgSuccess(t('oauth:key.theNewSigningKeyIsActive'))
  await getList()
}

/** 停止使用密钥签发新令牌 */
async function retire(row) {
  await proxy.$modal.confirm(
    t('oauth:key.stopIssuingNewCredentialsWithKeyValueItsPublicKeyWillRemainAvailableFor', {
      value0: row.kid,
    })
  )
  await retireOidcKey(row.kid)
  proxy.$modal.msgSuccess(t('oauth:key.theKeyHasStoppedSigningAndIsNowUsedOnlyToVerify'))
  await getList()
}

/** 删除按钮操作 */
async function handleDelete(row) {
  await proxy.$modal.confirm(
    t('oauth:key.deleteTheRecordForKeyValueConfirmThatEveryCredentialItSignedHasExpired', {
      value0: row.kid,
    })
  )
  await deleteOidcKey(row.kid)
  proxy.$modal.msgSuccess(t('oauth:key.keyRecordDeleted'))
  await getList()
}

getList()
</script>

<style scoped>
.key-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr) 32px minmax(0, 1fr);
  align-items: center;
}

.overview-state {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}

.overview-icon {
  display: grid;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  color: var(--oauth-color-primary);
  background: var(--oauth-color-primary-light-9);
  border-radius: 11px;
  font-size: 18px;
  place-items: center;
}

.overview-icon.is-success {
  color: var(--oauth-color-success);
  background: var(--oauth-color-success-light-9);
}

.overview-icon.is-next {
  color: var(--oauth-color-warning-dark-2);
  background: var(--oauth-color-warning-light-9);
}

.overview-state.is-disabled .overview-icon {
  color: var(--oauth-color-warning-dark-2);
  background: var(--oauth-color-warning-light-9);
}

.overview-state > div {
  min-width: 0;
}

.overview-state small,
.overview-state strong,
.overview-state p {
  display: block;
}

.overview-state small {
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.overview-state strong {
  margin-top: 3px;
  overflow: hidden;
  color: var(--oauth-text-color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-state p {
  margin: 4px 0 0;
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.overview-divider {
  color: var(--oauth-border-color-dark);
  text-align: center;
}

.result-count {
  color: var(--oauth-text-color-regular);
  font-size: 13px;
}

.result-count strong {
  color: var(--oauth-text-color-primary);
  font-size: 16px;
}

.key-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.key-mark {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  color: var(--oauth-color-primary);
  background: var(--oauth-color-primary-light-9);
  border-radius: 9px;
  place-items: center;
}

.key-mark.is-active {
  color: var(--oauth-color-success);
  background: var(--oauth-color-success-light-9);
}

.key-mark.is-retiring {
  color: var(--oauth-color-warning-dark-2);
  background: var(--oauth-color-warning-light-9);
}

.key-mark.is-retired {
  color: var(--oauth-text-color-secondary);
  background: var(--oauth-fill-color-light);
}

.key-mark.is-compromised {
  color: var(--oauth-color-danger);
  background: var(--oauth-color-danger-light-9);
}

.key-cell strong,
.key-cell small,
.role-cell small,
.next-action strong,
.next-action small {
  display: block;
}

.key-cell strong {
  color: var(--oauth-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.key-cell small,
.role-cell small,
.next-action small {
  margin-top: 4px;
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.timeline-cell {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.timeline-cell span {
  color: var(--oauth-text-color-primary);
  font-size: 13px;
}

.timeline-cell small {
  display: block;
  margin-bottom: 4px;
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.next-action strong {
  color: var(--oauth-text-color-primary);
  font-size: 13px;
}

.rotation-preview {
  display: grid;
  grid-template-columns: 1fr 36px 1fr 36px 1fr;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--oauth-fill-color-light);
  border-radius: 9px;
}

.rotation-preview > div {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  column-gap: 9px;
  align-items: center;
}

.rotation-preview span {
  display: grid;
  grid-row: 1 / span 2;
  width: 30px;
  height: 30px;
  color: var(--oauth-color-primary);
  background: var(--oauth-color-primary-light-9);
  border-radius: 50%;
  font-weight: 700;
  place-items: center;
}

.rotation-preview strong,
.rotation-preview small {
  display: block;
}

.rotation-preview strong {
  color: var(--oauth-text-color-primary);
  font-size: 13px;
}

.rotation-preview small {
  margin-top: 3px;
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

.rotation-preview i {
  height: 1px;
  background: var(--oauth-border-color);
}

.form-section + .form-section {
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px solid var(--oauth-border-color-lighter);
}

.form-section h3 {
  margin: 0;
  color: var(--oauth-text-color-primary);
  font-size: 16px;
}

.form-section > p {
  margin: 6px 0 18px;
  color: var(--oauth-text-color-secondary);
  font-size: 13px;
}

.algorithm-value {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 32px;
}

.algorithm-value strong {
  padding: 3px 9px;
  color: var(--oauth-color-primary);
  background: var(--oauth-color-primary-light-9);
  border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.algorithm-value span {
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 900px) {
  .key-overview {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .overview-divider {
    display: none;
  }
}

@media (max-width: 640px) {
  .rotation-form :deep(.el-form-item) {
    display: block;
  }

  .rotation-form :deep(.el-form-item__label) {
    display: flex;
    width: auto !important;
    margin-bottom: 7px;
  }

  .rotation-preview {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .rotation-preview i {
    display: none;
  }
}
</style>
