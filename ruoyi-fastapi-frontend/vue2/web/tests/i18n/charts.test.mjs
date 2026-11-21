import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const Vue = require('vue')
const { i18n } = require('./test-runtime.cjs')

function loadChart(name) {
  const source = readFileSync(
    new URL(`../../src/views/dashboard/${name}.vue`, import.meta.url),
    'utf8'
  ).match(/<script>([\s\S]*?)<\/script>/)[1]
  const script = source
    .replace(/^import .*\n/gm, '')
    .replace(/^require\(.*\n/gm, '')
    .replace('export default', 'return')
  return new Function('resize', script)({})
}

test('mounted charts refresh translated labels and preserve numeric series', async () => {
  for (const name of ['LineChart', 'RaddarChart', 'PieChart', 'BarChart']) {
    await i18n.setPreference('zh-CN')
    const options = []
    const definition = loadChart(name)
    const vm = new Vue({
      ...definition,
      propsData: { chartData: { expectedData: [1, 2], actualData: [3, 4] } },
    })
    vm.chart = { setOption: (option) => options.push(option), dispose() {} }
    if (name === 'LineChart') vm.setOptions(vm.chartData)
    else vm.setOptions()
    const initial = options.at(-1)
    await i18n.setPreference('en-US')
    await Vue.nextTick()
    assert.equal(options.length, 2, name)
    const translated = options.at(-1)
    const values = (option) =>
      option.series.map((series) =>
        series.data.map((entry) => (typeof entry === 'number' ? entry : entry.value))
      )
    assert.deepEqual(values(translated), values(initial), name)
    if (name === 'RaddarChart') {
      assert.equal(initial.radar.indicator[0].name, '销售')
      assert.equal(translated.radar.indicator[0].name, 'Sales')
    } else if (name === 'PieChart') {
      assert.equal(initial.series[0].name, '每周文章')
      assert.equal(translated.series[0].name, 'Weekly articles')
    } else {
      const axis = Array.isArray(translated.xAxis) ? translated.xAxis[0] : translated.xAxis
      assert.equal(axis.data[0], 'Mon')
      assert.notEqual(initial.series[0].name, translated.series[0].name)
    }
    vm.$destroy()
  }
  await i18n.setPreference('zh-CN')
})
