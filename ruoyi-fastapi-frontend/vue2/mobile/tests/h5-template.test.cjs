const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const Config = require('webpack-chain')
const Vue = require('vue')
const compiler = require('vue-template-compiler')
const { chainWebpack } = require('../vue.config')
const uniPluginRoot = path.dirname(require.resolve('@dcloudio/vue-cli-plugin-uni/package.json'))
const { compileTemplate } = require(
  path.join(uniPluginRoot, 'packages/@vue/component-compiler-utils/dist/compileTemplate.js')
)

test('H5 development templates compile and render with the project Prettier version', () => {
  const config = new Config()
  chainWebpack(config)
  const options = config.module.rule('vue').use('vue-loader').get('options') || {}
  const compiled = compileTemplate({
    ...options,
    source: '<view><text>{{ message }}</text></view>',
    filename: 'h5-startup-smoke.vue',
    compiler,
    isProduction: false,
  })

  assert.deepEqual(compiled.errors, [])
  assert.equal(typeof compiled.code, 'string', '模板编译必须同步生成 JavaScript，不能返回 Promise')
  const render = new Function(`${compiled.code}\nreturn render`)()
  const vnode = render.call(new Vue({ data: { message: 'H5 ready' } }))
  assert.equal(vnode.children[0].children[0].text, 'H5 ready')
})
