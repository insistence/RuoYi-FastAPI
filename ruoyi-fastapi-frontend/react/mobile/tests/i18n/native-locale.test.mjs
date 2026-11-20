import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createLocaleRuntime } from '../../src/i18n/runtime.mjs'

test('RN auto reads native language priority and rereads it after foregrounding', async () => {
  let nativeLocales = [{ languageTag: 'ja-JP' }, { languageTag: 'en-US' }]
  const source = readFileSync(
    new URL('../../src/utils/deviceLocale.rn.js', import.meta.url),
    'utf8'
  )
  const getDeviceLocales = new Function(
    'getLocales',
    source.replace(/^import .*\n/gm, '').replace('export function', 'function') +
      '\nreturn getDeviceLocales'
  )(() => {
    if (nativeLocales instanceof Error) throw nativeLocales
    return nativeLocales
  })
  const meta = JSON.parse(readFileSync(new URL('../../src/i18n/locale-meta.json', import.meta.url)))
  const resources = Object.fromEntries(
    meta.locales.map(({ code }) => [code, { common: { ready: code } }])
  )
  const runtime = createLocaleRuntime({
    meta,
    resources,
    scope: 'native-test',
    storage: { get() {}, set() {} },
    deviceLocales: getDeviceLocales,
  })
  await runtime.setPreference('auto')
  assert.equal(runtime.locale, 'en-US')
  nativeLocales = [{ languageTag: 'zh_CN' }]
  runtime.refreshDeviceLocale()
  assert.equal(runtime.locale, 'zh-CN')
  assert.equal(runtime.preference, 'auto')
  nativeLocales = new Error('native service unavailable')
  assert.doesNotThrow(() => runtime.refreshDeviceLocale())
  assert.equal(runtime.locale, 'zh-CN')
})

test('login validation retains the key instead of capturing an old fixed translator', async () => {
  const source = readFileSync(new URL('../../src/pages/login.jsx', import.meta.url), 'utf8')
  const body = source.slice(
    source.indexOf('  async function submit() {'),
    source.indexOf('  return (')
  )
  const engine = createLocaleRuntime({
    meta: JSON.parse(readFileSync(new URL('../../src/i18n/locale-meta.json', import.meta.url))),
    resources: Object.fromEntries(
      ['zh-CN', 'en-US'].map((code) => [
        code,
        {
          common: JSON.parse(
            readFileSync(new URL(`../../src/i18n/locales/${code}/common.json`, import.meta.url))
          ),
        },
      ])
    ),
    scope: 'validation-test',
    storage: { get() {}, set() {} },
  }).engine
  let error
  const submit = new Function('lock', 'form', 'captcha', 'setError', 't', body + '\nreturn submit')(
    { current: false },
    { username: '', password: '', code: '' },
    { enabled: true },
    (value) => {
      error = value
    },
    engine.getFixedT('zh-CN', 'common')
  )
  await submit()
  assert.equal(error(engine.getFixedT('zh-CN', 'common')), '请输入您的账号')
  await engine.changeLanguage('en-US')
  assert.equal(error(engine.getFixedT('en-US', 'common')), 'Enter your username')
})
