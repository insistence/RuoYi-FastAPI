import { createInstance } from 'i18next'

// 菜单和字典原字段由后端数据协议固定为简体中文。
export const DATA_SOURCE_LOCALE = 'zh-CN'

function normalizeRevision(value) {
  return typeof value === 'string' &&
    /^(0|[1-9]\d{0,18})$/.test(value) &&
    (value.length < 19 || value <= '9223372036854775807')
    ? value
    : null
}

function compareRevision(left, right) {
  if (left === right) return 0
  if (right === null) return 1
  return left.length !== right.length ? left.length - right.length : left > right ? 1 : -1
}

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
  const languageFallbacks = meta.languageFallbacks || {}
  for (const [language, target] of Object.entries(languageFallbacks)) {
    if (!/^[a-z]{2,8}$/.test(language) || !byCode.has(target))
      throw new Error(`Invalid language fallback: ${language}`)
  }
  function match(value) {
    const code = normalizeLocale(value)
    return byCode.has(code) ? code : aliases.get(code) || languageFallbacks[code?.split('-')[0]]
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
    /**
     * 按目标语言、配置的回退语言和指定的原文语言生成查找顺序。
     *
     * @param {string} code 目标语言标识
     * @param {string} [sourceLocale] 原文语言，默认取当前应用的词库基准
     * @returns {string[]} 去重后的语言标识列表
     */
    chain(code, sourceLocale = meta.sourceLocale) {
      const result = []
      const append = (value) => {
        if (result.includes(value)) return
        result.push(value)
        for (const fallback of byCode.get(value)?.fallback || []) append(fallback)
      }
      append(code)
      append(sourceLocale)
      return result
    },
    get: (code) => byCode.get(code),
  }
}

/**
 * 创建当前应用独立的国际化实例，隔离账号和访客的语言偏好。
 *
 * @param {Object} options 当前应用的语言、存储和设备适配配置
 * @param {string} [options.appVersion] 记录缺词诊断时使用的应用版本
 * @returns {Object} 翻译、语言切换与偏好管理接口
 */
