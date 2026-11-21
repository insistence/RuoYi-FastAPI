import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLocaleRuntime } from '../../src/i18n/runtime.mjs'
import { createPluginLocaleRuntime } from '../../src/i18n/plugin.mjs'

const entry = (code, fallback = []) => ({
  code,
  enabled: true,
  direction: 'ltr',
  aliases: [],
  fallback,
})
const hostMeta = {
  sourceLocale: 'zh-CN',
  defaultLocale: 'zh-CN',
  locales: [entry('zh-CN'), entry('en-US'), entry('ja-JP')],
}
function hostRuntime() {
  return createLocaleRuntime({
    meta: hostMeta,
    resources: Object.fromEntries(
      hostMeta.locales.map(({ code }) => [code, { common: { hello: code } }])
    ),
    storage: { get() {}, set() {} },
    scope: 'plugin-test',
  })
}
function plugin(host, namespace = 'plugin.demo') {
  return createPluginLocaleRuntime({
    host,
    namespace,
    meta: {
      sourceLocale: 'zh-CN',
      defaultLocale: 'en-US',
      languageFallbacks: { en: 'en-US' },
      locales: [entry('zh-CN'), entry('en-US', ['zh-CN'])],
    },
    resources: {
      'zh-CN': { [namespace]: { hello: '你好', sourceOnly: '源语言' } },
      'en-US': { [namespace]: { hello: 'Hello' } },
    },
  })
}

test('source plugins resolve the host language using only their own defaults and fallback chain', async () => {
  const host = hostRuntime()
  const first = plugin(host)
  const second = plugin(host, 'plugin.other')
  assert.equal(first.t('hello'), '你好')
  await host.setPreference('en-US')
  assert.equal(first.t('hello'), 'Hello')
  assert.equal(first.t('sourceOnly'), '源语言')
  await host.setPreference('ja-JP')
  assert.equal(host.locale, 'ja-JP')
  assert.equal(host.headers['Accept-Language'], 'ja-JP')
  assert.equal(first.locale, 'en-US')
  assert.equal(first.t('hello'), 'Hello')
  assert.equal(host.engine.hasResourceBundle('en-US', 'plugin.demo'), false)
  assert.equal(first.engine.hasResourceBundle('en-US', 'plugin.other'), false)
  assert.equal(second.t('hello'), 'Hello')
})

test('unregistering and registering a plugin changes only its instance and preserves its catalogs', async () => {
  const host = hostRuntime()
  const first = plugin(host)
  const second = plugin(host, 'plugin.other')
  first.removePluginLocales()
  await host.setPreference('en-US')
  assert.equal(first.locale, 'zh-CN')
  assert.equal(first.engine.hasResourceBundle('en-US', 'plugin.demo'), false)
  assert.equal(second.t('hello'), 'Hello')
  assert.equal(host.t('common:hello'), 'en-US')
  first.registerPluginLocales()
  first.registerPluginLocales()
  assert.equal(first.locale, 'en-US')
  assert.equal(first.t('hello'), 'Hello')
  first.removePluginLocales()
  first.registerPluginLocales()
  assert.equal(first.t('sourceOnly'), '源语言')
})
