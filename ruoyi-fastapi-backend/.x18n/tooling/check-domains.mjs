import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const cli = fileURLToPath(new URL('./node_modules/@x18n/cli/bin.mjs', import.meta.url))
const scanner = fileURLToPath(new URL('../python-domain.mjs', import.meta.url))
let root = fileURLToPath(new URL('../../', import.meta.url))
const plugins = []
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index]
  const value = process.argv[++index]
  if (flag === '--root' && value) root = resolve(value)
  else if (flag === '--plugin' && value?.includes('=')) {
    const separator = value.indexOf('=')
    plugins.push({ id: value.slice(0, separator), root: resolve(value.slice(separator + 1)) })
  } else throw new Error('Usage: check-domains.mjs [--root BACKEND] [--plugin ID=ROOT ...]')
}

const independent = plugins.length > 0
if (!independent && existsSync(join(root, 'plugins'))) {
  for (const entry of readdirSync(join(root, 'plugins'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pluginRoot = join(root, 'plugins', entry.name)
    if (
      existsSync(join(pluginRoot, 'i18n/locale-meta.json')) ||
      existsSync(join(pluginRoot, 'i18n/catalogs'))
    )
      plugins.push({ id: entry.name, root: pluginRoot })
  }
}

function check(name, projectRoot, config) {
  const args = [cli, '--root', projectRoot, '--no-cache']
  if (config) args.push('--config', config)
  args.push('check', '--json')
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (!result.stdout) throw new Error(result.stderr || `${name}: x18n returned no report`)
  return { domain: name, status: result.status, report: JSON.parse(result.stdout) }
}

const directory = mkdtempSync(join(tmpdir(), 'ruoyi-domain-check-'))
try {
  const reports = independent ? [] : [check('core', root, join(root, '.x18n/core.mjs'))]
  for (const plugin of plugins) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(plugin.id)) throw new Error('Invalid plugin domain owner')
    const meta = JSON.parse(readFileSync(join(plugin.root, 'i18n/locale-meta.json'), 'utf8'))
    const locales = meta.locales.map((entry) => entry.code)
    if (
      !locales.length ||
      new Set(locales).size !== locales.length ||
      !locales.includes(meta.defaultLocale)
    )
      throw new Error(`Invalid domain locale registry: ${plugin.id}`)
    for (const code of locales)
      if (
        typeof code !== 'string' ||
        code.includes('/') ||
        code.includes('\\') ||
        code.includes('..')
      )
        throw new Error(`Invalid domain locale: ${plugin.id}`)
    const domain = `plugin.${plugin.id}`
    const config = join(directory, `${domain}.mjs`)
    // 配置只读引用原始资源，不复制词库或依赖宿主语言配置。
    writeFileSync(
      config,
      `import scanner from ${JSON.stringify(pathToFileURL(scanner).href)}\nexport default {
      name: ${JSON.stringify(domain)}, root: ${JSON.stringify(plugin.root)},
      sourceLocale: ${JSON.stringify(meta.sourceLocale || meta.defaultLocale)}, locales: ${JSON.stringify(locales)},
      presets: ['python-gettext'], plugins: [scanner(${JSON.stringify(domain)})],
      resources: [{ pattern: ${JSON.stringify(`i18n/catalogs/{locale}/LC_MESSAGES/${domain}.po`)} }],
      usage: { include: ['**/*.py'], exclude: ['tests/**', '.x18n/**', 'target/**'] },
      checks: { 'missing-translation': 'error', 'empty-translation': 'error', 'unused-key': 'warning' },
    }\n`
    )
    reports.push(check(domain, plugin.root, config))
  }
  console.log(JSON.stringify({ domains: reports }, null, 2))
  process.exitCode = reports.every((report) => report.status === 0) ? 0 : 1
} finally {
  if (dirname(directory) !== tmpdir()) throw new Error('Unexpected temporary check directory')
  rmSync(directory, { recursive: true, force: true })
}
