import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { testLocale } from './localeFixture.mjs'

const userPage = readFileSync(
  new URL('../../src/views/system/user/index.vue', import.meta.url),
  'utf8'
)
const passwordItem = userPage.match(/<el-form-item\b[^>]*\bprop="password"[^>]*>/)[0]
const passwordLabel = new Function('$t', `return ${passwordItem.match(/:label="([^"]+)"/)[1]}`)

for (const [locale, expected] of [
  ['zh-CN', '用户密码'],
  ['en-US', 'Password'],
]) {
  test(`the actual user password field resolves to a string label in ${locale}`, async () => {
    await testLocale.setPreference(locale)
    assert.equal(passwordLabel(testLocale.t), expected)
    assert.equal(typeof testLocale.t('system:password.prompt', { name: 'test-user' }), 'string')
    assert.match(testLocale.t('system:password.prompt', { name: 'test-user' }), /test-user/)
  })
}
