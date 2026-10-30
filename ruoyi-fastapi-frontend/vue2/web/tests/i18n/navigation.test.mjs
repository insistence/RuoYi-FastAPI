import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { withLocalePatch } from '../../src/utils/localePayload.mjs'
import { restoreVisitedViews, serializeVisitedViews } from '../../src/utils/tagsView.js'
import { createLocaleRuntime } from '../../src/i18n/runtime.mjs'

const require = createRequire(import.meta.url)
const Vue = require('vue')
const VueRouter = require('vue-router')
Vue.use(VueRouter)
const meta = JSON.parse(readFileSync(new URL('../../src/i18n/locale-meta.json', import.meta.url)))
const i18n = createLocaleRuntime({
  meta,
  resources: {
    'zh-CN': { common: { title: '首页' } },
    'en-US': { common: { title: 'Home' } },
  },
  storage: { get: () => null, set() {} },
  scope: 'test',
  deviceLocales: () => ['zh-CN'],
})
const source = readFileSync(new URL('../../src/i18n/adapter.js', import.meta.url), 'utf8')
const adapter = new Function(
  'Vue',
  'i18n',
  source
    .replace(/^import .*\n/gm, '')
    .replace(/export const /g, 'const ')
    .replace('export default', 'const plugin =') +
    '\nreturn { t, resolveRouteTitle, resolveText, localeState, plugin }'
)(Vue, i18n)
Vue.use(adapter.plugin)

function router() {
  return new VueRouter({
    mode: 'abstract',
    routes: [
      {
        path: '/index',
        name: 'Index',
        component: {},
        meta: { title: '首页', titleKey: 'common:title', affix: true },
      },
      {
        path: '/menu/:id',
        name: 'Menu',
        component: {},
        meta: { title: '菜单', titleI18n: { 'en-US': '<b>Menu</b>' } },
      },
    ],
  })
}

test('route and dictionary labels react without changing the route, input or values', async () => {
  await i18n.setPreference('zh-CN')
  const route = router().resolve('/menu/7?tab=profile#details').route
  const dataSource = readFileSync(
    new URL('../../src/utils/dict/DictData.js', import.meta.url),
    'utf8'
  )
  const DictData = new Function(
    'resolveText',
    dataSource.replace(/^import .*\n/gm, '').replace('export default class', 'return class')
  )(adapter.resolveText)
  const option = new DictData('正常', '0', { dictLabelI18n: { 'en-US': 'Active' } })
  const vm = new Vue({
    data: { input: '未保存', option },
    computed: {
      title() {
        return adapter.resolveRouteTitle(route)
      },
      label() {
        return this.option.label
      },
    },
  })
  assert.equal(vm.title, '菜单')
  assert.equal(vm.label, '正常')
  await i18n.setPreference('en-US')
  await Vue.nextTick()
  assert.equal(vm.title, '<b>Menu</b>')
  assert.equal(vm.label, 'Active')
  assert.equal(option.value, '0')
  assert.equal(route.query.tab, 'profile')
  assert.equal(vm.input, '未保存')
  await i18n.setPreference('zh-CN')
  assert.equal(vm.label, '正常')
  vm.$destroy()
})

test('persisted tabs restore current metadata and explicit custom titles', () => {
  const instance = router()
  const original = instance.resolve('/menu/7?tab=profile#details').route
  const snapshot = serializeVisitedViews([
    instance.resolve('/index').route,
    { ...original, customTitle: 'User title' },
  ])
  assert.equal(snapshot.views.length, 1)
  assert.ok(!('title' in snapshot.views[0]) && !('meta' in snapshot.views[0]))
  const restored = restoreVisitedViews(snapshot, (location) => instance.resolve(location).route)
  assert.equal(restored[0].customTitle, 'User title')
  assert.equal(restored[0].params.id, '7')
  assert.equal(restored[0].hash, '#details')
  const legacy = restoreVisitedViews(
    [{ path: '/menu/1', title: '旧名称', meta: { title: '旧名称' } }, { path: '/removed' }, null],
    (location) => instance.resolve(location).route
  )
  assert.equal(legacy.length, 1)
  assert.equal(legacy[0].meta.titleI18n['en-US'], '<b>Menu</b>')
  assert.equal(legacy[0].customTitle, undefined)
})

test('locale patches preserve omitted languages and distinguish updates from deletion', () => {
  assert.deepEqual(
    withLocalePatch({ menuName: '菜单', menuNameI18n: { 'en-US': 'Old', ja: '旧' } }),
    { menuName: '菜单' }
  )
  assert.deepEqual(
    withLocalePatch({
      dictLabel: '正常',
      dictLabelI18n: { 'en-US': 'Active', ja: '有効' },
      dictLabelI18nPatch: { 'en-US': 'Enabled', ja: null },
    }),
    { dictLabel: '正常', dictLabelI18n: { 'en-US': 'Enabled', ja: null } }
  )
})

test('a locale change revalidates only fields already displaying errors', () => {
  const formSource = readFileSync(new URL('../../src/i18n/forms.js', import.meta.url), 'utf8')
  const plugin = new Function(formSource.replace('export default', 'return'))()
  let mixin
  plugin.install({
    mixin(value) {
      mixin = value
    },
  })
  const calls = []
  const form = {
    $options: { name: 'ElForm' },
    $nextTick: (fn) => fn(),
    fields: [
      { validateState: 'error', validate: (...args) => calls.push(args[0]) },
      { validateState: '', validate: () => assert.fail('untouched field validated') },
      { validateState: 'success', validate: () => assert.fail('valid field validated') },
    ],
  }
  mixin.watch['$locale.locale'].call(form)
  assert.deepEqual(calls, [''])
})
