import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('../../src/i18n/navigation.js', import.meta.url), 'utf8')

test('native titles and tab labels follow the active page and language', () => {
  let locale = 'zh-CN'
  let route = 'pages/mine/setting/index'
  const calls = []
  const events = {}
  const uni = {
    setNavigationBarTitle(value) {
      calls.push(['title', value.title])
    },
    setTabBarItem(value) {
      calls.push(['tab', value.index, value.text])
    },
  }
  const module = new Function(
    't',
    'i18n',
    'uni',
    'getCurrentPages',
    source
      .replace(/^import .*\n/gm, '')
      .replace('export function', 'function')
      .replace('export default', 'const plugin =') + '\nreturn { refreshNavigation, plugin }'
  )(
    (key) => `${locale}:${key}`,
    {
      engine: {
        on(event, handler) {
          events[event] = handler
        },
      },
    },
    uni,
    () => [{ route }]
  )
  module.plugin.install({ nextTick: (fn) => fn(), mixin() {} })
  module.refreshNavigation()
  assert.equal(calls[0][1], 'zh-CN:mobile:settings.title')
  assert.equal(calls.filter((item) => item[0] === 'tab').length, 3)
  calls.length = 0
  locale = 'en-US'
  events.languageChanged()
  assert.equal(calls[0][1], 'en-US:mobile:settings.title')
  assert.equal(calls[1][2], 'en-US:mobile:nav.home')
  calls.length = 0
  route = 'pages/common/textview/index'
  module.refreshNavigation()
  assert.ok(
    calls.every((item) => item[0] === 'tab'),
    'custom content titles are preserved'
  )
})
