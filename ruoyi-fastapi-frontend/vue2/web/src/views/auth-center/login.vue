<template>
  <AuthCenterShell
    :current-step="0"
    :expires-in="interaction.expiresIn"
    :application-name="interaction.client?.clientName"
    :application-id="interaction.client?.clientId"
  >
    <div
      v-loading="initializing"
      class="auth-flow"
    >
      <p class="panel-kicker">{{ $t('authCenter:messages.verifyIdentity') }}</p>
      <h2>{{ $t('authCenter:messages.continueWithYourAccount') }}</h2>
      <p class="panel-lead">
        {{ $t('authCenter:messages.afterSigningInYouWillReturnTo') }}
        <strong>{{ applicationName }}</strong>
        {{ $t('authCenter:messages.toContinueThisSignInDoesNotChangeYourSessionInThe') }}
      </p>

      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />
      <el-form
        :validate-on-rule-change="false"
        ref="loginRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.native.prevent="submitLogin"
      >
        <el-form-item
          :label="$t('authCenter:interface.username')"
          prop="userName"
        >
          <el-input
            v-model="form.userName"
            size="medium"
            autocomplete="username"
            :placeholder="$t('authCenter:messages.enterYourUsername')"
            autofocus
          >
            <template #prefix
              ><i
                class="el-icon el-icon-user"
                aria-hidden="true"
              ></i
            ></template>
          </el-input>
        </el-form-item>
        <el-form-item
          :label="$t('authCenter:interface.password')"
          prop="password"
        >
          <el-input
            v-model="form.password"
            size="medium"
            type="password"
            show-password
            autocomplete="current-password"
            :placeholder="$t('auth:lock.password')"
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
          v-if="captcha.captchaEnabled"
          :label="$t('authCenter:messages.verificationCode')"
          prop="code"
        >
          <div class="captcha-row">
            <el-input
              v-model="form.code"
              size="medium"
              autocomplete="off"
              :placeholder="$t('authCenter:messages.enterTheCharactersInTheImage')"
            />
            <el-button
              type="text"
              class="captcha-image"
              :aria-label="$t('authCenter:messages.getADifferentVerificationImage')"
              :title="$t('auth:interface.canTReadItTryAnotherImage')"
              @click="loadCaptcha"
            >
              <img
                v-if="captcha.img"
                :src="`data:image/gif;base64,${captcha.img}`"
                :alt="$t('authCenter:messages.verificationCode')"
              />
              <span v-else>{{ $t('authCenter:messages.newImage') }}</span>
            </el-button>
          </div>
        </el-form-item>

        <div class="preference-row">
          <el-checkbox v-model="form.rememberMe">{{
            $t('authCenter:messages.staySignedInOnThisDevice')
          }}</el-checkbox>
          <small>{{ $t('authCenter:messages.useThisOnlyOnAPersonalDeviceYouTrust') }}</small>
        </div>
        <el-button
          class="primary-action"
          type="primary"
          size="medium"
          native-type="submit"
          :loading="submitting"
        >
          {{ $t('authCenter:messages.signInAndContinue') }}
        </el-button>
      </el-form>
      <el-button
        type="text"
        class="cancel-action"
        :disabled="submitting"
        @click="cancel"
        >{{ $t('authCenter:messages.cancelAndReturnToTheApp') }}</el-button
      >
    </div>
  </AuthCenterShell>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'AuthCenterLogin' }
</script>

<script setup>
import { computed, getCurrentInstance, reactive, ref } from 'vue'
import {
  cancelInteraction,
  getInteraction,
  getInteractionCaptcha,
  submitInteractionLogin,
} from '@/api/authCenter'
import AuthCenterShell from './AuthCenterShell.vue'
import { useInteractionContext } from './useInteraction'

