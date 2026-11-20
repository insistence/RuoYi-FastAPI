import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createLocaleRuntime, createLocaleRegistry } from '../../src/i18n/runtime.mjs'

const meta = JSON.parse(readFileSync(new URL('../../src/i18n/locale-meta.json', import.meta.url)))
const resources = {
  'zh-CN': { common: { sample: '中文' } },
  'en-US': { common: { sample: 'English' } },
}
function setup(storage = { get: () => null, set: () => {} }, extra = {}) {
  return createLocaleRuntime({ meta, resources, scope: 'contract:api', storage, ...extra })
}
const key = 'contract:api:locale:v2:user:7'

test('declared language families preserve exact variants', () => {
  const registry = createLocaleRegistry(meta, resources)
  assert.equal(registry.resolve('auto', ['en-GB']), 'en-US')
  assert.equal(registry.resolve('auto', ['en-AU']), 'en-US')
  const expanded = {
    ...meta,
    defaultLocale: 'en-US',
    locales: [...meta.locales, { code: 'en-GB', enabled: true, aliases: [], fallback: ['en-US'] }],
  }
  const precise = createLocaleRegistry(expanded, { ...resources, 'en-GB': {} })
  assert.equal(precise.resolve('en-GB'), 'en-GB')
  assert.equal(precise.resolve('zh-TW'), 'en-US')
  assert.throws(
    () => createLocaleRegistry({ ...meta, languageFallbacks: { en: 'missing' } }, resources),
    /Invalid language fallback/
  )
})

test('source language supplies missing text independently of the negotiation default', async () => {
  const expanded = {
    ...meta,
    defaultLocale: 'en-US',
    locales: [...meta.locales, { code: 'ja-JP', enabled: true, aliases: [], fallback: [] }],
  }
  const runtime = setup(undefined, {
    meta: expanded,
    resources: { ...resources, 'ja-JP': { common: {} } },
  })
  assert.equal(runtime.registry.resolve('unknown'), 'en-US')
  await runtime.setPreference('ja-JP')
  assert.equal(runtime.t('common:sample'), '中文')
  assert.equal(runtime.resolveText('原始名称', { 'en-US': 'English name' }), '原始名称')
})

test('delayed save responses cannot overwrite a newer server revision from another tab', async () => {
  const data = new Map()
  const events = []
  const storage = {
    get: (k) => data.get(k),
    set: (k, v) => {
      data.set(k, v)
      events.push([k, v])
    },
  }
  const a = setup(storage),
    b = setup(storage)
  a.setAccount(7, 'zh-CN', '0')
  b.setAccount(7, 'zh-CN', '0')
  let release
  let server = { locale: 'zh-CN', revision: '0' }
  const delayed = a.setPreference('en-US', {
    save: async () => {
      server = { locale: 'en-US', revision: '1' }
      const response = { ...server }
      await new Promise((resolve) => {
        release = resolve
      })
      return response
    },
  })
  await Promise.resolve()
  await b.setPreference('auto', { save: async () => (server = { locale: 'auto', revision: '2' }) })
  a.acceptStorageEvent(key, data.get(key))
  const writes = events.length
  release()
  await delayed
  assert.deepEqual(server, { locale: 'auto', revision: '2' })
  assert.equal(a.preference, 'auto')
  assert.equal(b.preference, 'auto')
  assert.equal(events.length, writes)
  assert.deepEqual(JSON.parse(data.get(key)), server)
})

test('out-of-order storage and profile reads preserve the latest decimal revision', () => {
  const data = new Map()
  const storage = { get: (k) => data.get(k), set: (k, v) => data.set(k, v) }
  const runtime = setup(storage)
  runtime.setAccount(7, 'en-US', '9007199254740993')
  const old = JSON.stringify({ locale: 'zh-CN', revision: '9007199254740992' })
  data.set(key, old)
  runtime.acceptStorageEvent(key, old)
  runtime.setAccount(7, 'zh-CN', '9007199254740992')
  assert.equal(runtime.preference, 'en-US')
  assert.equal(runtime.preferenceRevision, '9007199254740993')
  assert.equal(JSON.parse(data.get(key)).revision, '9007199254740993')
  const restored = setup(storage)
  restored.initialize(true)
  assert.equal(restored.preference, 'en-US')
  assert.equal(restored.preferenceRevision, '9007199254740993')
})

