import { getStorage, setStorage, removeStorage } from '@/utils/platformStorage'
import Taro from '@tarojs/taro'
const TokenKey = 'App-Token'

export function getToken() {
  return getStorage(TokenKey)
}

export function setToken(token) {
  return setStorage(TokenKey, token)
}

export function removeToken() {
  return removeStorage(TokenKey)
}
