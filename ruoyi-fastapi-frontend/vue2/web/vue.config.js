'use strict'
const fs = require('fs')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const webpack = require('webpack')

function resolve(dir) {
  return path.join(__dirname, dir)
}

function tryResolve(specifier) {
  try {
    return require.resolve(specifier)
  } catch {
    return null
  }
}

function resolveNodeModulesPackageRoot(pkgName) {
  const candidates = [
    path.join(__dirname, 'node_modules', pkgName),
    path.resolve(__dirname, '../node_modules', pkgName),
  ]
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    } catch {}
  }
  return null
}

function resolvePackageRoot(pkgName) {
  const entry = tryResolve(pkgName)
  if (!entry) {
    return null
  }
  return path.dirname(path.dirname(entry))
}

function setAliasIfResolved(alias, key, specifier) {
  const resolved = tryResolve(specifier)
  if (resolved) {
    alias[key] = resolved
  }
}

function setAliasIfExists(alias, key, filePath) {
  if (!filePath) {
    return
  }
  alias[key] = filePath
}

const markstreamVue2Root = resolvePackageRoot('markstream-vue2')
const terrastructD2Root = resolveNodeModulesPackageRoot('@terrastruct/d2')
const monacoEditorRoot = resolveNodeModulesPackageRoot('monaco-editor')
const shikiRoot = resolvePackageRoot('shiki')
const shikijsLangsRoot = resolvePackageRoot('@shikijs/langs')
const shikijsThemesRoot = resolvePackageRoot('@shikijs/themes')
const shikijsOnigurumaRoot = resolvePackageRoot('@shikijs/engine-oniguruma')

const markstreamAlias = {}
setAliasIfResolved(markstreamAlias, 'vue$', 'vue/dist/vue.runtime.esm.js')
setAliasIfExists(
  markstreamAlias,
  'markstream-vue2$',
  markstreamVue2Root ? path.join(markstreamVue2Root, 'dist/index.cjs') : null
)
setAliasIfExists(
  markstreamAlias,
  'markstream-vue2/index.css',
  markstreamVue2Root ? path.join(markstreamVue2Root, 'dist/index.css') : null
)
setAliasIfExists(
  markstreamAlias,
  'markstream-vue2/index.tailwind.css',
  markstreamVue2Root ? path.join(markstreamVue2Root, 'dist/index.tailwind.css') : null
)
setAliasIfExists(
  markstreamAlias,
  'markstream-vue2/workers/katexRenderer.worker',
  markstreamVue2Root ? path.join(markstreamVue2Root, 'dist/workers/katexRenderer.worker.js') : null
)
setAliasIfExists(
  markstreamAlias,
  'markstream-vue2/workers/mermaidParser.worker',
  markstreamVue2Root ? path.join(markstreamVue2Root, 'dist/workers/mermaidParser.worker.js') : null
)
setAliasIfExists(
  markstreamAlias,
  '@terrastruct/d2$',
  terrastructD2Root ? path.join(terrastructD2Root, 'dist/browser/index.js') : null
)
setAliasIfExists(markstreamAlias, 'monaco-editor', monacoEditorRoot)
setAliasIfExists(
  markstreamAlias,
  '@shikijs/langs',
  shikijsLangsRoot ? path.join(shikijsLangsRoot, 'dist') : null
)
setAliasIfExists(
  markstreamAlias,
  '@shikijs/themes',
  shikijsThemesRoot ? path.join(shikijsThemesRoot, 'dist') : null
)
setAliasIfExists(
  markstreamAlias,
  '@shikijs/engine-oniguruma',
  shikijsOnigurumaRoot ? path.join(shikijsOnigurumaRoot, 'dist') : null
)
setAliasIfExists(
  markstreamAlias,
  '@shikijs/engine-oniguruma$',
  shikijsOnigurumaRoot ? path.join(shikijsOnigurumaRoot, 'dist/index.mjs') : null
)
setAliasIfExists(
  markstreamAlias,
  '@shikijs/engine-oniguruma/wasm-inlined',
  shikijsOnigurumaRoot ? path.join(shikijsOnigurumaRoot, 'dist/wasm-inlined.mjs') : null
)
setAliasIfExists(
  markstreamAlias,
  '@shikijs/engine-oniguruma/wasm-inlined$',
  shikijsOnigurumaRoot ? path.join(shikijsOnigurumaRoot, 'dist/wasm-inlined.mjs') : null
)
setAliasIfExists(
  markstreamAlias,
  'shiki$',
  shikiRoot ? path.join(shikiRoot, 'dist/index.mjs') : null
)
setAliasIfExists(markstreamAlias, 'shiki', shikiRoot ? path.join(shikiRoot, 'dist') : null)
setAliasIfExists(
  markstreamAlias,
  'shiki/wasm',
  shikiRoot ? path.join(shikiRoot, 'dist/wasm.mjs') : null
)
setAliasIfResolved(
  markstreamAlias,
  '@antv/infographic/jsx-runtime',
  '@antv/infographic/jsx-runtime'
)
setAliasIfResolved(
  markstreamAlias,
  '@antv/infographic/jsx-dev-runtime',
  '@antv/infographic/jsx-dev-runtime'
)
setAliasIfResolved(
  markstreamAlias,
  'measury/fonts/AlibabaPuHuiTi-Regular',
  'measury/fonts/AlibabaPuHuiTi-Regular'
)

