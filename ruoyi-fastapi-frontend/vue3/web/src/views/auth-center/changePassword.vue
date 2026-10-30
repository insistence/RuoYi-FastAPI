<template>
  <AuthCenterShell
    :current-step="0"
    :steps="[$t('authCenter:protectYourAccount'), $t('authCenter:confirmPermissions')]"
    :expires-in="interaction.expiresIn"
    :application-name="interaction.client?.clientName"
    :application-id="interaction.client?.clientId"
  >
    <div
      v-loading="initializing"
      class="auth-flow"
    >
      <p class="panel-kicker">{{ $t('authCenter:accountProtection') }}</p>
      <h2>{{ $t('authCenter:setANewPasswordToContinue') }}</h2>
      <p class="panel-lead">
        {{ $t('authCenter:yourPasswordHasExpiredOrIsStillTheInitialPassword')
        }}<strong>{{ applicationName }}</strong
        >。
      </p>

      <div class="security-impact">
        <el-icon><Warning /></el-icon>
        <span
          ><strong>{{ $t('authCenter:protectYourEntireAccount') }}</strong
          ><small>{{
            $t('authCenter:existingSessionsInOtherExternalAppsWillBeSignedOut')
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
        ref="passwordRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-form-item
          :label="$t('authCenter:currentPassword')"
          prop="oldPassword"
        >
          <el-input
            v-model="form.oldPassword"
            type="password"
            show-password
            size="large"
            autocomplete="current-password"
            :placeholder="$t('authCenter:toVerifyYourIdentity')"
          >
            <template #prefix
              ><el-icon><Lock /></el-icon
            ></template>
          </el-input>
        </el-form-item>
        <el-form-item
          :label="$t('system:newPassword')"
          prop="newPassword"
        >
          <el-input
            v-model="form.newPassword"
            type="password"
            show-password
            size="large"
            autocomplete="new-password"
            :placeholder="$t('authCenter:enterANewPassword')"
          >
            <template #prefix
              ><el-icon><Key /></el-icon
            ></template>
          </el-input>
          <div
            class="password-meter"
            aria-live="polite"
          >
            <div class="meter-heading">
              <span>{{ $t('authCenter:passwordStrength') }}</span
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
          :label="$t('authCenter:repeatNewPassword')"
          prop="confirmPassword"
        >
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            size="large"
            autocomplete="new-password"
            :placeholder="$t('authCenter:enterItAgainToAvoidMistakes')"
            @keyup.enter="submit"
          >
            <template #prefix
              ><el-icon><CircleCheck /></el-icon
            ></template>
          </el-input>
        </el-form-item>
        <el-button
          class="primary-action"
          type="primary"
          size="large"
          native-type="submit"
          :loading="submitting"
        >
          {{ $t('authCenter:updatePasswordAndContinue') }}</el-button
        >
      </el-form>
    </div>
  </AuthCenterShell>
</template>

<script setup name="AuthCenterChangePassword">
import { t } from '@/i18n/adapter'
import { getInteraction, submitInteractionPasswordChange } from '@/api/authCenter'
import { usePasswordRule } from '@/utils/passwordRule'
import AuthCenterShell from './AuthCenterShell.vue'
import { useInteractionContext } from './useInteraction'

const { interactionId, csrfToken, goToAction, followServerRedirect } = useInteractionContext()
const { pwdChrType, infoPwdValidator } = usePasswordRule()
const router = useRouter()
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
  () => interaction.value.client?.clientName || t('authCenter:appRequestingSignIn')
)
const policyDescription = computed(
  () =>
    ({
      get 0() {
        return t('authCenter:use620CharactersAngleBracketsQuotesBackslashesAndVertical')
      },
      get 1() {
        return t('authCenter:use620Digits')
      },
      get 2() {
        return t('authCenter:use620LatinLetters')
      },
      get 3() {
        return t('authCenter:use620CharactersIncludingBothLettersAndNumbers')
      },
      get 4() {
        return t('authCenter:use620CharactersIncludingLettersNumbersAndSymbols')
      },
    })[pwdChrType.value] || t('authCenter:use620Characters')
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
      t('authCenter:requirementsNotMet'),
      t('authCenter:basic'),
      t('monitor:good'),
      t('authCenter:strong'),
    ][strengthLevel.value]
)

const validateNewPassword = (_rule, value, callback) => {
  if (value && value === form.oldPassword) {
    return callback(new Error(t('authCenter:theNewPasswordMustDifferFromTheCurrentPassword')))
  }
  callback()
}
const validateConfirmation = (_rule, value, callback) => {
  if (!value) {
    return callback(new Error(t('authCenter:enterTheNewPasswordAgain')))
  }
  if (value !== form.newPassword) {
    return callback(new Error(t('authCenter:theNewPasswordsDoNotMatch')))
  }
  callback()
}
const rules = computed(() => ({
  oldPassword: [
    {
      required: true,
      get message() {
        return t('authCenter:enterYourCurrentPassword')
      },
      trigger: 'blur',
    },
  ],
  newPassword: [...infoPwdValidator.value, { validator: validateNewPassword, trigger: 'blur' }],
  confirmPassword: [{ validator: validateConfirmation, trigger: 'blur' }],
}))

/** 读取认证交互状态并检查是否需要修改密码 */
async function initialize() {
  if (!interactionId.value || !csrfToken()) {
    return fatal(t('authCenter:theAuthenticationRequestIsIncompleteReturnToTheAppAnd'))
  }
  try {
    const response = await getInteraction(interactionId.value, csrfToken())
    interaction.value = response.data || {}
    if (interaction.value.nextAction !== 'changePassword') {
      await goToAction(interaction.value.nextAction)
    }
  } catch (error) {
    fatal(error?.message || t('authCenter:theAuthenticationRequestHasExpiredReturnToTheAppAnd'))
  } finally {
    initializing.value = false
  }
}

/** 校验并提交密码修改 */
async function submit() {
  if (!interactionId.value || !csrfToken()) {
    return fatal(t('authCenter:theAuthenticationRequestIsIncompleteReturnToTheAppAnd'))
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
      error?.message || t('authCenter:passwordUpdateFailedReviewTheInformationOnThisPageAnd')
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
  color: var(--el-color-warning-dark-2);
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
  margin: 12px 0 18px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.panel-lead strong {
  color: var(--el-text-color-primary);
}

.security-impact {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px 14px;
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
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
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.security-impact small {
  margin-top: 3px;
  color: var(--el-text-color-regular);
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
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.meter-heading strong.is-0 {
  color: var(--el-text-color-secondary);
}

.meter-heading strong.is-1 {
  color: var(--el-color-danger);
}

.meter-heading strong.is-2 {
  color: var(--el-color-warning-dark-2);
}

.meter-heading strong.is-3 {
  color: var(--el-color-success);
}

.meter-bars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  margin: 6px 0;
}

.meter-bars i {
  height: 3px;
  background: var(--el-fill-color-dark);
  border-radius: 3px;
}

.meter-bars i.active {
  background: var(--el-color-warning);
}

.meter-bars i:nth-child(3).active {
  background: var(--el-color-success);
}

.password-meter > small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.primary-action {
  width: 100%;
  height: 44px;
  margin-top: 10px;
}
</style>
