import { getDicts } from '@/api/system/dict/data'
import { getToken } from '@/utils/auth'

const pending = new Map()

const state = {
  dict: new Array(),
  revision: 0,
}
const mutations = {
  SET_DICT: (state, { key, value }) => {
    if (key !== null && key !== '') {
      const index = state.dict.findIndex((item) => item.key === key)
      if (index !== -1) state.dict.splice(index, 1)
      state.dict.push({
        key: key,
        value: value,
      })
    }
  },
  REMOVE_DICT: (state, key) => {
    state.revision++
    try {
      for (let i = 0; i < state.dict.length; i++) {
        if (state.dict[i].key == key) {
          state.dict.splice(i, 1)
          return true
        }
      }
    } catch (e) {}
  },
  CLEAN_DICT: (state) => {
    state.revision++
    state.dict = new Array()
  },
}

const actions = {
  async loadDict({ state, commit }, type) {
    const token = getToken()
    if (!token) return []
    const cached = state.dict.find((item) => item.key === type)?.value
    if (cached) return cached
    const revision = state.revision
    const previous = pending.get(type)
    if (previous?.revision === revision && previous.token === token) return previous.promise
    const request = { revision, token }
    request.promise = getDicts(type)
      .then((response) => {
        if (state.revision !== revision || getToken() !== token) return null
        commit('SET_DICT', { key: type, value: response.data })
        return response.data
      })
      .finally(() => {
        if (pending.get(type) === request) pending.delete(type)
      })
    pending.set(type, request)
    return request.promise
  },
  // 设置字典
  setDict({ commit }, data) {
    commit('SET_DICT', data)
  },
  // 删除字典
  removeDict({ commit }, key) {
    commit('REMOVE_DICT', key)
  },
  // 清空字典
  cleanDict({ commit }) {
    commit('CLEAN_DICT')
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
}
