import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@x18n/builtins/scanners/js'
import vue from '@x18n/builtins/scanners/vue'

const scanners = [...js().scanners, ...vue().scanners]
const context = {
  calls: [{ callee: ['t', '$t', 'i18n.t', 'engine.t', 'proxy.$t'] }],
  config: { extract: { ignoreCallees: [], attributes: [] } },
}

async function* sourceFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* sourceFiles(path)
    else if (entry.isFile()) yield path
  }
}

function messageAt(messages, key) {
  let value = messages
  for (const segment of key.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, segment)) {
      // 嵌套路径不存在时，兼容 i18next 的含点字面量键。
      return messages && Object.hasOwn(messages, key) ? messages[key] : undefined
    }
    value = value[segment]
  }
  return value
}

/**
 * 复用 x18n AST 扫描器，仅检查宿主 src 中直接使用 namespace:key 字面量的调用。
 * 跳过注释和字符串示例，不推断动态键或翻译别名。
 * 缺失键、插值和翻译覆盖率仍由 x18n 检查。
 */
export async function checkMessageShapes(root, resources) {
  const project = fileURLToPath(root)
  const errors = []
  for await (const path of sourceFiles(join(project, 'src'))) {
    const extension = extname(path).slice(1)
    const scanner = scanners.find((item) => item.extensions.includes(extension))
    if (!scanner) continue
    const text = await readFile(path, 'utf8')
    const { usages } = await scanner.scan({ path, text }, context)
    for (const usage of usages) {
      if (usage.kind !== 'call' || usage.dynamic !== false || !usage.expression) continue
      const separator = usage.raw.indexOf(':')
      if (separator <= 0 || separator === usage.raw.length - 1) continue
      const namespace = usage.raw.slice(0, separator)
      const key = usage.raw.slice(separator + 1)
      for (const [locale, namespaces] of Object.entries(resources)) {
        const value = messageAt(namespaces[namespace], key)
        if (value === null || typeof value !== 'object') continue
        const line = text.slice(0, usage.range.start).split('\n').length
        const file = relative(project, path).replaceAll('\\', '/')
        const shape = Array.isArray(value) ? 'array' : 'object'
        errors.push(
          `${file}:${line}: ${usage.raw} resolves to ${shape} in ${locale}; expected a string message`
        )
      }
    }
  }
  if (errors.length) throw new Error(`Invalid translation message shape:\n${errors.join('\n')}`)
}
