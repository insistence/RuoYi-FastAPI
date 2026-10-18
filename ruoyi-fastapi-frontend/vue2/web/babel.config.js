module.exports = {
  presets: [
    // https://github.com/vuejs/vue-cli/tree/master/packages/@vue/babel-preset-app
    [
      '@vue/cli-plugin-babel/preset',
      {
        // 保留 ESM 供 webpack 解析，同时使旧 CommonJS 转换缓存失效。
        modules: false,
        // CLI 的类字段转换会同时处理依赖中的静态块和私有成员。
        // 两种浏览器构建都启用完整的类特性转换，避免现代 bundle 漏编译。
        include: [
          'transform-class-static-block',
          'transform-private-methods',
          'transform-private-property-in-object',
        ],
      },
    ],
  ],
  env: {
    development: {
      // 保留 import() 交给 webpack 5，避免 ESM 渲染依赖被转换成浏览器中的 require()。
      plugins: [['import', { libraryName: 'ant-design-vue', libraryDirectory: 'es', style: true }]],
    },
  },
}