function createOptionalIgnoreRegex() {
  const alwaysIgnore = [
    'mermaid',
    '@mermaid-js/parser',
    'langium',
    '@antv/infographic',
    '@antv/hierarchy',
    'monaco-editor/esm/vs/language/css/monaco.contribution',
    'monaco-editor/esm/vs/language/html/monaco.contribution',
    'monaco-editor/esm/vs/language/json/monaco.contribution',
    'monaco-editor/esm/vs/language/typescript/monaco.contribution',
  ]
  const maybeIgnore = []
  if (!monacoEditorRoot) {
    maybeIgnore.push('monaco-editor')
  }
  if (!tryResolve('shiki')) {
    maybeIgnore.push('shiki')
  }
  if (!tryResolve('@shikijs/langs')) {
    maybeIgnore.push('@shikijs/langs')
  }
  if (!tryResolve('@shikijs/themes')) {
    maybeIgnore.push('@shikijs/themes')
  }
  const combined = [...alwaysIgnore, ...maybeIgnore]
  return new RegExp(`^(${combined.join('|')})$`)
}

function createMonacoAssetCopyPlugins() {
  if (!monacoEditorRoot) {
    return []
  }
  const from = path.join(monacoEditorRoot, 'esm/vs')
  if (!fs.existsSync(from)) {
    return []
  }
  return [
    new CopyWebpackPlugin({
      patterns: [
        { from, to: 'monaco/vs' },
        { from: path.join(monacoEditorRoot, 'min/vs'), to: 'monaco-json/vs' },
      ],
    }),
  ]
}

const CompressionPlugin = require('compression-webpack-plugin')

const name = process.env.VUE_APP_TITLE || 'RuoYi-FastAPI' // 网页标题

const port = process.env.port || process.env.npm_config_port || 80 // 端口

// 与浏览器通信桥使用同样的同源路径规则，拒绝外部 URL 和路径跳转。
const pluginBaseValue = process.env.VUE_APP_PLUGIN_BASE || ''
const pluginBase = pluginBaseValue === '/' ? '' : pluginBaseValue.replace(/\/$/, '')
if (pluginBase && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(pluginBase)) {
  throw new Error('插件部署路径无效')
}

