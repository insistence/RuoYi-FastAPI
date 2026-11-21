import { localizeDictionary } from '@/i18n/names.mjs'
import { getToken } from '@/utils/auth'
import useDictStore from '@/store/modules/dict'
import { getDicts } from '@/api/system/dict/data'
import { computed, ref } from 'vue'
import { resolveText } from '@/i18n/adapter'

/**
 * 获取字典数据，缓存原始名称及译文，显示标签随语言切换。
 */
export function useDict(...types) {
  const result = {}
  types.forEach((type) => {
    const cached = useDictStore().getDict(type)
    const raw = ref(cached || [])
    result[type] = computed(() => localizeDictionary(raw.value, resolveText))
    if (!cached) {
      const token = getToken()
      getDicts(type).then((response) => {
        if (getToken() !== token) return
        raw.value = response.data.map((item) => ({
          originalLabel: item.dictLabel,
          label: item.dictLabel,
          labelI18n: item.dictLabelI18n || {},
          value: item.dictValue,
          elTagType: item.listClass,
          elTagClass: item.cssClass,
        }))
        useDictStore().removeDict(type)
        useDictStore().setDict(type, raw.value)
      })
    }
  })
  return result
}
