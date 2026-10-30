import { t } from './adapter'

const pageTitles = {
  'pages/login': () => t('mobile:nav.login'),
  'pages/register': () => t('mobile:nav.register'),
  'pages/index': () => t('mobile:app.title'),
  'pages/work/index': () => t('mobile:nav.work'),
  'pages/mine/index': () => t('mobile:nav.mine'),
  'pages/mine/avatar/index': () => t('mobile:nav.avatar'),
  'pages/mine/info/index': () => t('mobile:nav.profile'),
  'pages/mine/info/edit': () => t('mobile:profile.edit'),
  'pages/mine/pwd/index': () => t('mobile:password.title'),
  'pages/mine/setting/index': () => t('mobile:settings.title'),
  'pages/mine/setting/timezone': () => t('mobile:timezone.title'),
  'pages/mine/help/index': () => t('mobile:help.title'),
  'pages/mine/about/index': () => t('mobile:about.title'),
  'pages/common/agreement/index': () => t('mobile:agreement.title'),
  'pages/common/privacy/index': () => t('mobile:privacy.title'),
  'pages/common/webview/index': () => t('mobile:nav.web'),
  'pages/common/textview/index': () => t('mobile:nav.text'),
}

/** 同步页面标题和原生标签，保留外部网页、文本内容的自定义标题。 */
export function refreshNavigation() {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  const title = page && pageTitles[page.route]
  if (title && !page.options?.title && !page.$page?.options?.title) {
    uni.setNavigationBarTitle({ title: title() })
  }
  const labels = [t('mobile:nav.home'), t('mobile:nav.work'), t('mobile:nav.mine')]
  labels.forEach((text, index) => {
    uni.setTabBarItem({ index, text, fail() {} })
  })
}
