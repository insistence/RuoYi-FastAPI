import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { computed, reactive, watch, nextTick, effectScope } from 'vue'

const read = (path) =>
  readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8').replace(/^import .*$/gm, '')

test('dictionary invalidation updates held refs and rejects late requests across edits and logout', async () => {
  let token = 'account-one'
  const requests = []
  const getDicts = () => new Promise((resolve) => requests.push(resolve))
  const defineStore = (_id, definition) => () => {
    const state = reactive(definition.state())
    for (const [name, fn] of Object.entries(definition.actions)) state[name] = fn.bind(state)
    return state
  }
  const useStore = new Function(
    'getDicts',
    'getToken',
    'defineStore',
    read('store/modules/dict.js').replace('export default useDictStore', 'return useDictStore')
  )(getDicts, () => token, defineStore)
  const store = useStore()
  const useDict = new Function(
    'localizeDictionary',
    'useDictStore',
    'computed',
    'watch',
    'resolveText',
    read('utils/dict.js').replace('export function', 'function') + '; return useDict'
  )(
    (rows) => rows,
    () => store,
    computed,
    watch,
    (text) => text
  )
  const scope = effectScope()
  const held = scope.run(() => useDict('status')).status
  scope.run(() => useDict('status'))
  assert.equal(requests.length, 1, 'concurrent consumers share the pending request')
  store.removeDict('status')
  await nextTick()
  assert.equal(requests.length, 2)
  requests[1]({ data: [{ dictLabel: 'new', dictLabelI18n: { 'en-US': 'New' }, dictValue: '1' }] })
  await new Promise(setImmediate)
  assert.equal(held.value[0].originalLabel, 'new')
  requests[0]({ data: [{ dictLabel: 'old', dictLabelI18n: {}, dictValue: '1' }] })
  await new Promise(setImmediate)
  assert.equal(held.value[0].originalLabel, 'new', 'late response cannot replace refreshed data')
  store.removeDict('status')
  await nextTick()
  token = null
  store.cleanDict()
  await nextTick()
  requests[2]({ data: [{ dictLabel: 'previous account', dictValue: '1' }] })
  await new Promise(setImmediate)
  assert.deepEqual(held.value, [])
  assert.equal(requests.length, 3, 'logout does not refetch protected dictionaries')
  scope.stop()
})
