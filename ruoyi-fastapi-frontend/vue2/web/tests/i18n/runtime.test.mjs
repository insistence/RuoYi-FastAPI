import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  createLocaleRuntime,
  createLocaleRegistry,
  normalizeLocale,
} from '../../src/i18n/runtime.mjs'
const meta = JSON.parse(readFileSync(new URL('../../src/i18n/locale-meta.json', import.meta.url)))
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
  runtime.setAccount(1, 'zh-CN')
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
  runtime.setAccount(1, 'zh-CN')
  let done
  const pending = runtime.setPreference('en-US', {
    save: () =>
      new Promise((resolve) => {
        done = resolve
      }),
  })
  await Promise.resolve()
  runtime.setAccount(2, 'zh-CN')
  done()
  await assert.rejects(pending)
  assert.equal(runtime.accountId, '2')
  assert.equal(runtime.locale, 'zh-CN')
})
test('guest preference returns after logout; unsupported account preference is retained', async () => {
  const runtime = setup()
  await runtime.setPreference('en-US')
  runtime.setAccount(1, 'fr-CA')
  assert.equal(runtime.preference, 'fr-CA')
  assert.equal(runtime.locale, 'zh-CN')
  runtime.setAccount(null)
  assert.equal(runtime.locale, 'en-US')
})
test('auto follows changed device locale without changing the preference', async () => {
  let device = 'en-US'
  const runtime = setup({ deviceLocales: () => [device] })
  await runtime.setPreference('auto')
  const oldHeaders = runtime.headers
  device = 'zh-CN'
  runtime.refreshDeviceLocale()
  assert.equal(runtime.preference, 'auto')
  assert.equal(runtime.locale, 'zh-CN')
  assert.equal(oldHeaders['Accept-Language'], 'en-US')
})
test('preference switches are serialized and recover after failed requests', async () => {
  const runtime = setup()
  runtime.setAccount(1)
  const seen = []
  const save = async (value) => {
    seen.push(value)
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
