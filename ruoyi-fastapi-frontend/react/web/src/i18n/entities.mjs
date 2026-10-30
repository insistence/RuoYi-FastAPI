// 仅发送改动的翻译项，空值明确删除，未编辑的语言由服务端保留。
export function translationPatch(values = {}, original = {}) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([locale, value]) => value !== undefined && value !== original?.[locale])
      .map(([locale, value]) => [locale, value?.trim() || null])
  )
}

export function localizeOptions(options, resolveText, label = 'label', translations = 'labelI18n') {
  return (options || []).map((option) => ({
    ...option,
    label: resolveText(option[label], option[translations]),
    ...(option.children
      ? { children: localizeOptions(option.children, resolveText, label, translations) }
      : {}),
  }))
}
