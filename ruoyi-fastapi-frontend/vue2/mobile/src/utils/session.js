import store from '@/store'
import { getToken } from '@/utils/auth'
import { showConfirm } from '@/utils/common'

let sessionExpiredPromise = null

/**
 * 合并普通请求与上传的会话失效处理，避免重复确认、退出和跳转。
 * @param {string} token 发起请求时使用的令牌
 * @returns {Promise<boolean>} 是否已确认退出
 */
export function handleSessionExpired(token) {
  // 忽略旧会话的迟到响应，避免影响已经重新登录的账号。
  if (!token || token !== getToken()) return Promise.resolve(false)
  if (sessionExpiredPromise) return sessionExpiredPromise
  sessionExpiredPromise = Promise.resolve()
    .then(() => showConfirm('登录状态已过期，您可以继续留在该页面，或者重新登录?'))
    .then(async (result) => {
      if (!result.confirm || token !== getToken()) return false
      await store.dispatch('LogOut')
      uni.reLaunch({ url: '/pages/login' })
      return true
    })
    .catch(() => false)
    .finally(() => {
      sessionExpiredPromise = null
    })
  return sessionExpiredPromise
}
