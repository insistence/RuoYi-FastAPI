<template>
  <AuthCenterShell :show-progress="false">
    <div class="error-flow">
      <span
        class="error-symbol"
        aria-hidden="true"
        ><i
          class="el-icon el-icon-close"
          aria-hidden="true"
        ></i
      ></span>
      <p class="panel-kicker">
        {{
          serviceUnavailable
            ? $t('authCenter:expression.serviceUnavailable')
            : $t('layout:route.authError')
        }}
      </p>
      <h2>{{ errorTitle }}</h2>
      <p
        class="panel-lead"
        role="alert"
      >
        {{ safeMessage }}
      </p>

      <div class="next-steps">
        <strong>{{ $t('authCenter:messages.whatYouCanDo') }}</strong>
        <ol v-if="serviceUnavailable">
          <li>{{ $t('authCenter:messages.returnToTheAppOrCloseThisPage') }}</li>
          <li>{{ $t('authCenter:messages.askYourAdministratorToCheckTheServiceStatus') }}</li>
        </ol>
        <ol v-else>
          <li>{{ $t('authCenter:messages.returnToTheAppAndStartSignInAgain') }}</li>
          <li>
            {{ $t('authCenter:messages.ifItStillFailsTellYourAdministratorTheAppNameAndWhen') }}
          </li>
        </ol>
      </div>

      <el-button
        v-if="canGoBack"
        type="primary"
        size="medium"
        class="return-action"
        @click="returnBack"
      >
        {{ $t('authCenter:messages.goBack') }}
      </el-button>
      <p
        v-else
        class="close-help"
      >
        {{
          serviceUnavailable
            ? $t('authCenter:expression.youCanSafelyCloseThisPageAndReturnToTheApplication')
            : $t('authCenter:expression.youCanSafelyCloseThisPageAndRestartSignInFromThe')
        }}
      </p>
    </div>
  </AuthCenterShell>
</template>

<script>
import { t } from '@/i18n/adapter'

export default { name: 'AuthCenterError' }
</script>

<script setup>
import { computed, getCurrentInstance } from 'vue'
import AuthCenterShell from './AuthCenterShell.vue'

const { proxy } = getCurrentInstance()
const route = computed(() => proxy.$route)
const router = getCurrentInstance().proxy.$router
const canGoBack = typeof window !== 'undefined' && window.history.length > 1
const serviceReason = computed(() => route.value.query.reason)
const serviceUnavailable = computed(() => ['disabled', 'unavailable'].includes(serviceReason.value))
const errorTitle = computed(() => {
  if (serviceReason.value === 'disabled')
    return t('authCenter:messages.authenticationServiceIsDisabled')
  if (serviceReason.value === 'unavailable')
    return t('authCenter:messages.authenticationServiceIsUnavailable')
  return t('authCenter:messages.unableToContinue')
})
const safeMessage = computed(() => {
  if (serviceReason.value === 'disabled') {
    return t(
      'authCenter:messages.authenticationIsNotEnabledReturnToTheAppOrContactYourAdministrator'
    )
  }
  if (serviceReason.value === 'unavailable') {
    return t('authCenter:messages.theAuthenticationServiceCannotBeReachedTryAgainLaterFromTheApp')
  }
  const message = typeof route.value.query.message === 'string' ? route.value.query.message : ''
  return (
    message.slice(0, 240) ||
    t('authCenter:messages.theAuthenticationRequestMayHaveExpiredBeIncompleteOrReferToAn')
  )
})

/** 返回浏览器历史中的上一页 */
function returnBack() {
  router.back()
}
</script>

<style scoped>
.error-flow {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: 370px;
}

.error-symbol {
  display: grid;
  width: 48px;
  height: 48px;
  color: var(--oauth-color-danger);
  background: var(--oauth-color-danger-light-9);
  border: 1px solid var(--oauth-color-danger-light-7);
  border-radius: 13px;
  font-size: 20px;
  place-items: center;
}

.panel-kicker {
  margin: 22px 0 8px;
  color: var(--oauth-color-danger);
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
  margin: 13px 0 20px;
  color: var(--oauth-text-color-regular);
  font-size: 14px;
  line-height: 1.75;
}

.next-steps {
  width: 100%;
  padding: 15px 17px;
  background: var(--oauth-fill-color-lighter);
  border-radius: 9px;
}

.next-steps strong {
  color: var(--oauth-text-color-primary);
  font-size: 13px;
}

.next-steps ol {
  margin: 9px 0 0;
  padding-left: 20px;
  color: var(--oauth-text-color-regular);
  font-size: 12px;
  line-height: 1.8;
}

.return-action {
  width: 100%;
  height: 44px;
  margin-top: 22px;
}

.close-help {
  width: 100%;
  margin: 20px 0 0;
  color: var(--oauth-text-color-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
