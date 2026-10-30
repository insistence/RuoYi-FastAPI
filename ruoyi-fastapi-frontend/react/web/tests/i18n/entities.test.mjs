import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { translationPatch, localizeOptions } from '../../src/i18n/entities.mjs'
import { createLocaleRuntime } from '../../src/i18n/runtime.mjs'
import { registerGeneratedResources } from '../../src/i18n/generated.mjs'

const meta = JSON.parse(readFileSync(new URL('../../src/i18n/locale-meta.json', import.meta.url)))

function runtimeFor(config) {
  const data = new Map()
  return createLocaleRuntime({
    meta: config,
    resources: Object.fromEntries(
      config.locales.map(({ code }) => [code, { common: { fixture: 'fixture' } }])
    ),
    storage: { get: (key) => data.get(key), set: (key, value) => data.set(key, value) },
    scope: 'entity-test',
    deviceLocales: () => [],
  })
}

test('translation patches preserve omitted languages and explicitly delete cleared fields', () => {
  const original = { 'en-US': 'Name', 'fr-FR': 'Nom', 'ja-JP': '名前' }
  assert.deepEqual(
    translationPatch({ 'en-US': '  Renamed  ', 'fr-FR': '', 'ja-JP': undefined }, original),
    { 'en-US': 'Renamed', 'fr-FR': null }
  )
  assert.deepEqual(translationPatch({ 'en-US': 'Name' }, original), {})
  assert.equal(original['fr-FR'], 'Nom')
})

test('dictionary and tree labels follow the locale without changing values or source records', async () => {
  const runtime = runtimeFor(meta)
  const options = [
    {
      label: '原名',
      labelI18n: { 'en-US': 'Translated name' },
      value: 'business-code',
      children: [{ label: '旧缓存名称', value: 0 }],
    },
  ]
  await runtime.setPreference('en-US')
  const translated = localizeOptions(options, runtime.resolveText)
  assert.equal(translated[0].label, 'Translated name')
  assert.equal(translated[0].value, 'business-code')
  assert.equal(translated[0].children[0].label, '旧缓存名称')
  assert.equal(translated[0].children[0].value, 0)
  await runtime.setPreference('zh-CN')
  assert.equal(localizeOptions(options, runtime.resolveText)[0].label, '原名')
  assert.equal(options[0].label, '原名')
})

test('copied generated catalogs register independent namespaces and support a configured third locale', async () => {
  const expanded = {
    ...meta,
    locales: [
      ...meta.locales,
      {
        code: 'fr-FR',
        nativeName: 'Français',
        enabled: true,
        direction: 'ltr',
        aliases: ['fr'],
        fallback: ['en-US'],
      },
    ],
  }
  const runtime = runtimeFor(expanded)
  registerGeneratedResources(runtime, {
    './i18n/locales/zh-CN/generated.system.example.json': { title: '示例管理' },
    './i18n/locales/en-US/generated.system.example.json': {
      title: 'Example management',
      create: 'Create example',
    },
    './i18n/locales/fr-FR/generated.system.example.json': { title: 'Gestion des exemples' },
    './i18n/locales/en-US/common.json': { injected: 'not a generated module' },
  })
  await runtime.setPreference('fr-FR')
  assert.equal(runtime.t('generated.system.example:title'), 'Gestion des exemples')
  assert.equal(runtime.t('generated.system.example:create'), 'Create example')
  assert.equal(runtime.engine.exists('common:injected'), false)
})
