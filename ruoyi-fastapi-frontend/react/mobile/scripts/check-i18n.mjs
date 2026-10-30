// 此处仅校验项目的语言注册约定，词条、占位符和翻译诊断交由 x18n。
import { readFile, readdir } from 'node:fs/promises'
import { createLocaleRegistry } from '../src/i18n/runtime.mjs'

const meta = JSON.parse(await readFile(new URL('../src/i18n/locale-meta.json', import.meta.url)))
const resources = {}
for (const entry of meta.locales.filter((item) => item.enabled)) {
  const directory = new URL(`../src/i18n/locales/${entry.code}/`, import.meta.url)
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json'))
  if (!files.length) throw new Error(`No resources: ${entry.code}`)
  resources[entry.code] = {}
  for (const file of files)
    resources[entry.code][file.slice(0, -5)] = JSON.parse(await readFile(new URL(file, directory)))
  if (!Object.keys(resources[entry.code].common || {}).length)
    throw new Error(`Empty common namespace: ${entry.code}`)
}
createLocaleRegistry(meta, resources)
console.log(`Locale registration valid: ${Object.keys(resources).join(', ')}`)
