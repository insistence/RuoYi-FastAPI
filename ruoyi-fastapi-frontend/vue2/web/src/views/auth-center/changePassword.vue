<template>
  <AuthCenterShell
    :current-step="0"
    :steps="[$t('authCenter:steps.protectAccount'), $t('authCenter:steps.confirmPermissions')]"
    :expires-in="interaction.expiresIn"
    :application-name="interaction.client?.clientName"
    :application-id="interaction.client?.clientId"
  >
    <div
      v-loading="initializing"
      class="auth-flow"
    >
      <p class="panel-kicker">{{ $t('authCenter:messages.accountProtection') }}</p>
      <h2>{{ $t('authCenter:messages.setANewPasswordToContinue') }}</h2>
      <p class="panel-lead">
        {{ $t('authCenter:messages.yourPasswordHasExpiredOrIsStillTheInitialPasswordUpdateIt') }}
        <strong>{{ applicationName }}</strong
        >。
      </p>

      <div class="security-impact">
        <i
          class="el-icon el-icon-warning-outline"
          aria-hidden="true"
        ></i>
        <span
          ><strong>{{ $t('authCenter:messages.protectYourEntireAccount') }}</strong
          ><small>{{
            $t('authCenter:messages.existingSessionsInOtherExternalAppsWillBeSignedOutSignIn')
          }}</small></span
        >
      </div>
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />

      <el-form
        :validate-on-rule-change="false"
        ref="passwordRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.native.prevent="submit"
      >
        <el-form-item
          :label="$t('authCenter:messages.currentPassword')"
          prop="oldPassword"
        >
          <el-input
            v-model="form.oldPassword"
            type="password"
            show-password
            size="medium"
            autocomplete="current-password"
            :placeholder="$t('authCenter:messages.toVerifyYourIdentity')"
          >
            <template #prefix
              ><i
                class="el-icon el-icon-lock"
                aria-hidden="true"
              ></i
            ></template>
          </el-input>
        </el-form-item>
        <el-form-item
          :label="$t('auth:password.new')"
          prop="newPassword"
        >
          <el-input
            v-model="form.newPassword"
            type="password"
            show-password
            size="medium"
            autocomplete="new-password"
            :placeholder="$t('authCenter:messages.enterANewPassword')"
          >
            <template #prefix
              ><i
                class="el-icon el-icon-key"
                aria-hidden="true"
              ></i
            ></template>
          </el-input>
          <div
            class="password-meter"
            aria-live="polite"
          >
            <div class="meter-heading">
              <span>{{ $t('authCenter:messages.passwordStrength') }}</span
              ><strong :class="`is-${strengthLevel}`">{{ strengthLabel }}</strong>
            </div>
            <div
              class="meter-bars"
              aria-hidden="true"
            >
              <i
                v-for="index in 3"
                :key="index"
                :class="{ active: index <= strengthLevel }"
              />
            </div>
            <small>{{ policyDescription }}</small>
          </div>
        </el-form-item>
        <el-form-item
          :label="$t('authCenter:messages.repeatNewPassword')"
          prop="confirmPassword"
        >
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            size="medium"
            autocomplete="new-password"
            :placeholder="$t('authCenter:messages.enterItAgainToAvoidMistakes')"
          >
            <template #prefix
              ><i
                class="el-icon el-icon-circle-check"
                aria-hidden="true"
              ></i
            ></template>
          </el-input>
        </el-form-item>
        <el-button
          class="primary-action"
          type="primary"
          size="medium"
          native-type="submit"
          :loading="submitting"
        >
          {{ $t('authCenter:messages.updatePasswordAndContinue') }}
        </el-button>
      </el-form>
    </div>
  </AuthCenterShell>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'AuthCenterChangePassword' }
</script>

<script setup>
import { computed, getCurrentInstance, reactive, ref } from 'vue'
import { getInteraction, submitInteractionPasswordChange } from '@/api/authCenter'
import { usePasswordRule } from '@/utils/passwordRule'
import AuthCenterShell from './AuthCenterShell.vue'
import { useInteractionContext } from './useInteraction'

const { interactionId, csrfToken, goToAction, followServerRedirect } = useInteractionContext()
const { pwdChrType, infoPwdValidator } = usePasswordRule()
const router = getCurrentInstance().proxy.$router
const passwordRef = ref()
const interaction = ref({})
const initializing = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const applicationName = computed(
  () => interaction.value.client?.clientName || t('authCenter:messages.appRequestingSignIn')
)
const policyDescription = computed(
  () =>
    ({
      0: t('authCenter:password.forbiddenCharacters'),
      1: t('authCenter:messages.use620Digits'),
      2: t('authCenter:messages.use620LatinLetters'),
      3: t('authCenter:messages.use620CharactersIncludingBothLettersAndNumbers'),
      4: t('authCenter:messages.use620CharactersIncludingLettersNumbersAndSymbols'),
    })[pwdChrType.value] || t('auth:interface.use620Characters')
)

