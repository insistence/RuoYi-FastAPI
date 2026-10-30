import { t } from './adapter'
import { i18n } from './index'

const pageTitles = {
  'pages/login': () => t('mobile:nav.login'),
  'pages/register': () => t('mobile:nav.register'),
  'pages/index': () => t('mobile:brand'),
  'pages/work/index': () => t('mobile:nav.work'),
  'pages/mine/index': () => t('mobile:nav.mine'),
  'pages/mine/avatar/index': () => t('mobile:nav.avatar'),
  'pages/mine/info/index': () => t('mobile:nav.profile'),
  'pages/mine/info/edit': () => t('mobile:profile.edit'),
  'pages/mine/pwd/index': () => t('mobile:settings.password'),
  'pages/mine/setting/index': () => t('mobile:settings.title'),
  'pages/mine/setting/timezone': () => t('mobile:settings.timezone'),
  'pages/mine/help/index': () => t('mobile:help.title'),
  'pages/mine/about/index': () => t('mobile:about.title'),
  'pages/common/agreement/index': () => t('mobile:agreement.title'),
  'pages/common/privacy/index': () => t('mobile:privacy.title'),
  'pages/common/webview/index': () => t('mobile:nav.webview'),
}

export function refreshNavigation() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  const title = current && pageTitles[current.route]
  if (title) uni.setNavigationBarTitle({ title: title() })
  const labels = [t('mobile:nav.home'), t('mobile:nav.work'), t('mobile:nav.mine')]
  labels.forEach((text, index) => {
    uni.setTabBarItem({ index, text, fail() {} })
  })
}

export default {
  install(Vue) {
    i18n.engine.on('languageChanged', () => Vue.nextTick(refreshNavigation))
    Vue.mixin({
      onShow() {
        this.$nextTick(refreshNavigation)
      },
    })
  },
}
