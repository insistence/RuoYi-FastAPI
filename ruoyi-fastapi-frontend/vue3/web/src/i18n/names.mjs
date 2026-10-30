/** 只提交编辑过的译文，空值表示删除，未出现的语言保持不变。 */
export function updateTranslationPatch(patch, original, locale, value) {
  const next = { ...patch }
  if (value === (original?.[locale] || '')) delete next[locale]
  else next[locale] = value || null
  return next
}

/** 兼容旧缓存并保留业务键值，译文只影响显示标签。 */
export function localizeDictionary(items, resolveText) {
  return items.map((item) => ({
    ...item,
    label: resolveText(item.originalLabel ?? item.label, item.labelI18n),
  }))
}
