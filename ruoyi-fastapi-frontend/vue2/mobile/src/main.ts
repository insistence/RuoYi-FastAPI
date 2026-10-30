import LocalePlugin from '@/i18n/adapter'
import NavigationPlugin from '@/i18n/navigation'
import LanguageSelect from '@/components/LanguageSelect/index.vue'
import { i18n } from '@/i18n'
import { getToken } from '@/utils/auth'
// @ts-nocheck
import Vue from 'vue'
import App from './App.vue'
import './app.css'
import store from './store'
import plugins from './plugins'
import './permission'
import { getDicts } from '@/api/system/dict/data'

Vue.use(plugins)
Vue.use(LocalePlugin)
Vue.use(NavigationPlugin)
Vue.component('LanguageSelect', LanguageSelect)
i18n.initialize(Boolean(getToken()))
Vue.config.productionTip = false
Vue.prototype.$store = store
Vue.prototype.getDicts = getDicts
App.mpType = 'app'
const app = new Vue({
  ...App,
})
app.$mount()