// vue.config.js 配置说明
//官方vue.config.js 参考文档 https://cli.vuejs.org/zh/config/#css-loaderoptions
// 这里只列一部分，具体配置参考文档
module.exports = {
  // 部署生产环境和开发环境下的URL。
  // 默认情况下，Vue CLI 会假设你的应用是被部署在一个域名的根路径上
  // 例如 https://www.ruoyi.vip/。如果应用被部署在一个子路径上，你就需要用这个选项指定这个子路径。例如，如果你的应用被部署在 https://www.ruoyi.vip/admin/，则设置 baseUrl 为 /admin/。
  publicPath: process.env.NODE_ENV === 'production' ? '/' : '/',
  // pnpm run build 生成文件的目录名称（要和 baseUrl 的生产环境路径一致）（默认 dist）
  outputDir: 'dist',
  // 用于放置生成的静态资源 (js、css、img、fonts) 的；（项目打包之后，静态资源会放在这个文件夹下）
  assetsDir: 'static',
  // 如果你不需要生产环境的 source map，可以将其设置为 false 以加速生产环境构建。
  productionSourceMap: false,
  // Markdown/Monaco 依赖较大，限制并行转译，避免多目标 CI 构建耗尽内存。
  parallel: 2,
  transpileDependencies: [
    'quill',
    'markstream-vue2',
    'markstream-core',
    '@terrastruct/d2',
    'stream-markdown-parser',
    'stream-diffs',
    '@pierre/diffs',
    'monaco-editor',
    'shiki',
    '@shikijs/core',
    '@shikijs/engine-javascript',
    '@shikijs/engine-oniguruma',
    '@shikijs/types',
    '@shikijs/vscode-textmate',
    '@shikijs/langs',
    '@shikijs/themes',
    'oniguruma-to-es',
    '@antv/infographic',
  ],
  // webpack-dev-server 相关配置
  devServer: {
    host: '0.0.0.0',
    port: port,
    open: true,
    proxy: {
      [`${pluginBase}/apps/`]: {
        target: 'http://127.0.0.1:9099',
        changeOrigin: false,
        ws: true,
        // Uvicorn 会补回 root_path，转发时只剥离一次外部部署前缀。
        pathRewrite: (requestPath) => requestPath.slice(pluginBase.length),
        onProxyRes(upstream, _request, response) {
          const contentType = upstream.headers['content-type'] || ''
          if (contentType.split(';')[0].trim().toLowerCase() !== 'text/event-stream') return
          // 上游异常断开时结束下游，下游退出时也回收仍在读取的事件流。
          upstream.once('aborted', () => response.destroy())
          upstream.once('error', () => response.destroy())
          response.once('close', () => {
            if (!upstream.complete) upstream.destroy()
          })
        },
      },
      [`${pluginBase}/plugin/runtime/`]: {
        target: 'http://127.0.0.1:9099',
        changeOrigin: false,
        pathRewrite: (requestPath) => requestPath.slice(pluginBase.length),
      },
      // 认证协议与交互 API 使用 issuer 同源根路径。
      '/.well-known': { target: 'http://127.0.0.1:9099', changeOrigin: true },
      '/oauth2': { target: 'http://127.0.0.1:9099', changeOrigin: true },
      '/auth/interaction': { target: 'http://127.0.0.1:9099', changeOrigin: true },
      // detail: https://cli.vuejs.org/config/#devserver-proxy
      [process.env.VUE_APP_BASE_API]: {
        target: `http://127.0.0.1:9099`,
        changeOrigin: true,
        pathRewrite: {
          ['^' + process.env.VUE_APP_BASE_API]: '',
        },
      },
    },
    allowedHosts: 'all',
  },
  css: {
    loaderOptions: {
      sass: {
        sassOptions: { style: 'expanded' },
      },
      less: {
        // Ant Design Vue 1.x 的样式仍使用 Less 3 的无括号除法。
        lessOptions: { javascriptEnabled: true, math: 'always' },
      },
    },
  },
  configureWebpack: {
    name: name,
    resolve: {
      symlinks: false,
      fallback: {
        path: require.resolve('path-browserify'),
        url: require.resolve('url/'),
      },
      modules: ['node_modules', path.resolve(__dirname, '../node_modules')],
      alias: {
        '@': resolve('src'),
        ...markstreamAlias,
      },
    },
    plugins: [
      new webpack.IgnorePlugin({
        resourceRegExp: createOptionalIgnoreRegex(),
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'node_modules/mermaid/dist/mermaid.min.js'),
            to: 'mermaid/mermaid.min.js',
          },
          {
            from: path.resolve(__dirname, 'node_modules/katex/dist/katex.min.js'),
            to: 'katex/katex.min.js',
          },
          {
            from: path.resolve(__dirname, 'node_modules/katex/dist/contrib/mhchem.min.js'),
            to: 'katex/contrib/mhchem.min.js',
          },
        ],
      }),
      ...createMonacoAssetCopyPlugins(),
      // http://doc.ruoyi.vip/ruoyi-vue/other/faq.html#使用gzip解压缩静态文件
      new CompressionPlugin({
        test: /\.(js|css|html|jpe?g|png|gif|svg)?$/i, // 压缩文件格式
        filename: '[path][base].gz[query]', // 压缩后的文件名
        algorithm: 'gzip', // 使用gzip压缩
        // threshold: 10240,                           // 只有大于 10kb 的文件会被压缩
        minRatio: 0.8, // 压缩比例，小于 80% 的文件不会被压缩
        deleteOriginalAssets: false, // 压缩后删除原文件
      }),
    ],
  },
  chainWebpack(config) {
    config.plugins.delete('preload') // TODO: need test
    config.plugins.delete('prefetch') // TODO: need test

    // css-loader 6 需要显式启用 ICSS，才能向布局组件导出 Sass 的 :export 变量。
    config.module
      .rule('scss')
      .oneOf('normal')
      .use('css-loader')
      .tap((options) => ({
        ...options,
        modules: {
          auto: (resourcePath) => resourcePath === resolve('src/assets/styles/variables.scss'),
          mode: 'icss',
        },
      }))

    // set svg-sprite-loader
    config.module.rule('svg').exclude.add(resolve('src/assets/icons')).end()
    config.module
      .rule('icons')
      .test(/\.svg$/)
      .include.add(resolve('src/assets/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]',
      })
      .end()

    config.when(process.env.NODE_ENV !== 'development', (config) => {
      // 保持 runtime 为外部脚本，使认证页面可使用严格的 script-src 'self'。
      config.optimization.splitChunks({
        chunks: 'all',
        cacheGroups: {
          libs: {
            name: 'chunk-libs',
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            chunks: 'initial', // only package third parties that are initially dependent
          },
          elementUI: {
            name: 'chunk-elementUI', // split elementUI into a single package
            test: /[\\/]node_modules[\\/]_?element-ui(.*)/, // in order to adapt to cnpm
            priority: 20, // the weight needs to be larger than libs and app or it will be packaged into libs or app
          },
          commons: {
            name: 'chunk-commons',
            test: resolve('src/components'), // can customize your rules
            minChunks: 3, //  minimum common number
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      })
      config.optimization.runtimeChunk('single')
    })
  },
}
