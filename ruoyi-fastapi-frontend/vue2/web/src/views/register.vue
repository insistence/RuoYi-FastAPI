<template>
  <div class="register">
    <el-form
      :validate-on-rule-change="false"
      ref="registerForm"
      :model="registerForm"
      :rules="registerRules"
      class="register-form"
    >
      <h3 class="title">{{ title }}</h3>
      <el-form-item prop="username">
        <el-input
          v-model="registerForm.username"
          type="text"
          auto-complete="off"
          :placeholder="$t('authCenter:interface.username')"
        >
          <svg-icon
            slot="prefix"
            icon-class="user"
            class="el-input__icon input-icon"
          />
        </el-input>
      </el-form-item>
      <el-form-item
        prop="password"
        :rules="registerPwdValidator"
      >
        <el-input
          v-model="registerForm.password"
          type="password"
          auto-complete="off"
          :placeholder="$t('authCenter:interface.password')"
          @keyup.enter.native="handleRegister"
        >
          <svg-icon
            slot="prefix"
            icon-class="password"
            class="el-input__icon input-icon"
          />
        </el-input>
      </el-form-item>
      <el-form-item prop="confirmPassword">
        <el-input
          v-model="registerForm.confirmPassword"
          type="password"
          auto-complete="off"
          :placeholder="$t('auth:register.confirmPassword')"
          @keyup.enter.native="handleRegister"
        >
          <svg-icon
            slot="prefix"
            icon-class="password"
            class="el-input__icon input-icon"
          />
        </el-input>
      </el-form-item>
      <el-form-item
        prop="code"
        v-if="captchaEnabled"
      >
        <el-input
          v-model="registerForm.code"
          auto-complete="off"
          :placeholder="$t('common:login.code')"
          style="width: 63%"
          @keyup.enter.native="handleRegister"
        >
          <svg-icon
            slot="prefix"
            icon-class="validCode"
            class="el-input__icon input-icon"
          />
        </el-input>
        <div class="register-code">
          <img
            :src="codeUrl"
            @click="getCode"
            class="register-code-img"
          />
        </div>
      </el-form-item>
      <el-form-item style="width: 100%">
        <el-button
          :loading="loading"
          size="medium"
          type="primary"
          style="width: 100%"
          @click.native.prevent="handleRegister"
        >
          <span v-if="!loading">{{ $t('auth:register.submit') }}</span>
          <span v-else>{{ $t('auth:register.submitting') }}</span>
        </el-button>
        <div style="float: right">
          <router-link
            class="link-type"
            :to="'/login'"
            >{{ $t('common:alreadyHaveAnAccountSignIn') }}</router-link
          >
        </div>
      </el-form-item>
    </el-form>
    <!--  底部  -->
    <div class="el-register-footer">
      <span>{{ footerContent }}</span>
    </div>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getCodeImg, register } from '@/api/login'
import passwordRule from '@/utils/passwordRule'
import defaultSettings from '@/settings'

export default {
  mixins: [passwordRule],
  data() {
    return {
      title: process.env.VUE_APP_TITLE,
      footerContent: defaultSettings.footerContent,
      codeUrl: '',
      registerForm: {
        username: '',
        password: '',
        confirmPassword: '',
        code: '',
        uuid: '',
      },
      loading: false,
      captchaEnabled: true,
    }
  },
  computed: {
    registerRules() {
      return {
        username: [
          { required: true, trigger: 'blur', message: () => t('auth:register.usernameRequired') },
          {
            min: 2,
            max: 20,
            message: () => t('common:usernameMustBeBetween2And20Characters'),
            trigger: 'blur',
          },
        ],
        confirmPassword: [
          { required: true, message: () => t('auth:register.confirmRequired'), trigger: 'blur' },
          {
            validator: (rule, value, callback) => {
              if (this.registerForm.password !== value) {
                callback(new Error(t('auth:register.passwordMismatch')))
              } else {
                callback()
              }
            },
            trigger: 'blur',
          },
        ],
        code: [
          { required: true, trigger: 'change', message: () => t('common:login.codeRequired') },
        ],
      }
    },
  },
  created() {
    this.getCode()
  },
  methods: {
    getCode() {
      getCodeImg().then((res) => {
        this.captchaEnabled = res.captchaEnabled === undefined ? true : res.captchaEnabled
        if (this.captchaEnabled) {
          this.codeUrl = 'data:image/gif;base64,' + res.img
          this.registerForm.uuid = res.uuid
        }
      })
    },
    handleRegister() {
      this.$refs.registerForm.validate((valid) => {
        if (valid) {
          this.loading = true
          register(this.registerForm)
            .then(() => {
              const username = this.registerForm.username
              this.$alert(t('auth:register.success', { username }), t('common:notice'), {
                type: 'success',
              })
                .then(() => {
                  this.$router.push('/login')
                })
                .catch(() => {})
            })
            .catch(() => {
              this.loading = false
              if (this.captchaEnabled) {
                this.getCode()
              }
            })
        }
      })
    },
  },
}
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
.register {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-image: url('../assets/images/login-background.jpg');
  background-size: cover;
}
.title {
  margin: 0px auto 30px auto;
  text-align: center;
  color: #707070;
}

.register-form {
  border-radius: 6px;
  background: #ffffff;
  width: 400px;
  padding: 25px 25px 5px 25px;
  .el-input {
    height: 38px;
    input {
      height: 38px;
    }
  }
  .input-icon {
    height: 39px;
    width: 14px;
    margin-left: 2px;
  }
}
.register-tip {
  font-size: 13px;
  text-align: center;
  color: #bfbfbf;
}
.register-code {
  width: 33%;
  height: 38px;
  float: right;
  img {
    cursor: pointer;
    vertical-align: middle;
  }
}
.el-register-footer {
  height: 40px;
  line-height: 40px;
  position: fixed;
  bottom: 0;
  width: 100%;
  text-align: center;
  color: #fff;
  font-family: Arial;
  font-size: 12px;
  letter-spacing: 1px;
}
.register-code-img {
  height: 38px;
}
</style>
