import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inputComponents, selectComponents } from '../../src/utils/generator/config.js'
import {
  cleanDrawingDefaultValue,
  drawingDefaultValue,
  initDrawingDefaultValue,
} from '../../src/utils/generator/drawingDefault.js'
import { setMessageTranslator } from '../../src/i18n/message.mjs'
import { getPluginReleaseView } from '../../src/utils/pluginReleaseFormatter.js'
import { testLocale } from './localeFixture.mjs'

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
