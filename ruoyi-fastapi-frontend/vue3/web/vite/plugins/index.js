import vue from '@vitejs/plugin-vue'
import monacoEditorEsmPlugin from 'vite-plugin-monaco-editor-esm'

import createAutoImport from './auto-import.js'
import createSvgIcon from './svg-icon.js'
import createCompression from './compression.js'
import createSetupExtend from './setup-extend.js'
import createMonacoEnvironment from './monaco-environment.js'

const monacoWorkers = [
  {
    label: 'editorWorkerService',
    entry: 'monaco-editor/esm/vs/editor/editor.worker.js',
  },
  {
    label: 'css',
    entry: 'monaco-editor/esm/vs/language/css/css.worker.js',
  },
  {
    label: 'html',
    entry: 'monaco-editor/esm/vs/language/html/html.worker.js',
  },
  {
    label: 'json',
    entry: 'monaco-editor/esm/vs/language/json/json.worker.js',
  },
  {
    label: 'typescript',
    entry: 'monaco-editor/esm/vs/language/typescript/ts.worker.js',
  },
]

export default function createVitePlugins(viteEnv, isBuild = false) {
  const vitePlugins = [vue()]
  vitePlugins.push(createAutoImport())
  vitePlugins.push(createSetupExtend())
  vitePlugins.push(
    monacoEditorEsmPlugin({
      languageWorkers: [],
      customWorkers: monacoWorkers,
    })
  )
  vitePlugins.push(createMonacoEnvironment())
  vitePlugins.push(createSvgIcon(isBuild))
  isBuild && vitePlugins.push(...createCompression(viteEnv))
  return vitePlugins
}
