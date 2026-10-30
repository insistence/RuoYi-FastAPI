import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const Vue = require('vue')
const { i18n, t } = require('./test-runtime.cjs')

function component(name) {
  const source = readFileSync(
    new URL(`../../src/components/${name}/index.vue`, import.meta.url),
    'utf8'
  ).match(/<script>([\s\S]*?)<\/script>/)[1]
  return new Function(
    'getToken',
    'i18n',
    't',
    source.replace(/^import .*\n/gm, '').replace('export default', 'return')
  )(() => 'test-token', i18n, t)
}

test('direct uploads use the selected locale without mutating an earlier request snapshot', async () => {
  for (const name of ['Editor', 'FileUpload', 'ImageUpload', 'ExcelImportDialog']) {
    await i18n.setPreference('zh-CN')
    const definition = component(name)
    const vm = new Vue({ computed: { headers: definition.computed.headers } })
    const previousHeaders = vm.headers
    assert.equal(previousHeaders['Accept-Language'], 'zh-CN', name)
    await i18n.setPreference('en-US')
    await Vue.nextTick()
    assert.equal(vm.headers['Accept-Language'], 'en-US', name)
    assert.equal(previousHeaders['Accept-Language'], 'zh-CN', name)
    assert.equal(vm.headers.Authorization, 'Bearer test-token', name)
    vm.$destroy()
  }
  await i18n.setPreference('zh-CN')
})

test('editor tooltips and picker text react without recreating editor content', async () => {
  await i18n.setPreference('zh-CN')
  const definition = component('Editor')
  const vm = new Vue({
    data: { content: '<p>User content</p>' },
    computed: { editorLocaleStyles: definition.computed.editorLocaleStyles },
  })
  assert.equal(vm.editorLocaleStyles['--editor-save'], '"保存"')
  await i18n.setPreference('en-US')
  await Vue.nextTick()
  assert.equal(vm.editorLocaleStyles['--editor-save'], '"Save"')
  assert.equal(vm.content, '<p>User content</p>')
  vm.$destroy()
  await i18n.setPreference('zh-CN')
})
