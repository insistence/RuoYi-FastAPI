import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inputComponents, selectComponents } from '../../src/utils/generator/config.js'
import {
  cleanDrawingDefaultValue,
  drawingDefaultValue,
  initDrawingDefaultValue,
} from '../../src/utils/generator/drawingDefault.js'
import { setMessageTranslator } from '../../src/i18n/message.mjs'
import { normalizePluginOperationLogDetail } from '../../src/utils/pluginPlanFormatter.js'
import { getPluginReleaseView } from '../../src/utils/pluginReleaseFormatter.js'
import { testLocale } from './localeFixture.mjs'
import { initialPreviewFile, previewFileLabel } from '../../src/views/tool/gen/preview.js'

test('generated locale resources retain distinct preview labels and full file identities', () => {
  const files = {
    'vue/index.vue.jinja2': '<template />',
    'python/do.py.jinja2': 'class Demo: pass',
    'frontend/src/i18n/locales/zh-CN/demo.json': '{}',
    'frontend/src/i18n/locales/en-US/demo.json': '{}',
    'backend/i18n/catalogs/en-US/LC_MESSAGES/core.po': 'msgid "demo"',
  }
  assert.equal(initialPreviewFile(files), 'python/do.py.jinja2')
  assert.equal(previewFileLabel('vue/index.vue.jinja2'), 'index.vue')
  assert.equal(previewFileLabel('do.py.jinja2'), 'do.py')
  const resourceKeys = Object.keys(files).filter((key) => !key.endsWith('.jinja2'))
  assert.deepEqual(resourceKeys.map(previewFileLabel), resourceKeys)
  assert.equal(new Set(Object.keys(files).map(previewFileLabel)).size, Object.keys(files).length)
})

test('preview defaults to an available resource when no Python model template exists', () => {
  assert.equal(
    initialPreviewFile({ 'frontend/src/i18n/locales/en-US/demo.json': '{}' }),
    'frontend/src/i18n/locales/en-US/demo.json'
  )
  assert.equal(initialPreviewFile({}), '')
})

test('palette labels follow the locale while cloned form values remain unchanged', async () => {
  setMessageTranslator(testLocale.t)
  await testLocale.setPreference('zh-CN')
  assert.equal(inputComponents[0].label, '单行文本')
  const existing = JSON.parse(JSON.stringify(selectComponents[0]))
  await testLocale.setPreference('en-US')
  assert.equal(inputComponents[0].label, 'Single-line text')
  assert.equal(existing.label, '下拉选择')
  assert.deepEqual(
    selectComponents[0].options.map((item) => item.value),
    existing.options.map((item) => item.value)
  )
  cleanDrawingDefaultValue()
  initDrawingDefaultValue()
  assert.equal(drawingDefaultValue[0].label, 'Phone number')
  assert.equal(drawingDefaultValue[0].vModel, 'mobile')
  await testLocale.setPreference('zh-CN')
  assert.equal(drawingDefaultValue[0].label, 'Phone number')
  cleanDrawingDefaultValue()
  setMessageTranslator(undefined)
})

test('translated release summaries retain the selected worker count', async () => {
  setMessageTranslator(testLocale.t)
  await testLocale.setPreference('en-US')
  const release = {
    status: 'ready',
    healthyWorkers: 2,
    disabledWorkers: 3,
    liveWorkers: 5,
    expectedWorkers: 6,
  }
  assert.match(
    getPluginReleaseView({ enabled: '0', release }).workerSummary,
    /2.*Live 5.*Expected 6/
  )
  assert.match(
    getPluginReleaseView({ enabled: '1', release }).workerSummary,
    /3.*Live 5.*Expected 6/
  )
  setMessageTranslator(undefined)
})

test('plugin validation groups retain their severity in each language', async () => {
  setMessageTranslator(testLocale.t)
  try {
    for (const locale of ['zh-CN', 'en-US']) {
      await testLocale.setPreference(locale)
      const detail = normalizePluginOperationLogDetail({
        result: { manifestIssues: [{}], manifestWarnings: [{}, { level: 'info' }] },
      })
      assert.deepEqual(
        detail.validationItems.map((item) => item.level),
        ['error', 'warning', 'info']
      )
    }
  } finally {
    setMessageTranslator(undefined)
  }
})
