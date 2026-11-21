import { refreshNavigation } from '@/i18n/navigation'
import LocalePlugin from '@/i18n/adapter'
import LanguageSelect from '@/components/LanguageSelect/index.vue'
import { i18n } from '@/i18n'
// @ts-nocheck
import { createSSRApp } from 'vue'
import App from './App.vue'
import store from './store' // store
import { install } from './plugins' // plugins
import './permission' // permission
import { useDict } from '@/utils/dict'

export function createApp() {
  const app = createSSRApp(App)
  app.use(store)
  app.use(LocalePlugin)
  app.mixin({ onShow: refreshNavigation })
  i18n.engine.on('languageChanged', refreshNavigation)
  app.component('LanguageSelect', LanguageSelect)
  app.config.globalProperties.useDict = useDict
  install(app)
  return {
    app,
  }
}
