import { useCallback, useEffect, useState } from 'react'
import { useI18n } from './adapter'

export function useLocalizedFormErrors(...forms) {
  const { locale } = useI18n()
  useEffect(() => {
    for (const form of forms) {
      const names = form
        .getFieldsError()
        .filter((field) => field.errors.length)
        .map((field) => field.name)
      if (names.length) form.validateFields(names).catch(() => {})
    }
  }, [locale, ...forms])
}

// 弹窗标题和本地错误保留翻译函数，切换语言时更新文本而不重建页面状态。
export function useLocalizedText(initial = '') {
  const { t } = useI18n()
  const [value, setValue] = useState(() => initial)
  const update = useCallback((next) => setValue(() => next), [])
  return [typeof value === 'function' ? value(t) : value, update]
}
