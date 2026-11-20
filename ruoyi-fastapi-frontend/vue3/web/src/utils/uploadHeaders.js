import { i18n } from '@/i18n'
import { localeState } from '@/i18n/adapter'
import { getToken } from '@/utils/auth'

/**
 * 获取本次上传的认证和语言请求头。
 *
 * @returns {Object} 上传请求头
 */
export function getUploadHeaders() {
  // 让上传组件的计算属性在语言切换时重新生成请求头。
  void localeState.locale
  return { Authorization: 'Bearer ' + getToken(), ...i18n.headers }
}
