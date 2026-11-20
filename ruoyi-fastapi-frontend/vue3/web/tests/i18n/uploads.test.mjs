import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { computed, h, reactive, nextTick } from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { testLocale } from './localeFixture.mjs'

const state = reactive({ locale: testLocale.locale })
testLocale.engine.on('languageChanged', (locale) => {
  state.locale = locale
})
const t = (key, params) => {
  void state.locale
  return testLocale.t(key, params)
}
const source = readFileSync(new URL('../../src/utils/uploadHeaders.js', import.meta.url), 'utf8')
const getUploadHeaders = new Function(
  'i18n',
  'localeState',
  'getToken',
  source.replace(/^import .*$/gm, '').replace('export function', 'function') +
    '; return getUploadHeaders'
)(testLocale, state, () => 'token')

test('native upload components obtain fresh headers and leave in-flight snapshots unchanged', async () => {
  for (const name of ['Editor', 'ExcelImportDialog', 'FileUpload', 'ImageUpload']) {
    const source = readFileSync(
      new URL(`../../src/components/${name}/index.vue`, import.meta.url),
      'utf8'
    )
    // Compile the actual component as well as evaluating its header expression.
    const { descriptor } = parse(source)
    compileScript(descriptor, { id: name, inlineTemplate: true })
    const declaration = source.match(/const headers = (computed\(getUploadHeaders\))/)[1]
    const headers = new Function('computed', 'getUploadHeaders', `return ${declaration}`)(
      computed,
      getUploadHeaders
    )
    await testLocale.setPreference('zh-CN')
    const original = headers.value
    await testLocale.setPreference('en-US')
    await nextTick()
    assert.equal(headers.value['Accept-Language'], 'en-US', name)
    assert.equal(headers.value.Authorization, 'Bearer token', name)
    assert.equal(original['Accept-Language'], 'zh-CN', name)
  }
})

test('editor CSS text changes language without changing the document', async () => {
  const source = readFileSync(
    new URL('../../src/components/Editor/index.vue', import.meta.url),
    'utf8'
  )
  const expression = source.match(/const editorLocaleStyles = (computed\([\s\S]*?\n\}\)\))/)[1]
  const styles = new Function('computed', 't', `return ${expression}`)(computed, t)
  await testLocale.setPreference('zh-CN')
  assert.equal(styles.value['--editor-save'], '"保存"')
  await testLocale.setPreference('en-US')
  assert.equal(styles.value['--editor-save'], '"Save"')
  assert.equal(styles.value['--editor-heading1'], '"Heading 1"')
})

test('pasted editor images capture the language separately for each request', async () => {
  const source = readFileSync(
    new URL('../../src/components/Editor/index.vue', import.meta.url),
    'utf8'
  )
  const functionSource = source.slice(
    source.indexOf('function insertImage('),
    source.indexOf('</script>')
  )
  const sent = []
  const insertImage = new Function(
    'axios',
    'uploadUrl',
    'getUploadHeaders',
    'FormData',
    'handleUploadSuccess',
    `${functionSource}; return insertImage`
  )(
    {
      post: (_url, _data, options) => {
        sent.push(options.headers)
        return { then() {} }
      },
    },
    { value: '/common/upload' },
    getUploadHeaders,
    class {
      append() {}
    },
    () => {}
  )
  await testLocale.setPreference('zh-CN')
  insertImage({ name: 'first.png' })
  await testLocale.setPreference('en-US')
  insertImage({ name: 'second.png' })
  assert.equal(sent[0]['Accept-Language'], 'zh-CN')
  assert.equal(sent[1]['Accept-Language'], 'en-US')
})

test('import feedback is a text node and preserves literal markup and newlines', () => {
  const source = readFileSync(
    new URL('../../src/components/ExcelImportDialog/index.vue', import.meta.url),
    'utf8'
  )
  const handler = source.slice(
    source.indexOf('function handleSuccess('),
    source.indexOf('function handleSubmit(')
  )
  const text = 'Row 1: <b>example</b>\nRow 2'
  let message
  const bindings = {
    proxy: {
      $alert(node) {
        message = node
      },
    },
    h,
    t,
    visible: {},
    isUploading: {},
    selectedFile: {},
    uploadRef: {},
    emit() {},
  }
  const handleSuccess = new Function(...Object.keys(bindings), `${handler}; return handleSuccess`)(
    ...Object.values(bindings)
  )
  handleSuccess({ msg: text })
  assert.equal(message.type, 'div')
  assert.equal(message.children, text)
  assert.equal(message.props.innerHTML, undefined)
})

test('download errors retain server detail and have a translated string fallback', () => {
  const source = readFileSync(new URL('../../src/utils/errorCode.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace('export default errorCode', '')
    .replace('export function getResponseMessage', 'return function getResponseMessage')
  const getResponseMessage = new Function('t', source)(t)
  assert.equal(getResponseMessage({ code: 403, msg: 'Specific message' }), 'Specific message')
  assert.equal(typeof getResponseMessage({ code: 403 }), 'string')
  const fallback = getResponseMessage({ code: 999, msg: '  ' })
  assert.equal(typeof fallback, 'string')
  assert.ok(fallback.trim())
})
