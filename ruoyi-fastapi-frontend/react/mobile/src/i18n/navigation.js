import { useEffect } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { t } from './index'
import { useI18n } from './adapter'

const titles = {
  'pages/login': () => t('mobile:ruoyiFastapiMobileSignIn'),
  'pages/register': () => t('mobile:ruoyiFastapiMobileSignUp'),
  'pages/index': () => t('mobile:navigation.home'),
  'pages/work/index': () => t('mobile:navigation.work'),
  'pages/mine/index': () => t('mobile:navigation.me'),
  'pages/mine/avatar/index': () => t('mobile:chooseAvatar'),
  'pages/mine/info/index': () => t('mobile:viewProfile'),
  'pages/mine/info/edit': () => t('mobile:editProfile'),
  'pages/mine/pwd/index': () => t('mobile:changePassword'),
  'pages/mine/setting/index': () => t('mobile:appSettings'),
  'pages/mine/setting/timezone': () => t('mobile:timeZoneSettings'),
  'pages/mine/help/index': () => t('mobile:frequentlyAskedQuestions'),
  'pages/mine/about/index': () => t('mobile:aboutUs'),
  'pages/common/agreement/index': () => t('mobile:userAgreement'),
  'pages/common/privacy/index': () => t('mobile:privacyPolicy'),
}

export function refreshNavigation() {
  let route
  try {
    route = Taro.getCurrentPages().at(-1)?.route?.replace(/^\//, '').split('?')[0]
    if (titles[route])
      Promise.resolve(Taro.setNavigationBarTitle({ title: titles[route]() })).catch(() => {})
  } catch {}
  if (typeof Taro.setTabBarItem !== 'function') return
  const tabs = [t('mobile:navigation.home'), t('mobile:navigation.work'), t('mobile:navigation.me')]
  tabs.forEach((text, index) => {
    // 登录页或尚未创建原生 TabBar 时，下一次 onShow 会重新同步。
    try {
      Promise.resolve(Taro.setTabBarItem({ index, text })).catch(() => {})
    } catch {}
  })
}

export function usePageLocale() {
  const { locale } = useI18n()
  useDidShow(refreshNavigation)
  useEffect(refreshNavigation, [locale])
}
