import { getDicts } from '@/api/system/dict/data'
import { getToken } from '@/utils/auth'

const pending = new Map()

const useDictStore = defineStore('dict', {
  state: () => ({
    dict: new Array(),
    revision: 0,
  }),
  actions: {
    async loadDict(type) {
      const token = getToken()
      if (!token) return []
      const cached = this.getDict(type)
      if (cached) return cached
      const revision = this.revision
      const previous = pending.get(type)
      if (previous?.revision === revision && previous.token === token) return previous.promise
      const request = { revision, token }
      request.promise = getDicts(type)
        .then((response) => {
          if (this.revision !== revision || getToken() !== token) return null
          const rows = response.data.map((item) => ({
            originalLabel: item.dictLabel,
            label: item.dictLabel,
            labelI18n: item.dictLabelI18n || {},
            value: item.dictValue,
            elTagType: item.listClass,
            elTagClass: item.cssClass,
          }))
          this.setDict(type, rows)
          return rows
        })
        .finally(() => {
          if (pending.get(type) === request) pending.delete(type)
        })
      pending.set(type, request)
      return request.promise
    },
    // 获取字典
    getDict(_key) {
      if (_key == null && _key == '') {
        return null
      }
      try {
        for (let i = 0; i < this.dict.length; i++) {
          if (this.dict[i].key == _key) {
            return this.dict[i].value
          }
        }
      } catch (e) {
        return null
      }
    },
    // 设置字典
    setDict(_key, value) {
      if (_key !== null && _key !== '') {
        const index = this.dict.findIndex((item) => item.key === _key)
        if (index !== -1) this.dict.splice(index, 1)
        this.dict.push({
          key: _key,
          value: value,
        })
      }
    },
    // 删除字典
    removeDict(_key) {
      this.revision++
      var bln = false
      try {
        for (let i = 0; i < this.dict.length; i++) {
          if (this.dict[i].key == _key) {
            this.dict.splice(i, 1)
            return true
          }
        }
      } catch (e) {
        bln = false
      }
      return bln
    },
    // 清空字典
    cleanDict() {
      this.revision++
      this.dict = new Array()
    },
    // 初始字典
    initDict() {},
  },
})

export default useDictStore
