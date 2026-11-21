import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { computed, createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

test('uni-app can change its app instance locale after the translation plugin is installed', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    configFile: false,
    resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
    css: { postcss: { plugins: [] } },
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const {
      default: plugin,
      localeState,
      useI18n,
    } = await server.ssrLoadModule('/src/i18n/adapter.js')
    const app = createSSRApp({
      created() {
        let locale = 'zh-CN'
        // uni-app 在应用实例上定义此属性，uni.setLocale 通过 Vue 代理写入。
        Object.defineProperty(this, '$locale', {
          get: () => locale,
          set: (value) => {
            locale = value
          },
        })
        this.$locale = 'en-US'
      },
      render() {
        return h('span', this.$locale)
      },
    })
    app.use(plugin)
    assert.equal('$locale' in app.config.globalProperties, false)
    assert.equal(await renderToString(app), '<span>en-US</span>')

    const language = computed(() => [localeState.locale, localeState.preference])
    assert.deepEqual(language.value, ['zh-CN', 'zh-CN'])
    const { engine } = useI18n().i18n
    await engine.changeLanguage('en-US')
    engine.emit('preferenceChanged', 'auto')
    assert.deepEqual(language.value, ['en-US', 'auto'])
  } finally {
    await server.close()
  }
})
