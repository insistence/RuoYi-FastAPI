import { access, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocaleRegistry } from '../src/i18n/runtime.mjs'
import { checkMessageShapes } from './check-message-shapes.mjs'

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

/** 校验宿主与插件的语言注册表，以及宿主直接引用的消息类型。 */
export async function checkLocaleRegistration(root = new URL('../', import.meta.url)) {
  const meta = await readJson(new URL('src/i18n/locale-meta.json', root))
  const resources = {}
  for (const entry of meta.locales.filter((item) => item.enabled)) {
    const directory = new URL(`src/i18n/locales/${entry.code}/`, root)
    const files = (await readdir(directory)).filter((name) => name.endsWith('.json'))
    resources[entry.code] = {}
    for (const file of files) {
      resources[entry.code][file.slice(0, -5)] = await readJson(new URL(file, directory))
    }
    if (!Object.keys(resources[entry.code].common || {}).length) {
      throw new Error(`Empty common namespace: ${entry.code}`)
    }
  }
  createLocaleRegistry(meta, resources)
  await checkMessageShapes(root, resources)
  const projects = [{ name: 'host', locales: Object.keys(resources) }]
  for (const entry of await readdir(new URL('plugins/', root), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const directory = new URL(`plugins/${entry.name}/`, root)
    const metadata = new URL('locale-meta.json', directory)
    try {
      await access(metadata)
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    const pluginMeta = await readJson(metadata)
    const namespace = `plugin.${entry.name}`
    const bundles = {}
    for (const locale of pluginMeta.locales.filter((item) => item.enabled)) {
      const messages = await readJson(new URL(`locales/${locale.code}.json`, directory))
      if (!Object.keys(messages).length) {
        throw new Error(`Empty namespace: ${namespace}/${locale.code}`)
      }
      bundles[locale.code] = { [namespace]: messages }
    }
    createLocaleRegistry(pluginMeta, bundles)
    projects.push({ name: namespace, locales: Object.keys(bundles) })
  }
  return projects
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projects = await checkLocaleRegistration()
  for (const project of projects) {
    console.log(`Locale registration valid (${project.name}): ${project.locales.join(', ')}`)
  }
}
