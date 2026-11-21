import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { parse, compileScript } from '@vue/compiler-sfc'
import { transform } from 'esbuild'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { testLocale } from './localeFixture.mjs'

const source = await readFile(
  new URL('../../src/components/LocalizedMessage/index.vue', import.meta.url),
  'utf8'
)
const { descriptor } = parse(source)
const compiled = compileScript(descriptor, { id: 'localized-message-test', inlineTemplate: true })
const { code } = await transform(compiled.content, { format: 'cjs' })
const module = { exports: {} }
new Function('require', 'module', 'exports', code)(
  createRequire(import.meta.url),
  module,
  module.exports
)
const LocalizedMessage = module.exports.default

function render(message) {
  return renderToString(
    createSSRApp({
      render: () =>
        h(
          LocalizedMessage,
          { message },
          {
            start: () => h('input', { value: 7 }),
            step: () => h('input', { value: 2 }),
          }
        ),
    })
  )
}

test('translated sentences reorder named input slots and preserve text escaping', async () => {
  const options = { start: '{start}', step: '{step}' }
  await testLocale.setPreference('zh-CN')
  const chinese = await render(testLocale.t('components:cron.every.days', options))
  await testLocale.setPreference('en-US')
  const english = await render(testLocale.t('components:cron.every.days', options))
  assert.ok(chinese.indexOf('value="7"') < chinese.indexOf('value="2"'))
  assert.ok(english.indexOf('value="2"') < english.indexOf('value="7"'))
  const escaped = await render('<img onerror="alert(1)"> {start} {unknown}')
  assert.ok(escaped.includes('&lt;img'))
  assert.ok(!escaped.includes('<img'))
  assert.ok(escaped.includes('{unknown}'))
})
