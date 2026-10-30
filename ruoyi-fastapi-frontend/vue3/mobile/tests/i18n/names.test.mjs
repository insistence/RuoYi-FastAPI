import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateTranslationPatch, localizeDictionary } from '../../src/i18n/names.mjs'
import { createLocaleRuntime } from '../../src/i18n/runtime.mjs'

test('translation edits preserve unknown languages and distinguish removal from no edit', () => {
  const original = { 'en-US': 'Users', 'ja-JP': 'ユーザー' }
  let patch = updateTranslationPatch({}, original, 'en-US', 'Accounts')
  assert.deepEqual(patch, { 'en-US': 'Accounts' })
  patch = updateTranslationPatch(patch, original, 'en-US', '')
  assert.deepEqual(patch, { 'en-US': null })
  assert.equal(original['ja-JP'], 'ユーザー')
  assert.deepEqual(updateTranslationPatch(patch, original, 'en-US', 'Users'), {})
})

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
    { label: '正常', value: '0', labelI18n: { 'en-US': 'Enabled', 'ja-JP': '有効' } },
    { label: '旧缓存', value: 'legacy' },
  ]
  await locale.setPreference('en-US')
  assert.deepEqual(
    localizeDictionary(cache, locale.resolveText).map((item) => item.label),
    ['Enabled', '旧缓存']
  )
  await locale.setPreference('ja-JP')
  assert.deepEqual(
    localizeDictionary(cache, locale.resolveText).map((item) => item.label),
    ['有効', '旧缓存']
  )
  assert.equal(cache[0].label, '正常')
  assert.deepEqual(
    localizeDictionary(cache, locale.resolveText).map((item) => item.value),
    ['0', 'legacy']
  )
})
