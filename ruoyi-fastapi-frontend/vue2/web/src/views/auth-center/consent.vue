<template>
  <AuthCenterShell
    :current-step="1"
    :expires-in="interaction.expiresIn"
    :application-name="interaction.client?.clientName"
    :application-id="interaction.client?.clientId"
  >
    <div
      v-loading="initializing"
      class="auth-flow"
    >
      <p class="panel-kicker">{{ $t('authCenter:messages.confirmPermissions') }}</p>
      <h2>{{ $t('authCenter:messages.confirmWhatToShare') }}</h2>
      <p class="panel-lead">
        <strong>{{ applicationName }}</strong>
        {{
          $t(
            'authCenter:messages.isRequestingTheInformationBelowRequiredInformationIsNeededForAccessOptional'
          )
        }}
      </p>
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />

      <el-checkbox-group
        v-model="selectedScopes"
        class="scope-selection"
      >
        <section
          v-if="requiredScopes.length"
          class="scope-group"
          aria-labelledby="required-scope-title"
        >
          <div class="group-heading">
            <div>
              <h3 id="required-scope-title">{{ $t('authCenter:messages.requiredForAccess') }}</h3>
              <p>{{ $t('authCenter:messages.decliningThesePermissionsPreventsAccessToTheApp') }}</p>
            </div>
            <span>{{ requiredScopes.length }} {{ $t('authCenter:messages.items') }}</span>
          </div>
          <div class="scope-list">
            <label
              v-for="scope in requiredScopes"
              :key="scope.scope"
              class="scope-item is-required"
            >
              <el-checkbox
                :label="scope.scope"
                disabled
              >
                {{ scope.name || scope.scope }}
              </el-checkbox>
              <span class="scope-copy">
                <span class="scope-title">
                  <strong>{{ scope.name || scope.scope }}</strong>
                  <el-tooltip
                    v-if="scope.name && scope.name !== scope.scope"
                    :content="$t('auth:scope.systemCode', { code: scope.scope })"
                    placement="top"
                  >
                    <i
                      class="el-icon el-icon-question"
                      aria-hidden="true"
                    ></i>
                  </el-tooltip>
                </span>
                <small>{{
                  scope.description ||
                  $t(
                    'authCenter:expression.usedToCompleteSignInOrProvideTheApplicationSCoreFunctions'
                  )
                }}</small>
              </span>
              <el-tag
                size="small"
                type="info"
                effect="plain"
                >{{ $t('authCenter:messages.required') }}</el-tag
              >
            </label>
          </div>
        </section>

        <section
          v-if="optionalScopes.length"
          class="scope-group"
          aria-labelledby="optional-scope-title"
        >
          <div class="group-heading">
            <div>
              <h3 id="optional-scope-title">{{ $t('authCenter:messages.yourChoice') }}</h3>
              <p>{{ $t('authCenter:messages.youCanUseTheAppWithoutSelectingThese') }}</p>
            </div>
            <span>{{
              $t('authCenter:consent.selectedCount', {
                selected: selectedOptionalCount,
                total: optionalScopes.length,
              })
            }}</span>
          </div>
          <div class="scope-list">
            <label
              v-for="scope in optionalScopes"
              :key="scope.scope"
              class="scope-item"
            >
              <el-checkbox :label="scope.scope">{{ scope.name || scope.scope }}</el-checkbox>
              <span class="scope-copy">
                <span class="scope-title">
                  <strong>{{ scope.name || scope.scope }}</strong>
                  <el-tooltip
                    v-if="scope.name && scope.name !== scope.scope"
                    :content="$t('auth:scope.systemCode', { code: scope.scope })"
                    placement="top"
                  >
                    <i
                      class="el-icon el-icon-question"
                      aria-hidden="true"
                    ></i>
                  </el-tooltip>
                </span>
                <small>{{
                  scope.description ||
                  $t('authCenter:expression.allowTheApplicationToUseThisInformationOrCapability')
                }}</small>
              </span>
              <el-tag
                v-if="scope.sensitive"
                size="small"
                type="warning"
                effect="plain"
                >{{ $t('authCenter:messages.sensitiveInformation') }}</el-tag
              >
            </label>
          </div>
        </section>
      </el-checkbox-group>

      <label class="remember-card">
        <el-checkbox v-model="rememberConsent" />
        <span>
          <strong>{{ $t('authCenter:messages.rememberMyChoices') }}</strong>
          <small>{{
            $t(
              'authCenter:messages.rememberingYourChoicesAvoidsRepeatedConfirmationForApprovedPermissionsARevocableAuthorization'
            )
          }}</small>
          <small v-if="selectedScopes.includes('offline_access')">{{
            $t('authCenter:messages.offlineAccessAllowsTheAppToRenewAccessWhenYouAreAway')
          }}</small>
        </span>
      </label>

      <div class="actions">
        <el-button
          size="medium"
          :disabled="submitting"
          @click="submit(false)"
          >{{ $t('authCenter:messages.declineAndReturn') }}</el-button
        >
        <el-button
          type="primary"
          size="medium"
          :loading="submitting"
          @click="submit(true)"
          >{{ $t('authCenter:messages.allow') }} {{ selectedScopes.length }}
          {{ $t('authCenter:messages.andContinue') }}</el-button
        >
      </div>
      <div
        v-if="policyUri"
        class="policy-link"
      >
        <el-link
          :href="policyUri"
          target="_blank"
          rel="noopener noreferrer"
          type="primary"
          >{{ $t('authCenter:messages.viewThisAppSPrivacyPolicy') }}</el-link
        >
      </div>
    </div>
  </AuthCenterShell>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'AuthCenterConsent' }
