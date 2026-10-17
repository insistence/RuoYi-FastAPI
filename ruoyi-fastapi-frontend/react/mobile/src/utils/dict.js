import { useEffect } from 'react'
import useDictStore from '@/store/modules/dict'
import { getDicts } from '@/api/system/dict/data'
const pending = new Map()
export function useDict(...types) {
  const dictionary = useDictStore((state) => state.dict)
  const key = types.join('|')
  useEffect(() => {
    for (const type of types)
      if (!useDictStore.getState().dict[type] && !pending.has(type)) {
        const request = getDicts(type)
          .then((result) =>
            useDictStore.getState().setDict(
              type,
              (result.data || []).map((item) => ({
                label: item.dictLabel,
                value: item.dictValue,
                listClass: item.listClass,
                cssClass: item.cssClass,
              }))
            )
          )
          .catch(() => {})
          .finally(() => pending.delete(type))
        pending.set(type, request)
      }
  }, [key])
  return Object.fromEntries(types.map((type) => [type, dictionary[type] || []]))
}
