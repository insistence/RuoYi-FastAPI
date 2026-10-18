import uniPackage from '@dcloudio/vite-plugin-uni'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'
import postcssPlugins from './postcss.config.ts'

// 当前 uni 插件以 CommonJS 导出 default；ESM 配置需解开这一层。
const uni = (uniPackage as unknown as { default?: typeof uniPackage }).default || uniPackage

function patchNodeForgeMiniProgramRuntime() {
  return {
    name: 'patch-node-forge-mini-program-runtime',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (id.includes('node-forge/lib/util.js')) {
        return {
          code: code.replace(
            /return typeof self === 'undefined' \? window : self;/,
            "return typeof globalThis !== 'undefined' ? globalThis : (typeof self === 'undefined' ? (typeof window === 'undefined' ? {} : window) : self);"
          ),
          map: null,
        }
      }

      if (id.includes('node-forge/lib/random.js')) {
        return {
          code: code.replace(
            /var _crypto = globalScope\.crypto \|\| globalScope\.msCrypto;/,
            'var _crypto = (globalScope && (globalScope.crypto || globalScope.msCrypto)) || null;'
          ),
          map: null,
        }
      }

      return null
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(async () => {
  // 新版本的 unplugin-auto-import 改成了只有 esm 格式的产物，而 uni-app 目前必须 cjs 格式
  // 所以需要改成动态 import 的写法来进行引入
  // 详见 https://github.com/sonofmagic/uni-app-vite-vue3-tailwind-vscode-template/issues/29
  const { default: AutoImport } = await import('unplugin-auto-import/vite')
  return {
    // WeappTailwindcss 需要放在 uni 插件后面。
    plugins: [
      uni(),
      patchNodeForgeMiniProgramRuntime(),
      WeappTailwindcss({
        tailwindcssBasedir: fileURLToPath(new URL('.', import.meta.url)),
        cssEntries: [fileURLToPath(new URL('./src/app.css', import.meta.url))],
        cssOptions: { rem2rpx: true },
      }),
      AutoImport({
        imports: ['vue', 'uni-app', 'pinia'],
        dts: './src/auto-imports.d.ts',
      }),
    ],
    // Tailwind 由 WeappTailwindcss 生成，这里只保留其他 PostCSS 处理。
    css: {
      postcss: {
        plugins: postcssPlugins,
      },
      // https://vitejs.dev/config/shared-options.html#css-preprocessoroptions
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['legacy-js-api'],
        },
      },
    },
  }
})
