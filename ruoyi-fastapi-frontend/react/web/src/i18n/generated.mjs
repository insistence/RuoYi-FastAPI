// 生成模块与宿主独立维护词库，只注册当前应用构建产物中的语言资源。
export function registerGeneratedResources(runtime, catalogs) {
  const enabled = new Set(runtime.registry.entries.map((entry) => entry.code))
  for (const [path, resource] of Object.entries(catalogs)) {
    const match = path.match(/\/locales\/([^/]+)\/(generated\.[^/]+)\.json$/)
    if (!match || !enabled.has(match[1])) continue
    runtime.engine.addResourceBundle(match[1], match[2], resource, true, true)
  }
}
