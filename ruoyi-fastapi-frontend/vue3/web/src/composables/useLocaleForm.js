import { watch } from 'vue'
import { useI18n } from '@/i18n/adapter'

/** 切换语言时只重新校验已经显示错误的字段，保留未校验字段和表单输入。 */
export function useLocaleForm(formRef) {
  const { locale } = useI18n()
  watch(
    locale,
    () => {
      for (const field of formRef.value?.fields || []) {
        if (field.validateState === 'error') {
          field.validate('').catch(() => {})
        }
      }
    },
    { flush: 'post' }
  )
}