test('timeout recovery uses the authoritative snapshot and rejects malformed snapshots', async () => {
  const runtime = setup()
  runtime.setAccount(7, 'zh-CN', '1')
  await runtime.setPreference('en-US', {
    save: async () => {
      throw Error('timeout')
    },
    readBack: async () => ({ locale: 'en-US', revision: '2' }),
  })
  assert.equal(runtime.preferenceRevision, '2')
  await assert.rejects(
    runtime.setPreference('zh-CN', { save: async () => ({ locale: 'zh-CN' }) }),
    /Invalid locale snapshot/
  )
  assert.equal(runtime.preference, 'en-US')
})

test('offline account snapshots, guest choices and API instances are isolated', async () => {
  const data = new Map()
  const storage = { get: (k) => data.get(k), set: (k, v) => data.set(k, v) }
  const runtime = setup(storage)
  await runtime.setPreference('auto')
  runtime.setAccount(7, 'en-US', '1')
  const restored = setup(storage)
  restored.initialize(true)
  assert.equal(restored.preference, 'en-US')
  assert.equal(restored.preferenceRevision, '1')
  restored.setAccount(8, 'zh-CN', '0')
  restored.acceptStorageEvent(key, JSON.stringify({ locale: 'auto', revision: '9' }))
  assert.equal(restored.preference, 'zh-CN')
  restored.setAccount(null)
  assert.equal(restored.preference, 'auto')
  const other = setup(storage, { scope: 'other:api' })
  other.initialize(true)
  assert.equal(other.accountId, null)
  assert.equal(other.preference, 'zh-CN')
})

test('refreshing the same account does not cancel a pending save', async () => {
  const runtime = setup()
  runtime.setAccount(7, 'zh-CN', '0')
  let finish
  const pending = runtime.setPreference('en-US', {
    save: () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  })
  await Promise.resolve()
  runtime.setAccount(7, 'zh-CN', '0')
  finish({ locale: 'en-US', revision: '1' })
  await pending
  assert.equal(runtime.preference, 'en-US')
  assert.equal(runtime.preferenceRevision, '1')
})

test('timeout read-back adopts a newer remote preference even when the requested change lost', async () => {
  const runtime = setup()
  runtime.setAccount(7, 'zh-CN', '1')
  await assert.rejects(
    runtime.setPreference('en-US', {
      save: async () => {
        throw Error('timeout')
      },
      readBack: async () => ({ locale: 'auto', revision: '3' }),
    }),
    /timeout/
  )
  assert.equal(runtime.preference, 'auto')
  assert.equal(runtime.preferenceRevision, '3')
})

test('invalid profile snapshots leave the current account and its revision intact', () => {
  const runtime = setup()
  runtime.setAccount(7, 'en-US', '4')
  assert.throws(() => runtime.setAccount(undefined, 'zh-CN', '4'), /Missing locale account/)
  assert.throws(() => runtime.setAccount(8, 'zh-CN', 4), /Invalid locale snapshot/)
  assert.throws(() => runtime.setAccount(8, 'zh-CN'), /Invalid locale snapshot/)
  assert.equal(runtime.accountId, '7')
  assert.equal(runtime.preferenceRevision, '4')
  assert.equal(runtime.preference, 'en-US')
})

test('dynamic names keep the database source when an application uses English source catalogs', async () => {
  const expanded = {
    ...meta,
    sourceLocale: 'en-US',
    locales: [...meta.locales, { code: 'ja-JP', enabled: true, fallback: [] }],
  }
  const runtime = setup(undefined, {
    meta: expanded,
    resources: { ...resources, 'ja-JP': { common: {} } },
  })
  const translations = { 'en-US': 'Users' }
  await runtime.setPreference('en-US')
  assert.equal(runtime.resolveText('用户管理', translations), 'Users')
  await runtime.setPreference('ja-JP')
  assert.equal(runtime.t('common:sample'), 'English')
  assert.equal(runtime.resolveText('用户管理', translations), '用户管理')
})

test('a missing key keeps explicit fallback text or uses a safe label and reports only once', (ctx) => {
  const warn = ctx.mock.method(console, 'warn', () => {})
  const runtime = setup(undefined, {
    appVersion: '2.0.0',
    resources: {
      ...resources,
      'en-US': { common: { translationUnavailable: 'Text unavailable' } },
    },
  })
  const t = runtime.engine.getFixedT('en-US', 'layout')
  const options = { name: 'Private name' }
  assert.equal(t('missing', { ...options, defaultValue: 'Hello {{name}}' }), 'Hello Private name')
  assert.equal(t('missing', options), 'Text unavailable')
  assert.equal(warn.mock.callCount(), 1)
  assert.deepEqual(warn.mock.calls[0].arguments, [
    'Missing translation',
    { namespace: 'layout', key: 'missing', locale: 'en-US', version: '2.0.0' },
  ])
})
