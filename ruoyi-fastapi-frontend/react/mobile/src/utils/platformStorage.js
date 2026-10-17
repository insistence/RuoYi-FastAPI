import Taro from '@tarojs/taro'
export const getStorage = (key) => Taro.getStorageSync(key)
export const setStorage = (key, value) => Taro.setStorageSync(key, value)
export const removeStorage = (key) => Taro.removeStorageSync(key)
