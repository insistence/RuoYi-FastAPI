import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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

import cache from '@/plugins/cache'

// 密码限制类型

// 各类型对应的正则、错误提示
const PWD_RULES = {
  0: {
    pattern: /^[^<>"'|\\]+$/,
    get message() {
      return t('common:passwordMustNotContainOr')
    },
  },
  1: {
    pattern: /^[0-9]+$/,
    get message() {
      return t('common:passwordMustContainOnlyDigits09')
    },
  },
  2: {
    pattern: /^[a-zA-Z]+$/,
    get message() {
      return t('common:passwordMustContainOnlyEnglishLettersAZA')
    },
  },
  3: {
    pattern: /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/,
    get message() {
      return t('auth:password.lettersAndDigits')
    },
  },
  4: {
    pattern: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*()\-=_+])[A-Za-z\d~!@#$%^&*()\-=_+]+$/,
    get message() {
      return t('common:passwordMustContainLettersDigitsAndSpecialCharacters')
    },
  },
}

export function usePasswordRule() {
  useI18n()

  const pwdChrType = cache.session.get('pwrChrtype') || '0'
  // 默认密码校验
  const pwdValidator = (() => {
    const rule = PWD_RULES[pwdChrType] || PWD_RULES['0']
    return [
      { required: true, message: t('auth:password.required'), trigger: 'blur' },
      {
        min: 6,
        max: 20,
        message: t('common:passwordMustContain620Characters'),
        trigger: 'blur',
      },
      { pattern: rule.pattern, message: rule.message, trigger: 'blur' },
    ]
  })()
  // 校验prompt的inputValidator函数
  const pwdPromptValidator = (value) => {
    const rule = PWD_RULES['0']
    if (!value || value.length < 6 || value.length > 20) {
      return t('common:passwordMustContain620Characters')
    }
    if (!rule.pattern.test(value)) {
      return rule.message
    }
  }
  // 个人中心密码校验
  const infoPwdValidator = (() => {
    const rule = PWD_RULES[pwdChrType] || PWD_RULES['0']
    return [
      { required: true, message: t('auth:password.newRequired'), trigger: 'blur' },
      {
        min: 6,
        max: 20,
        message: t('common:newPasswordMustContain620Characters'),
        trigger: 'blur',
      },
      { pattern: rule.pattern, message: rule.message, trigger: 'blur' },
    ]
  })()
  // 注册页面密码校验
  const registerPwdValidator = (() => {
    const rule = PWD_RULES['0']
    return [
      { required: true, message: t('common:login.passwordRequired'), trigger: 'blur' },
      {
        min: 6,
        max: 20,
        message: t('common:userPasswordMustContain620Characters'),
        trigger: 'blur',
      },
      { pattern: rule.pattern, message: rule.message, trigger: 'blur' },
    ]
  })()

  return {
    pwdChrType,
    pwdValidator,
    infoPwdValidator,
    pwdPromptValidator,
    registerPwdValidator,
  }
}
