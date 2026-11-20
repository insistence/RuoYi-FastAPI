import Vue from 'vue'
import store from '@/store'
import DataDict from '@/utils/dict'

function install() {
  Vue.use(DataDict, {
    metas: {
      '*': {
        labelField: 'dictLabel',
        valueField: 'dictValue',
        request(dictMeta) {
          return store.dispatch('dict/loadDict', dictMeta.type)
        },
      },
    },
  })
}

export default { install }
