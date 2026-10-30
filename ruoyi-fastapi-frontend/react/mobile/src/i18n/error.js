import { useState } from 'react'
import { useI18n } from './adapter'

// 本地校验保留词条，切换语言时只更新已显示的错误；服务端正文保持原样。
export function useLocalizedError() {
  const { t } = useI18n()
  const [error, setError] = useState('')
  return [typeof error === 'function' ? error(t) : error, (next) => setError(() => next)]
}
