<template>
  <el-dialog
    v-model="visible"
    :title="$t('oauth:saveTheApplicationSecret')"
    width="min(680px, calc(100vw - 48px))"
    append-to-body
    :close-on-click-modal="false"
  >
    <el-form
      label-width="160px"
      class="secret-form"
    >
      <el-form-item>
        <template #label
          ><FieldLabel
            :label="$t('monitor:applicationID')"
            :help="$t('oauth:systemGeneratedAppIDCopyItToConfigureTheExternal')"
        /></template>
        <el-input
          :model-value="secret.clientId"
          readonly
        />
      </el-form-item>
      <el-form-item>
        <template #label
          ><FieldLabel
            :label="$t('oauth:applicationSecret')"
            :help="$t('oauth:theAppSecretActsAsItsPasswordAndIsShown')"
        /></template>
        <el-input
          :model-value="secret.clientSecret"
          readonly
        >
          <template #append>
            <el-button
              icon="CopyDocument"
              @click="copySecret"
              >{{ $t('monitor:copy') }}</el-button
            >
          </template>
        </el-input>
      </el-form-item>
    </el-form>
    <el-checkbox v-model="confirmed">{{ $t('oauth:iHaveStoredTheSecretSecurely') }}</el-checkbox>
    <template #footer>
      <el-button
        type="primary"
        :disabled="!confirmed"
        @click="close"
        >{{ $t('oauth:finish') }}</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import FieldLabel from '@/components/OAuthWorkspace/FieldLabel.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  secret: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])
const { proxy } = getCurrentInstance()
const confirmed = ref(false)
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

watch(
  () => props.modelValue,
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
    proxy.$modal.msgSuccess(t('oauth:secretCopied'))
  } catch {
    proxy.$modal.msgError(t('oauth:theBrowserDeniedClipboardAccessCopyTheSecretManually'))
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
