// https://x18n.dev/raw/guide/configuration.md
import { readFileSync } from 'node:fs'
import projectResources from './scripts/x18n-project.mjs'

const meta = JSON.parse(
  readFileSync(new URL('./src/i18n/locale-meta.json', import.meta.url), 'utf8')
)
export default {
  sourceLocale: meta.sourceLocale,
  locales: [
    ...new Set([
      meta.sourceLocale,
      ...meta.locales.filter((item) => item.enabled).map((item) => item.code),
    ]),
  ],
  presets: ['i18next'],
  plugins: [projectResources],
  resources: [
    { pattern: 'src/i18n/locales/{locale}/{namespace}.json' },
    { pattern: 'plugins/ai/locales/{locale}.json', namespace: 'plugin.ai' },
  ],
  namespace: { separator: ':', default: 'common' },
  usage: {
    include: ['src/**/*.{js,jsx,ts,tsx,vue,mjs}', 'plugins/ai/**/*.{js,vue}'],
    exclude: ['src/vendor/**', 'src/uni_modules/**', 'src/i18n/locales/**'],
    regex: [
      { extensions: ['js', 'vue'], patterns: [String.raw`\btitleKey\s*:\s*['"]([^'"]+)['"]`] },
    ],
    calls: [{ callee: '$t' }, { callee: 'useI18n', factory: true, returns: ['t'] }],
  },
  checks: {
    'missing-translation': 'error',
    'empty-translation': 'error',
    'unused-key': 'warning',
    'hard-string': 'warning',
  },
}
