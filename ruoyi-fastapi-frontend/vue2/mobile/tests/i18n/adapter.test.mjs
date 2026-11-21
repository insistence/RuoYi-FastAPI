import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import Vue from 'vue'

export const i18n = { locale: 'zh-CN', preference: 'zh-CN', engine: new EventEmitter() }

test('the adapter tracks language changes without claiming the uni-app instance locale', async () => {
  const adapter = new URL('../../src/i18n/adapter.js', import.meta.url).href
  // 仅替换依赖 webpack 词库的入口，实际加载适配器和 Vue。
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === adapter) return { url: adapter, format: 'module', shortCircuit: true }
      return specifier === './index' && context.parentURL === adapter
        ? { url: import.meta.url, shortCircuit: true }
        : nextResolve(specifier, context)
    },
  })
  try {
    const { default: plugin, localeState } = await import(adapter)
    const App = Vue.extend({
      computed: { language: () => [localeState.locale, localeState.preference] },
    })
    App.use(plugin)
    const vm = new App()
    assert.equal('$locale' in vm, false)
    Object.defineProperty(vm, '$locale', { value: 'zh-Hans', writable: true })
    assert.deepEqual(vm.language, ['zh-CN', 'zh-CN'])

    vm.$locale = 'en'
    i18n.engine.emit('languageChanged', 'en-US')
    i18n.engine.emit('preferenceChanged', 'auto')
    assert.deepEqual(vm.language, ['en-US', 'auto'])
    assert.equal(vm.$locale, 'en')
  } finally {
    hook.deregister()
  }
})
