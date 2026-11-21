import { useEffect, useState, useSyncExternalStore } from 'react'
import { getDicts } from '@/api/system/dict/data'
import { useI18n } from '@/i18n/adapter'
// 字典结果和进行中的请求按类型共享，多个组件使用同一字典时复用请求。
const cache = new Map()
const pending = new Map()
let revision = 0
const listeners = new Set()
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
/** 清空字典缓存并通知订阅组件重新加载。 */
export function clearDictCache() {
  cache.clear()
  pending.clear()
  revision++
  listeners.forEach((listener) => listener())
}
/**
 * 获取一个或多个字典的数据，并随缓存失效自动刷新。
 * @param {...string} types 字典类型
 * @returns {Object<string, Array>} 以字典类型为键的选项列表，未加载时为空数组
 */
export function useDict(...types) {
  const { i18n } = useI18n()
  const key = types.join(',')
  const version = useSyncExternalStore(subscribe, () => revision)
  const [values, setValues] = useState({})
  useEffect(() => {
    let active = true
    for (const type of types) {
      if (cache.has(type)) {
        setValues((values) => ({ ...values, [type]: cache.get(type) }))
        continue
      }
      if (!pending.has(type))
        pending.set(
          type,
          getDicts(type)
            .then((result) => {
              const data = (result.data || []).map((item) => ({
                label: item.dictLabel,
                labelI18n: item.dictLabelI18n,
                value: item.dictValue,
                elTagType: item.listClass,
                elTagClass: item.cssClass,
              }))
              // 清空缓存前发出的请求不能回填到新一轮缓存中。
              if (version === revision) cache.set(type, data)
              return data
            })
            .finally(() => {
              if (version === revision) pending.delete(type)
            })
        )
      pending
        .get(type)
        .then((data) => {
          if (active) setValues((values) => ({ ...values, [type]: data }))
        })
        .catch(() => {})
    }
    return () => {
      // 组件卸载或订阅类型变化后，忽略旧请求的状态更新。
      active = false
    }
  }, [key, version])
  return Object.fromEntries(
    types.map((type) => [
      type,
      (values[type] || []).map((item) => ({
        ...item,
        label: i18n.resolveText(item.label, item.labelI18n),
      })),
    ])
  )
}
