/** 注册当前应用构建产物中的生成模块词库。 */
export function registerGeneratedResources(runtime, modules) {
  for (const [path, messages] of Object.entries(modules)) {
    const match = path.match(/\/locales\/([^/]+)\/(generated\.[^/]+)\.json$/)
    if (!match) throw new Error(`Invalid generated locale resource: ${path}`)
    const [, locale, namespace] = match
    if (!runtime.registry.get(locale)) continue
    runtime.engine.addResourceBundle(locale, namespace, messages, true, true)
  }
}
