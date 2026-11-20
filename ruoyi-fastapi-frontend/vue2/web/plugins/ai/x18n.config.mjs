import { readFileSync } from 'node:fs'
import projectResources from '../../scripts/x18n-project.mjs'
const meta = JSON.parse(readFileSync(new URL('./locale-meta.json', import.meta.url), 'utf8'))
export default {
  name: 'plugin.ai',
  sourceLocale: meta.sourceLocale,
  locales: meta.locales.filter((entry) => entry.enabled).map((entry) => entry.code),
  presets: ['i18next'],
  plugins: [projectResources],
  resources: [{ pattern: 'locales/{locale}.json', namespace: 'plugin.ai' }],
  namespace: { separator: ':', default: 'plugin.ai' },
  usage: {
    include: ['views/**/*.{vue,jsx,js}', 'api/**/*.js'],
    calls: [{ callee: '$t' }, { callee: 'useI18n', factory: true, returns: ['t'] }],
  },
  checks: {
    'missing-translation': 'error',
    'empty-translation': 'error',
    'unused-key': 'warning',
    'hard-string': 'warning',
  },
}
