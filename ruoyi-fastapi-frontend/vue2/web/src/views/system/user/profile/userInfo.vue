<template>
  <el-form
    :validate-on-rule-change="false"
    ref="form"
    :model="form"
    :rules="rules"
    label-width="80px"
  >
    <el-form-item
      :label="$t('system:user.nickname')"
      prop="nickName"
    >
      <el-input
        v-model="form.nickName"
        maxlength="30"
      />
    </el-form-item>
    <el-form-item
      :label="$t('system:user.phone')"
      prop="phonenumber"
    >
      <el-input
        v-model="form.phonenumber"
        maxlength="11"
      />
    </el-form-item>
    <el-form-item
      :label="$t('system:user.email')"
      prop="email"
    >
      <el-input
        v-model="form.email"
        maxlength="50"
      />
    </el-form-item>
    <el-form-item :label="$t('system:user.sex')">
      <el-radio-group v-model="form.sex">
        <el-radio label="0">{{ $t('system:user.male') }}</el-radio>
        <el-radio label="1">{{ $t('system:user.female') }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item>
      <el-button
        type="primary"
        size="mini"
        @click="submit"
        >{{ $t('common:save') }}</el-button
      >
      <el-button
        type="danger"
        size="mini"
        @click="close"
        >{{ $t('layout:search.close') }}</el-button
      >
    </el-form-item>
  </el-form>
</template>

<script>
import { t } from '@/i18n/adapter'

import { updateUserProfile } from '@/api/system/user'

export default {
  props: {
    user: {
      type: Object,
    },
  },
  data() {
    return {
      form: {},
      // 表单校验
      rules: {
        nickName: [
          { required: true, message: () => t('system:user.nicknameRequired'), trigger: 'blur' },
        ],
        email: [
          { required: true, message: () => t('system:emailAddressIsRequired'), trigger: 'blur' },
          {
            type: 'email',
            message: () => t('system:dept.enterAValidEmailAddress'),
            trigger: ['blur', 'change'],
          },
        ],
        phonenumber: [
          { required: true, message: () => t('system:user.phoneRequired'), trigger: 'blur' },
          {
            pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/,
            message: () => t('system:user.phoneInvalid'),
            trigger: 'blur',
          },
        ],
      },
    }
  },
  watch: {
    user: {
      handler(user) {
        if (user) {
          this.form = {
            nickName: user.nickName,
            phonenumber: user.phonenumber,
            email: user.email,
            sex: user.sex,
          }
        }
      },
      immediate: true,
    },
  },
  methods: {
    submit() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          updateUserProfile(this.form).then(() => {
            this.$modal.msgSuccess(t('common:updateSuccess'))
            this.user.phonenumber = this.form.phonenumber
            this.user.email = this.form.email
          })
        }
      })
    },
    close() {
      this.$tab.closePage()
    },
  },
}
</script>
