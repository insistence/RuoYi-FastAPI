import { t } from '@/i18n'
export function validateJson(value, valueType, validate) {
  try {
    if (validate) validate(value)
    else {
      const parsed = JSON.parse(value)
      if (valueType === 'array' && !Array.isArray(parsed))
        throw new Error(t('common:enterAJsonArray'))
      if (
        valueType === 'object' &&
        (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      )
        throw new Error(t('common:enterAJsonObject'))
    }
    return { valid: true }
  } catch (error) {
    return { valid: false, message: error.message }
  }
}
