// https://x18n.dev/raw/guide/configuration.md
import { readFileSync } from 'node:fs'

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
  resources: [{ pattern: 'src/i18n/locales/{locale}/{namespace}.json' }],
  namespace: { separator: ':', default: 'common' },
  usage: {
    include: ['src/**/*.{js,jsx,ts,tsx,vue,mjs}'],
    exclude: ['src/vendor/**', 'src/uni_modules/**', 'src/i18n/locales/**'],
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
