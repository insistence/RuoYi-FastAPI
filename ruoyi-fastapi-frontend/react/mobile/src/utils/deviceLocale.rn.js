import { getLocales } from 'expo-localization'

/** 应用回到前台时重新读取系统语言，保留用户设置的优先顺序。 */
export function getDeviceLocales() {
  try {
    return getLocales()
      .map(({ languageTag }) => languageTag)
      .filter(Boolean)
  } catch {
    return []
  }
}
