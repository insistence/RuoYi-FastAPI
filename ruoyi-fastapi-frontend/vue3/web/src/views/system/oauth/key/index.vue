<template>
  <div class="oauth-route-page">
    <PageFrame
      :section="$t('monitor:securityOperations')"
      :title="$t('oauth:signingKeys')"
      :description="$t('oauth:manageSigningKeysUsedToProveTheAuthenticityOfIdentity')"
    >
      <template #actions>
        <el-button
          type="primary"
          icon="RefreshRight"
          v-hasPermi="['system:oauthKey:rotate']"
          @click="openRotation"
        >
          {{ $t('oauth:scheduleKeyRotation') }}</el-button
        >
      </template>

      <template #context>
        <div class="key-overview">
          <div
            class="overview-state"
            :class="{ 'is-disabled': !ready }"
          >
            <span class="overview-icon"
              ><el-icon><Lock /></el-icon
            ></span>
            <div>
              <small>{{ $t('oauth:authenticationService') }}</small>
              <strong>{{ serviceStatus.title }}</strong>
              <p>{{ serviceStatus.description }}</p>
            </div>
          </div>
          <div
            class="overview-divider"
            aria-hidden="true"
          >
            <el-icon><Right /></el-icon>
          </div>
          <div class="overview-state">
            <span class="overview-icon is-success"
              ><el-icon><Key /></el-icon
            ></span>
            <div>
              <small>{{ $t('oauth:currentSigningKey') }}</small>
              <strong>{{ activeKey?.kid || $t('oauth:notActivated') }}</strong>
              <p>
                {{
                  activeKey
                    ? $t('oauth:issueNewCredentialsFromValue', {
                        value0: parseTime(activeKey.signingStartAt) || '计划时间',
                      })
                    : $t('oauth:firstActivateAKeyWhosePublicKeyHasBeenPublished')
                }}
              </p>
            </div>
          </div>
          <div
            class="overview-divider"
            aria-hidden="true"
          >
            <el-icon><Right /></el-icon>
          </div>
          <div class="overview-state">
            <span class="overview-icon is-next"
              ><el-icon><Clock /></el-icon
            ></span>
            <div>
              <small>{{ $t('oauth:nextRotation') }}</small>
              <strong>{{ nextKey?.kid || $t('oauth:notScheduled') }}</strong>
              <p>
                {{
                  nextKey
                    ? $t('oauth:scheduledToTakeOverSigningAtValue', {
                        value0: parseTime(nextKey.signingStartAt) || '待确认时间',
                      })
                    : $t('oauth:scheduleRotationBeforeTheCurrentKeyExpires')
                }}
              </p>
            </div>
          </div>
        </div>
      </template>

      <template #toolbar>
        <span class="result-count"
          >{{ $t('system:total') }}<strong>{{ total }}</strong> {{ $t('oauth:keys') }}</span
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
          :label="$t('oauth:key')"
          min-width="250"
        >
          <template #default="scope">
            <div class="key-cell">
              <span
                class="key-mark"
                :class="`is-${scope.row.status}`"
                ><el-icon><Key /></el-icon
              ></span>
              <span>
                <strong>{{ scope.row.kid }}</strong>
                <small>{{ scope.row.fingerprint || publicFingerprint(scope.row.publicJwk) }}</small>
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:currentPurpose')"
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
          :label="$t('oauth:signingMethod')"
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
          :label="$t('oauth:lifecycle')"
          min-width="280"
        >
          <template #default="scope">
            <div class="timeline-cell">
              <span
                ><small>{{ $t('oauth:publishedToApplications') }}</small
                >{{ parseTime(scope.row.publishAt) || '—' }}</span
              >
              <span
                ><small>{{
                  scope.row.status === 'pending'
                    ? $t('oauth:scheduledSigningStart')
                    : $t('oauth:signingStarts')
                }}</small
                >{{ parseTime(scope.row.signingStartAt) || '—' }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('oauth:next')"
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
          :label="$t('system:actions')"
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
                    link
                    type="primary"
                    icon="Clock"
                    disabled
                    v-hasPermi="['system:oauthKey:activate']"
                  >
                    {{ $t('oauth:awaitingPublication') }}</el-button
                  >
                </span>
              </el-tooltip>
              <el-button
                v-else-if="scope.row.status === 'pending'"
                link
                type="primary"
                icon="CircleCheck"
                v-hasPermi="['system:oauthKey:activate']"
                @click="activate(scope.row)"
                >{{ $t('oauth:activate') }}</el-button
              >
              <el-button
                v-if="scope.row.status === 'active'"
                link
                type="warning"
                icon="VideoPause"
                v-hasPermi="['system:oauthKey:retire']"
                @click="retire(scope.row)"
                >{{ $t('oauth:stopSigning') }}</el-button
              >
              <el-button
                v-if="scope.row.status === 'retired'"
                link
                type="danger"
                icon="Delete"
                v-hasPermi="['system:oauthKey:retire']"
                @click="handleDelete(scope.row)"
                >{{ $t('monitor:deleteRecord') }}</el-button
              >
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="$t('oauth:noSigningKeyPrepared')">
            <el-button
              type="primary"
              v-hasPermi="['system:oauthKey:rotate']"
              @click="openRotation"
              >{{ $t('oauth:createTheFirstKey') }}</el-button
            >
          </el-empty>
        </template>
      </el-table>
      <pagination
        v-show="total > 0"
        v-model:page="query.pageNum"
        v-model:limit="query.pageSize"
        :total="total"
        @pagination="getList"
      />
    </PageFrame>

    <el-dialog
      v-model="open"
      :title="$t('oauth:scheduleSigningKeyRotation')"
      width="min(780px, calc(100vw - 48px))"
      append-to-body
      :close-on-click-modal="false"
    >
      <div
        class="rotation-preview"
        :aria-label="$t('oauth:keyRotationProcess')"
      >
        <div>
          <span>1</span><strong>{{ $t('oauth:publishFirst') }}</strong
          ><small>{{ $t('oauth:applicationsObtainThePublicKeyInAdvance') }}</small>
        </div>
        <i aria-hidden="true" />
        <div>
          <span>2</span><strong>{{ $t('oauth:thenTakeOverSigning') }}</strong
          ><small>{{ $t('oauth:newCredentialsUseTheNewKey') }}</small>
        </div>
        <i aria-hidden="true" />
        <div>
          <span>3</span><strong>{{ $t('oauth:retainTheOldPublicKey') }}</strong
          ><small>{{ $t('oauth:oldCredentialsRemainVerifiableUntilTheyExpire') }}</small>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :validate-on-rule-change="false"
        label-width="160px"
        class="rotation-form"
      >
        <section class="form-section">
          <h3>{{ $t('oauth:rotationIdentifier') }}</h3>
          <p>{{ $t('oauth:giveThisRotationAnIdentifiableReferenceToHelpLocateIt') }}</p>
          <el-form-item prop="kid">
            <template #label
              ><FieldLabel
                :label="$t('oauth:keyID')"
                :help="$t('oauth:uniqueIDInThePublicKeySetIncludeTheYear')"
            /></template>
            <el-input
              v-model="form.kid"
              maxlength="128"
              :placeholder="$t('oauth:forExample202609Primary')"
            />
          </el-form-item>
          <el-form-item>
            <template #label
              ><FieldLabel
                :label="$t('oauth:signingMethod')"
                :help="$t('oauth:rS256IsAWidelySupportedAsymmetricSigningAlgorithmAppsReceive')"
            /></template>
            <div class="algorithm-value">
              <strong>RS256</strong
              ><span>{{ $t('oauth:privateKeysAreNeverShownOrExportedOnThisPage') }}</span>
            </div>
          </el-form-item>
        </section>

        <section class="form-section">
          <h3>{{ $t('oauth:activationSchedule') }}</h3>
          <p>{{ $t('oauth:publishThePublicKeyBeforeUsingItToSignSo') }}</p>
          <el-form-item prop="publishAt">
            <template #label
              ><FieldLabel
                :label="$t('oauth:publicKeyPublicationTime')"
                :help="$t('oauth:fromThisTimeAppsCanRetrieveTheNewPublicKey')"
            /></template>
            <BusinessDateTimePicker
              v-model="form.publishAt"
              :label="$t('oauth:publicKeyPublicationTime')"
            />
          </el-form-item>
          <el-form-item prop="activateAt">
            <template #label
              ><FieldLabel
                :label="$t('oauth:signingStartTime')"
                :help="$t('oauth:fromThisTimeNewIdentityAndAccessTokensUseThe')"
            /></template>
            <BusinessDateTimePicker
              v-model="form.activateAt"
              :label="$t('oauth:signingStartTime')"
            />
          </el-form-item>
          <el-form-item>
            <template #label
              ><FieldLabel
                :label="$t('oauth:changeDescription')"
                :help="$t('oauth:recordTheRotationReasonOrRelatedTicketForAuditingThis')"
            /></template>
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              :placeholder="$t('oauth:forExampleRoutineQuarterlyRotationRelatedTicketSEC1024')"
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
          >{{ $t('oauth:createRotationPlan') }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="OAuthKey">
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
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
useLocaleForm(computed(() => proxy.$refs.formRef))
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
      get title() {
        return t('oauth:notEnabled')
      },
      get description() {
        return t('oauth:youCanPrepareKeysFirstAndStartIssuingCredentialsWhen')
      },
    }
  }
  if (!ready.value) {
    return {
      get title() {
        return t('oauth:waitingForSigningKeyInitialization')
      },
      get description() {
        return t(
          'oauth:theAdminConsoleRemainsAvailableAuthenticationEndpointsWillTemporarilyReject'
        )
      },
    }
  }
  return {
    get title() {
      return t('oauth:enabledAndReadyForAuthentication')
    },
    get description() {
      return t('oauth:identityCredentialsAreSignedWithTheCurrentSigningKey')
    },
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
    return callback(new Error(t('oauth:chooseASigningStartTime')))
  }
  callback()
}

