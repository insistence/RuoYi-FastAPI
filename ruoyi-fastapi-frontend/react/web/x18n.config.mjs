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
  presets: ['react-i18next'],
  plugins: [projectResources],
  resources: [
    { pattern: 'plugins/ai/locales/{locale}.json', namespace: 'plugin.ai' },
    { pattern: 'src/i18n/locales/{locale}/{namespace}.json' },
  ],
  namespace: { separator: ':', default: 'common' },
  usage: {
    include: ['src/**/*.{js,jsx,ts,tsx,vue,mjs}', 'plugins/ai/**/*.{js,jsx}'],
    exclude: ['src/vendor/**', 'src/uni_modules/**', 'src/i18n/locales/**'],
    regex: [
      {
        extensions: ['js', 'jsx'],
        patterns: [String.raw`\b(?:titleKey|messageKey)\s*:\s*['"]([^'"]+)['"]`],
      },
    ],
    calls: [
      { callee: 'translateMessage' },
      { callee: '$t' },
      { callee: 'useI18n', factory: true, returns: ['t'] },
    ],
  },
  checks: {
    'missing-translation': 'error',
    'empty-translation': 'error',
    'unused-key': 'warning',
    'hard-string': 'warning',
  },
}
