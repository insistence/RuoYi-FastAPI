<template>
  <AuthCenterShell :show-progress="false">
    <div class="error-flow">
      <span
        class="error-symbol"
        aria-hidden="true"
        ><el-icon><CloseBold /></el-icon
      ></span>
      <p class="panel-kicker">
        {{
          serviceUnavailable ? $t('authCenter:serviceUnavailable') : $t('layout:routes.authError')
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
        <strong>{{ $t('authCenter:whatYouCanDo') }}</strong>
        <ol v-if="serviceUnavailable">
          <li>{{ $t('authCenter:returnToTheAppOrCloseThisPage') }}</li>
          <li>{{ $t('authCenter:askYourAdministratorToCheckTheServiceStatus') }}</li>
        </ol>
        <ol v-else>
          <li>{{ $t('authCenter:returnToTheAppAndStartSignInAgain') }}</li>
          <li>{{ $t('authCenter:ifItStillFailsTellYourAdministratorTheAppName') }}</li>
        </ol>
      </div>

      <el-button
        v-if="canGoBack"
        type="primary"
        size="large"
        class="return-action"
        @click="returnBack"
      >
        {{ $t('authCenter:goBack') }}</el-button
      >
      <p
        v-else
        class="close-help"
      >
        {{
          serviceUnavailable
            ? $t('authCenter:youCanSafelyCloseThisPageAndReturnToThe')
            : $t('authCenter:youCanSafelyCloseThisPageAndRestartSignIn')
        }}
      </p>
    </div>
  </AuthCenterShell>
</template>

<script setup name="AuthCenterError">
import { t } from '@/i18n/adapter'
import AuthCenterShell from './AuthCenterShell.vue'

const route = useRoute()
const router = useRouter()
const canGoBack = typeof window !== 'undefined' && window.history.length > 1
const serviceReason = computed(() => route.query.reason)
const serviceUnavailable = computed(() => ['disabled', 'unavailable'].includes(serviceReason.value))
const errorTitle = computed(() => {
  if (serviceReason.value === 'disabled') return t('authCenter:authenticationServiceIsDisabled')
  if (serviceReason.value === 'unavailable')
    return t('authCenter:authenticationServiceIsUnavailable')
  return t('authCenter:unableToContinue')
})
const safeMessage = computed(() => {
  if (serviceReason.value === 'disabled') {
    return t('authCenter:authenticationIsNotEnabledReturnToTheAppOrContact')
  }
  if (serviceReason.value === 'unavailable') {
    return t('authCenter:theAuthenticationServiceCannotBeReachedTryAgainLaterFrom')
  }
  const message = typeof route.query.message === 'string' ? route.query.message : ''
  return (
    message.slice(0, 240) ||
    t('authCenter:theAuthenticationRequestMayHaveExpiredBeIncompleteOrRefer')
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
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-7);
  border-radius: 13px;
  font-size: 20px;
  place-items: center;
}

.panel-kicker {
  margin: 22px 0 8px;
  color: var(--el-color-danger);
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
  margin: 13px 0 20px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.75;
}

.next-steps {
  width: 100%;
  padding: 15px 17px;
  background: var(--el-fill-color-lighter);
  border-radius: 9px;
}

.next-steps strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.next-steps ol {
  margin: 9px 0 0;
  padding-left: 20px;
  color: var(--el-text-color-regular);
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
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
