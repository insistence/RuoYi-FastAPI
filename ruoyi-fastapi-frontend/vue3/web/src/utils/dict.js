import { localizeDictionary } from '@/i18n/names.mjs'
import useDictStore from '@/store/modules/dict'
import { computed, watch } from 'vue'
import { resolveText } from '@/i18n/adapter'

/**
 * 保持现有组件对原始缓存的订阅，并在字典失效后重新获取数据。
 */
export function useDict(...types) {
  const store = useDictStore()
  const result = {}
  types.forEach((type) => {
    result[type] = computed(() => localizeDictionary(store.getDict(type) || [], resolveText))
    watch(
      () => store.revision,
      () => {
        // 请求层已统一提示网络错误。
        store.loadDict(type).catch(() => {})
      },
      { immediate: true }
    )
  })
  return result
}