export function createLocaleRuntime({
  meta,
  resources,
  storage,
  scope,
  appVersion,
  deviceLocales = () => [],
  onChange = () => {},
}) {
  const registry = createLocaleRegistry(meta, resources)
  const engine = createInstance()
  let account = null
  let revision = null
  let generation = 0
  let preference = meta.defaultLocale
  let queue = Promise.resolve()
  const accountKey = `${scope}:locale:account`
  const guestKey = `${scope}:locale:v1:guest`
  const snapshotKey = () => `${scope}:locale:v2:user:${account}`
  const validPreference = (value) => (value === 'auto' ? value : normalizeLocale(value))
  function parseSnapshot(value) {
    const locale = validPreference(value?.locale)
    const version = normalizeRevision(value?.revision)
    return locale && version !== null ? { locale, revision: version } : null
  }
  function readSnapshot(raw) {
    try {
      return parseSnapshot(JSON.parse(raw))
    } catch {
      return null
    }
  }
  function requireSnapshot(value) {
    const snapshot = parseSnapshot(value)
    if (!snapshot) throw new Error('Invalid locale snapshot')
    return snapshot
  }
  const reportedMissingKeys = new Set()
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
    appendNamespaceToMissingKey: true,
    parseMissingKeyHandler(qualifiedKey, defaultValue, options) {
      const locale = options.lng || engine.language
      const warningKey = `${locale}:${qualifiedKey}`
      if (!reportedMissingKeys.has(warningKey)) {
        reportedMissingKeys.add(warningKey)
        const [namespace, key] = qualifiedKey.split(':')
        // 插值参数可能包含业务数据，诊断只记录词条位置和版本。
        console.warn('Missing translation', { namespace, key, locale, version: appVersion })
      }
      return (
        defaultValue ??
        engine.t('common:translationUnavailable', { lng: locale, defaultValue: '—' })
      )
    },
  })
  function applyPreference(value) {
    preference = value
    const code = registry.resolve(value, deviceLocales())
    engine.changeLanguage(code)
    onChange(code, registry.get(code))
    engine.emit('preferenceChanged', value)
  }
  function restore() {
    const snapshot = account === null ? null : readSnapshot(storage.get(snapshotKey()))
    revision = snapshot?.revision ?? null
    const value = account === null ? validPreference(storage.get(guestKey)) : snapshot?.locale
    applyPreference(value || meta.defaultLocale)
  }
  function acceptSnapshot(snapshot, persist = true) {
    // 先读取其他标签页可能已提交的更新，再比较本次回包的 revision。
    const stored = readSnapshot(storage.get(snapshotKey()))
    if (stored && compareRevision(stored.revision, revision) > 0) {
      revision = stored.revision
      applyPreference(stored.locale)
    }
    if (compareRevision(snapshot.revision, revision) <= 0) return
    revision = snapshot.revision
    if (persist) storage.set(snapshotKey(), JSON.stringify(snapshot))
    applyPreference(snapshot.locale)
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
    get preferenceRevision() {
      return revision
    },
    get headers() {
      return { 'Accept-Language': engine.language }
    },
    initialize(hasSession = false) {
      generation++
      const previous = hasSession ? storage.get(accountKey) : null
      account =
        previous === null || previous === undefined || previous === '' ? null : String(previous)
      restore()
    },
    /**
     * 切换账号并使旧账号尚未完成的语言切换失效。
     *
     * @param {string|number|null} id 当前账号标识，null 表示访客
     * @param {string} [value] 账号快照中的语言偏好
     * @param {string} [serverRevision] 账号快照的十进制版本号
     */
    setAccount(id, value, serverRevision) {
      if (id === undefined || id === '') throw new Error('Missing locale account')
      const next = id === null ? null : String(id)
      const snapshot =
        next === null ? null : requireSnapshot({ locale: value, revision: serverRevision })
      if (next !== account) {
        generation++
        revision = null
      }
      account = next
      storage.set(accountKey, account || '')
      if (snapshot) acceptSnapshot(snapshot)
      else restore()
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
      const run = async () => {
        if (generation !== epoch) throw new Error('Locale account changed')
        // 保存账号偏好前，先确认有效语言的资源已经加载。
        const code = registry.resolve(canonical, deviceLocales())
        if (!engine.hasResourceBundle(code, 'common')) throw new Error('Missing locale resources')
        if (account === null) {
          storage.set(guestKey, canonical)
          applyPreference(canonical)
          return
        }
        if (!save) throw new Error('A preference save callback is required')
        let saved
        let saveError
        try {
          saved = await save(canonical)
        } catch (error) {
          if (generation !== epoch || !readBack) throw error
          saveError = error
          saved = await readBack()
        }
        if (generation !== epoch) throw new Error('Locale account changed')
        const snapshot = requireSnapshot(saved)
        acceptSnapshot(snapshot)
        if (saveError && snapshot.locale !== canonical) throw saveError
      }
      const result = queue.then(run)
      queue = result.catch(() => {})
      return result
    },
    refreshDeviceLocale() {
      if (preference === 'auto') applyPreference(preference)
    },
    acceptStorageEvent(key, value) {
      if (account === null) {
        if (key === guestKey) {
          const locale = validPreference(value)
          if (locale) applyPreference(locale)
        }
        return
      }
      if (key !== snapshotKey()) return
      const snapshot = readSnapshot(value)
      if (!snapshot) return
      acceptSnapshot(snapshot, false)
      // 跨标签的并发写入可能乱序，离线快照始终保留已知的最新版本。
      const stored = readSnapshot(storage.get(snapshotKey()))
      if (!stored || compareRevision(revision, stored.revision) > 0) {
        storage.set(snapshotKey(), JSON.stringify({ locale: preference, revision }))
      }
    },
    /**
     * 根据当前语言选择菜单或字典译名，回退到数据库原字段。
     *
     * @param {string} original 数据库原名
     * @param {Object<string, string>} [translations] 按语言标识保存的译名
     * @returns {string} 当前界面使用的名称
     */
    resolveText(original, translations = {}) {
      for (const code of registry.chain(engine.language, DATA_SOURCE_LOCALE)) {
        if (code === DATA_SOURCE_LOCALE) return original
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
