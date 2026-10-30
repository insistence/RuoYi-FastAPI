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
      <p class="panel-kicker">{{ $t('authCenter:confirmPermissions') }}</p>
      <h2>{{ $t('authCenter:confirmWhatToShare') }}</h2>
      <p class="panel-lead">
        <strong>{{ applicationName }}</strong>
        {{ $t('authCenter:isRequestingTheInformationBelowRequiredInformationIsNeededFor') }}
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
              <h3 id="required-scope-title">{{ $t('authCenter:requiredForAccess') }}</h3>
              <p>{{ $t('authCenter:decliningThesePermissionsPreventsAccessToTheApp') }}</p>
            </div>
            <span>{{ $t('authCenter:permissionCount', { count: requiredScopes.length }) }}</span>
          </div>
          <div class="scope-list">
            <label
              v-for="scope in requiredScopes"
              :key="scope.scope"
              class="scope-item is-required"
            >
              <el-checkbox
                :value="scope.scope"
                disabled
              />
              <span class="scope-copy">
                <span class="scope-title">
                  <strong>{{ scope.name || scope.scope }}</strong>
                  <el-tooltip
                    v-if="scope.name && scope.name !== scope.scope"
                    :content="$t('authCenter:permissionCodeValue', { scope: scope.scope })"
                    placement="top"
                  >
                    <el-icon
                      class="scope-help"
                      tabindex="0"
                      :aria-label="$t('authCenter:viewPermissionCodes')"
                      ><QuestionFilled
                    /></el-icon>
                  </el-tooltip>
                </span>
                <small>{{
                  scope.description || $t('authCenter:usedToCompleteSignInOrProvideTheApplicationS')
                }}</small>
              </span>
              <el-tag
                size="small"
                type="info"
                effect="plain"
                >{{ $t('authCenter:required') }}</el-tag
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
              <h3 id="optional-scope-title">{{ $t('authCenter:yourChoice') }}</h3>
              <p>{{ $t('authCenter:youCanUseTheAppWithoutSelectingThese') }}</p>
            </div>
            <span>{{
              $t('authCenter:selectedCount', {
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
              <el-checkbox :value="scope.scope" />
              <span class="scope-copy">
                <span class="scope-title">
                  <strong>{{ scope.name || scope.scope }}</strong>
                  <el-tooltip
                    v-if="scope.name && scope.name !== scope.scope"
                    :content="$t('authCenter:permissionCodeValue', { scope: scope.scope })"
                    placement="top"
                  >
                    <el-icon
                      class="scope-help"
                      tabindex="0"
                      :aria-label="$t('authCenter:viewPermissionCodes')"
                      ><QuestionFilled
                    /></el-icon>
                  </el-tooltip>
                </span>
                <small>{{
                  scope.description ||
                  $t('authCenter:allowTheApplicationToUseThisInformationOrCapability')
                }}</small>
              </span>
              <el-tag
                v-if="scope.sensitive"
                size="small"
                type="warning"
                effect="plain"
                >{{ $t('authCenter:sensitiveInformation') }}</el-tag
              >
            </label>
          </div>
        </section>
      </el-checkbox-group>

      <label class="remember-card">
        <el-checkbox v-model="rememberConsent" />
        <span>
          <strong>{{ $t('authCenter:rememberMyChoices') }}</strong>
          <small>{{
            $t('authCenter:rememberingYourChoicesAvoidsRepeatedConfirmationForApprovedPermissionsA')
          }}</small>
          <small v-if="selectedScopes.includes('offline_access')">{{
            $t('authCenter:offlineAccessAllowsTheAppToRenewAccessWhenYou')
          }}</small>
        </span>
      </label>

      <div class="actions">
        <el-button
          size="large"
          :disabled="submitting"
          @click="submit(false)"
          >{{ $t('authCenter:declineAndReturn') }}</el-button
        >
        <el-button
          type="primary"
          size="large"
          :loading="submitting"
          @click="submit(true)"
          >{{ $t('authCenter:allowCount', { count: selectedScopes.length }) }}</el-button
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
          >{{ $t('authCenter:viewThisAppSPrivacyPolicy') }}</el-link
        >
      </div>
    </div>
  </AuthCenterShell>
</template>

<script setup name="AuthCenterConsent">
import { t } from '@/i18n/adapter'
import { getInteraction, submitInteractionConsent } from '@/api/authCenter'
import AuthCenterShell from './AuthCenterShell.vue'
import { useInteractionContext } from './useInteraction'

const { interactionId, csrfToken, goToAction, followServerRedirect } = useInteractionContext()
const router = useRouter()
const interaction = ref({})
const selectedScopes = ref([])
const rememberConsent = ref(false)
const initializing = ref(true)
const submitting = ref(false)
const errorMessage = ref('')

const applicationName = computed(
  () => interaction.value.client?.clientName || t('authCenter:appRequestingSignIn')
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
    return fatal(t('authCenter:theAuthenticationRequestIsIncompleteReturnToTheAppAnd'))
  }
  try {
    const response = await getInteraction(interactionId.value, csrfToken())
    interaction.value = response.data || {}
    if (interaction.value.nextAction !== 'consent') {
      return await goToAction(interaction.value.nextAction)
    }
    selectedScopes.value = requiredScopes.value.map((item) => item.scope)
  } catch (error) {
    fatal(error?.message || t('authCenter:theAuthorizationRequestHasExpired'))
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
    errorMessage.value = error?.message || t('authCenter:couldNotSaveYourPermissionChoicesTryAgain')
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
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 25px;
  font-weight: 650;
  line-height: 1.4;
}

.panel-lead {
  margin: 12px 0 22px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.panel-lead strong {
  color: var(--el-text-color-primary);
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
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.group-heading p {
  margin: 4px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.group-heading > span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.scope-list {
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 9px;
}

.scope-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  min-height: 68px;
  padding: 13px 15px;
  background: var(--el-bg-color-overlay);
  cursor: pointer;
}

.scope-item:hover {
  background: var(--el-fill-color-light);
}

.scope-item.is-required {
  background: var(--el-fill-color-lighter);
  cursor: default;
}

.scope-item + .scope-item {
  border-top: 1px solid var(--el-border-color-lighter);
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
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.scope-copy small {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.scope-help {
  color: var(--el-text-color-secondary);
  cursor: help;
  outline: none;
}

.scope-help:focus-visible {
  color: var(--el-color-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
}

.remember-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 18px;
  padding: 13px 15px;
  background: var(--el-fill-color-lighter);
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
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.remember-card small {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
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
