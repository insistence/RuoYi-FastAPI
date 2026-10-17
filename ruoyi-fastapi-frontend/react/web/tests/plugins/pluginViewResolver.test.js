import assert from 'node:assert/strict'
import { resolvePluginViewPath } from '../../src/utils/pluginViewResolver.js'
assert.equal(resolvePluginViewPath('plugin/ai/chat/index'), '../../plugins/ai/views/chat/index.jsx')
assert.equal(
  resolvePluginViewPath('/plugin/bundle_demo/nested/view'),
  '../../plugins/bundle_demo/views/nested/view.jsx'
)
for (const value of [
  null,
  '',
  'plugin/../login',
  'plugin/ai/../login',
  'plugin/ai/chat.jsx',
  'plugin/a/index',
  'plugin/ai//index',
])
  assert.equal(resolvePluginViewPath(value), '')