const strengthLevel = computed(() => {
  const value = form.newPassword || ''
  if (value.length < 6) {
    return 0
  }
  let level = 1
  if (value.length >= 10) {
    level += 1
  }
  const types = [/[A-Za-z]/.test(value), /\d/.test(value), /[^A-Za-z\d]/.test(value)].filter(
    Boolean
  ).length
  if (types >= 2) {
    level += 1
  }
  return Math.min(3, level)
})
const strengthLabel = computed(
  () =>
    [
      t('authCenter:messages.requirementsNotMet'),
      t('authCenter:messages.basic'),
      t('authCenter:messages.good'),
      t('authCenter:messages.strong'),
    ][strengthLevel.value]
)

const validateNewPassword = (_rule, value, callback) => {
  if (value && value === form.oldPassword) {
    return callback(
      new Error(t('authCenter:messages.theNewPasswordMustDifferFromTheCurrentPassword'))
    )
  }
  callback()
}
const validateConfirmation = (_rule, value, callback) => {
  if (!value) {
    return callback(new Error(t('authCenter:messages.enterTheNewPasswordAgain')))
  }
  if (value !== form.newPassword) {
    return callback(new Error(t('authCenter:messages.theNewPasswordsDoNotMatch')))
  }
  callback()
}
const rules = computed(() => ({
  oldPassword: [
    {
      required: true,
      message: () => t('authCenter:messages.enterYourCurrentPassword'),
      trigger: 'blur',
    },
  ],
  newPassword: [...infoPwdValidator.value, { validator: validateNewPassword, trigger: 'blur' }],
  confirmPassword: [{ validator: validateConfirmation, trigger: 'blur' }],
}))

/** 读取认证交互状态并检查是否需要修改密码 */
async function initialize() {
  if (!interactionId.value || !csrfToken()) {
    return fatal(
      t('authCenter:messages.theAuthenticationRequestIsIncompleteReturnToTheAppAndSignIn')
    )
  }
  try {
    const response = await getInteraction(interactionId.value, csrfToken())
    interaction.value = response.data || {}
    if (interaction.value.nextAction !== 'changePassword') {
      await goToAction(interaction.value.nextAction)
    }
  } catch (error) {
    fatal(
      error?.message ||
        t('authCenter:messages.theAuthenticationRequestHasExpiredReturnToTheAppAndSignIn')
    )
  } finally {
    initializing.value = false
  }
}

/** 校验并提交密码修改 */
async function submit() {
  if (!interactionId.value || !csrfToken()) {
    return fatal(
      t('authCenter:messages.theAuthenticationRequestIsIncompleteReturnToTheAppAndSignIn')
    )
  }
  if (!(await passwordRef.value?.validate().catch(() => false))) {
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const response = await submitInteractionPasswordChange(interactionId.value, csrfToken(), {
      ...form,
    })
    Object.assign(form, {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    if (response.data?.nextAction === 'redirect') {
      return followServerRedirect(response.data.redirectUrl)
    }
    await goToAction(response.data?.nextAction)
  } catch (error) {
    form.oldPassword = ''
    errorMessage.value =
      error?.message || t('auth:interface.passwordUpdateFailedCheckTheFormAndTryAgain')
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
  color: var(--oauth-color-warning-dark-2);
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
  margin: 12px 0 18px;
  color: var(--oauth-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.panel-lead strong {
  color: var(--oauth-text-color-primary);
}

.security-impact {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px 14px;
  color: var(--oauth-color-warning-dark-2);
  background: var(--oauth-color-warning-light-9);
  border: 1px solid var(--oauth-color-warning-light-7);
  border-radius: 8px;
}

.security-impact > .el-icon {
  flex: 0 0 auto;
  margin-top: 2px;
}

.security-impact strong,
.security-impact small {
  display: block;
}

.security-impact strong {
  color: var(--oauth-text-color-primary);
  font-size: 12px;
}

.security-impact small {
  margin-top: 3px;
  color: var(--oauth-text-color-regular);
  font-size: 11px;
  line-height: 1.5;
}

.el-alert {
  margin-bottom: 18px;
}

.password-meter {
  width: 100%;
  margin-top: 8px;
}

.meter-heading {
  display: flex;
  justify-content: space-between;
  color: var(--oauth-text-color-secondary);
  font-size: 11px;
}

.meter-heading strong.is-0 {
  color: var(--oauth-text-color-secondary);
}

.meter-heading strong.is-1 {
  color: var(--oauth-color-danger);
}

.meter-heading strong.is-2 {
  color: var(--oauth-color-warning-dark-2);
}

.meter-heading strong.is-3 {
  color: var(--oauth-color-success);
}

.meter-bars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  margin: 6px 0;
}

.meter-bars i {
  height: 3px;
  background: var(--oauth-fill-color-dark);
  border-radius: 3px;
}

.meter-bars i.active {
  background: var(--oauth-color-warning);
}

.meter-bars i:nth-child(3).active {
  background: var(--oauth-color-success);
}

.password-meter > small {
  color: var(--oauth-text-color-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.primary-action {
  width: 100%;
  height: 44px;
  margin-top: 10px;
}
</style>
