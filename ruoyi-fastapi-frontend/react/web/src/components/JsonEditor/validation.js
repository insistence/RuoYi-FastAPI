export function validateJson(value, valueType, validate) {
  try {
    if (validate) validate(value)
    else {
      const parsed = JSON.parse(value)
      if (valueType === 'array' && !Array.isArray(parsed)) throw new Error('请输入 JSON 数组')
      if (
        valueType === 'object' &&
        (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      )
        throw new Error('请输入 JSON 对象')
    }
    return { valid: true }
  } catch (error) {
    return { valid: false, message: error.message }
  }
}