const rules = {
  kid: [
    {
      required: true,
      get message() {
        return t('oauth:enterAnIdentifiableKeyID')
      },
      trigger: 'blur',
    },
    {
      pattern: /^[A-Za-z0-9._-]+$/,
      get message() {
        return t('oauth:useOnlyLettersDigitsPeriodsHyphensAndUnderscores')
      },
      trigger: 'blur',
    },
  ],
  publishAt: [
    {
      required: true,
      get message() {
        return t('oauth:chooseAPublicKeyPublicationTime')
      },
      trigger: 'change',
    },
  ],
  activateAt: [{ validator: validateActivationTime, trigger: 'change' }],
}

/** 获取签名密钥状态名称 */
function statusText(value) {
  return (
    {
      get pending() {
        return t('oauth:awaitingActivation')
      },
      get active() {
        return t('oauth:signing')
      },
      get retiring() {
        return t('oauth:verifyingOldCredentials')
      },
      get retired() {
        return t('oauth:retired')
      },
      get compromised() {
        return t('oauth:possiblyCompromised')
      },
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
      get pending() {
        return t('oauth:publicKeyPublishedNotYetIssuingNewCredentials')
      },
      get active() {
        return t('oauth:usedToIssueNewIdentityAndAccessCredentials')
      },
      get retiring() {
        return t('oauth:noLongerIssuingNewCredentialsOnlyVerifyingUnexpiredOldCredentials')
      },
      get retired() {
        return t('oauth:removedFromThePublicKeyList')
      },
      get compromised() {
        return t('oauth:markedAsUntrustedCompleteEmergencyRotationAsSoonAsPossible')
      },
    }[value] || t('oauth:unknownStatusInformation')
  )
}

