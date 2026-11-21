import assert from 'node:assert/strict'
import { test } from 'node:test'
import { localizeDictionary } from '../../src/i18n/names.mjs'
import { createLocaleRuntime } from '../../src/i18n/runtime.mjs'

test('cached dictionaries switch through a third language without changing business values', async () => {
  const locale = createLocaleRuntime({
    meta: {
      sourceLocale: 'zh-CN',
      defaultLocale: 'zh-CN',
      locales: [
        { code: 'zh-CN', enabled: true, fallback: [] },
        { code: 'en-US', enabled: true, fallback: ['zh-CN'] },
        { code: 'ja-JP', enabled: true, fallback: ['en-US'] },
      ],
    },
    resources: { 'zh-CN': { common: {} }, 'en-US': { common: {} }, 'ja-JP': { common: {} } },
    storage: { get() {}, set() {} },
  })
  const cache = [
    { originalLabel: '正常', value: '0', labelI18n: { 'en-US': 'Enabled', 'ja-JP': '有効' } },
    { originalLabel: '普通', value: 'basic' },
  ]
  await locale.setPreference('en-US')
  assert.deepEqual(
    localizeDictionary(cache, locale.resolveText).map((item) => item.label),
    ['Enabled', '普通']
  )
  await locale.setPreference('ja-JP')
  assert.deepEqual(
    localizeDictionary(cache, locale.resolveText).map((item) => item.label),
    ['有効', '普通']
  )
  assert.equal(cache[0].originalLabel, '正常')
  assert.deepEqual(
    localizeDictionary(cache, locale.resolveText).map((item) => item.value),
    ['0', 'basic']
  )
})
