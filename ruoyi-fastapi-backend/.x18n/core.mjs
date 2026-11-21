import pythonDomain from './python-domain.mjs'

// https://x18n.dev/raw/presets/python-gettext.md
// PO 的完整语义由 scripts/compile_i18n.py 校验并编译。
export default {
  name: 'core',
  root: '..',
  sourceLocale: 'zh-CN',
  presets: ['python-gettext'],
  plugins: [pythonDomain('core')],
  resources: [{ pattern: 'i18n/catalogs/{locale}/LC_MESSAGES/core/*.po' }],
  usage: {
    include: ['**/*.py'],
    // 这三个文件只生成前端源码，其中的 t() 由目标应用的 x18n 检查。
    exclude: [
      'tests/**',
      '.x18n/**',
      'target/**',
      'i18n/translator.py',
      'cli/runtime/plugin/scaffold/frontend.py',
      'cli/runtime/plugin/scaffold/frontend_vue2.py',
      'cli/runtime/plugin/scaffold/frontend_react.py',
    ],
  },
  checks: { 'missing-translation': 'error', 'empty-translation': 'error', 'unused-key': 'warning' },
}
