import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  createLocaleRuntime,
  createLocaleRegistry,
  normalizeLocale,
} from '../../src/i18n/runtime.mjs'
const meta = JSON.parse(readFileSync(new URL('../../src/i18n/locale-meta.json', import.meta.url)))

test('the bundled registry includes every enabled locale and namespace', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    configFile: false,
    css: { postcss: { plugins: [] } },
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const { resources } = await server.ssrLoadModule('/src/i18n/registry.js')
    for (const { code } of meta.locales.filter((entry) => entry.enabled)) {
      const dir = new URL(`../../src/i18n/locales/${code}/`, import.meta.url)
      const files = readdirSync(dir).filter((name) => name.endsWith('.json'))
      const expected = Object.fromEntries(
        files.map((name) => [name.slice(0, -5), JSON.parse(readFileSync(new URL(name, dir)))])
      )
      assert.deepEqual(resources[code], expected)
    }
  } finally {
    await server.close()
  }
})

const resources = Object.fromEntries(
  meta.locales.map(({ code }) => [
    code,
    {
      common: JSON.parse(
        readFileSync(new URL(`../../src/i18n/locales/${code}/common.json`, import.meta.url))
      ),
    },
  ])
)
function setup(extra = {}) {
  const data = new Map()
  return createLocaleRuntime({
    meta,
    resources,
    scope: 'test:api',
    storage: { get: (k) => data.get(k), set: (k, v) => data.set(k, v) },
    ...extra,
  })
}
test('canonical locales, explicit aliases, and precise region fallback', () => {
  const runtime = setup()
  assert.equal(normalizeLocale('en_us'), 'en-US')
  assert.equal(normalizeLocale('../en'), null)
  assert.equal(normalizeLocale('x-acme'), 'x-acme')
  assert.equal(runtime.registry.resolve('en'), 'en-US')
  assert.equal(runtime.registry.resolve('zh-TW'), 'zh-CN')
  assert.equal(runtime.registry.resolve('auto', ['ja-JP', 'en-US']), 'en-US')
})
test('third language is configured, not a two-language branch', async () => {
  const expanded = {
    ...meta,
    locales: [
      ...meta.locales,
      {
        code: 'ja-JP',
        nativeName: '日本語',
        enabled: true,
        direction: 'ltr',
        aliases: ['ja'],
        fallback: ['en-US'],
      },
    ],
  }
  const runtime = setup({
    meta: expanded,
    resources: { ...resources, 'ja-JP': { common: { language: '言語' } } },
  })
  await runtime.setPreference('ja-JP')
  assert.equal(runtime.locale, 'ja-JP')
  assert.equal(runtime.t('common:language'), '言語')
  assert.equal(runtime.headers['Accept-Language'], 'ja-JP')
  assert.equal(runtime.resolveText('原名', { 'en-US': 'Fallback name' }), 'Fallback name')
})
test('save failure leaves active language and preference intact', async () => {
  const runtime = setup()
  runtime.setAccount(1, 'zh-CN', '0')
  await assert.rejects(
    runtime.setPreference('en-US', {
      save: async () => {
        throw Error('network')
      },
    })
  )
  assert.equal(runtime.locale, 'zh-CN')
  assert.equal(runtime.preference, 'zh-CN')
})
test('an old save cannot overwrite a new account', async () => {
  const runtime = setup()
  runtime.setAccount(1, 'zh-CN', '0')
  let done
  const pending = runtime.setPreference('en-US', {
    save: () =>
      new Promise((resolve) => {
        done = resolve
      }),
  })
  await Promise.resolve()
  runtime.setAccount(2, 'zh-CN', '0')
  done()
  await assert.rejects(pending)
  assert.equal(runtime.accountId, '2')
  assert.equal(runtime.locale, 'zh-CN')
})
test('an explicit login choice survives reload and is consumed only by a matching login', async () => {
  const data = new Map()
  const storage = { get: (key) => data.get(key), set: (key, value) => data.set(key, value) }
  const runtime = setup({ storage })
  await runtime.setPreference('en-US')
  const submitted = runtime.loginPreference
  await runtime.setPreference('auto')
  runtime.confirmLoginPreference(submitted)
  assert.equal(runtime.loginPreference, 'auto')

  const reloaded = setup({ storage })
  reloaded.initialize(false)
  assert.equal(reloaded.preference, 'auto')
  assert.equal(reloaded.loginPreference, 'auto')
  reloaded.confirmLoginPreference('auto')
  reloaded.setAccount(1, 'auto', '1')
  assert.equal(reloaded.loginPreference, null)
  await reloaded.setPreference('en-US', { save: async (locale) => ({ locale, revision: '2' }) })
  reloaded.setAccount(null)
  assert.equal(reloaded.preference, 'en-US')
  assert.equal(reloaded.loginPreference, null)

  const next = setup({ storage })
  next.initialize(false)
  assert.equal(next.preference, 'en-US')
  assert.equal(next.loginPreference, null)
  next.setAccount(2, 'fr-CA', '0')
  assert.equal(next.preference, 'fr-CA')
  assert.equal(next.locale, 'zh-CN')
})
test('auto follows changed device locale without changing the preference', async () => {
  let device = 'en-US'
  const runtime = setup({ deviceLocales: () => [device] })
  const languages = []
  const preferences = []
  runtime.engine.on('languageChanged', (code) => languages.push(code))
  runtime.engine.on('preferenceChanged', (value) => preferences.push(value))
  await runtime.setPreference('auto')
  const oldHeaders = runtime.headers
  device = 'en-GB'
  runtime.refreshDeviceLocale()
  device = 'zh-CN'
  runtime.refreshDeviceLocale()
  runtime.refreshDeviceLocale()
  assert.deepEqual(languages, ['en-US', 'zh-CN'])
  assert.deepEqual(preferences, ['auto'])
  assert.equal(runtime.preference, 'auto')
  assert.equal(runtime.locale, 'zh-CN')
  assert.equal(oldHeaders['Accept-Language'], 'en-US')
})
test('preference switches are serialized and recover after failed requests', async () => {
  const runtime = setup()
  runtime.setAccount(1, 'zh-CN', '0')
  const seen = []
  const save = async (value) => {
    seen.push(value)
    return { locale: value, revision: String(seen.length) }
  }
  await Promise.all([
    runtime.setPreference('en-US', { save }),
    runtime.setPreference('zh-CN', { save }),
  ])
  assert.deepEqual(seen, ['en-US', 'zh-CN'])
  assert.equal(runtime.locale, 'zh-CN')
})
test('fallback cycles and missing resources fail at registration', () => {
  assert.throws(
    () =>
      createLocaleRegistry(
        { ...meta, locales: meta.locales.map((item) => ({ ...item, fallback: [item.code] })) },
        resources
      ),
    /cycle/
  )
  assert.throws(() => createLocaleRegistry(meta, {}), /Missing/)
})
