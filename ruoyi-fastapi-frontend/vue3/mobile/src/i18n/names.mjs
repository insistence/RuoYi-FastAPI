/** 保留字典业务键值，译文只影响显示标签。 */
export function localizeDictionary(items, resolveText) {
  return items.map((item) => ({
    ...item,
    label: resolveText(item.originalLabel, item.labelI18n),
  }))
}
