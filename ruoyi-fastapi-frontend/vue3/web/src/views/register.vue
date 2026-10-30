<template>
  <div class="register">
    <el-form
      ref="registerRef"
      :model="registerForm"
      :rules="registerRules"
      :validate-on-rule-change="false"
      class="register-form"
    >
      <LanguageSelect />
      <h3 class="title">{{ title }}</h3>
      <el-form-item prop="username">
        <el-input
          v-model="registerForm.username"
          type="text"
          size="large"
          auto-complete="off"
          :placeholder="$t('common:login.username')"
        >
          <template #prefix
            ><svg-icon
              icon-class="user"
              class="el-input__icon input-icon"
          /></template>
        </el-input>
      </el-form-item>
      <el-form-item
        prop="password"
        :rules="registerPwdValidator"
      >
        <el-input
          v-model="registerForm.password"
          type="password"
          size="large"
          auto-complete="off"
          :placeholder="$t('common:login.password')"
          @keyup.enter="handleRegister"
        >
          <template #prefix
            ><svg-icon
              icon-class="password"
              class="el-input__icon input-icon"
          /></template>
        </el-input>
      </el-form-item>
      <el-form-item prop="confirmPassword">
        <el-input
          v-model="registerForm.confirmPassword"
          type="password"
          size="large"
          auto-complete="off"
          :placeholder="$t('auth:register.confirmPassword')"
          @keyup.enter="handleRegister"
        >
          <template #prefix
            ><svg-icon
              icon-class="password"
              class="el-input__icon input-icon"
          /></template>
        </el-input>
      </el-form-item>
      <el-form-item
        prop="code"
        v-if="captchaEnabled"
      >
        <el-input
          size="large"
          v-model="registerForm.code"
          auto-complete="off"
          :placeholder="$t('common:login.code')"
          style="width: 63%"
          @keyup.enter="handleRegister"
        >
          <template #prefix
            ><svg-icon
              icon-class="validCode"
              class="el-input__icon input-icon"
          /></template>
        </el-input>
        <div class="register-code">
          <img
            :src="codeUrl"
            :alt="$t('auth:captcha.refresh')"
            @click="getCode"
            class="register-code-img"
          />
        </div>
      </el-form-item>
      <el-form-item style="width: 100%">
        <el-button
          :loading="loading"
          size="large"
          type="primary"
          style="width: 100%"
          @click.prevent="handleRegister"
        >
          <span v-if="!loading">{{ $t('auth:register.submit') }}</span>
          <span v-else>{{ $t('auth:register.submitting') }}</span>
        </el-button>
        <div style="float: right">
          <router-link
            class="link-type"
            :to="'/login'"
            >{{ $t('auth:register.signIn') }}</router-link
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

<script setup>
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { ElMessageBox } from 'element-plus'
import { getCodeImg, register } from '@/api/login'
import defaultSettings from '@/settings'
import { usePasswordRule } from '@/utils/passwordRule'

const title = import.meta.env.VITE_APP_TITLE
const footerContent = defaultSettings.footerContent
const router = useRouter()
const registerRef = ref(null)
useLocaleForm(registerRef)
const { registerPwdValidator } = usePasswordRule()

const registerForm = ref({
  username: '',
  password: '',
  confirmPassword: '',
  code: '',
  uuid: '',
})

const equalToPassword = (rule, value, callback) => {
  if (registerForm.value.password !== value) {
    callback(new Error(t('auth:register.passwordMismatch')))
  } else {
    callback()
  }
}

const registerRules = computed(() => ({
  username: [
    { required: true, trigger: 'blur', message: t('common:login.usernameRequired') },
    {
      min: 2,
      max: 20,
      message: t('auth:register.usernameLength', { min: 2, max: 20 }),
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, trigger: 'blur', message: t('auth:register.confirmRequired') },
    { required: true, validator: equalToPassword, trigger: 'blur' },
  ],
  code: [{ required: true, trigger: 'change', message: t('common:login.codeRequired') }],
}))

const codeUrl = ref('')
const loading = ref(false)
const captchaEnabled = ref(true)

function handleRegister() {
  registerRef.value.validate((valid) => {
    if (valid) {
      loading.value = true
      register(registerForm.value)
        .then((res) => {
          const username = registerForm.value.username
          ElMessageBox.alert(t('auth:register.success', { username }), t('common:notice'), {
            confirmButtonText: t('common:confirm'),
            type: 'success',
          })
            .then(() => {
              router.push('/login')
            })
            .catch(() => {})
        })
        .catch(() => {
          loading.value = false
          if (captchaEnabled.value) {
            getCode()
          }
        })
    }
  })
}

function getCode() {
  getCodeImg().then((res) => {
    captchaEnabled.value = res.captchaEnabled === undefined ? true : res.captchaEnabled
    if (captchaEnabled.value) {
      codeUrl.value = 'data:image/gif;base64,' + res.img
      registerForm.value.uuid = res.uuid
    }
  })
}

getCode()
</script>

<style lang="scss" scoped>
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
    height: 40px;
    input {
      height: 40px;
    }
  }
  .input-icon {
    height: 39px;
    width: 14px;
    margin-left: 0px;
  }
}
.register-tip {
  font-size: 13px;
  text-align: center;
  color: #bfbfbf;
}
.register-code {
  width: 33%;
  height: 40px;
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
  height: 40px;
  padding-left: 12px;
}
</style>
