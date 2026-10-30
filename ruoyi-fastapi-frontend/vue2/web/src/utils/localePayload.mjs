export function withLocalePatch(data) {
  const payload = { ...data }
  for (const field of ['menuNameI18n', 'dictNameI18n', 'dictLabelI18n']) {
    if (Object.prototype.hasOwnProperty.call(data, `${field}Patch`)) {
      payload[field] = data[`${field}Patch`]
    } else {
      delete payload[field]
    }
    delete payload[`${field}Patch`]
  }
  return payload
}
