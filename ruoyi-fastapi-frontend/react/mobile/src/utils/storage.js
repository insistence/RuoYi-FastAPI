import { getStorage, setStorage, removeStorage } from '@/utils/platformStorage'
import Taro from '@tarojs/taro'
import constant from './constant'

// 存储变量名
let storageKey = 'storage_data'

// 存储节点变量名
let storageNodeKeys = [
  constant.avatar,
  constant.id,
  constant.name,
  constant.roles,
  constant.permissions,
  constant.timezone,
]

const storage = {
  set: function (key, value) {
    if (storageNodeKeys.indexOf(key) != -1) {
      let tmp = getStorage(storageKey)
      tmp = tmp ? tmp : {}
      tmp[key] = value
      setStorage(storageKey, tmp)
    }
  },
  get: function (key) {
    let storageData = getStorage(storageKey) || {}
    return storageData[key] || ''
  },
  remove: function (key) {
    let storageData = getStorage(storageKey) || {}
    delete storageData[key]
    setStorage(storageKey, storageData)
  },
  clean: function () {
    removeStorage(storageKey)
  },
}

export default storage