const { interactionId, csrfToken, goToAction, followServerRedirect } = useInteractionContext()
const router = getCurrentInstance().proxy.$router
const loginRef = ref()
const initializing = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const interaction = ref({})
const captcha = ref({ captchaEnabled: false, uuid: '', img: '' })
const form = reactive({
  userName: '',
  password: '',
  code: '',
  uuid: '',
  rememberMe: false,
})
const applicationName = computed(
  () => interaction.value.client?.clientName || t('authCenter:messages.appRequestingSignIn')
)
const rules = {
  userName: [
    { required: true, message: () => t('common:login.usernameRequired'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: () => t('common:login.passwordRequired'), trigger: 'blur' },
  ],
  code: [
    {
      validator: (_rule, value, callback) =>
        captcha.value.captchaEnabled && !value
          ? callback(new Error(t('authCenter:messages.enterTheVerificationCode')))
          : callback(),
      trigger: 'blur',
    },
  ],
}

/** 读取认证请求并初始化登录状态 */
async function initialize() {
  if (!interactionId.value || !csrfToken()) {
    return showFatal(
      t('authCenter:messages.theAuthenticationRequestIsIncompleteReturnToTheAppAndSignIn')
    )
  }
  try {
    const response = await getInteraction(interactionId.value, csrfToken())
    interaction.value = response.data || {}
    if (interaction.value.nextAction && interaction.value.nextAction !== 'login') {
      return await goToAction(interaction.value.nextAction)
    }
    if (interaction.value.captchaEnabled) {
      await loadCaptcha()
    }
  } catch (error) {
    showFatal(
      error?.message ||
        t('authCenter:messages.theAuthenticationRequestHasExpiredReturnToTheAppAndSignIn')
    )
  } finally {
    initializing.value = false
  }
}

/** 加载认证中心验证码 */
async function loadCaptcha() {
  const response = await getInteractionCaptcha(interactionId.value)
  captcha.value = response.data || { captchaEnabled: false }
  form.uuid = captcha.value.uuid || ''
  form.code = ''
}

/** 校验并提交登录凭据 */
async function submitLogin() {
  if (!(await loginRef.value?.validate().catch(() => false))) {
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const response = await submitInteractionLogin(interactionId.value, csrfToken(), { ...form })
    form.password = ''
    const result = response.data || {}
    if (result.nextAction === 'redirect') {
      return followServerRedirect(result.redirectUrl)
    }
    await goToAction(result.nextAction)
  } catch (error) {
    form.password = ''
    errorMessage.value =
      error?.message ||
      t('auth:interface.authenticationFailedCheckYourAccountAndPasswordThenTryAgain')
    if (captcha.value.captchaEnabled) {
      await loadCaptcha().catch(() => {})
    }
  } finally {
    submitting.value = false
  }
}

/** 取消当前认证请求 */
async function cancel() {
  try {
    const response = await cancelInteraction(interactionId.value, csrfToken())
    if (response.data?.redirectUrl) {
      return followServerRedirect(response.data.redirectUrl)
    }
  } catch (error) {
    errorMessage.value =
      error?.message || t('authCenter:messages.theAuthenticationRequestCouldNotBeCancelled')
  }
}

/** 跳转到认证错误页面 */
function showFatal(message) {
  router.replace({ path: '/auth-center/error', query: { message } })
}
initialize()
</script>

<style scoped>
.auth-flow {
  min-height: 390px;
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
  margin: 12px 0 24px;
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

.captcha-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  gap: 10px;
  width: 100%;
}

.captcha-image {
  height: 40px;
  padding: 0;
  overflow: hidden;
  color: var(--oauth-text-color-regular);
  background: var(--oauth-fill-color-light);
  border: 1px solid var(--oauth-border-color);
  border-radius: var(--oauth-border-radius-base);
}

.captcha-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 2px;
}

.preference-row small {
  color: var(--oauth-text-color-secondary);
  font-size: 11px;
}

.primary-action {
  width: 100%;
  height: 44px;
  margin-top: 22px;
}

.cancel-action {
  display: block;
  margin: 14px auto 0;
  color: var(--oauth-text-color-regular);
}

@media (max-width: 440px) {
  .captcha-row {
    grid-template-columns: minmax(0, 1fr) 112px;
  }

  .preference-row {
    display: block;
  }

  .preference-row small {
    display: block;
    margin: 2px 0 0 24px;
  }
}
</style>
