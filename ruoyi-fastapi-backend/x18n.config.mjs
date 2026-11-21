import { existsSync, readdirSync, readFileSync } from 'node:fs'
import core from './.x18n/core.mjs'
import pythonDomain from './.x18n/python-domain.mjs'

const plugins = new URL('./plugins/', import.meta.url)
const coreLocales = new Set(
  readdirSync(new URL('./i18n/catalogs/', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
)
const resources = core.resources.map((resource) => ({ ...resource, namespace: 'core' }))
const checks = { ...core.checks }

if (existsSync(plugins)) {
  for (const entry of readdirSync(plugins, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-z][a-z0-9_-]{0,63}$/.test(entry.name)) continue
    const registry = new URL(`${entry.name}/i18n/locale-meta.json`, plugins)
    if (!existsSync(registry)) continue
    const domain = `plugin.${entry.name}`
    resources.push({
      pattern: `plugins/${entry.name}/i18n/catalogs/{locale}/LC_MESSAGES/${domain}.po`,
      namespace: domain,
    })
    // x18n 对整个项目使用同一组语言；仅当域的语言配置不同，交给 check-domains 分域检查。
    const meta = JSON.parse(readFileSync(registry, 'utf8'))
    if ((meta.sourceLocale || meta.defaultLocale) !== core.sourceLocale) {
      checks['missing-key'] = 'off'
      checks['missing-translation'] = 'off'
    } else if (
      meta.locales.length !== coreLocales.size ||
      meta.locales.some(({ code }) => !coreLocales.has(code))
    ) {
      checks['missing-translation'] = 'off'
    }
  }
}

export default {
  ...core,
  name: 'backend',
  root: '.',
  plugins: [pythonDomain()],
  namespace: { separator: ':', default: 'core' },
  resources,
  checks,
}
