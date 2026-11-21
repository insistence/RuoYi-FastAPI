<template>
  <el-dialog
    custom-class="oauth-overlay"
    :visible.sync="visible"
    :title="$t('oauth:client.saveTheApplicationSecret')"
    width="min(680px, calc(100vw - 48px))"
    append-to-body
    :close-on-click-modal="false"
  >
    <el-form
      :validate-on-rule-change="false"
      label-width="160px"
      class="secret-form"
    >
      <el-form-item>
        <template #label
          ><FieldLabel
            :label="$t('oauth:shared.appId')"
            :help="
              $t(
                'oauth:client.theSystemGeneratedApplicationIDCopyItToConfigureTheExternalApplication'
              )
            "
        /></template>
        <el-input
          :value="secret.clientId"
          readonly
        />
      </el-form-item>
      <el-form-item>
        <template #label
          ><FieldLabel
            :label="$t('oauth:client.applicationSecret')"
            :help="$t('oauth:client.theApplicationSecretActsAsItsPasswordAndIsShownOnlyOnce')"
        /></template>
        <el-input
          :value="secret.clientSecret"
          readonly
        >
          <template #append>
            <el-button
              icon="el-icon-document-copy"
              @click="copySecret"
              >{{ $t('common:copy') }}</el-button
            >
          </template>
        </el-input>
      </el-form-item>
    </el-form>
    <el-checkbox v-model="confirmed">{{
      $t('oauth:client.iHaveStoredTheSecretSecurely')
    }}</el-checkbox>
    <template #footer>
      <el-button
        type="primary"
        :disabled="!confirmed"
        @click="close"
        >{{ $t('common:finish') }}</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'

import { computed, getCurrentInstance, ref, watch } from 'vue'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel.vue'

const props = defineProps({
  value: { type: Boolean, default: false },
  secret: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['input'])
const { proxy } = getCurrentInstance()
const confirmed = ref(false)
const visible = computed({
  get: () => props.value,
  set: (value) => emit('input', value),
})

watch(
  () => props.value,
  (value) => {
    if (value) {
      confirmed.value = false
    }
  }
)

/** 复制本次生成的客户端密钥 */
async function copySecret() {
  if (!props.secret.clientSecret) {
    return
  }
  try {
    await navigator.clipboard.writeText(props.secret.clientSecret)
    proxy.$modal.msgSuccess(t('oauth:client.secretCopied'))
  } catch {
    proxy.$modal.msgError(t('oauth:client.theBrowserDeniedClipboardAccessCopyTheSecretManually'))
  }
}

/** 关闭密钥展示对话框 */
function close() {
  visible.value = false
}
</script>

<style scoped>
@media (max-width: 640px) {
  .secret-form :deep(.el-form-item) {
    display: block;
  }

  .secret-form :deep(.el-form-item__label) {
    width: auto !important;
    margin-bottom: 6px;
  }

  .secret-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
