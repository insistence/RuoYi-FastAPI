import Taro from '@tarojs/taro'

/** 小程序和 H5 使用平台语言；RN 由同名平台文件读取原生语言列表。 */
export function getDeviceLocales() {
  try {
    return [Taro.getSystemInfoSync()?.language].filter(Boolean)
  } catch {
    return []
  }
}