</script>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { getInteraction, submitInteractionConsent } from '@/api/authCenter'
import AuthCenterShell from './AuthCenterShell.vue'
import { useInteractionContext } from './useInteraction'

const { interactionId, csrfToken, goToAction, followServerRedirect } = useInteractionContext()
const router = getCurrentInstance().proxy.$router
const interaction = ref({})
const selectedScopes = ref([])
const rememberConsent = ref(false)
const initializing = ref(true)
const submitting = ref(false)
const errorMessage = ref('')

const applicationName = computed(
  () => interaction.value.client?.clientName || t('authCenter:messages.appRequestingSignIn')
)
const requiredScopes = computed(() =>
  (interaction.value.requestedScopes || []).filter((item) => item.required)
)
const optionalScopes = computed(() =>
  (interaction.value.requestedScopes || []).filter((item) => !item.required)
)
const selectedOptionalCount = computed(
  () => optionalScopes.value.filter((item) => selectedScopes.value.includes(item.scope)).length
)
const policyUri = computed(() => safeExternalUrl(interaction.value.client?.policyUri))

/** 校验可展示的客户端外部链接 */
function safeExternalUrl(value) {
  if (!value) {
    return ''
  }
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

/** 读取授权请求并初始化必选权限 */
async function initialize() {
  if (!interactionId.value || !csrfToken()) {
    return fatal(
      t('authCenter:messages.theAuthenticationRequestIsIncompleteReturnToTheAppAndSignIn')
    )
  }
  try {
    const response = await getInteraction(interactionId.value, csrfToken())
    interaction.value = response.data || {}
    if (interaction.value.nextAction !== 'consent') {
      return await goToAction(interaction.value.nextAction)
    }
    selectedScopes.value = requiredScopes.value.map((item) => item.scope)
  } catch (error) {
    fatal(error?.message || t('authCenter:messages.theAuthorizationRequestHasExpired'))
  } finally {
    initializing.value = false
  }
}

/** 提交授权决定和记忆选择 */
async function submit(approved) {
  submitting.value = true
  errorMessage.value = ''
  try {
    const required = requiredScopes.value.map((item) => item.scope)
    const approvedScopes = [...new Set([...required, ...selectedScopes.value])]
    const response = await submitInteractionConsent(interactionId.value, csrfToken(), {
      approved,
      scopes: approved ? approvedScopes : [],
      rememberConsent: approved && rememberConsent.value,
    })
    await followServerRedirect(response.data?.redirectUrl)
  } catch (error) {
    errorMessage.value =
      error?.message || t('authCenter:messages.couldNotSaveYourPermissionChoicesTryAgain')
  } finally {
    submitting.value = false
  }
}

/** 跳转到认证错误页面 */
function fatal(message) {
  router.replace({ path: '/auth-center/error', query: { message } })
}
initialize()
</script>

<style scoped>
.auth-flow {
  min-height: 410px;
}

.panel-kicker {
  margin: 0 0 8px;
  color: var(--oauth-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

h2 {
  margin: 0;
  color: var(--oauth-text-color-primary);
  font-size: 25px;
  font-weight: 650;
  line-height: 1.4;
}

.panel-lead {
  margin: 12px 0 22px;
  color: var(--oauth-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.panel-lead strong {
  color: var(--oauth-text-color-primary);
}

.el-alert {
  margin-bottom: 18px;
}

.scope-group + .scope-group {
  margin-top: 20px;
}

.scope-selection {
  display: block;
  line-height: 1.5;
}

.group-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

.group-heading h3 {
  margin: 0;
  color: var(--oauth-text-color-primary);
  font-size: 14px;
}

.group-heading p {
  margin: 4px 0 0;
  color: var(--oauth-text-color-secondary);
  font-size: 11px;
}

.group-heading > span {
  color: var(--oauth-text-color-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.scope-list {
  overflow: hidden;
  border: 1px solid var(--oauth-border-color-light);
  border-radius: 9px;
}

.scope-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  min-height: 68px;
  padding: 13px 15px;
  background: var(--oauth-bg-color-overlay);
  cursor: pointer;
}

/* Element UI 的 label 同时作为选项值，隐藏重复文字并保留读屏名称。 */
.scope-item :deep(.el-checkbox__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.scope-item:hover {
  background: var(--oauth-fill-color-light);
}

.scope-item.is-required {
  background: var(--oauth-fill-color-lighter);
  cursor: default;
}

.scope-item + .scope-item {
  border-top: 1px solid var(--oauth-border-color-lighter);
}

.scope-title {
  display: flex;
  align-items: center;
  gap: 5px;
}

.scope-copy strong,
.scope-copy small {
  display: block;
}

.scope-copy strong {
  color: var(--oauth-text-color-primary);
  font-size: 13px;
}

.scope-copy small {
  margin-top: 4px;
  color: var(--oauth-text-color-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.scope-help {
  color: var(--oauth-text-color-secondary);
  cursor: help;
  outline: none;
}

.scope-help:focus-visible {
  color: var(--oauth-color-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--oauth-color-primary-light-7);
}

.remember-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 18px;
  padding: 13px 15px;
  background: var(--oauth-fill-color-lighter);
  border-radius: 9px;
  cursor: pointer;
}

.remember-card .el-checkbox {
  margin-top: 1px;
}

.remember-card strong,
.remember-card small {
  display: block;
}

.remember-card strong {
  color: var(--oauth-text-color-primary);
  font-size: 13px;
}

.remember-card small {
  margin-top: 4px;
  color: var(--oauth-text-color-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1.65fr;
  gap: 10px;
  margin-top: 22px;
}

.actions .el-button {
  height: 44px;
  margin: 0;
}

.policy-link {
  margin-top: 13px;
  text-align: center;
}

.policy-link .el-link {
  font-size: 12px;
}

@media (max-width: 460px) {
  .scope-item {
    grid-template-columns: 22px minmax(0, 1fr);
  }

  .scope-item > .el-tag {
    grid-column: 2;
    justify-self: start;
  }

  .actions {
    grid-template-columns: 1fr;
  }

  .actions .el-button:first-child {
    order: 2;
  }
}
</style>
