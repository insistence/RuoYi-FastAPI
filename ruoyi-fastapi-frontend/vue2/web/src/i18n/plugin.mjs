import { createInstance } from 'i18next'
import { createLocaleRegistry } from './runtime.mjs'

// 插件仅跟随宿主的有效语言；资源、默认语言与回退链由插件独立声明。
export function createPluginLocaleRuntime({ host, meta, resources, namespace }) {
  const registry = createLocaleRegistry(meta, resources)
  const engine = createInstance()
  engine.init({
    resources: JSON.parse(JSON.stringify(resources)),
    lng: registry.resolve(host.locale),
    initAsync: false,
    defaultNS: namespace,
    ns: [namespace],
    load: 'currentOnly',
    supportedLngs: registry.entries.map((entry) => entry.code),
    fallbackLng: (code) => registry.chain(code).slice(1),
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
  })
  let registered = false
  const followHost = () => engine.changeLanguage(registry.resolve(host.locale))
  function registerPluginLocales() {
    for (const entry of registry.entries) {
      engine.removeResourceBundle(entry.code, namespace)
      engine.addResourceBundle(entry.code, namespace, resources[entry.code][namespace])
    }
    if (!registered) host.engine.on('languageChanged', followHost)
    registered = true
    followHost()
  }
  function removePluginLocales() {
    host.engine.off('languageChanged', followHost)
    registered = false
    for (const entry of registry.entries) engine.removeResourceBundle(entry.code, namespace)
  }
  registerPluginLocales()
  return {
    engine,
    registry,
    get locale() {
      return engine.language
    },
    t: (key, options) => engine.t(key, options),
    registerPluginLocales,
    removePluginLocales,
  }
}
