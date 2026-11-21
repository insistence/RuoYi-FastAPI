const fs = require('node:fs')
const path = require('node:path')
const Vue = require('vue')
const { createLocaleRuntime } = require('../../src/i18n/runtime.mjs')
const root = path.resolve(__dirname, '../../src/i18n')
const meta = JSON.parse(fs.readFileSync(path.join(root, 'locale-meta.json'), 'utf8'))
const resources = {}
for (const locale of meta.locales) {
  resources[locale.code] = {}
  const folder = path.join(root, 'locales', locale.code)
  for (const file of fs.readdirSync(folder)) {
    if (file.endsWith('.json'))
      resources[locale.code][file.slice(0, -5)] = JSON.parse(
        fs.readFileSync(path.join(folder, file), 'utf8')
      )
  }
}
const i18n = createLocaleRuntime({
  meta,
  resources,
  scope: 'test',
  storage: {
    get() {
      return null
    },
    set() {},
  },
  deviceLocales: () => ['zh-CN'],
})
const state = Vue.observable({ locale: i18n.locale })
i18n.engine.on('languageChanged', (locale) => {
  state.locale = locale
})
const t = (key, options) => {
  void state.locale
  return i18n.t(key, options)
}
Vue.prototype.$t = t
Vue.prototype.$locale = state
module.exports = { i18n, t, localeState: state }
