<template>
  <el-form
    :validate-on-rule-change="false"
    ref="form"
    :model="user"
    :rules="formRules"
    label-width="80px"
  >
    <el-form-item
      :label="$t('auth:password.old')"
      prop="oldPassword"
    >
      <el-input
        v-model="user.oldPassword"
        :placeholder="$t('auth:password.oldPlaceholder')"
        type="password"
        show-password
      />
    </el-form-item>
    <el-form-item
      :label="$t('auth:password.new')"
      prop="newPassword"
      :rules="infoPwdValidator"
    >
      <el-input
        v-model="user.newPassword"
        :placeholder="$t('auth:password.newPlaceholder')"
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
        :placeholder="$t('auth:password.confirmPlaceholder')"
        type="password"
        show-password
      />
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

import { updateUserPwd } from '@/api/system/user'
import passwordRule from '@/utils/passwordRule'

export default {
  mixins: [passwordRule],
  data() {
    return {
      user: {
        oldPassword: undefined,
        newPassword: undefined,
        confirmPassword: undefined,
      },
    }
  },
  computed: {
    formRules() {
      return {
        oldPassword: [
          { required: true, message: () => t('auth:password.oldRequired'), trigger: 'blur' },
        ],
        confirmPassword: [
          { required: true, message: () => t('auth:password.confirmRequired'), trigger: 'blur' },
          {
            validator: (rule, value, callback) => {
              if (this.user.newPassword !== value) {
                callback(new Error(t('auth:register.passwordMismatch')))
              } else {
                callback()
              }
            },
            trigger: 'blur',
          },
        ],
      }
    },
  },
  methods: {
    submit() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          updateUserPwd(this.user.oldPassword, this.user.newPassword).then(() => {
            this.$modal.msgSuccess(t('common:updateSuccess'))
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
