import { t } from '@/i18n/adapter'
/**
 * 密码强度规则
 * 根据参数 chrtype 动态生成校验规则
 *
 * chrtype 说明：
 *   0 - 任意字符（默认）
 *   1 - 纯数字（0-9）
 *   2 - 纯字母（a-z / A-Z）
 *   3 - 字母 + 数字（必须同时包含）
 *   4 - 字母 + 数字 + 特殊字符（必须同时包含，特殊字符：~!@#$%^&*()-=_+）
 */
import { computed, ref } from 'vue'
import cache from '@/plugins/cache'

// 各类型对应的正则、错误提示
const PWD_RULES = {
  0: {
    pattern: /^[^<>"'|\\]+$/,
    message: () => t('auth:password.illegalCharacters', { characters: String.raw`< > " ' \ |` }),
  },
  1: { pattern: /^[0-9]+$/, message: () => t('auth:password.digits') },
  2: { pattern: /^[a-zA-Z]+$/, message: () => t('auth:password.letters') },
  3: {
    pattern: /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/,
    message: () => t('auth:password.lettersAndDigits'),
  },
  4: {
    pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*()\-=_+])[A-Za-z\d~!@#$%^&*()\-=_+]+$/,
    message: () => t('auth:password.complex', { characters: '~!@#$%^&*()-=_+' }),
  },
}

export default {
  data() {
    return {
      // 密码限制类型
      pwdChrType: cache.session.get('pwrChrtype') || '0',
    }
  },
  computed: {
    // 默认密码校验
    pwdValidator() {
      const rule = PWD_RULES[this.pwdChrType] || PWD_RULES['0']
      return [
        { required: true, message: () => t('auth:password.required'), trigger: 'blur' },
        {
          min: 6,
          max: 20,
          message: () => t('auth:password.length', { min: 6, max: 20 }),
          trigger: 'blur',
        },
        { pattern: rule.pattern, message: rule.message, trigger: 'blur' },
      ]
    },
    // 校验prompt的inputValidator函数
    pwdPromptValidator() {
      const rule = PWD_RULES['0']
      return (value) => {
        if (!value || value.length < 6 || value.length > 20) {
          return t('auth:password.length', { min: 6, max: 20 })
        }
        if (!rule.pattern.test(value)) {
          return rule.message()
        }
      }
    },
    // 个人中心密码校验
    infoPwdValidator() {
      const rule = PWD_RULES[this.pwdChrType] || PWD_RULES['0']
      return [
        { required: true, message: () => t('auth:password.newRequired'), trigger: 'blur' },
        {
          min: 6,
          max: 20,
          message: () => t('auth:password.length', { min: 6, max: 20 }),
          trigger: 'blur',
        },
        { pattern: rule.pattern, message: rule.message, trigger: 'blur' },
      ]
    },
    // 注册页面密码校验
    registerPwdValidator() {
      const rule = PWD_RULES['0']
      return [
        { required: true, message: () => t('auth:register.passwordRequired'), trigger: 'blur' },
        {
          min: 6,
          max: 20,
          message: () => t('auth:password.length', { min: 6, max: 20 }),
          trigger: 'blur',
        },
        { pattern: rule.pattern, message: rule.message, trigger: 'blur' },
      ]
    },
  },
}

/** 创建认证页面使用的密码规则，复用后台的规则定义。 */
export function usePasswordRule() {
  const pwdChrType = ref(cache.session.get('pwrChrtype') || '0')
  const infoPwdValidator = computed(() => {
    const rule = PWD_RULES[pwdChrType.value] || PWD_RULES['0']
    return [
      { required: true, message: () => t('auth:password.newRequired'), trigger: 'blur' },
      {
        min: 6,
        max: 20,
        message: () => t('auth:password.length', { min: 6, max: 20 }),
        trigger: 'blur',
      },
      { pattern: rule.pattern, message: rule.message, trigger: 'blur' },
    ]
  })
  return { pwdChrType, infoPwdValidator }
}