/** 缩略显示RSA公钥模数 */
function publicFingerprint(jwk) {
  if (!jwk?.n) {
    return t('oauth:publicFingerprintUnavailable')
  }
  return t('oauth:publicFingerprintRSAValue', { arg0: jwk.n.slice(0, 18) })
}

/** 获取密钥后续处理计划 */
function nextActionText(row) {
  return (
    {
      get pending() {
        return t('oauth:waitingToStart')
      },
      get active() {
        return t('oauth:stopSigningWhenTheNextKeyTakesOver')
      },
      get retiring() {
        return t('oauth:waitingForAllOldCredentialsToExpire')
      },
      get retired() {
        return t('oauth:metadataCanBeRemoved')
      },
      get compromised() {
        return t('oauth:scheduleEmergencyRotationNow')
      },
    }[row.status] || t('oauth:noPlan')
  )
}

/** 显示密钥后续操作的时间条件 */
function nextActionTime(row) {
  if (row.status === 'pending') {
    return parseTime(row.signingStartAt) || t('oauth:manualActivationRequired')
  }
  if (['retiring', 'retired'].includes(row.status)) {
    return row.removeFromJwksAt
      ? t('oauth:earliestCleanupValue', { arg0: parseTime(row.removeFromJwksAt) })
      : t('oauth:waitingForTheSafeVerificationWindowToEnd')
  }
  if (row.status === 'active') {
    return t('oauth:noAutomaticStopTimeIsSet')
  }
  return t('oauth:checkTheSecurityLogs')
}

