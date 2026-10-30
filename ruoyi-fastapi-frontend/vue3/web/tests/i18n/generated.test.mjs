import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLocaleRuntime } from '../../src/i18n/runtime.mjs'
import { registerGeneratedResources } from '../../src/i18n/generated.mjs'

test('generated module namespaces support additional registered languages and source fallback', async () => {
  const locales = ['zh-CN', 'en-US', 'ja-JP']
  const runtime = createLocaleRuntime({
    meta: {
      sourceLocale: 'zh-CN',
      defaultLocale: 'zh-CN',
      locales: locales.map((code) => ({
        code,
        enabled: true,
        aliases: [],
        fallback: code === 'zh-CN' ? [] : ['zh-CN'],
      })),
    },
    resources: Object.fromEntries(locales.map((code) => [code, { common: {} }])),
    scope: 'generated-test',
    storage: { get() {}, set() {} },
  })
  registerGeneratedResources(runtime, {
    './i18n/locales/zh-CN/generated.demo.tasks.json': {
      title: '任务',
      fields: { name: { label: '名称' } },
    },
    './i18n/locales/en-US/generated.demo.tasks.json': { title: 'Tasks' },
    './i18n/locales/ja-JP/generated.demo.tasks.json': { title: 'タスク' },
    './i18n/locales/fr-FR/generated.demo.tasks.json': { title: 'Tâches' },
  })
  await runtime.setPreference('en-US')
  assert.equal(runtime.t('generated.demo.tasks:title'), 'Tasks')
  assert.equal(runtime.t('generated.demo.tasks:fields.name.label'), '名称')
  await runtime.setPreference('ja-JP')
  assert.equal(runtime.t('generated.demo.tasks:title'), 'タスク')
  assert.equal(runtime.engine.hasResourceBundle('fr-FR', 'generated.demo.tasks'), false)
})
