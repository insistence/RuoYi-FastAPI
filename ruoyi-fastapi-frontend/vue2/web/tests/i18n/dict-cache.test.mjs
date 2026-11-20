import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const Vue = require('vue')
const Vuex = require('vuex')
Vue.use(Vuex)
const read = (path) =>
  readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8').replace(/^import .*$/gm, '')

test('dictionary consumers retain their array and ignore late responses after invalidation or logout', async () => {
  let token = 'account-one'
  const requests = []
  const module = new Function(
    'getDicts',
    'getToken',
    read('store/modules/dict.js').replace('export default', 'return')
  )(
    () => new Promise((resolve) => requests.push(resolve)),
    () => token
  )
  const store = new Vuex.Store({ modules: { dict: module } })
  const DictData = new Function(
    'resolveText',
    read('utils/dict/DictData.js').replace('export default class', 'return class')
  )((text) => text)
  const DictMeta = {
    parse: (type) => ({
      type,
      request: () => store.dispatch('dict/loadDict', type),
      responseConverter: (rows) =>
        rows.map((row) => new DictData(row.dictLabel, row.dictValue, row)),
    }),
  }
  const Dict = new Function(
    'Vue',
    'mergeRecursive',
    'DictMeta',
    'DictData',
    read('utils/dict/Dict.js').replace('export default class Dict', 'class Dict') + ';return Dict'
  )(Vue, (_defaults, options) => options, DictMeta, DictData)
  const install = new Function(
    'Dict',
    'mergeOptions',
    read('utils/dict/index.js').replace('export default function', 'return function')
  )(Dict, () => {})
  const LocalVue = Vue.extend()
  install(LocalVue, {})
  const first = new LocalVue({ store, dicts: ['status'] })
  const second = new LocalVue({ store, dicts: ['status'] })
  const held = first.dict.type.status
  assert.equal(requests.length, 1)
  store.commit('dict/REMOVE_DICT', 'status')
  await Vue.nextTick()
  assert.equal(requests.length, 2)
  requests[1]({ data: [{ dictLabel: 'new', dictLabelI18n: { 'en-US': 'New' }, dictValue: '1' }] })
  await new Promise(setImmediate)
  assert.equal(held[0].label, 'new')
  assert.equal(second.dict.type.status[0].label, 'new')
  requests[0]({ data: [{ dictLabel: 'old', dictLabelI18n: {}, dictValue: '1' }] })
  await new Promise(setImmediate)
  assert.equal(held[0].label, 'new')
  assert.equal(first.dict.type.status, held, 'existing consumer references stay attached')
  store.commit('dict/REMOVE_DICT', 'status')
  await Vue.nextTick()
  token = null
  store.commit('dict/CLEAN_DICT')
  await Vue.nextTick()
  requests[2]({ data: [{ dictLabel: 'old account', dictValue: '1' }] })
  await new Promise(setImmediate)
  assert.equal(held.length, 0)
  assert.equal(requests.length, 3)
  first.$destroy()
  second.$destroy()
})
