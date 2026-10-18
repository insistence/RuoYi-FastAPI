const path = require('path')
const { WeappTailwindcss } = require('weapp-tailwindcss/webpack')
const { cssMatcher: matchTailwindCss } = require('weapp-tailwindcss/defaults').getDefaultOptions()

/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
const config = {
  //....
  configureWebpack: {
    resolve: {
      alias: {
        'node-forge/lib/util': path.resolve(__dirname, 'src/vendor/node-forge/lib/util.js'),
        'node-forge/lib/random': path.resolve(__dirname, 'src/vendor/node-forge/lib/random.js'),
        'node-forge/lib/prng': path.resolve(__dirname, 'src/vendor/node-forge/lib/prng.js'),
        'node-forge/lib/rsa': path.resolve(__dirname, 'src/vendor/node-forge/lib/rsa.js'),
      },
    },
    plugins: [
      new (require('webpack').NormalModuleReplacementPlugin)(
        /node-forge[\\/]lib[\\/]util\.js$/,
        path.resolve(__dirname, 'src/vendor/node-forge/lib/util.js')
      ),
      new (require('webpack').NormalModuleReplacementPlugin)(
        /node-forge[\\/]lib[\\/]random\.js$/,
        path.resolve(__dirname, 'src/vendor/node-forge/lib/random.js')
      ),
      new (require('webpack').NormalModuleReplacementPlugin)(
        /node-forge[\\/]lib[\\/]prng\.js$/,
        path.resolve(__dirname, 'src/vendor/node-forge/lib/prng.js')
      ),
      new (require('webpack').NormalModuleReplacementPlugin)(
        /node-forge[\\/]lib[\\/]rsa\.js$/,
        path.resolve(__dirname, 'src/vendor/node-forge/lib/rsa.js')
      ),
      new WeappTailwindcss({
        tailwindcssBasedir: __dirname,
        cssEntries: [path.resolve(__dirname, 'src/app.css')],
        cssOptions: { rem2rpx: true },
        // uni-h5 的基础样式是直接复制的资源，不能被识别为 Tailwind 生成入口。
        cssMatcher: (file) =>
          !/^static[\\/]index\.[\da-f]+\.css$/.test(file) && matchTailwindCss(file),
      }),
    ],
  },
  chainWebpack: (config) => {
    // uni-app 的旧模板编译器同步调用 Prettier；Prettier 3 返回 Promise。
    // 仅关闭生成代码的美化，源码格式化仍使用项目的 Prettier。
    config.module
      .rule('vue')
      .use('vue-loader')
      .tap((options) => ({ ...options, prettify: false }))
    // 去除ts类型检测，因为uni-app ts type 支持其实不咋好
    config.plugins.delete('fork-ts-checker')
  },
  css: {
    loaderOptions: {
      scss: {
        sassOptions: {
          silenceDeprecations: ['import', 'legacy-js-api'],
        },
      },
    },
  },
  transpileDependencies: ['uview-ui', /@formatjs/],
  //....
}

module.exports = config
