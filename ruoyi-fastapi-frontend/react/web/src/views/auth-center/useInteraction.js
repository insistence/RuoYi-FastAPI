import { useCallback, useLayoutEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { completeInteraction } from '@/api/authCenter'
import {
  interactionRouteLocation,
  readInteractionCsrf,
  trustedCompletionUrl,
} from './interactionSecurity'

const ACTION_ROUTES = {
  login: '/auth-center/login',
  consent: '/auth-center/consent',
  changePassword: '/auth-center/change-password',
  error: '/auth-center/error',
}
/**
 * 创建认证页面共享的交互上下文。
 * @returns {Object} 当前交互标识、CSRF 凭据访问器、步骤跳转和错误处理方法
 */
export function useInteractionContext() {
  const location = useLocation()
  const navigate = useNavigate()
  const interactionId = new URLSearchParams(location.search).get('interaction') || ''
  const storageKey = `oidc:interaction:csrf:${interactionId}`
  // 按交互标识保存地址片段中的 CSRF 凭据，并立即从浏览器地址中移除片段。
  useLayoutEffect(() => {
    const token = readInteractionCsrf(window.location.hash)
    if (token && interactionId) {
      sessionStorage.setItem(storageKey, token)
      window.history.replaceState(
        window.history.state,
        '',
        interactionRouteLocation(location.pathname, interactionId)
      )
    }
  }, [interactionId, storageKey, location.pathname])
  /**
   * 读取当前认证交互的 CSRF 凭据。
   * @returns {string} 当前凭据，未保存或无交互标识时为空字符串
   */
  const csrfToken = useCallback(
    () => (interactionId ? sessionStorage.getItem(storageKey) || '' : ''),
    [interactionId, storageKey]
  )
  /** 清除当前交互保存在会话存储中的 CSRF 凭据。 */
  const clearInteraction = useCallback(() => {
    if (interactionId) sessionStorage.removeItem(storageKey)
  }, [interactionId, storageKey])
  /**
   * 校验同源完成地址，完成认证交互后跳转到服务端返回的应用地址。
   * @param {string} url 必须绑定当前交互标识的同源完成地址
   * @returns {Promise<void>} 完成交互并发起浏览器跳转
   * @throws {Error} 完成地址不可信、请求失败或响应中的跳转地址无效
   */
  const followServerRedirect = useCallback(
    async (url) => {
      if (!trustedCompletionUrl(url, window.location.origin, interactionId))
        throw new Error('认证流程返回了不受信任的跳转地址')
      const response = await completeInteraction(interactionId, csrfToken())
      const redirectUrl = response.data?.redirectUrl
      if (typeof redirectUrl !== 'string') throw new Error('认证流程返回了无效跳转地址')
      // 完成请求和响应校验成功后再清理凭据，失败时保留供用户重试。
      clearInteraction()
      window.location.assign(redirectUrl)
    },
    [interactionId, csrfToken, clearInteraction]
  )
  /**
   * 进入服务端指定的认证步骤；redirect 动作先完成交互再离开认证中心。
   * @param {string} action 下一步认证动作
   * @returns {void|Promise<void>} 路由导航或完成交互的结果
   * @throws {Error} 服务端返回了未定义的认证步骤
   */
  const goToAction = useCallback(
    (action) => {
      if (action === 'redirect')
        return followServerRedirect(
          `/auth/interaction/${encodeURIComponent(interactionId)}/complete`
        )
      const path = ACTION_ROUTES[action]
      if (!path) throw new Error('认证流程返回了无效步骤')
      navigate(interactionRouteLocation(path, interactionId), {
        replace: true,
      })
    },
    [interactionId, followServerRedirect, navigate]
  )
  /** 展示认证错误页，并替换当前历史记录。 */
  const fatal = useCallback(
    (message) =>
      navigate(`/auth-center/error?message=${encodeURIComponent(message)}`, {
        replace: true,
      }),
    [navigate]
  )
  return useMemo(
    () => ({
      interactionId,
      csrfToken,
      clearInteraction,
      goToAction,
      followServerRedirect,
      fatal,
    }),
    [interactionId, csrfToken, clearInteraction, goToAction, followServerRedirect, fatal]
  )
}