/** 检查密钥是否已到允许启用的公开时间 */
function activationDisabledReason(row) {
  const publishAt = new Date(row.publishAt).getTime()
  if (!Number.isFinite(publishAt)) {
    return t('oauth:invalidPublicKeyPublicationTimeRefreshTheListAndTry')
  }
  if (publishAt > Date.now()) {
    return t('oauth:thePublicKeyWillBePublishedAtValueItCan', { arg0: parseTime(row.publishAt) })
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
    proxy.$modal.msgError(t('oauth:signingCannotStartBeforePublicKeyPublication'))
    return
  }
  saving.value = true
  try {
    await rotateOidcKey(payload)
    proxy.$modal.msgSuccess(t('oauth:rotationScheduledTheNewPublicKeyWillBePublishedFirst'))
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
      ? t('oauth:thisKeyWasScheduledToBeginSigningAtValueThis', {
          arg0: parseTime(row.signingStartAt),
        })
      : t('oauth:itWillImmediatelyTakeOverIssuanceOfNewCredentials')
  await proxy.$modal.confirm(
    t('oauth:startUsingKeyValueValueTheCurrentSigningKeyWillEnter', {
      kid: row.kid,
      scheduleNotice,
    })
  )
  await activateOidcKey(row.kid)
  proxy.$modal.msgSuccess(t('oauth:theNewSigningKeyIsActive'))
  await getList()
}

/** 停止使用密钥签发新令牌 */
async function retire(row) {
  await proxy.$modal.confirm(
    t('oauth:stopIssuingNewCredentialsWithKeyValueItsPublicKey', { kid: row.kid })
  )
  await retireOidcKey(row.kid)
  proxy.$modal.msgSuccess(t('oauth:theKeyHasStoppedSigningAndIsNowUsedOnly'))
  await getList()
}

/** 删除按钮操作 */
async function handleDelete(row) {
  await proxy.$modal.confirm(
    t('oauth:deleteTheRecordForKeyValueMakeSureAllCredentials', { kid: row.kid })
  )
  await deleteOidcKey(row.kid)
  proxy.$modal.msgSuccess(t('oauth:keyRecordDeleted'))
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
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 11px;
  font-size: 18px;
  place-items: center;
}

.overview-icon.is-success {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.overview-icon.is-next {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}

.overview-state.is-disabled .overview-icon {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
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
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.overview-state strong {
  margin-top: 3px;
  overflow: hidden;
  color: var(--el-text-color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-state p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.overview-divider {
  color: var(--el-border-color-dark);
  text-align: center;
}

.result-count {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.result-count strong {
  color: var(--el-text-color-primary);
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
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 9px;
  place-items: center;
}

.key-mark.is-active {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.key-mark.is-retiring {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}

.key-mark.is-retired {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.key-mark.is-compromised {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.key-cell strong,
.key-cell small,
.role-cell small,
.next-action strong,
.next-action small {
  display: block;
}

.key-cell strong {
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.key-cell small,
.role-cell small,
.next-action small {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.timeline-cell {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.timeline-cell span {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.timeline-cell small {
  display: block;
  margin-bottom: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.next-action strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.rotation-preview {
  display: grid;
  grid-template-columns: 1fr 36px 1fr 36px 1fr;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--el-fill-color-light);
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
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 50%;
  font-weight: 700;
  place-items: center;
}

.rotation-preview strong,
.rotation-preview small {
  display: block;
}

.rotation-preview strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.rotation-preview small {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.rotation-preview i {
  height: 1px;
  background: var(--el-border-color);
}

.form-section + .form-section {
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.form-section h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.form-section > p {
  margin: 6px 0 18px;
  color: var(--el-text-color-secondary);
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
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.algorithm-value span {
  color: var(--el-text-color-secondary);
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
