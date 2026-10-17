import AsyncStorage from '@react-native-async-storage/async-storage'

// RN only offers async storage. Hydrate before mounting pages, then serialize
// writes so logout cannot race a previous token/profile write.
const cache = new Map()
let writes = Promise.resolve()
export async function hydrateStorage() {
  const keys = await AsyncStorage.getAllKeys()
  const values = await AsyncStorage.multiGet(keys)
  for (const [key, value] of values) {
    try {
      cache.set(key, JSON.parse(value))
    } catch {
      /* Ignore stale data. */
    }
  }
}
export const getStorage = (key) => cache.get(key) ?? ''
function enqueue(write) {
  writes = writes.catch(() => {}).then(write)
  writes.catch((error) => console.error('本地存储写入失败', error))
  return writes
}
export function setStorage(key, value) {
  cache.set(key, value)
  return enqueue(() => AsyncStorage.setItem(key, JSON.stringify(value)))
}
export function removeStorage(key) {
  cache.delete(key)
  return enqueue(() => AsyncStorage.removeItem(key))
}
