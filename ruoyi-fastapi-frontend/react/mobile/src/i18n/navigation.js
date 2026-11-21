import { useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { t } from './index'
import { useI18n } from './adapter'

const titles = {
  'pages/login': () => t('auth:login.title'),
  'pages/register': () => t('auth:register.title'),
  'pages/index': () => t('mobile:nav.home'),
  'pages/work/index': () => t('mobile:nav.work'),
  'pages/mine/index': () => t('mobile:nav.mine'),
  'pages/mine/avatar/index': () => t('mobile:avatar.choose'),
  'pages/mine/info/index': () => t('mobile:profile.view'),
  'pages/mine/info/edit': () => t('mobile:profile.edit'),
  'pages/mine/pwd/index': () => t('auth:password.title'),
  'pages/mine/setting/index': () => t('mobile:settings.title'),
  'pages/mine/setting/timezone': () => t('mobile:timezone.title'),
  'pages/mine/help/index': () => t('mobile:help.title'),
  'pages/mine/about/index': () => t('mobile:about.title'),
  'pages/common/agreement/index': () => t('mobile:agreement.title'),
  'pages/common/privacy/index': () => t('mobile:privacy.title'),
}

export function refreshNavigation() {
  let route
  try {
    route = Taro.getCurrentPages().at(-1)?.route?.replace(/^\//, '').split('?')[0]
    if (titles[route])
      Promise.resolve(Taro.setNavigationBarTitle({ title: titles[route]() })).catch(() => {})
  } catch {}
  if (typeof Taro.setTabBarItem !== 'function') return
  const tabs = [t('mobile:nav.home'), t('mobile:nav.work'), t('mobile:nav.mine')]
  tabs.forEach((text, index) => {
    // 登录页或尚未创建原生 TabBar 时，下一次 onShow 会重新同步。
    try {
      Promise.resolve(Taro.setTabBarItem({ index, text })).catch(() => {})
    } catch {}
  })
}

/**
 * 在页面显示或语言变化时更新导航文案。
 *
 * @returns {string} 当前页面使用的语言标识
 */
export function usePageLocale() {
  const { locale } = useI18n()
  useDidShow(refreshNavigation)
  useEffect(refreshNavigation, [locale])
  return locale
}
