<template>
  <el-form
    ref="pwdRef"
    :model="user"
    :rules="rules"
    :validate-on-rule-change="false"
    label-width="80px"
  >
    <el-form-item
      :label="$t('system:currentPassword')"
      prop="oldPassword"
    >
      <el-input
        v-model="user.oldPassword"
        :placeholder="$t('system:enterCurrentPassword')"
        type="password"
        show-password
      />
    </el-form-item>
    <el-form-item
      :label="$t('system:newPassword')"
      prop="newPassword"
      :rules="infoPwdValidator"
    >
      <el-input
        v-model="user.newPassword"
        :placeholder="$t('system:enterNewPassword')"
        type="password"
        show-password
      />
    </el-form-item>
    <el-form-item
      :label="$t('auth:register.confirmPassword')"
      prop="confirmPassword"
    >
      <el-input
        v-model="user.confirmPassword"
        :placeholder="$t('system:confirmNewPassword')"
        type="password"
        show-password
      />
    </el-form-item>
    <el-form-item>
      <el-button
        type="primary"
        @click="submit"
        >{{ $t('common:save') }}</el-button
      >
      <el-button
        type="danger"
        @click="close"
        >{{ $t('layout:search.close') }}</el-button
      >
    </el-form-item>
  </el-form>
</template>

<script setup>
import { useLocaleForm } from '@/composables/useLocaleForm'
import { t } from '@/i18n/adapter'
import { usePasswordRule } from '@/utils/passwordRule'
import { updateUserPwd } from '@/api/system/user'

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.pwdRef))
const { infoPwdValidator } = usePasswordRule()

const user = reactive({
  oldPassword: undefined,
  newPassword: undefined,
  confirmPassword: undefined,
})

const equalToPassword = (rule, value, callback) => {
  if (user.newPassword !== value) {
    callback(new Error(t('auth:register.passwordMismatch')))
  } else {
    callback()
  }
}
const rules = ref({
  oldPassword: [
    {
      required: true,
      get message() {
        return t('system:currentPasswordIsRequired')
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    {
      required: true,
      get message() {
        return t('system:confirmYourPassword')
      },
      trigger: 'blur',
    },
    { required: true, validator: equalToPassword, trigger: 'blur' },
  ],
})

/** 提交按钮 */
function submit() {
  proxy.$refs.pwdRef.validate((valid) => {
    if (valid) {
      updateUserPwd(user.oldPassword, user.newPassword).then(() => {
        proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
      })
    }
  })
}
/** 关闭按钮 */
function close() {
  proxy.$tab.closePage()
}
</script>
