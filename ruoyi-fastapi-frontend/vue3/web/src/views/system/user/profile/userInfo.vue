<template>
  <el-form
    ref="userRef"
    :model="form"
    :rules="rules"
    :validate-on-rule-change="false"
    label-width="80px"
  >
    <el-form-item
      :label="$t('system:nickname')"
      prop="nickName"
    >
      <el-input
        v-model="form.nickName"
        maxlength="30"
      />
    </el-form-item>
    <el-form-item
      :label="$t('system:phoneNumber')"
      prop="phonenumber"
    >
      <el-input
        v-model="form.phonenumber"
        maxlength="11"
      />
    </el-form-item>
    <el-form-item
      :label="$t('system:email')"
      prop="email"
    >
      <el-input
        v-model="form.email"
        maxlength="50"
      />
    </el-form-item>
    <el-form-item :label="$t('system:genderLabel')">
      <el-radio-group v-model="form.sex">
        <el-radio value="0">{{ $t('system:male') }}</el-radio>
        <el-radio value="1">{{ $t('system:female') }}</el-radio>
      </el-radio-group>
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
import { updateUserProfile } from '@/api/system/user'

const props = defineProps({
  user: {
    type: Object,
  },
})

const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.userRef))

const form = ref({})
const rules = ref({
  nickName: [
    {
      required: true,
      get message() {
        return t('system:nicknameIsRequired')
      },
      trigger: 'blur',
    },
  ],
  email: [
    {
      required: true,
      get message() {
        return t('system:emailAddressIsRequired')
      },
      trigger: 'blur',
    },
    {
      type: 'email',
      get message() {
        return t('system:enterAValidEmailAddress')
      },
      trigger: ['blur', 'change'],
    },
  ],
  phonenumber: [
    {
      required: true,
      get message() {
        return t('system:phoneNumberIsRequired')
      },
      trigger: 'blur',
    },
    {
      pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/,
      get message() {
        return t('system:enterAValidPhoneNumber')
      },
      trigger: 'blur',
    },
  ],
})

/** 提交按钮 */
function submit() {
  proxy.$refs.userRef.validate((valid) => {
    if (valid) {
      updateUserProfile(form.value).then(() => {
        proxy.$modal.msgSuccess(t('system:updatedSuccessfully'))
        props.user.phonenumber = form.value.phonenumber
        props.user.email = form.value.email
      })
    }
  })
}

/** 关闭按钮 */
function close() {
  proxy.$tab.closePage()
}

// 回显当前登录用户信息
watch(
  () => props.user,
  (user) => {
    if (user) {
      form.value = {
        nickName: user.nickName,
        phonenumber: user.phonenumber,
        email: user.email,
        sex: user.sex,
      }
    }
  },
  { immediate: true }
)
</script>
