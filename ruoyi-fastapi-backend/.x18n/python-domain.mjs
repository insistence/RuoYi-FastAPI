// 官方 Scanner API：https://x18n.dev/raw/plugins/capabilities.md
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./scan_python_domains.py', import.meta.url))
function parse(sources) {
  const result = spawnSync(process.env.X18N_PYTHON || 'python', [script], {
    input: JSON.stringify(sources),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.error || result.status !== 0)
    throw new Error(`Python domain scan failed: ${result.error?.message || result.stderr}`)
  return JSON.parse(result.stdout)
}

function select(usages, domain, root) {
  for (const usage of usages) {
    if (usage.domain === 'core' || usage.domain === domain) continue
    const match = /^plugin\.([a-z][a-z0-9_-]{0,63})$/.exec(usage.domain)
    if (
      (domain && domain !== 'core') ||
      !match ||
      !existsSync(join(root, 'plugins', match[1], 'i18n/locale-meta.json'))
    )
      throw new Error(`Undeclared gettext domain: ${usage.domain}`)
  }
  return usages
    .filter((usage) => !domain || usage.domain === domain)
    .map(({ domain: namespace, ...usage }) => (domain ? usage : { ...usage, namespace }))
}

export default function pythonDomain(domain) {
  let root
  const scans = new Map()
  return {
    name: 'ruoyi-python-domains',
    enforce: 'post',
    async config(draft, { host, user }) {
      root = host.root
      // 保留预设中的其他文件类型；Python 调用通过 AST 分类，支持嵌套参数。
      draft.usage.regex = draft.usage.regex
        .map((rule) => ({
          ...rule,
          extensions: rule.extensions.filter((extension) => extension !== 'py'),
        }))
        .filter((rule) => rule.extensions.length)
      const include = user.usage?.include || draft.usage.include
      const ignore = [...draft.usage.exclude, ...(user.usage?.exclude || [])]
      const paths = (await host.glob(include, { ignore })).filter((path) => path.endsWith('.py'))
      const sources = await Promise.all(
        paths.map(async (path) => ({ path, text: await host.readFile(path) }))
      )
      const parsed = parse(sources)
      parsed.forEach((item, index) =>
        scans.set(item.path, {
          text: sources[index].text,
          usages: select(item.usages, domain, root),
        })
      )
    },
    scanners: [
      {
        id: 'ruoyi-python-domain-calls',
        extensions: ['py'],
        scan(file) {
          let result = scans.get(file.path)
          if (result?.text !== file.text) {
            result = { text: file.text, usages: select(parse([file])[0].usages, domain, root) }
            scans.set(file.path, result)
          }
          return { usages: result.usages }
        },
      },
    ],
  }
}
