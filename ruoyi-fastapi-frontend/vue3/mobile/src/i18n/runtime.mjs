import { createInstance } from 'i18next'

/**
 * 规范化语言标识，兼容使用下划线的设备语言。
 *
 * @param {string} value 原始语言标识
 * @returns {string|null} 规范化后的语言标识，无效时返回 null
 */
export function normalizeLocale(value) {
  if (typeof value !== 'string' || value.length > 63) return null
  value = value.trim().replace(/_/g, '-')
  if (/^x(?:-[a-z0-9]{1,8})+$/i.test(value)) return value.toLowerCase()
  try {
    return Intl.getCanonicalLocales(value.trim().replace(/_/g, '-'))[0] || null
  } catch {
    return null
  }
}

/**
 * 校验当前应用的语言注册表、资源和回退链。
 *
 * @param {Object} meta 当前应用的语言元数据
 * @param {Object} resources 按语言和命名空间组织的词库
 * @returns {Object} 语言匹配与回退查询接口
 */
export function createLocaleRegistry(meta, resources) {
  const entries = meta.locales.filter((item) => item.enabled)
  const byCode = new Map(entries.map((item) => [item.code, item]))
  for (const key of [meta.sourceLocale, meta.defaultLocale]) {
    if (!byCode.has(key)) throw new Error(`Unregistered locale: ${key}`)
  }
  const aliases = new Map()
  const visit = (code, path = []) => {
    if (path.includes(code)) throw new Error(`Locale fallback cycle: ${code}`)
    const entry = byCode.get(code)
    if (!entry || !resources[code]) throw new Error(`Missing locale resources: ${code}`)
    for (const fallback of entry.fallback || []) visit(fallback, [...path, code])
  }
  for (const entry of entries) {
    if (normalizeLocale(entry.code) !== entry.code)
      throw new Error(`Noncanonical locale: ${entry.code}`)
    visit(entry.code)
    for (const alias of entry.aliases || []) {
      const code = normalizeLocale(alias)
      if (!code || aliases.has(code)) throw new Error(`Conflicting locale alias: ${alias}`)
      aliases.set(code, entry.code)
    }
  }
  function match(value) {
    const code = normalizeLocale(value)
    return byCode.has(code) ? code : aliases.get(code)
  }
  return {
    entries,
    resolve(value, devices = []) {
      const candidates = value === 'auto' ? devices : [value]
      for (const candidate of candidates) {
        const code = match(candidate)
        if (code) return code
      }
      return meta.defaultLocale
    },
    chain(code) {
      const result = []
      const append = (value) => {
        if (result.includes(value)) return
        result.push(value)
        for (const fallback of byCode.get(value)?.fallback || []) append(fallback)
      }
      append(code)
      append(meta.sourceLocale)
      return result
    },
    get: (code) => byCode.get(code),
  }
}

/**
 * 创建当前应用独立的国际化实例，隔离账号和访客的语言偏好。
 *
 * @param {Object} options 当前应用的语言、存储和设备适配配置
 * @returns {Object} 翻译、语言切换与偏好管理接口
 */
export function createLocaleRuntime({
  meta,
  resources,
  storage,
  scope,
  deviceLocales = () => [],
  onChange = () => {},
}) {
  const registry = createLocaleRegistry(meta, resources)
  const engine = createInstance()
  let account = null
  let generation = 0
  let preference = meta.defaultLocale
  let queue = Promise.resolve()
  const storageKey = () => `${scope}:locale:v1:${account === null ? 'guest' : `user:${account}`}`
  const validPreference = (value) => (value === 'auto' ? value : normalizeLocale(value))
  engine.init({
    resources,
    lng: meta.defaultLocale,
    initAsync: false,
    defaultNS: 'common',
    ns: Object.keys(resources[meta.sourceLocale]),
    load: 'currentOnly',
    supportedLngs: registry.entries.map((item) => item.code),
    fallbackLng: (code) => registry.chain(code).slice(1),
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
  })
  function commit(value, persist = true) {
    preference = value
    const code = registry.resolve(value, deviceLocales())
    // 各端均同步打包当前语言及回退词库，切换时可直接取词。
    engine.changeLanguage(code)
    if (persist) storage.set(storageKey(), value)
    onChange(code, registry.get(code))
    engine.emit('preferenceChanged', value)
  }
  function restore() {
    commit(validPreference(storage.get(storageKey())) || meta.defaultLocale, false)
  }
  const runtime = {
    engine,
    registry,
    t: (key, options) => engine.t(key, options),
    get locale() {
      return engine.language
    },
    get preference() {
      return preference
    },
    get accountId() {
      return account
    },
    get headers() {
      return { 'Accept-Language': engine.language, 'X-I18n-Version': '1' }
    },
    initialize(hasSession = false) {
      const previous = hasSession ? storage.get(`${scope}:locale:account`) : null
      account =
        previous === null || previous === undefined || previous === '' ? null : String(previous)
      restore()
    },
    /**
     * 切换账号并使旧账号尚未完成的语言切换失效。
     *
     * @param {string|number|null} id 当前账号标识，null 表示访客
     * @param {string} value 服务端返回的语言偏好
     */
    setAccount(id, value = meta.defaultLocale) {
      generation++
      account = id === null || id === undefined ? null : String(id)
      storage.set(`${scope}:locale:account`, account || '')
      if (account === null) restore()
      else commit(validPreference(value) || meta.defaultLocale)
    },
    /**
     * 串行保存语言偏好，确认保存成功后再更新界面。
     *
     * @param {string} value 语言标识或 auto
     * @param {Object} callbacks 保存偏好与失败后回读的接口
     * @returns {Promise<void>} 语言切换结果
     */
    setPreference(value, { save, readBack } = {}) {
      const canonical = validPreference(value)
      if (!canonical) return Promise.reject(new Error('Invalid locale preference'))
      const epoch = generation
      const expectedAccount = account
      const run = async () => {
        if (generation !== epoch) throw new Error('Locale account changed')
        // 保存账号偏好前，先确认有效语言的资源已经加载。
        const code = registry.resolve(canonical, deviceLocales())
        if (!engine.hasResourceBundle(code, 'common')) throw new Error('Missing locale resources')
        if (expectedAccount !== null) {
          if (!save) throw new Error('A preference save callback is required')
          try {
            await save(canonical)
          } catch (error) {
            if (!readBack || (await readBack()) !== canonical) throw error
          }
        }
        if (generation !== epoch) throw new Error('Locale account changed')
        commit(canonical)
      }
      const result = queue.then(run)
      queue = result.catch(() => {})
      return result
    },
    refreshDeviceLocale() {
      if (preference === 'auto') commit(preference, false)
    },
    acceptStorageEvent(key, value) {
      const canonical = validPreference(value)
      if (key === storageKey() && canonical) commit(canonical, false)
    },
    resolveText(original, translations = {}) {
      for (const code of registry.chain(engine.language)) {
        if (code === meta.sourceLocale) return original
        if (typeof translations?.[code] === 'string' && translations[code])
          return translations[code]
      }
      return original
    },
    resolveRouteTitle(route) {
      const info = route?.meta || route || {}
      return info.titleKey && engine.exists(info.titleKey)
        ? engine.t(info.titleKey)
        : runtime.resolveText(info.title || '', info.titleI18n)
    },
  }
  return runtime
}
